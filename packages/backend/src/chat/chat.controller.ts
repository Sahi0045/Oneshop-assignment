import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  ParseUUIDPipe,
  Delete,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsUUID,
  IsEnum,
  MaxLength,
  MinLength,
  ArrayMinSize,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

import { ChatService, ConversationType, MessageType } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

// ---------------------------------------------------------------------------
// Inline DTOs
// ---------------------------------------------------------------------------

class CreateConversationDto {
  @ApiProperty({
    description:
      'Array of user UUIDs to include as participants. ' +
      'For DIRECT conversations exactly 2 IDs are required. ' +
      'For GROUP conversations at least 2 IDs are required.',
    type: [String],
    example: ['user-uuid-1', 'user-uuid-2'],
    minItems: 2,
  })
  @IsArray({ message: 'userIds must be an array of UUIDs.' })
  @ArrayMinSize(2, { message: 'A conversation requires at least 2 participants.' })
  @IsUUID('4', { each: true, message: 'Each userId must be a valid UUID v4.' })
  userIds: string[];

  @ApiPropertyOptional({
    description:
      'Conversation type. Defaults to DIRECT for 2-participant conversations.',
    enum: ConversationType,
    example: ConversationType.DIRECT,
    default: ConversationType.DIRECT,
  })
  @IsOptional()
  @IsEnum(ConversationType, {
    message: `type must be one of: ${Object.values(ConversationType).join(', ')}.`,
  })
  type?: ConversationType = ConversationType.DIRECT;

  @ApiPropertyOptional({
    description: 'Optional UUID of a project to link to this conversation.',
    example: 'project-uuid-123',
  })
  @IsOptional()
  @IsUUID('4', { message: 'projectId must be a valid UUID v4.' })
  projectId?: string;

  @ApiPropertyOptional({
    description: 'Optional UUID of a contract to link to this conversation.',
    example: 'contract-uuid-456',
  })
  @IsOptional()
  @IsUUID('4', { message: 'contractId must be a valid UUID v4.' })
  contractId?: string;

  @ApiPropertyOptional({
    description:
      'Display title for GROUP conversations. ' +
      'Not required for DIRECT conversations.',
    example: 'Project Alpha Team',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'title must not exceed 100 characters.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title?: string;
}

class SendMessageDto {
  @ApiProperty({
    description:
      'Message content. Required for TEXT messages. ' +
      'For FILE or IMAGE messages this can be a caption or empty string.',
    example: 'Hey! I just reviewed your project requirements. Happy to discuss further.',
    maxLength: 10000,
  })
  @IsString({ message: 'content must be a string.' })
  @IsNotEmpty({ message: 'Message content must not be empty.' })
  @MaxLength(10000, { message: 'Message content must not exceed 10 000 characters.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  content: string;

  @ApiPropertyOptional({
    description:
      'Message type. Defaults to TEXT. ' +
      'Use IMAGE or FILE when attaching media (provide fileUrl).',
    enum: MessageType,
    example: MessageType.TEXT,
    default: MessageType.TEXT,
  })
  @IsOptional()
  @IsEnum(MessageType, {
    message: `type must be one of: ${Object.values(MessageType).join(', ')}.`,
  })
  type?: MessageType = MessageType.TEXT;

  @ApiPropertyOptional({
    description:
      'S3 / CDN URL of the attached file or image. ' +
      'Required when type is FILE or IMAGE.',
    example: 'https://s3.amazonaws.com/freelancer-platform-uploads/chat/document.pdf',
  })
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @ApiPropertyOptional({
    description: 'Original filename of the attached file (for display purposes).',
    example: 'project-brief.pdf',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'fileName must not exceed 255 characters.' })
  fileName?: string;

  @ApiPropertyOptional({
    description: 'File size in bytes.',
    example: 204800,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'fileSize must be a whole number.' })
  @Min(1, { message: 'fileSize must be at least 1 byte.' })
  fileSize?: number;

  @ApiPropertyOptional({
    description: 'UUID of the message being replied to (thread/quote reply).',
    example: 'message-uuid-789',
  })
  @IsOptional()
  @IsUUID('4', { message: 'replyToId must be a valid UUID v4.' })
  replyToId?: string;
}

class GetOrCreateDirectConversationDto {
  @ApiProperty({
    description: 'UUID of the other user to start a direct conversation with.',
    example: 'other-user-uuid',
  })
  @IsUUID('4', { message: 'userId must be a valid UUID v4.' })
  @IsNotEmpty({ message: 'userId must not be empty.' })
  userId: string;
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

@ApiTags('Chat')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chatService: ChatService) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /chat/conversations
  // Returns all conversations for the authenticated user.
  // ─────────────────────────────────────────────────────────────────────────────

  @Get('conversations')
  @ApiOperation({
    summary: 'Get all conversations',
    description:
      'Returns all conversations the authenticated user is a participant of, ' +
      'ordered by most-recently-active first.\n\n' +
      'Each conversation includes:\n' +
      '- The last message (with sender info)\n' +
      '- All participant profiles\n' +
      '- Unread message count for the requesting user\n' +
      '- Linked project / contract info (if applicable)\n\n' +
      '**Real-time updates:** Subscribe to the `/chat` Socket.IO namespace ' +
      'and listen for `message:new` events to keep this list in sync without polling.',
  })
  @ApiResponse({
    status: 200,
    description: 'Conversation list returned successfully.',
    schema: {
      example: {
        success: true,
        data: [
          {
            id: 'conv-uuid',
            type: 'DIRECT',
            title: null,
            unreadCount: 3,
            myLastReadAt: '2025-01-15T09:00:00.000Z',
            lastMessageAt: '2025-01-15T10:30:00.000Z',
            lastMessage: {
              id: 'msg-uuid',
              content: 'Sounds great! I can start on Monday.',
              type: 'TEXT',
              createdAt: '2025-01-15T10:30:00.000Z',
              sender: {
                id: 'user-uuid',
                firstName: 'Alice',
                lastName: 'Smith',
                avatar: 'https://...',
              },
            },
            participants: [
              {
                userId: 'user-uuid-1',
                user: { id: 'user-uuid-1', firstName: 'John', lastName: 'Doe', avatar: null },
              },
              {
                userId: 'user-uuid-2',
                user: { id: 'user-uuid-2', firstName: 'Alice', lastName: 'Smith', avatar: 'https://...' },
              },
            ],
            otherParticipants: [
              { id: 'user-uuid-2', firstName: 'Alice', lastName: 'Smith', avatar: 'https://...' },
            ],
            project: null,
            contract: null,
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getConversations(@CurrentUser('id') userId: string) {
    return this.chatService.getConversations(userId);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /chat/conversations
  // Creates a new conversation (DIRECT or GROUP).
  // ─────────────────────────────────────────────────────────────────────────────

  @Post('conversations')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a conversation',
    description:
      'Creates a new conversation and adds the specified users as participants.\n\n' +
      '**DIRECT conversations** require exactly 2 participants. ' +
      'If a DIRECT conversation already exists between the two users, ' +
      'consider using `POST /chat/conversations/direct` instead (idempotent).\n\n' +
      '**GROUP conversations** require at least 2 participants and optionally a title.\n\n' +
      'Conversations can optionally be linked to a project or contract for context.',
  })
  @ApiBody({ type: CreateConversationDto })
  @ApiResponse({
    status: 201,
    description: 'Conversation created.',
    schema: {
      example: {
        success: true,
        data: {
          id: 'conv-uuid',
          type: 'DIRECT',
          title: null,
          participants: [
            { userId: 'user-uuid-1', joinedAt: '2025-01-15T10:00:00.000Z' },
            { userId: 'user-uuid-2', joinedAt: '2025-01-15T10:00:00.000Z' },
          ],
          project: null,
          contract: null,
          createdAt: '2025-01-15T10:00:00.000Z',
        },
        message: 'Conversation created successfully.',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation error or invalid participant count.' })
  @ApiResponse({ status: 404, description: 'One or more participant user IDs not found.' })
  async createConversation(
    @Body() dto: CreateConversationDto,
    @CurrentUser('id') userId: string,
  ) {
    // Ensure the requesting user is always included as a participant
    const userIds = dto.userIds.includes(userId)
      ? dto.userIds
      : [userId, ...dto.userIds];

    const conversation = await this.chatService.createConversation(
      userIds,
      dto.type,
      dto.projectId,
      dto.contractId,
      dto.title,
    );

    return { data: conversation, message: 'Conversation created successfully.' };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /chat/conversations/direct
  // Get or create a DIRECT conversation (idempotent).
  // ─────────────────────────────────────────────────────────────────────────────

  @Post('conversations/direct')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get or create a direct conversation (idempotent)',
    description:
      'Finds an existing DIRECT conversation between the authenticated user and the ' +
      'specified user, or creates one if none exists.\n\n' +
      'This is the recommended way to initiate a 1:1 chat from the UI ' +
      '(e.g. clicking "Message" on a freelancer\'s profile) because it is safe ' +
      'to call multiple times without creating duplicate conversations.',
  })
  @ApiBody({ type: GetOrCreateDirectConversationDto })
  @ApiResponse({
    status: 200,
    description: 'Existing or newly created direct conversation.',
    schema: {
      example: {
        success: true,
        data: {
          id: 'conv-uuid',
          type: 'DIRECT',
          participants: [
            { userId: 'current-user-uuid' },
            { userId: 'other-user-uuid' },
          ],
          createdAt: '2025-01-15T10:00:00.000Z',
        },
        message: 'Direct conversation ready.',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Cannot start a conversation with yourself.' })
  @ApiResponse({ status: 404, description: 'Target user not found.' })
  async getOrCreateDirectConversation(
    @Body() dto: GetOrCreateDirectConversationDto,
    @CurrentUser('id') userId: string,
  ) {
    const conversation = await this.chatService.getOrCreateDirectConversation(
      userId,
      dto.userId,
    );
    return { data: conversation, message: 'Direct conversation ready.' };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /chat/conversations/:id
  // Get a single conversation by ID.
  // ─────────────────────────────────────────────────────────────────────────────

  @Get('conversations/:id')
  @ApiOperation({
    summary: 'Get a conversation by ID',
    description:
      'Returns the full details of a single conversation including all participants, ' +
      'last message, linked project/contract, and the requesting user\'s unread count.\n\n' +
      'Returns 403 if the requesting user is not a participant.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Conversation UUID.' })
  @ApiResponse({
    status: 200,
    description: 'Conversation returned.',
  })
  @ApiResponse({ status: 403, description: 'Not a participant of this conversation.' })
  @ApiResponse({ status: 404, description: 'Conversation not found.' })
  async getConversation(
    @Param('id', ParseUUIDPipe) conversationId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.chatService.getConversationById(conversationId, userId);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /chat/conversations/:id/messages
  // Paginated message history for a conversation.
  // ─────────────────────────────────────────────────────────────────────────────

  @Get('conversations/:id/messages')
  @ApiOperation({
    summary: 'Get messages in a conversation',
    description:
      'Returns a paginated list of messages for the specified conversation.\n\n' +
      '**Access control:** Only participants can read the message history.\n\n' +
      '**Pagination options:**\n' +
      '- **Page-based** (`page` + `limit`): standard offset pagination, best for ' +
      'navigating to a specific point in the history.\n' +
      '- **Cursor-based** (`cursor` = last message ID): returns messages older than ' +
      'the cursor, ideal for infinite-scroll "load more" UIs — pass the `nextCursor` ' +
      'value from the previous response as `cursor` in the next request.\n\n' +
      'Messages are returned in **chronological order** (oldest first). ' +
      'Each message includes sender profile, file metadata, reply-to reference, ' +
      'and emoji reactions.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Conversation UUID.' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (1-based, default: 1). Ignored when cursor is provided.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Messages per page (default: 50, max: 100).',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description:
      'Message UUID cursor for cursor-based pagination. ' +
      'Returns messages with IDs less than (older than) this cursor.',
  })
  @ApiResponse({
    status: 200,
    description: 'Message list returned.',
    schema: {
      example: {
        success: true,
        data: {
          items: [
            {
              id: 'msg-uuid-1',
              content: 'Hi! I saw your project and I am very interested.',
              type: 'TEXT',
              isRead: true,
              fileUrl: null,
              replyTo: null,
              reactions: [],
              sender: {
                id: 'user-uuid',
                firstName: 'Alice',
                lastName: 'Smith',
                avatar: 'https://...',
              },
              createdAt: '2025-01-15T09:00:00.000Z',
            },
            {
              id: 'msg-uuid-2',
              content: 'Great! Tell me more about your experience.',
              type: 'TEXT',
              isRead: false,
              fileUrl: null,
              replyTo: null,
              reactions: [{ emoji: '👍', userId: 'user-uuid' }],
              sender: {
                id: 'other-user-uuid',
                firstName: 'John',
                lastName: 'Doe',
                avatar: null,
              },
              createdAt: '2025-01-15T09:05:00.000Z',
            },
          ],
          total: 42,
          page: 1,
          limit: 50,
          totalPages: 1,
          nextCursor: null,
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Not a participant of this conversation.' })
  @ApiResponse({ status: 404, description: 'Conversation not found.' })
  async getMessages(
    @Param('id', ParseUUIDPipe) conversationId: string,
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.chatService.getMessages(conversationId, userId, {
      page:   page  ? parseInt(page, 10)  : 1,
      limit:  limit ? parseInt(limit, 10) : 50,
      cursor: cursor ?? undefined,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /chat/conversations/:id/messages
  // Send a message via REST (fallback when WebSocket is unavailable).
  // ─────────────────────────────────────────────────────────────────────────────

  @Post('conversations/:id/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Send a message (REST fallback)',
    description:
      'Sends a message to a conversation via REST.\n\n' +
      '**Prefer the WebSocket `send-message` event** on the `/chat` namespace ' +
      'for real-time delivery — this REST endpoint is a fallback for environments ' +
      'where WebSockets are unavailable (e.g. some corporate proxies, serverless).\n\n' +
      'The persisted message is returned but **no real-time broadcast occurs** — ' +
      'the recipient will see it the next time they poll or reconnect via WebSocket.\n\n' +
      'If you need the other participants to receive the message in real-time, ' +
      'emit it via the WebSocket gateway instead.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Conversation UUID.' })
  @ApiBody({ type: SendMessageDto })
  @ApiResponse({
    status: 201,
    description: 'Message sent.',
    schema: {
      example: {
        success: true,
        data: {
          id: 'msg-uuid',
          conversationId: 'conv-uuid',
          content: 'Hey! I just reviewed your project requirements. Happy to discuss further.',
          type: 'TEXT',
          isRead: false,
          fileUrl: null,
          fileName: null,
          fileSize: null,
          replyTo: null,
          sender: {
            id: 'current-user-uuid',
            firstName: 'Alice',
            lastName: 'Smith',
            avatar: 'https://...',
          },
          createdAt: '2025-01-15T10:35:00.000Z',
        },
        message: 'Message sent.',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 403, description: 'Not a participant of this conversation.' })
  @ApiResponse({ status: 404, description: 'Conversation not found.' })
  async sendMessage(
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() dto: SendMessageDto,
    @CurrentUser('id') userId: string,
  ) {
    const message = await this.chatService.sendMessage(conversationId, userId, {
      content:   dto.content,
      type:      dto.type,
      fileUrl:   dto.fileUrl,
      fileName:  dto.fileName,
      fileSize:  dto.fileSize,
      replyToId: dto.replyToId,
    });

    this.logger.log(
      `REST message sent: ${message.id} | conversation: ${conversationId} | sender: ${userId}`,
    );

    return { data: message, message: 'Message sent.' };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PATCH /chat/conversations/:id/read
  // Mark all messages in a conversation as read.
  // ─────────────────────────────────────────────────────────────────────────────

  @Patch('conversations/:id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark conversation as read',
    description:
      'Marks all messages in the specified conversation as read for the ' +
      'authenticated user.\n\n' +
      'This updates the user\'s `lastReadAt` timestamp for the conversation ' +
      'and resets the Redis unread counter to 0.\n\n' +
      '**Real-time:** For real-time read-receipt updates to other participants, ' +
      'emit the `mark-read` event on the `/chat` WebSocket namespace instead. ' +
      'This REST endpoint performs the same DB/cache update but does **not** ' +
      'broadcast a Socket.IO event.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Conversation UUID.' })
  @ApiResponse({
    status: 200,
    description: 'Conversation marked as read.',
    schema: {
      example: {
        success: true,
        data: { conversationId: 'conv-uuid', readAt: '2025-01-15T10:40:00.000Z' },
        message: 'Conversation marked as read.',
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Not a participant of this conversation.' })
  @ApiResponse({ status: 404, description: 'Conversation not found.' })
  async markAsRead(
    @Param('id', ParseUUIDPipe) conversationId: string,
    @CurrentUser('id') userId: string,
  ) {
    const readAt = new Date();
    await this.chatService.markAsRead(conversationId, userId);

    return {
      data:    { conversationId, readAt: readAt.toISOString() },
      message: 'Conversation marked as read.',
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /chat/unread-count
  // Total unread message count across all conversations.
  // ─────────────────────────────────────────────────────────────────────────────

  @Get('unread-count')
  @ApiOperation({
    summary: 'Get total unread message count',
    description:
      'Returns the total number of unread messages across all conversations ' +
      'for the authenticated user.\n\n' +
      'This is suitable for displaying a badge on the chat icon in the navigation bar.\n\n' +
      'Counts are served from Redis (O(n) where n = number of conversations) ' +
      'for fast response times.',
  })
  @ApiResponse({
    status: 200,
    description: 'Unread count returned.',
    schema: {
      example: {
        success: true,
        data: { unreadCount: 7 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getUnreadCount(@CurrentUser('id') userId: string) {
    const unreadCount = await this.chatService.getUnreadCount(userId);
    return { unreadCount };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DELETE /chat/conversations/:conversationId/messages/:messageId
  // Soft-delete a message (sender or ADMIN only).
  // ─────────────────────────────────────────────────────────────────────────────

  @Delete('conversations/:conversationId/messages/:messageId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a message',
    description:
      'Soft-deletes a message from a conversation. ' +
      'Only the original message sender or an ADMIN can delete a message.\n\n' +
      'The message row is kept in the database for audit/moderation purposes — ' +
      'the content is replaced with "This message has been deleted." and ' +
      '`deletedAt` is set. ' +
      'Deleted messages are excluded from normal message listings.',
  })
  @ApiParam({ name: 'conversationId', type: String, description: 'Conversation UUID.' })
  @ApiParam({ name: 'messageId',      type: String, description: 'Message UUID to delete.' })
  @ApiResponse({
    status: 200,
    description: 'Message deleted.',
    schema: {
      example: {
        success: true,
        data: {
          id: 'msg-uuid',
          content: 'This message has been deleted.',
          deletedAt: '2025-01-15T11:00:00.000Z',
        },
        message: 'Message deleted.',
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Not the message sender or not an admin.' })
  @ApiResponse({ status: 404, description: 'Message or conversation not found.' })
  @ApiResponse({ status: 409, description: 'Message has already been deleted.' })
  async deleteMessage(
    @Param('conversationId', ParseUUIDPipe) _conversationId: string,
    @Param('messageId',      ParseUUIDPipe) messageId:      string,
    @CurrentUser('id')   userId:   string,
    @CurrentUser('role') userRole: string,
  ) {
    const deleted = await this.chatService.deleteMessage(messageId, userId, userRole);
    return { data: deleted, message: 'Message deleted.' };
  }
}
