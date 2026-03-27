import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
  WsException,
} from '@nestjs/websockets';
import { Logger, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { RedisService } from '../common/redis/redis.service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ONLINE_STATUS_TTL = 300; // 5 minutes — refreshed on every event
const TYPING_DEBOUNCE_MS = 5000; // stop-typing auto-fired after 5s of inactivity

// Redis key helpers
const onlineKey   = (userId: string) => `chat:online:${userId}`;
const socketKey   = (userId: string) => `chat:socket:${userId}`;
const typingTimer = new Map<string, NodeJS.Timeout>(); // socketId → timer

// ---------------------------------------------------------------------------
// Payload interfaces
// ---------------------------------------------------------------------------

interface AuthenticatedSocket extends Socket {
  userId:    string;
  userEmail: string;
  userRole:  string;
}

interface JoinConversationPayload {
  conversationId: string;
}

interface SendMessagePayload {
  conversationId: string;
  content:        string;
  type?:          'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM';
  fileUrl?:       string;
  fileName?:      string;
  fileSize?:      number;
  replyToId?:     string;
}

interface TypingPayload {
  conversationId: string;
}

interface MarkReadPayload {
  conversationId: string;
}

// ---------------------------------------------------------------------------
// Gateway
// ---------------------------------------------------------------------------

/**
 * ChatGateway
 *
 * Socket.IO WebSocket gateway for the `/chat` namespace.
 *
 * Authentication
 * ──────────────
 * A JWT access token must be supplied in the Socket.IO handshake either as:
 *   - `socket.handshake.auth.token`        (preferred — never in URL)
 *   - `socket.handshake.headers.authorization` (Bearer <token>)
 *
 * The token is verified in handleConnection(). Unauthenticated sockets are
 * immediately disconnected.
 *
 * Rooms
 * ─────
 * Each authenticated user is automatically joined to two rooms:
 *   1. `user:<userId>`                  — personal room for direct notifications
 *   2. `conversation:<id>` (on-demand)  — joined via the join-conversation event
 *
 * Scaling
 * ───────
 * For multi-instance deployments, replace the default in-memory Socket.IO
 * adapter with @socket.io/redis-adapter so that events emitted on one node
 * are broadcast to clients connected to other nodes.
 */
@Injectable()
@WebSocketGateway({
  cors: {
    origin:      '*',
    methods:     ['GET', 'POST'],
    credentials: true,
  },
  namespace:       '/chat',
  transports:      ['websocket', 'polling'],
  pingInterval:    25_000,
  pingTimeout:     20_000,
  maxHttpBufferSize: 1e6, // 1 MB max message size
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService:    ChatService,
    private readonly jwtService:     JwtService,
    private readonly configService:  ConfigService,
    private readonly redisService:   RedisService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // Lifecycle hooks
  // ─────────────────────────────────────────────────────────────────────────────

  afterInit(server: Server): void {
    this.logger.log('ChatGateway initialised — Socket.IO /chat namespace ready.');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // handleConnection — authenticate incoming socket
  // ─────────────────────────────────────────────────────────────────────────────

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    try {
      // ── 1. Extract JWT ──────────────────────────────────────────────────────
      const token = this.extractToken(client);

      if (!token) {
        this.rejectClient(client, 'Authentication token is missing.');
        return;
      }

      // ── 2. Verify & decode ──────────────────────────────────────────────────
      const jwtSecret = this.configService.get<string>('JWT_SECRET', 'fallback-secret');
      let payload: any;

      try {
        payload = await this.jwtService.verifyAsync(token, { secret: jwtSecret });
      } catch {
        this.rejectClient(client, 'Invalid or expired authentication token.');
        return;
      }

      // ── 3. Attach user identity to the socket ───────────────────────────────
      client.userId    = payload.sub;
      client.userEmail = payload.email;
      client.userRole  = payload.role;

      // ── 4. Join personal room ───────────────────────────────────────────────
      await client.join(`user:${client.userId}`);

      // ── 5. Track online status in Redis ────────────────────────────────────
      await this.redisService.setex(
        onlineKey(client.userId),
        ONLINE_STATUS_TTL,
        '1',
      );
      await this.redisService.hset(
        socketKey(client.userId),
        client.id,
        new Date().toISOString(),
      );

      // ── 6. Notify contacts that this user came online ───────────────────────
      this.server.emit(`user:${client.userId}:online`, {
        userId:   client.userId,
        isOnline: true,
        socketId: client.id,
      });

      this.logger.log(
        `Client connected: socketId=${client.id} | userId=${client.userId} | ` +
          `email=${client.userEmail}`,
      );

      // Acknowledge successful connection to the client
      client.emit('connected', {
        socketId: client.id,
        userId:   client.userId,
        message:  'Connected to chat server.',
      });
    } catch (err) {
      this.logger.error(`Unexpected error in handleConnection: ${err?.message}`, err?.stack);
      this.rejectClient(client, 'Internal server error during authentication.');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // handleDisconnect — clean up on socket close
  // ─────────────────────────────────────────────────────────────────────────────

  async handleDisconnect(client: AuthenticatedSocket): Promise<void> {
    if (!client.userId) {
      // Unauthenticated socket disconnected — nothing to clean up
      return;
    }

    try {
      // ── 1. Remove this socket from the Redis socket map ─────────────────────
      await this.redisService.hdel(socketKey(client.userId), client.id);

      // ── 2. Check if the user still has other active sockets ────────────────
      const remainingSockets = await this.redisService.hkeys(socketKey(client.userId));

      if (remainingSockets.length === 0) {
        // No more active connections — mark user as offline
        await this.redisService.del(onlineKey(client.userId));

        // Update lastSeen in the database (fire-and-forget)
        this.chatService
          .updateUserLastSeen(client.userId)
          .catch((err) =>
            this.logger.warn(
              `Failed to update lastSeen for user ${client.userId}: ${err.message}`,
            ),
          );

        // Notify contacts that user went offline
        this.server.emit(`user:${client.userId}:offline`, {
          userId:   client.userId,
          isOnline: false,
          lastSeen: new Date().toISOString(),
        });
      }

      // ── 3. Clear any pending typing timers for this socket ─────────────────
      const timer = typingTimer.get(client.id);
      if (timer) {
        clearTimeout(timer);
        typingTimer.delete(client.id);
      }

      this.logger.log(
        `Client disconnected: socketId=${client.id} | userId=${client.userId}`,
      );
    } catch (err) {
      this.logger.error(
        `Error in handleDisconnect for userId=${client.userId}: ${err?.message}`,
        err?.stack,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // join-conversation
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Client joins a conversation room.
   *
   * Validates that the authenticated user is a participant of the conversation
   * before admitting them to the Socket.IO room.  This prevents users from
   * eavesdropping on conversations they are not part of.
   *
   * Emits:
   *   → `conversation:joined`  to the caller on success
   *   → `error`                to the caller on failure
   */
  @SubscribeMessage('join-conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: JoinConversationPayload,
  ): Promise<void> {
    try {
      if (!this.assertAuthenticated(client)) return;

      const { conversationId } = payload;

      if (!conversationId) {
        client.emit('error', { message: 'conversationId is required.' });
        return;
      }

      // Verify the user is a participant of this conversation
      const isParticipant = await this.chatService.isParticipant(
        conversationId,
        client.userId,
      );

      if (!isParticipant) {
        client.emit('error', {
          message: 'You are not a participant of this conversation.',
          code:    'NOT_PARTICIPANT',
        });
        return;
      }

      const roomName = `conversation:${conversationId}`;
      await client.join(roomName);

      this.logger.debug(
        `User ${client.userId} joined conversation room: ${roomName}`,
      );

      // Acknowledge to the joining user
      client.emit('conversation:joined', {
        conversationId,
        roomName,
        message: `Joined conversation ${conversationId}.`,
      });

      // Notify other participants that this user is now active in the conversation
      client.to(roomName).emit('conversation:participant-active', {
        conversationId,
        userId: client.userId,
      });
    } catch (err) {
      this.logger.error(`join-conversation error: ${err?.message}`, err?.stack);
      client.emit('error', { message: 'Failed to join conversation.', code: 'JOIN_ERROR' });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // send-message
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Persists a new message and broadcasts it to all conversation participants.
   *
   * Flow:
   *   1. Validate the payload.
   *   2. Persist via ChatService (Prisma).
   *   3. Emit `message:new` to the conversation room (including the sender
   *      so all their open tabs receive the message).
   *   4. Emit `message:sent` back to the sender as a delivery receipt.
   *   5. For participants not currently in the room, emit to their personal
   *      `user:<id>` room so they receive a push-style notification.
   *
   * Emits:
   *   → `message:new`   to conversation room
   *   → `message:sent`  to sender (delivery receipt)
   *   → `message:new`   to each offline participant's personal room
   */
  @SubscribeMessage('send-message')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: SendMessagePayload,
  ): Promise<void> {
    try {
      if (!this.assertAuthenticated(client)) return;

      const { conversationId, content, type = 'TEXT', fileUrl, fileName, fileSize, replyToId } = payload;

      // ── Input validation ────────────────────────────────────────────────────
      if (!conversationId) {
        client.emit('error', { message: 'conversationId is required.', code: 'VALIDATION_ERROR' });
        return;
      }

      if (!content && type === 'TEXT') {
        client.emit('error', { message: 'Message content must not be empty.', code: 'VALIDATION_ERROR' });
        return;
      }

      if (content && content.length > 10_000) {
        client.emit('error', { message: 'Message content must not exceed 10 000 characters.', code: 'VALIDATION_ERROR' });
        return;
      }

      // ── Persist message ─────────────────────────────────────────────────────
      const message = await this.chatService.sendMessage(
        conversationId,
        client.userId,
        {
          content,
          type,
          fileUrl,
          fileName,
          fileSize,
          replyToId,
        },
      );

      const roomName = `conversation:${conversationId}`;

      // ── Broadcast to room ───────────────────────────────────────────────────
      // server.to() includes all sockets in the room — including the sender's
      // other open tabs but NOT this specific socket, so we use server.in()
      // which includes everyone.
      this.server.in(roomName).emit('message:new', {
        conversationId,
        message,
      });

      // ── Send delivery receipt to this specific socket ───────────────────────
      client.emit('message:sent', {
        conversationId,
        messageId:   message.id,
        tempId:      (payload as any).tempId, // echo back client's optimistic temp ID
        deliveredAt: message.createdAt,
      });

      // ── Notify offline participants ─────────────────────────────────────────
      // Get the list of participants who are NOT in the room right now
      // (i.e. they haven't called join-conversation) and push to their
      // personal room so their notification handler can show a badge/alert.
      this.chatService
        .getConversationParticipantIds(conversationId)
        .then((participantIds) => {
          participantIds
            .filter((id) => id !== client.userId)
            .forEach((participantId) => {
              this.server
                .to(`user:${participantId}`)
                .emit('message:new', { conversationId, message });
            });
        })
        .catch((err) =>
          this.logger.warn(
            `Failed to notify offline participants for conversation ${conversationId}: ${err.message}`,
          ),
        );

      this.logger.debug(
        `Message sent: id=${message.id} | conversation=${conversationId} | sender=${client.userId}`,
      );
    } catch (err) {
      this.logger.error(`send-message error: ${err?.message}`, err?.stack);
      client.emit('error', { message: 'Failed to send message.', code: 'SEND_ERROR' });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // typing
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Broadcasts a "typing" indicator to all other participants in the room.
   *
   * A debounce timer is set per socket: if the client does not send another
   * `typing` event within TYPING_DEBOUNCE_MS (5s), `stop-typing` is
   * automatically emitted to the room.  This handles the case where the
   * user closes the tab without explicitly stopping typing.
   *
   * Emits:
   *   → `typing` to conversation room (excluding the sender)
   */
  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: TypingPayload,
  ): void {
    if (!this.assertAuthenticated(client)) return;

    const { conversationId } = payload;
    if (!conversationId) return;

    const roomName = `conversation:${conversationId}`;

    // Broadcast to everyone else in the room
    client.to(roomName).emit('typing', {
      conversationId,
      userId:    client.userId,
      userEmail: client.userEmail,
    });

    // Reset the auto-stop timer for this socket
    const existingTimer = typingTimer.get(`${client.id}:${conversationId}`);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(() => {
      client.to(roomName).emit('stop-typing', {
        conversationId,
        userId: client.userId,
      });
      typingTimer.delete(`${client.id}:${conversationId}`);
    }, TYPING_DEBOUNCE_MS);

    typingTimer.set(`${client.id}:${conversationId}`, timer);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // stop-typing
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Broadcasts a "stop-typing" indicator to all other participants in the room.
   *
   * Clears the debounce timer set by the `typing` handler.
   *
   * Emits:
   *   → `stop-typing` to conversation room (excluding the sender)
   */
  @SubscribeMessage('stop-typing')
  handleStopTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: TypingPayload,
  ): void {
    if (!this.assertAuthenticated(client)) return;

    const { conversationId } = payload;
    if (!conversationId) return;

    // Clear auto-stop timer
    const timerKey = `${client.id}:${conversationId}`;
    const timer    = typingTimer.get(timerKey);
    if (timer) {
      clearTimeout(timer);
      typingTimer.delete(timerKey);
    }

    const roomName = `conversation:${conversationId}`;
    client.to(roomName).emit('stop-typing', {
      conversationId,
      userId: client.userId,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // mark-read
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Marks all messages in a conversation as read by the authenticated user.
   *
   * Updates the participant's `lastReadAt` timestamp in the database and
   * emits a `messages:read` event so other participants' UIs can update
   * read receipts in real-time.
   *
   * Emits:
   *   → `messages:read` to conversation room (including sender)
   */
  @SubscribeMessage('mark-read')
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: MarkReadPayload,
  ): Promise<void> {
    try {
      if (!this.assertAuthenticated(client)) return;

      const { conversationId } = payload;
      if (!conversationId) return;

      await this.chatService.markAsRead(conversationId, client.userId);

      const roomName = `conversation:${conversationId}`;

      // Notify all participants (including the reader) so read receipts update
      this.server.in(roomName).emit('messages:read', {
        conversationId,
        userId:    client.userId,
        readAt:    new Date().toISOString(),
      });

      this.logger.debug(
        `Messages marked as read: conversation=${conversationId} | user=${client.userId}`,
      );
    } catch (err) {
      this.logger.error(`mark-read error: ${err?.message}`, err?.stack);
      client.emit('error', { message: 'Failed to mark messages as read.', code: 'MARK_READ_ERROR' });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Public API — used by other services (e.g. NotificationService)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Emits an event directly to a specific user's personal room.
   * Can be called from any service that has ChatGateway injected.
   *
   * @param userId  Target user's UUID.
   * @param event   Socket.IO event name.
   * @param data    Payload to send.
   */
  emitToUser(userId: string, event: string, data: any): void {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  /**
   * Emits an event to all participants in a conversation room.
   *
   * @param conversationId  Target conversation UUID.
   * @param event           Socket.IO event name.
   * @param data            Payload to send.
   */
  emitToConversation(conversationId: string, event: string, data: any): void {
    this.server.to(`conversation:${conversationId}`).emit(event, data);
  }

  /**
   * Returns whether a given user currently has an active Socket.IO connection.
   *
   * @param userId  User UUID to check.
   */
  async isUserOnline(userId: string): Promise<boolean> {
    try {
      const online = await this.redisService.get(onlineKey(userId));
      return online === '1';
    } catch {
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Extracts the JWT from either:
   *   - `socket.handshake.auth.token`  (Socket.IO auth object — preferred)
   *   - `Authorization: Bearer <token>` header
   */
  private extractToken(client: Socket): string | null {
    // Option 1: Socket.IO handshake auth object
    const authToken = (client.handshake.auth as any)?.token as string | undefined;
    if (authToken) return authToken;

    // Option 2: Authorization header
    const authHeader = client.handshake.headers?.authorization as string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7).trim();
    }

    // Option 3: Query parameter (least preferred — ends up in server logs)
    const queryToken = (client.handshake.query as any)?.token as string | undefined;
    if (queryToken) return queryToken;

    return null;
  }

  /**
   * Disconnects an unauthenticated / unauthorised socket with a reason.
   *
   * @param client   The socket to reject.
   * @param reason   Human-readable rejection reason.
   */
  private rejectClient(client: Socket, reason: string): void {
    client.emit('error', { message: reason, code: 'AUTH_ERROR' });
    client.disconnect(true);
    this.logger.warn(`Socket ${client.id} rejected: ${reason}`);
  }

  /**
   * Guards an event handler — ensures the socket is authenticated before
   * processing the event.  Returns `true` if authenticated, `false` otherwise
   * (and sends an error event to the client).
   *
   * @param client  The socket that triggered the event.
   */
  private assertAuthenticated(client: AuthenticatedSocket): boolean {
    if (!client.userId) {
      client.emit('error', {
        message: 'You must be authenticated to perform this action.',
        code:    'AUTH_REQUIRED',
      });
      return false;
    }
    return true;
  }
}
