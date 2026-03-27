import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

/**
 * NotificationController
 *
 * REST endpoints for the notification system.
 *
 * All endpoints require a valid JWT access token (JwtAuthGuard).
 * Users can only access their own notifications — ownership is enforced
 * in NotificationService by comparing the notification's userId with the
 * authenticated user's id.
 *
 * Real-time delivery
 * ──────────────────
 * Notifications are pushed in real-time via the `/notifications` Socket.IO
 * namespace (NotificationGateway).  These REST endpoints serve as the
 * persistence / management layer:
 *
 *   • GET  /notifications            — paginated history (badge + full list)
 *   • PATCH /notifications/:id/read  — mark a single notification as read
 *   • PATCH /notifications/read-all  — mark all notifications as read
 *   • GET  /notifications/unread-count — badge count
 *   • DELETE /notifications/:id      — delete a notification
 *
 * Client-side usage pattern
 * ─────────────────────────
 * 1. On page load, call `GET /notifications/unread-count` to initialise the badge.
 * 2. Subscribe to the `/notifications` WebSocket to receive live updates.
 * 3. When the user opens the notification panel, call `GET /notifications`
 *    to load the first page of history.
 * 4. On "mark all read" click, call `PATCH /notifications/read-all`.
 */
@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(private readonly notificationService: NotificationService) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /notifications
  // Paginated notification history for the authenticated user.
  // ─────────────────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'Get notifications',
    description:
      'Returns a paginated list of notifications for the authenticated user, ' +
      'ordered by creation date descending (newest first).\n\n' +
      '**Filtering options:**\n' +
      '- `unreadOnly=true` — show only unread notifications\n' +
      '- `type=BID_RECEIVED` — filter by notification type\n\n' +
      '**Real-time updates:** Connect to the `/notifications` Socket.IO namespace ' +
      'and listen for `notification:new` events to avoid polling this endpoint.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (1-based, default: 1).',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20, max: 100).',
    example: 20,
  })
  @ApiQuery({
    name: 'unreadOnly',
    required: false,
    type: Boolean,
    description: 'When true, returns only unread notifications.',
    example: false,
  })
  @ApiQuery({
    name: 'type',
    required: false,
    type: String,
    description:
      'Filter by notification type. Supported values: BID_RECEIVED, BID_ACCEPTED, ' +
      'BID_REJECTED, CONTRACT_STARTED, CONTRACT_COMPLETED, MILESTONE_SUBMITTED, ' +
      'MILESTONE_APPROVED, MILESTONE_REVISION, PAYMENT_RECEIVED, PAYMENT_FAILED, ' +
      'NEW_MESSAGE, REVIEW_RECEIVED, SYSTEM_ANNOUNCEMENT, etc.',
    example: 'BID_RECEIVED',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification list returned successfully.',
    schema: {
      example: {
        success: true,
        data: {
          items: [
            {
              id: 'notif-uuid-1',
              type: 'BID_RECEIVED',
              title: 'New bid received',
              body: 'Alice Smith placed a bid of $2 500 on "Build a SaaS Dashboard".',
              isRead: false,
              readAt: null,
              data: {
                projectId: 'project-uuid',
                projectTitle: 'Build a SaaS Dashboard',
                freelancerName: 'Alice Smith',
                bidId: 'bid-uuid',
                amount: 2500,
              },
              createdAt: '2025-01-15T10:00:00.000Z',
            },
            {
              id: 'notif-uuid-2',
              type: 'PAYMENT_RECEIVED',
              title: 'Payment received',
              body: '$2 250 USD has been transferred to your Stripe account for "Frontend implementation".',
              isRead: true,
              readAt: '2025-01-14T16:30:00.000Z',
              data: {
                milestoneId: 'milestone-uuid',
                milestoneTitle: 'Frontend implementation',
                contractId: 'contract-uuid',
                netAmount: 2250,
                currency: 'USD',
              },
              createdAt: '2025-01-14T15:00:00.000Z',
            },
          ],
          total: 2,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getNotifications(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('type') type?: string,
  ) {
    return this.notificationService.getUserNotifications(userId, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      unreadOnly: unreadOnly === 'true',
      type: type || undefined,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /notifications/unread-count
  // Returns just the badge number — fast Redis read.
  //
  // IMPORTANT: This route must be declared BEFORE `:id` routes to avoid
  // "unread-count" being parsed as a UUID parameter.
  // ─────────────────────────────────────────────────────────────────────────────

  @Get('unread-count')
  @ApiOperation({
    summary: 'Get unread notification count',
    description:
      'Returns the total number of unread notifications for the authenticated user.\n\n' +
      'This endpoint is optimised for the navigation bar badge — the count is ' +
      'served from Redis (O(1)) with a database fallback on cache miss.\n\n' +
      '**Real-time badge updates:** The `/notifications` Socket.IO namespace emits ' +
      '`unread-count` events whenever the count changes, so you typically only ' +
      'need to call this endpoint once on page load.',
  })
  @ApiResponse({
    status: 200,
    description: 'Unread notification count returned.',
    schema: {
      example: {
        success: true,
        data: {
          unreadCount: 5,
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getUnreadCount(@CurrentUser('id') userId: string) {
    const unreadCount = await this.notificationService.getUnreadCount(userId);
    return { unreadCount };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PATCH /notifications/read-all
  // Mark ALL unread notifications as read in one bulk operation.
  //
  // IMPORTANT: declared before `:id` to prevent routing conflicts.
  // ─────────────────────────────────────────────────────────────────────────────

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark all notifications as read',
    description:
      'Marks every unread notification for the authenticated user as read in a ' +
      'single bulk database update.\n\n' +
      'Also resets the Redis unread counter to 0 and emits:\n' +
      '- `notification:read-all` event on the `/notifications` Socket.IO namespace\n' +
      '- `unread-count` event with `{ count: 0 }` to update the badge\n\n' +
      'Returns the number of notifications that were updated.',
  })
  @ApiResponse({
    status: 200,
    description: 'All notifications marked as read.',
    schema: {
      example: {
        success: true,
        data: {
          count: 5,
        },
        message: '5 notification(s) marked as read.',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async markAllAsRead(@CurrentUser('id') userId: string) {
    const result = await this.notificationService.markAllAsRead(userId);
    return {
      data: result,
      message: `${result.count} notification(s) marked as read.`,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PATCH /notifications/:id/read
  // Mark a single notification as read.
  // ─────────────────────────────────────────────────────────────────────────────

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark a notification as read',
    description:
      'Marks a single notification as read for the authenticated user.\n\n' +
      '**Idempotent** — calling this on an already-read notification returns the ' +
      'notification unchanged without modifying any state.\n\n' +
      'On success:\n' +
      '- Sets `isRead = true` and `readAt = now` in the database.\n' +
      '- Decrements the Redis unread counter (floor at 0).\n' +
      '- Emits `notification:read` and updated `unread-count` via Socket.IO.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'UUID of the notification to mark as read.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read.',
    schema: {
      example: {
        success: true,
        data: {
          id: 'notif-uuid',
          type: 'BID_RECEIVED',
          title: 'New bid received',
          body: 'Alice Smith placed a bid of $2 500 on "Build a SaaS Dashboard".',
          isRead: true,
          readAt: '2025-01-15T12:00:00.000Z',
          createdAt: '2025-01-15T10:00:00.000Z',
        },
        message: 'Notification marked as read.',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'This notification does not belong to you.' })
  @ApiResponse({ status: 404, description: 'Notification not found.' })
  async markAsRead(
    @Param('id', ParseUUIDPipe) notificationId: string,
    @CurrentUser('id') userId: string,
  ) {
    const notification = await this.notificationService.markAsRead(
      notificationId,
      userId,
    );
    return { data: notification, message: 'Notification marked as read.' };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DELETE /notifications/:id
  // Permanently delete a notification.
  // ─────────────────────────────────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a notification',
    description:
      'Permanently deletes a notification from the authenticated user\'s history.\n\n' +
      'Only the notification owner or an ADMIN can delete a notification.\n\n' +
      'If the deleted notification was unread, the Redis unread counter is ' +
      'decremented accordingly.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'UUID of the notification to delete.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification deleted.',
    schema: {
      example: {
        success: true,
        data: null,
        message: 'Notification deleted successfully.',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'This notification does not belong to you.' })
  @ApiResponse({ status: 404, description: 'Notification not found.' })
  async deleteNotification(
    @Param('id', ParseUUIDPipe) notificationId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    await this.notificationService.deleteNotification(
      notificationId,
      userId,
      userRole,
    );
    return { data: null, message: 'Notification deleted successfully.' };
  }
}
