import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sgMail from '@sendgrid/mail';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';

// ---------------------------------------------------------------------------
// Notification type enum
// ---------------------------------------------------------------------------

export enum NotificationType {
  // Project / Bid
  BID_RECEIVED          = 'BID_RECEIVED',
  BID_ACCEPTED          = 'BID_ACCEPTED',
  BID_REJECTED          = 'BID_REJECTED',
  BID_WITHDRAWN         = 'BID_WITHDRAWN',
  PROJECT_CREATED       = 'PROJECT_CREATED',
  PROJECT_UPDATED       = 'PROJECT_UPDATED',
  PROJECT_COMPLETED     = 'PROJECT_COMPLETED',
  PROJECT_CANCELLED     = 'PROJECT_CANCELLED',

  // Contract
  CONTRACT_STARTED      = 'CONTRACT_STARTED',
  CONTRACT_COMPLETED    = 'CONTRACT_COMPLETED',
  CONTRACT_CANCELLED    = 'CONTRACT_CANCELLED',
  CONTRACT_DISPUTED     = 'CONTRACT_DISPUTED',

  // Milestone / Payment
  MILESTONE_SUBMITTED   = 'MILESTONE_SUBMITTED',
  MILESTONE_APPROVED    = 'MILESTONE_APPROVED',
  MILESTONE_REVISION    = 'MILESTONE_REVISION',
  PAYMENT_RECEIVED      = 'PAYMENT_RECEIVED',
  PAYMENT_FAILED        = 'PAYMENT_FAILED',
  WITHDRAWAL_COMPLETED  = 'WITHDRAWAL_COMPLETED',

  // Chat
  NEW_MESSAGE           = 'NEW_MESSAGE',

  // Account
  EMAIL_VERIFIED        = 'EMAIL_VERIFIED',
  PROFILE_REVIEWED      = 'PROFILE_REVIEWED',
  ACCOUNT_SUSPENDED     = 'ACCOUNT_SUSPENDED',

  // System
  SYSTEM_ANNOUNCEMENT   = 'SYSTEM_ANNOUNCEMENT',
  REVIEW_RECEIVED       = 'REVIEW_RECEIVED',
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface CreateNotificationOptions {
  userId:    string;
  type:      NotificationType | string;
  title:     string;
  body:      string;
  data?:     Record<string, any>;
  sendEmail?: boolean;
  emailTo?:   string;
  emailSubject?: string;
  emailTemplateId?: string;
  emailTemplateData?: Record<string, any>;
  /** If true the notification is considered low-priority and no real-time event is emitted */
  silent?: boolean;
}

export interface PaginationQuery {
  page?:    number;
  limit?:   number;
  unreadOnly?: boolean;
  type?:    string;
}

export interface PaginatedResult<T> {
  items:      T[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}

export interface EmailOptions {
  to:           string;
  subject:      string;
  templateId?:  string;
  templateData?: Record<string, any>;
  html?:        string;
  text?:        string;
}

// ---------------------------------------------------------------------------
// Redis key helpers
// ---------------------------------------------------------------------------

const unreadKey = (userId: string) => `notif:unread:${userId}`;

// ---------------------------------------------------------------------------
// NotificationService
// ---------------------------------------------------------------------------

/**
 * NotificationService
 *
 * Single entry-point for creating and managing notifications on the platform.
 *
 * Delivery channels
 * ─────────────────
 * 1. **In-app (real-time)** — emits a `notification:new` Socket.IO event to the
 *    user's personal room via `NotificationGateway.emitToUser()`.
 *
 * 2. **In-app (persisted)** — every notification is written to the `Notification`
 *    table in Prisma so users can view their history even after going offline.
 *
 * 3. **Email** — when `sendEmail: true` is passed (or when the notification type
 *    is configured as "always email"), a transactional email is sent via
 *    SendGrid.  Both dynamic templates (templateId) and raw HTML are supported.
 *
 * Usage from other modules
 * ────────────────────────
 * ```typescript
 * // In PaymentService after a milestone is approved:
 * await this.notificationService.createNotification({
 *   userId:   freelancerId,
 *   type:     NotificationType.PAYMENT_RECEIVED,
 *   title:    'Payment received',
 *   body:     `$${netAmount} has been transferred to your account.`,
 *   data:     { milestoneId, contractId, amount: netAmount },
 *   sendEmail: true,
 *   emailTo:   freelancerEmail,
 *   emailSubject: 'You have received a payment!',
 * });
 * ```
 *
 * Circular dependency note
 * ────────────────────────
 * NotificationService depends on NotificationGateway for real-time delivery.
 * To break the circular dependency (NotificationModule → ChatModule → …),
 * NotificationGateway is injected via `forwardRef` in the module and typed
 * with a lazy getter here.  If you ever move to a message-bus pattern (Kafka /
 * Redis Pub/Sub) this coupling disappears entirely.
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  /**
   * Lazy reference to NotificationGateway — injected after module init to
   * break the potential circular dependency with other modules.
   * Set via `setGateway()` called from NotificationModule.
   */
  private gateway: any | null = null;

  /** Notification types that always trigger an email regardless of caller config. */
  private readonly ALWAYS_EMAIL_TYPES: Set<string> = new Set([
    NotificationType.CONTRACT_STARTED,
    NotificationType.PAYMENT_RECEIVED,
    NotificationType.PAYMENT_FAILED,
    NotificationType.ACCOUNT_SUSPENDED,
  ]);

  constructor(
    private readonly prisma:        PrismaService,
    private readonly configService: ConfigService,
    private readonly redisService:  RedisService,
  ) {
    const sendgridKey = this.configService.get<string>('SENDGRID_API_KEY');
    if (sendgridKey) {
      sgMail.setApiKey(sendgridKey);
      this.logger.log('SendGrid API key configured.');
    } else {
      this.logger.warn(
        'SENDGRID_API_KEY is not set — email notifications will be silently skipped.',
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Gateway injection (called by NotificationModule after initialisation)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Sets the NotificationGateway reference after the module is fully initialised.
   * This avoids circular-dependency issues at module construction time.
   *
   * Called automatically by NotificationModule in its `onModuleInit()` hook
   * (or directly injected if you prefer the `forwardRef` pattern).
   */
  setGateway(gateway: any): void {
    this.gateway = gateway;
    this.logger.debug('NotificationGateway reference registered in NotificationService.');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // createNotification
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Creates a new notification for a user.
   *
   * Steps:
   *   1. Persist the notification to the database.
   *   2. Increment the Redis unread counter for the user.
   *   3. Emit `notification:new` via Socket.IO (unless `silent: true`).
   *   4. Send a transactional email if `sendEmail: true` or the type is in
   *      the ALWAYS_EMAIL_TYPES set.
   *
   * All steps after #1 are non-blocking (failures are logged, not thrown)
   * so a Redis outage or SendGrid error never causes a transaction rollback.
   *
   * @param options  Notification creation options.
   * @returns The persisted Notification record.
   */
  async createNotification(options: CreateNotificationOptions): Promise<any> {
    const {
      userId,
      type,
      title,
      body,
      data         = {},
      sendEmail    = false,
      emailTo,
      emailSubject,
      emailTemplateId,
      emailTemplateData,
      silent       = false,
    } = options;

    // ── 1. Persist to database ────────────────────────────────────────────────
    let notification: any;

    try {
      notification = await (this.prisma as any).notification.create({
        data: {
          userId,
          type,
          title,
          body,
          data:   data ?? {},
          isRead: false,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to persist notification for userId=${userId} type=${type}: ${err?.message}`,
        err?.stack,
      );
      throw new InternalServerErrorException(
        'Failed to create notification. Please try again.',
      );
    }

    // ── 2. Increment Redis unread counter (non-blocking) ──────────────────────
    this.redisService
      .incr(unreadKey(userId))
      .then((newCount) => {
        // ── 3. Emit real-time event via Socket.IO ─────────────────────────────
        if (!silent && this.gateway) {
          this.gateway.emitToUser(userId, 'notification:new', {
            notification,
          });
          this.gateway.emitToUser(userId, 'unread-count', { count: newCount });
        }
      })
      .catch((err) => {
        this.logger.warn(
          `Redis unread increment failed for userId=${userId}: ${err?.message}`,
        );

        // Still emit the notification even if Redis failed
        if (!silent && this.gateway) {
          this.gateway.emitToUser(userId, 'notification:new', { notification });
        }
      });

    // ── 4. Send email (non-blocking) ──────────────────────────────────────────
    const shouldEmail =
      sendEmail || this.ALWAYS_EMAIL_TYPES.has(type as string);

    if (shouldEmail && emailTo) {
      this.sendEmailNotification({
        to:           emailTo,
        subject:      emailSubject ?? title,
        templateId:   emailTemplateId,
        templateData: emailTemplateData ?? { title, body, ...(data ?? {}) },
        html:         emailTemplateId
          ? undefined
          : this.buildDefaultEmailHtml(title, body, data),
      }).catch((err) => {
        this.logger.warn(
          `Email notification failed for userId=${userId} type=${type}: ${err?.message}`,
        );
      });
    }

    this.logger.log(
      `Notification created: id=${notification.id} | userId=${userId} | type=${type}`,
    );

    return notification;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // sendEmailNotification
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Sends a transactional email via SendGrid.
   *
   * Supports two modes:
   *   1. **Dynamic template** — provide `templateId` + `templateData`.
   *      The data is passed to the SendGrid template engine for rendering.
   *   2. **Raw HTML** — provide `html` (and optionally `text` for plain-text
   *      fallback).  Used when no SendGrid template exists for the notification.
   *
   * If `SENDGRID_API_KEY` is not configured, the call is silently skipped
   * with a warning log — useful during local development.
   *
   * @param options  Email delivery options.
   */
  async sendEmailNotification(options: EmailOptions): Promise<void> {
    const sendgridKey = this.configService.get<string>('SENDGRID_API_KEY');

    if (!sendgridKey) {
      this.logger.warn(
        `Skipping email to ${options.to} — SENDGRID_API_KEY is not configured.`,
      );
      return;
    }

    const fromEmail = this.configService.get<string>(
      'SENDGRID_FROM_EMAIL',
      'noreply@freelancerplatform.com',
    );
    const fromName = this.configService.get<string>(
      'SENDGRID_FROM_NAME',
      'Freelancer Platform',
    );

    try {
      if (options.templateId) {
        // ── Dynamic template mode ─────────────────────────────────────────────
        await sgMail.send({
          to:   options.to,
          from: { email: fromEmail, name: fromName },
          templateId: options.templateId,
          dynamicTemplateData: {
            subject:      options.subject,
            frontendUrl:  this.configService.get('FRONTEND_URL', 'http://localhost:3000'),
            platformName: 'Freelancer Platform',
            ...(options.templateData ?? {}),
          },
        });
      } else {
        // ── Raw HTML mode ─────────────────────────────────────────────────────
        await sgMail.send({
          to:      options.to,
          from:    { email: fromEmail, name: fromName },
          subject: options.subject,
          html:    options.html ?? `<p>${options.subject}</p>`,
          text:    options.text,
        });
      }

      this.logger.log(
        `Email sent to ${options.to} | subject: "${options.subject}"`,
      );
    } catch (err) {
      // Log the full SendGrid error response body for easier debugging
      const detail = (err as any)?.response?.body ?? err?.message ?? err;
      this.logger.error(
        `SendGrid failed for ${options.to} | subject: "${options.subject}" | error: ${JSON.stringify(detail)}`,
        (err as Error)?.stack,
      );
      // Re-throw so callers can decide whether to retry
      throw err;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // getUserNotifications
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Returns a paginated list of notifications for the specified user.
   *
   * Results are ordered by `createdAt` descending (newest first).
   * Supports optional filtering by unread-only and by notification type.
   *
   * @param userId  UUID of the user whose notifications to retrieve.
   * @param query   Pagination + filter options.
   */
  async getUserNotifications(
    userId: string,
    query:  PaginationQuery = {},
  ): Promise<PaginatedResult<any>> {
    const {
      page       = 1,
      limit      = 20,
      unreadOnly = false,
      type,
    } = query;

    const safePage  = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const skip      = (safePage - 1) * safeLimit;

    // ── Build where clause ────────────────────────────────────────────────────
    const where: any = { userId };

    if (unreadOnly) {
      where.isRead = false;
    }

    if (type) {
      where.type = type;
    }

    // ── Execute paginated query in parallel ───────────────────────────────────
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take:    safeLimit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      items,
      total,
      page:       safePage,
      limit:      safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // markAsRead
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Marks a single notification as read.
   *
   * Steps:
   *   1. Verify the notification exists and belongs to the requesting user.
   *   2. If already read, return early (idempotent).
   *   3. Update `isRead = true` and `readAt = now` in the database.
   *   4. Decrement the Redis unread counter (floor at 0).
   *   5. Emit `notification:read` + updated `unread-count` via Socket.IO.
   *
   * @param notificationId  UUID of the notification to mark as read.
   * @param userId          UUID of the authenticated user (for ownership check).
   */
  async markAsRead(notificationId: string, userId: string): Promise<any> {
    // ── 1. Fetch notification ─────────────────────────────────────────────────
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException(
        `Notification with ID "${notificationId}" was not found.`,
      );
    }

    // ── 2. Ownership check ────────────────────────────────────────────────────
    if ((notification as any).userId !== userId) {
      throw new ForbiddenException(
        'You are not authorized to mark this notification as read.',
      );
    }

    // ── 3. Idempotency — already read ─────────────────────────────────────────
    if ((notification as any).isRead) {
      return notification;
    }

    // ── 4. Update database ────────────────────────────────────────────────────
    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data:  { isRead: true, readAt: new Date() },
    });

    // ── 5. Decrement Redis unread counter (non-blocking) ──────────────────────
    this.decrementUnreadCount(userId)
      .then((newCount) => {
        if (this.gateway) {
          // Notify the client that this specific notification was read
          this.gateway.emitToUser(userId, 'notification:read', {
            notificationId,
          });
          // Update the badge count
          this.gateway.emitToUser(userId, 'unread-count', { count: newCount });
        }
      })
      .catch((err) =>
        this.logger.warn(
          `Failed to decrement unread count for userId=${userId}: ${err?.message}`,
        ),
      );

    this.logger.debug(
      `Notification marked as read: id=${notificationId} | userId=${userId}`,
    );

    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // markAllAsRead
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Marks all unread notifications for a user as read in a single bulk update.
   *
   * Steps:
   *   1. Bulk-update all unread notifications in the database.
   *   2. Reset the Redis unread counter to 0.
   *   3. Emit `notification:read-all` + `unread-count: 0` via Socket.IO.
   *
   * @param userId  UUID of the user whose notifications to mark as read.
   * @returns       Number of notifications that were updated.
   */
  async markAllAsRead(userId: string): Promise<{ count: number }> {
    // ── 1. Bulk update in the database ────────────────────────────────────────
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data:  { isRead: true, readAt: new Date() },
    });

    const count = result.count;

    // ── 2. Reset Redis unread counter (non-blocking) ──────────────────────────
    this.redisService
      .set(unreadKey(userId), '0')
      .then(() => {
        if (this.gateway) {
          // Notify the client that all notifications were cleared
          this.gateway.emitToUser(userId, 'notification:read-all', {});
          // Reset the badge count to zero
          this.gateway.emitToUser(userId, 'unread-count', { count: 0 });
        }
      })
      .catch((err) =>
        this.logger.warn(
          `Failed to reset Redis unread count for userId=${userId}: ${err?.message}`,
        ),
      );

    this.logger.log(
      `All notifications marked as read: userId=${userId} | count=${count}`,
    );

    return { count };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // getUnreadCount
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Returns the number of unread notifications for a user.
   *
   * Reads from Redis for O(1) performance.  Falls back to a database COUNT
   * query if the Redis key is absent (e.g. after a cache flush), and
   * re-populates the cache in that case.
   *
   * @param userId  UUID of the user to count unread notifications for.
   */
  async getUnreadCount(userId: string): Promise<number> {
    // ── Try Redis first ───────────────────────────────────────────────────────
    try {
      const cached = await this.redisService.get(unreadKey(userId));

      if (cached !== null) {
        return parseInt(cached, 10);
      }
    } catch (err) {
      this.logger.warn(
        `Redis get failed for unread count userId=${userId}: ${err?.message}`,
      );
    }

    // ── Cache miss — query the database ───────────────────────────────────────
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

    // ── Repopulate cache (non-blocking) ───────────────────────────────────────
    this.redisService
      .set(unreadKey(userId), String(count))
      .catch((err) =>
        this.logger.warn(
          `Failed to repopulate unread count cache for userId=${userId}: ${err?.message}`,
        ),
      );

    return count;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // deleteNotification
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Permanently deletes a notification.
   * Only the owning user or an ADMIN can delete a notification.
   *
   * @param notificationId  UUID of the notification to delete.
   * @param userId          UUID of the requesting user.
   * @param userRole        Role of the requesting user.
   */
  async deleteNotification(
    notificationId: string,
    userId:         string,
    userRole:       string,
  ): Promise<void> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException(
        `Notification with ID "${notificationId}" was not found.`,
      );
    }

    if (
      (notification as any).userId !== userId &&
      userRole !== 'ADMIN'
    ) {
      throw new ForbiddenException(
        'You are not authorized to delete this notification.',
      );
    }

    await this.prisma.notification.delete({ where: { id: notificationId } });

    // If the notification was unread, adjust the Redis counter
    if (!(notification as any).isRead) {
      this.decrementUnreadCount(userId).catch(() => null);
    }

    this.logger.log(
      `Notification deleted: id=${notificationId} | by userId=${userId}`,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Convenience factory methods for common notification types
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Notifies the client that a new bid has been placed on their project.
   *
   * @param clientId     UUID of the project owner.
   * @param clientEmail  Email address of the project owner (for email delivery).
   * @param data         Contextual data (projectId, projectTitle, freelancerName, bidId, amount).
   */
  async notifyBidReceived(
    clientId:    string,
    clientEmail: string,
    data: {
      projectId:     string;
      projectTitle:  string;
      freelancerName: string;
      bidId:         string;
      amount:        number;
    },
  ): Promise<void> {
    await this.createNotification({
      userId: clientId,
      type:   NotificationType.BID_RECEIVED,
      title:  'New bid received',
      body:   `${data.freelancerName} placed a bid of $${data.amount} on "${data.projectTitle}".`,
      data,
      sendEmail:    true,
      emailTo:      clientEmail,
      emailSubject: `New bid on your project: ${data.projectTitle}`,
      emailTemplateData: {
        clientId,
        ...data,
        actionUrl: `${this.configService.get('FRONTEND_URL')}/projects/${data.projectId}/bids/${data.bidId}`,
      },
    }).catch((err) =>
      this.logger.error('notifyBidReceived failed', err),
    );
  }

  /**
   * Notifies the freelancer that their bid was accepted and a contract has started.
   *
   * @param freelancerId    UUID of the freelancer.
   * @param freelancerEmail Email address of the freelancer.
   * @param data            Contextual data (projectId, projectTitle, contractId, clientName, amount).
   */
  async notifyContractStarted(
    freelancerId:    string,
    freelancerEmail: string,
    data: {
      projectId:    string;
      projectTitle: string;
      contractId:   string;
      clientName:   string;
      amount:       number;
    },
  ): Promise<void> {
    await this.createNotification({
      userId: freelancerId,
      type:   NotificationType.CONTRACT_STARTED,
      title:  'Your bid was accepted!',
      body:   `${data.clientName} accepted your bid on "${data.projectTitle}". A contract has been created.`,
      data,
      sendEmail:    true,
      emailTo:      freelancerEmail,
      emailSubject: `Congratulations — your bid on "${data.projectTitle}" was accepted`,
      emailTemplateData: {
        freelancerId,
        ...data,
        actionUrl: `${this.configService.get('FRONTEND_URL')}/contracts/${data.contractId}`,
      },
    }).catch((err) =>
      this.logger.error('notifyContractStarted failed', err),
    );
  }

  /**
   * Notifies the freelancer that a milestone payment has been released.
   *
   * @param freelancerId    UUID of the freelancer.
   * @param freelancerEmail Email address of the freelancer.
   * @param data            Contextual data (milestoneId, milestoneTitle, contractId, netAmount).
   */
  async notifyPaymentReceived(
    freelancerId:    string,
    freelancerEmail: string,
    data: {
      milestoneId:    string;
      milestoneTitle: string;
      contractId:     string;
      projectTitle:   string;
      netAmount:      number;
      currency?:      string;
    },
  ): Promise<void> {
    const currency = (data.currency ?? 'USD').toUpperCase();

    await this.createNotification({
      userId: freelancerId,
      type:   NotificationType.PAYMENT_RECEIVED,
      title:  'Payment received',
      body:   `$${data.netAmount} ${currency} has been transferred to your Stripe account for "${data.milestoneTitle}".`,
      data,
      sendEmail:    true,
      emailTo:      freelancerEmail,
      emailSubject: `Payment of $${data.netAmount} ${currency} received`,
      emailTemplateData: {
        freelancerId,
        ...data,
        actionUrl: `${this.configService.get('FRONTEND_URL')}/contracts/${data.contractId}`,
      },
    }).catch((err) =>
      this.logger.error('notifyPaymentReceived failed', err),
    );
  }

  /**
   * Notifies the freelancer that a milestone revision has been requested.
   *
   * @param freelancerId    UUID of the freelancer.
   * @param freelancerEmail Email address of the freelancer.
   * @param data            Contextual data (milestoneId, milestoneTitle, contractId, revisionNote).
   */
  async notifyMilestoneRevision(
    freelancerId:    string,
    freelancerEmail: string,
    data: {
      milestoneId:    string;
      milestoneTitle: string;
      contractId:     string;
      projectTitle:   string;
      revisionNote:   string;
    },
  ): Promise<void> {
    await this.createNotification({
      userId: freelancerId,
      type:   NotificationType.MILESTONE_REVISION,
      title:  'Revision requested',
      body:   `The client has requested a revision on "${data.milestoneTitle}": ${data.revisionNote.slice(0, 120)}${data.revisionNote.length > 120 ? '…' : ''}`,
      data,
      sendEmail:    true,
      emailTo:      freelancerEmail,
      emailSubject: `Revision requested on milestone: ${data.milestoneTitle}`,
      emailTemplateData: {
        freelancerId,
        ...data,
        actionUrl: `${this.configService.get('FRONTEND_URL')}/contracts/${data.contractId}`,
      },
    }).catch((err) =>
      this.logger.error('notifyMilestoneRevision failed', err),
    );
  }

  /**
   * Notifies the client that a milestone has been submitted for review.
   *
   * @param clientId    UUID of the client.
   * @param clientEmail Email address of the client.
   * @param data        Contextual data (milestoneId, milestoneTitle, contractId, freelancerName).
   */
  async notifyMilestoneSubmitted(
    clientId:    string,
    clientEmail: string,
    data: {
      milestoneId:     string;
      milestoneTitle:  string;
      contractId:      string;
      projectTitle:    string;
      freelancerName:  string;
    },
  ): Promise<void> {
    await this.createNotification({
      userId: clientId,
      type:   NotificationType.MILESTONE_SUBMITTED,
      title:  'Milestone submitted for review',
      body:   `${data.freelancerName} has submitted "${data.milestoneTitle}" for your review.`,
      data,
      sendEmail:    true,
      emailTo:      clientEmail,
      emailSubject: `Action required: Review milestone "${data.milestoneTitle}"`,
      emailTemplateData: {
        clientId,
        ...data,
        actionUrl: `${this.configService.get('FRONTEND_URL')}/contracts/${data.contractId}`,
      },
    }).catch((err) =>
      this.logger.error('notifyMilestoneSubmitted failed', err),
    );
  }

  /**
   * Notifies a user about a new message in a conversation.
   * This is a lightweight, silent notification (no email by default).
   *
   * @param userId         UUID of the recipient.
   * @param data           Contextual data (conversationId, senderName, preview).
   */
  async notifyNewMessage(
    userId: string,
    data: {
      conversationId: string;
      senderName:     string;
      preview:        string;
    },
  ): Promise<void> {
    await this.createNotification({
      userId,
      type:   NotificationType.NEW_MESSAGE,
      title:  `New message from ${data.senderName}`,
      body:   data.preview.slice(0, 100) + (data.preview.length > 100 ? '…' : ''),
      data,
      silent: false,   // still emit real-time event for badge update
      sendEmail: false, // no email for chat messages (avoid spam)
    }).catch((err) =>
      this.logger.error('notifyNewMessage failed', err),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Decrements the Redis unread notification counter for a user.
   * The counter is floored at 0 to prevent negative values.
   *
   * @param userId  Target user's UUID.
   * @returns       The new unread count after decrement.
   */
  private async decrementUnreadCount(userId: string): Promise<number> {
    try {
      const raw      = await this.redisService.get(unreadKey(userId));
      const current  = raw ? parseInt(raw, 10) : 0;
      const newCount = Math.max(0, current - 1);

      await this.redisService.set(unreadKey(userId), String(newCount));

      return newCount;
    } catch (err) {
      this.logger.warn(
        `decrementUnreadCount failed for userId=${userId}: ${err?.message}`,
      );
      return 0;
    }
  }

  /**
   * Builds a minimal, styled HTML email body for notification types that do
   * not have a dedicated SendGrid dynamic template.
   *
   * @param title  Notification title (used as the email heading).
   * @param body   Notification body text.
   * @param data   Optional contextual data (used to inject an action URL).
   */
  private buildDefaultEmailHtml(
    title: string,
    body:  string,
    data?: Record<string, any>,
  ): string {
    const frontendUrl = this.configService.get(
      'FRONTEND_URL',
      'http://localhost:3000',
    );

    const actionUrl  = data?.actionUrl as string | undefined;
    const ctaButton  = actionUrl
      ? `
        <p style="text-align: center; margin: 32px 0;">
          <a href="${actionUrl}"
             style="background-color: #6366f1; color: #ffffff; padding: 14px 28px;
                    text-decoration: none; border-radius: 6px; font-weight: bold;
                    font-family: sans-serif; font-size: 14px;">
            View Details
          </a>
        </p>`
      : '';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
         style="background-color: #f9fafb; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0"
               style="background-color: #ffffff; border-radius: 8px;
                      box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; max-width: 600px; width: 100%;">
          <!-- Header -->
          <tr>
            <td style="background-color: #6366f1; padding: 24px 32px;">
              <p style="margin: 0; color: #ffffff; font-size: 22px; font-weight: bold;">
                Freelancer Platform
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 16px; color: #111827; font-size: 20px;">${title}</h2>
              <p style="margin: 0 0 24px; color: #374151; font-size: 15px; line-height: 1.6;">
                ${body}
              </p>
              ${ctaButton}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 16px 32px 24px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                You received this notification because you have an account on
                <a href="${frontendUrl}" style="color: #6366f1; text-decoration: none;">
                  Freelancer Platform
                </a>.
                <br />
                If you did not expect this email, you can safely ignore it.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
  }
}
