import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum ConversationType {
  DIRECT  = 'DIRECT',
  GROUP   = 'GROUP',
  SUPPORT = 'SUPPORT',
}

export enum MessageType {
  TEXT   = 'TEXT',
  IMAGE  = 'IMAGE',
  FILE   = 'FILE',
  SYSTEM = 'SYSTEM',
}

// ---------------------------------------------------------------------------
// Interfaces / DTOs
// ---------------------------------------------------------------------------

export interface SendMessageDto {
  content:    string;
  type?:      MessageType | string;
  fileUrl?:   string;
  fileName?:  string;
  fileSize?:  number;
  replyToId?: string;
}

export interface CreateConversationDto {
  userIds:      string[];
  type?:        ConversationType | string;
  projectId?:   string;
  contractId?:  string;
  title?:       string;
}

export interface PaginationDto {
  page?:   number;
  limit?:  number;
  cursor?: string; // cursor-based pagination for infinite scroll
}

export interface PaginatedMessages {
  items:      any[];
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
  nextCursor: string | null;
}

// ---------------------------------------------------------------------------
// Redis key helpers
// ---------------------------------------------------------------------------

const unreadCountKey = (userId: string, conversationId: string) =>
  `chat:unread:${userId}:${conversationId}`;

const lastSeenKey = (userId: string) => `chat:lastseen:${userId}`;

// ---------------------------------------------------------------------------
// ChatService
// ---------------------------------------------------------------------------

/**
 * ChatService
 *
 * Handles all persistence and business logic for the chat module.
 * The Socket.IO gateway (ChatGateway) delegates to this service for
 * any operation that requires a database or cache interaction.
 *
 * Key design decisions
 * ────────────────────
 * • Unread counts are maintained in Redis for O(1) lookups and bulk
 *   reset on mark-as-read, while the authoritative `lastReadAt` timestamp
 *   is persisted in Prisma for correctness across cache invalidations.
 *
 * • `getOrCreateDirectConversation` is idempotent — calling it multiple
 *   times for the same pair of users returns the same Conversation record.
 *
 * • Messages are soft-deletable (deletedAt field) — deleted messages are
 *   excluded from queries but kept for audit/moderation purposes.
 *
 * • The `getConversationParticipantIds` helper is intentionally kept
 *   lightweight (SELECT only ids) so that the gateway can call it on every
 *   sent message without adding noticeable latency.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma:       PrismaService,
    private readonly redisService: RedisService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // createConversation
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Creates a new conversation and adds the provided users as participants.
   *
   * Business rules
   * ──────────────
   * • A DIRECT conversation requires exactly 2 participants.
   * • A GROUP conversation requires at least 2 participants.
   * • Each participant gets a `ConversationParticipant` join-record with
   *   an initial `lastReadAt` of the creation timestamp.
   * • An optional `projectId` / `contractId` links the conversation to a
   *   specific project or contract for context.
   *
   * @param userIds     Array of user UUIDs to add as participants.
   * @param type        Conversation type (default: DIRECT).
   * @param projectId   Optional linked project UUID.
   * @param contractId  Optional linked contract UUID.
   * @param title       Optional conversation title (used for GROUP conversations).
   */
  async createConversation(
    userIds:     string[],
    type:        ConversationType | string = ConversationType.DIRECT,
    projectId?:  string,
    contractId?: string,
    title?:      string,
  ): Promise<any> {
    // ── Validate participant count ─────────────────────────────────────────────
    if (!userIds || userIds.length < 2) {
      throw new BadRequestException(
        'A conversation requires at least 2 participants.',
      );
    }

    if (type === ConversationType.DIRECT && userIds.length !== 2) {
      throw new BadRequestException(
        'A DIRECT conversation must have exactly 2 participants.',
      );
    }

    // ── Remove duplicate userIds ───────────────────────────────────────────────
    const uniqueUserIds = [...new Set(userIds)];

    // ── Verify all users exist ─────────────────────────────────────────────────
    const users = await this.prisma.user.findMany({
      where:  { id: { in: uniqueUserIds } },
      select: { id: true },
    });

    if (users.length !== uniqueUserIds.length) {
      const foundIds   = users.map((u: any) => u.id);
      const missingIds = uniqueUserIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(
        `The following user IDs were not found: ${missingIds.join(', ')}`,
      );
    }

    // ── Create conversation + participants in a transaction ────────────────────
    const now = new Date();

    const conversation = await this.prisma.conversation.create({
      data: {
        type,
        title:      title ?? null,
        projectId:  projectId  ?? null,
        contractId: contractId ?? null,
        participants: {
          create: uniqueUserIds.map((userId) => ({
            userId,
            joinedAt:   now,
            lastReadAt: now,
          })),
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id:        true,
                firstName: true,
                lastName:  true,
                avatar:    true,
                email:     true,
              },
            },
          },
        },
        project:  { select: { id: true, title: true } },
        contract: { select: { id: true, status: true } },
      },
    });

    this.logger.log(
      `Conversation created: ${conversation.id} | type: ${type} | ` +
        `participants: ${uniqueUserIds.join(', ')}`,
    );

    return conversation;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // getOrCreateDirectConversation
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Finds an existing DIRECT conversation between two users or creates one.
   *
   * This is idempotent — calling it multiple times for the same pair returns
   * the same conversation record.  It is the recommended way to initiate a
   * 1:1 conversation from the UI (e.g. clicking "Message" on a freelancer's
   * profile).
   *
   * @param userId1  First user UUID (order does not matter).
   * @param userId2  Second user UUID.
   */
  async getOrCreateDirectConversation(
    userId1: string,
    userId2: string,
  ): Promise<any> {
    if (userId1 === userId2) {
      throw new BadRequestException('A user cannot start a conversation with themselves.');
    }

    // ── Look for an existing DIRECT conversation between exactly these two users ─
    // We use a raw query approach: find conversations where BOTH users are
    // participants and the type is DIRECT.
    const existing = await this.prisma.conversation.findFirst({
      where: {
        type: ConversationType.DIRECT,
        AND: [
          { participants: { some: { userId: userId1 } } },
          { participants: { some: { userId: userId2 } } },
        ],
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id:        true,
                firstName: true,
                lastName:  true,
                avatar:    true,
                email:     true,
              },
            },
          },
        },
        lastMessage: true,
      },
    });

    if (existing) {
      this.logger.debug(
        `Returning existing direct conversation: ${existing.id} | ` +
          `users: ${userId1} ↔ ${userId2}`,
      );
      return existing;
    }

    // ── None found — create a new one ─────────────────────────────────────────
    this.logger.debug(
      `No direct conversation found between ${userId1} and ${userId2} — creating one.`,
    );

    return this.createConversation(
      [userId1, userId2],
      ConversationType.DIRECT,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // sendMessage
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Persists a new message and updates the conversation's `lastMessageAt`
   * timestamp and `lastMessageId` pointer.
   *
   * Steps:
   *   1. Verify the sender is a participant of the conversation.
   *   2. If `replyToId` is provided, verify the referenced message exists.
   *   3. Create the Message record.
   *   4. Update the Conversation's `lastMessageAt` and `lastMessageId`.
   *   5. Increment the unread count in Redis for every participant except the
   *      sender.
   *
   * @param conversationId  UUID of the target conversation.
   * @param senderId        UUID of the authenticated sender.
   * @param dto             Message payload (content, type, file metadata, etc.).
   */
  async sendMessage(
    conversationId: string,
    senderId:       string,
    dto:            SendMessageDto,
  ): Promise<any> {
    const {
      content,
      type        = MessageType.TEXT,
      fileUrl,
      fileName,
      fileSize,
      replyToId,
    } = dto;

    // ── 1. Verify conversation exists ──────────────────────────────────────────
    const conversation = await this.prisma.conversation.findUnique({
      where:  { id: conversationId },
      select: {
        id:           true,
        participants: { select: { userId: true } },
      },
    });

    if (!conversation) {
      throw new NotFoundException(
        `Conversation with ID "${conversationId}" was not found.`,
      );
    }

    // ── 2. Verify sender is a participant ──────────────────────────────────────
    const participantIds = conversation.participants.map((p: any) => p.userId);

    if (!participantIds.includes(senderId)) {
      throw new ForbiddenException(
        'You are not a participant of this conversation.',
      );
    }

    // ── 3. Validate content ────────────────────────────────────────────────────
    if (type === MessageType.TEXT && (!content || content.trim().length === 0)) {
      throw new BadRequestException('Message content must not be empty.');
    }

    if (content && content.length > 10_000) {
      throw new BadRequestException(
        'Message content must not exceed 10 000 characters.',
      );
    }

    // ── 4. Validate replyToId (if provided) ────────────────────────────────────
    if (replyToId) {
      const referencedMessage = await this.prisma.message.findFirst({
        where: { id: replyToId, conversationId },
      });

      if (!referencedMessage) {
        throw new NotFoundException(
          `Message with ID "${replyToId}" was not found in this conversation.`,
        );
      }
    }

    const now = new Date();

    // ── 5. Create message + update conversation in a transaction ───────────────
    const [message] = await this.prisma.$transaction([
      // Create the message
      this.prisma.message.create({
        data: {
          conversationId,
          senderId,
          content:    content ?? '',
          type,
          fileUrl:    fileUrl    ?? null,
          fileName:   fileName   ?? null,
          fileSize:   fileSize   ?? null,
          replyToId:  replyToId  ?? null,
          isRead:     false,
          createdAt:  now,
        },
        include: {
          sender: {
            select: {
              id:        true,
              firstName: true,
              lastName:  true,
              avatar:    true,
              email:     true,
            },
          },
          replyTo: {
            select: {
              id:      true,
              content: true,
              sender:  { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      }),

      // Update the conversation's lastMessageAt
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: now,
          updatedAt:     now,
        },
      }),
    ]);

    // ── 6. Update lastMessageId (after we have the message id) ─────────────────
    await this.prisma.conversation
      .update({
        where: { id: conversationId },
        data:  { lastMessageId: message.id },
      })
      .catch((err) =>
        this.logger.warn(
          `Failed to update lastMessageId for conversation ${conversationId}: ${err.message}`,
        ),
      );

    // ── 7. Increment unread counts in Redis for all participants except sender ──
    const otherParticipantIds = participantIds.filter((id: string) => id !== senderId);

    await Promise.all(
      otherParticipantIds.map((participantId: string) =>
        this.redisService
          .incr(unreadCountKey(participantId, conversationId))
          .catch((err) =>
            this.logger.warn(
              `Failed to increment unread count for user ${participantId}: ${err.message}`,
            ),
          ),
      ),
    );

    this.logger.debug(
      `Message created: ${message.id} | conversation: ${conversationId} | sender: ${senderId}`,
    );

    return message;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // getMessages
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Returns a paginated list of messages for a conversation.
   *
   * Access control: only participants of the conversation can read its messages.
   *
   * Pagination supports both page-based (page/limit) and cursor-based
   * (cursor = last message ID) approaches.  Cursor-based pagination is
   * recommended for the real-time infinite-scroll UI.
   *
   * @param conversationId  UUID of the target conversation.
   * @param userId          UUID of the requesting user (must be a participant).
   * @param pagination      Pagination options (page, limit, cursor).
   */
  async getMessages(
    conversationId: string,
    userId:         string,
    pagination:     PaginationDto = {},
  ): Promise<PaginatedMessages> {
    const {
      page  = 1,
      limit = 50,
      cursor,
    } = pagination;

    const safePage  = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const skip      = cursor ? 0 : (safePage - 1) * safeLimit;

    // ── 1. Verify conversation exists and user is a participant ─────────────────
    await this.findConversationOrFail(conversationId, userId);

    // ── 2. Build cursor-based where clause ──────────────────────────────────────
    const where: any = {
      conversationId,
      deletedAt: null,
    };

    if (cursor) {
      // Load messages older than the cursor message (for "load more" / up-scroll)
      where.id = { lt: cursor };
    }

    // ── 3. Execute paginated query ───────────────────────────────────────────────
    const [items, total] = await Promise.all([
      this.prisma.message.findMany({
        where,
        skip:    cursor ? 0 : skip,
        take:    safeLimit,
        orderBy: { createdAt: 'desc' }, // newest first — client reverses for display
        include: {
          sender: {
            select: {
              id:        true,
              firstName: true,
              lastName:  true,
              avatar:    true,
              email:     true,
            },
          },
          replyTo: {
            select: {
              id:      true,
              content: true,
              type:    true,
              sender:  { select: { id: true, firstName: true, lastName: true } },
            },
          },
          reactions: {
            select: {
              emoji:  true,
              userId: true,
              user:   { select: { id: true, firstName: true } },
            },
          },
        },
      }),
      this.prisma.message.count({ where: { conversationId, deletedAt: null } }),
    ]);

    // Determine the next cursor (oldest message in the current page)
    const nextCursor =
      items.length === safeLimit
        ? (items[items.length - 1] as any).id
        : null;

    return {
      items:      items.reverse(), // return chronological order
      total,
      page:       safePage,
      limit:      safeLimit,
      totalPages: Math.ceil(total / safeLimit),
      nextCursor,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // getConversations
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Returns all conversations the user is a participant of.
   *
   * Each conversation is enriched with:
   *   - The last message (content + sender)
   *   - The other participants' profile info
   *   - The unread count for this user (from Redis)
   *   - The user's `lastReadAt` timestamp
   *
   * Results are ordered by `lastMessageAt` descending (most recently active first).
   *
   * @param userId  UUID of the requesting user.
   */
  async getConversations(userId: string): Promise<any[]> {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        participants: {
          some: { userId },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id:        true,
                firstName: true,
                lastName:  true,
                avatar:    true,
                email:     true,
              },
            },
          },
        },
        lastMessage: {
          include: {
            sender: {
              select: {
                id:        true,
                firstName: true,
                lastName:  true,
                avatar:    true,
              },
            },
          },
        },
        project:  { select: { id: true, title: true } },
        contract: { select: { id: true, status: true } },
      },
    });

    if (conversations.length === 0) {
      return [];
    }

    // ── Enrich with unread counts from Redis ───────────────────────────────────
    const enriched = await Promise.all(
      conversations.map(async (conversation) => {
        // Get unread count from Redis (fall back to 0 on cache miss / error)
        let unreadCount = 0;
        try {
          const cached = await this.redisService.get(
            unreadCountKey(userId, conversation.id),
          );
          unreadCount = cached ? parseInt(cached, 10) : 0;
        } catch {
          unreadCount = 0;
        }

        // Find this user's participant record for lastReadAt
        const myParticipant = conversation.participants.find(
          (p: any) => p.userId === userId,
        );

        // For DIRECT conversations, derive a display name from the other participant
        const otherParticipants = conversation.participants.filter(
          (p: any) => p.userId !== userId,
        );

        return {
          ...conversation,
          unreadCount,
          myLastReadAt:    myParticipant?.lastReadAt ?? null,
          otherParticipants: otherParticipants.map((p: any) => p.user),
        };
      }),
    );

    return enriched;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // markAsRead
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Marks all messages in a conversation as read by the given user.
   *
   * Steps:
   *   1. Update the participant's `lastReadAt` timestamp in the database.
   *   2. Reset the Redis unread counter for this user + conversation to 0.
   *
   * @param conversationId  UUID of the conversation to mark as read.
   * @param userId          UUID of the user marking as read.
   */
  async markAsRead(conversationId: string, userId: string): Promise<void> {
    // ── Verify participant ──────────────────────────────────────────────────────
    const participant = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId, userId },
    });

    if (!participant) {
      throw new ForbiddenException(
        'You are not a participant of this conversation.',
      );
    }

    const now = new Date();

    // ── Update lastReadAt in DB ────────────────────────────────────────────────
    await this.prisma.conversationParticipant.updateMany({
      where: { conversationId, userId },
      data:  { lastReadAt: now },
    });

    // ── Reset Redis unread counter ─────────────────────────────────────────────
    await this.redisService
      .set(unreadCountKey(userId, conversationId), '0')
      .catch((err) =>
        this.logger.warn(
          `Failed to reset unread count for user ${userId}, conversation ${conversationId}: ${err.message}`,
        ),
      );

    this.logger.debug(
      `Marked as read: conversation=${conversationId} | user=${userId}`,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // getUnreadCount
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Returns the total number of unread messages for a user across all their
   * conversations.
   *
   * Uses Redis for O(conversations) performance rather than an aggregated DB query.
   *
   * @param userId  UUID of the user to count unread messages for.
   */
  async getUnreadCount(userId: string): Promise<number> {
    // ── Get all conversation IDs for this user ─────────────────────────────────
    const participations = await this.prisma.conversationParticipant.findMany({
      where:  { userId },
      select: { conversationId: true },
    });

    if (participations.length === 0) return 0;

    // ── Sum up Redis counters ──────────────────────────────────────────────────
    const counts = await Promise.all(
      participations.map(async (p: any) => {
        try {
          const cached = await this.redisService.get(
            unreadCountKey(userId, p.conversationId),
          );
          return cached ? parseInt(cached, 10) : 0;
        } catch {
          return 0;
        }
      }),
    );

    const total = counts.reduce((sum, count) => sum + count, 0);
    return total;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // isParticipant
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Checks whether a user is a participant of a given conversation.
   * Used by ChatGateway before admitting a socket to a conversation room.
   *
   * @param conversationId  UUID of the conversation.
   * @param userId          UUID of the user to check.
   */
  async isParticipant(conversationId: string, userId: string): Promise<boolean> {
    const participant = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId, userId },
      select: { id: true },
    });

    return participant !== null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // getConversationParticipantIds
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Returns the array of user IDs who are participants of a given conversation.
   *
   * This is a lightweight projection (SELECT userId only) intended for use
   * inside the hot path of the `send-message` Socket.IO event handler where
   * we need to push notifications to offline participants.
   *
   * @param conversationId  UUID of the conversation.
   */
  async getConversationParticipantIds(conversationId: string): Promise<string[]> {
    const participants = await this.prisma.conversationParticipant.findMany({
      where:  { conversationId },
      select: { userId: true },
    });

    return participants.map((p: any) => p.userId);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // updateUserLastSeen
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Updates the user's `lastSeen` timestamp in the database.
   * Called when a socket disconnects and there are no remaining active
   * connections for that user.
   *
   * @param userId  UUID of the user who went offline.
   */
  async updateUserLastSeen(userId: string): Promise<void> {
    const now = new Date();

    await this.prisma.user
      .update({
        where: { id: userId },
        data:  { lastSeenAt: now, updatedAt: now },
      })
      .catch((err) => {
        this.logger.warn(
          `Failed to update lastSeen for user ${userId}: ${err.message}`,
        );
      });

    // Also cache in Redis for fast presence checks
    await this.redisService
      .set(lastSeenKey(userId), now.toISOString())
      .catch(() => null);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // deleteMessage (soft delete)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Soft-deletes a message. Only the original sender or an ADMIN can delete.
   *
   * The message row is kept in the database for audit purposes — the `content`
   * is replaced with a tombstone and `deletedAt` is set.
   *
   * @param messageId  UUID of the message to delete.
   * @param userId     UUID of the requesting user.
   * @param userRole   Role of the requesting user.
   */
  async deleteMessage(
    messageId: string,
    userId:    string,
    userRole:  string,
  ): Promise<any> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException(`Message with ID "${messageId}" was not found.`);
    }

    if ((message as any).deletedAt) {
      throw new ConflictException('This message has already been deleted.');
    }

    // Only the sender or an admin can delete
    if ((message as any).senderId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('You are not authorized to delete this message.');
    }

    const deleted = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        content:   'This message has been deleted.',
        deletedAt: new Date(),
        fileUrl:   null,
        fileName:  null,
      },
    });

    this.logger.log(
      `Message soft-deleted: ${messageId} | by user: ${userId}`,
    );

    return deleted;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // addReaction
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Adds an emoji reaction to a message. If the user already reacted with the
   * same emoji, the reaction is removed (toggle behaviour).
   *
   * @param messageId      UUID of the target message.
   * @param userId         UUID of the reacting user.
   * @param conversationId UUID of the parent conversation (for access control).
   * @param emoji          Unicode emoji string (e.g. "👍", "❤️").
   */
  async addReaction(
    messageId:      string,
    userId:         string,
    conversationId: string,
    emoji:          string,
  ): Promise<any> {
    // Verify participant access
    await this.findConversationOrFail(conversationId, userId);

    // Check for existing reaction
    const existing = await this.prisma.messageReaction.findFirst({
      where: { messageId, userId, emoji },
    });

    if (existing) {
      // Toggle off — remove the reaction
      await this.prisma.messageReaction.delete({ where: { id: existing.id } });
      this.logger.debug(
        `Reaction removed: ${emoji} | message: ${messageId} | user: ${userId}`,
      );
      return { toggled: false, emoji };
    }

    // Add the reaction
    const reaction = await this.prisma.messageReaction.create({
      data: { messageId, userId, emoji },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
      },
    });

    this.logger.debug(
      `Reaction added: ${emoji} | message: ${messageId} | user: ${userId}`,
    );

    return { toggled: true, emoji, reaction };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // getConversationById
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Returns a single conversation with full participant and last-message details.
   * Throws NotFoundException if the conversation does not exist.
   * Throws ForbiddenException if the requesting user is not a participant.
   *
   * @param conversationId  UUID of the conversation.
   * @param userId          UUID of the requesting user.
   */
  async getConversationById(
    conversationId: string,
    userId:         string,
  ): Promise<any> {
    const conversation = await this.prisma.conversation.findUnique({
      where:   { id: conversationId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id:        true,
                firstName: true,
                lastName:  true,
                avatar:    true,
                email:     true,
              },
            },
          },
        },
        lastMessage: {
          include: {
            sender: {
              select: {
                id:        true,
                firstName: true,
                lastName:  true,
              },
            },
          },
        },
        project:  { select: { id: true, title: true } },
        contract: { select: { id: true, status: true } },
      },
    });

    if (!conversation) {
      throw new NotFoundException(
        `Conversation with ID "${conversationId}" was not found.`,
      );
    }

    // Access control
    const isParticipant = conversation.participants.some(
      (p: any) => p.userId === userId,
    );

    if (!isParticipant) {
      throw new ForbiddenException(
        'You are not a participant of this conversation.',
      );
    }

    // Attach unread count
    let unreadCount = 0;
    try {
      const cached = await this.redisService.get(
        unreadCountKey(userId, conversationId),
      );
      unreadCount = cached ? parseInt(cached, 10) : 0;
    } catch {
      unreadCount = 0;
    }

    return { ...conversation, unreadCount };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Fetches a conversation and verifies the user is a participant.
   * Throws NotFoundException / ForbiddenException as appropriate.
   */
  private async findConversationOrFail(
    conversationId: string,
    userId:         string,
  ): Promise<any> {
    const conversation = await this.prisma.conversation.findUnique({
      where:   { id: conversationId },
      include: {
        participants: {
          select: { userId: true },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException(
        `Conversation with ID "${conversationId}" was not found.`,
      );
    }

    const participantIds = conversation.participants.map((p: any) => p.userId);

    if (!participantIds.includes(userId)) {
      throw new ForbiddenException(
        'You are not a participant of this conversation.',
      );
    }

    return conversation;
  }
}
