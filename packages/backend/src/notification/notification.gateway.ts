import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { RedisService } from '../common/redis/redis.service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** TTL for online-presence key in Redis (refreshed on every event). */
const ONLINE_TTL_SECONDS = 300; // 5 minutes

// Redis key helpers
const onlineKey = (userId: string) => `notif:online:${userId}`;
const socketKey = (userId: string) => `notif:socket:${userId}`;
const unreadKey = (userId: string) => `notif:unread:${userId}`;

// ---------------------------------------------------------------------------
// Extended socket interface
// ---------------------------------------------------------------------------

interface AuthenticatedSocket extends Socket {
  userId: string;
  userEmail: string;
  userRole: string;
}

// ---------------------------------------------------------------------------
// Gateway
// ---------------------------------------------------------------------------

/**
 * NotificationGateway
 *
 * Socket.IO WebSocket gateway mounted on the `/notifications` namespace.
 *
 * Responsibilities
 * ────────────────
 * 1. **Authentication** — verifies the JWT supplied in the Socket.IO handshake
 *    before allowing a connection.  Unauthenticated sockets are immediately
 *    disconnected.
 *
 * 2. **Personal rooms** — each authenticated user is auto-joined to a personal
 *    room named `user:<userId>` so that `emitToUser()` can target them
 *    regardless of which server instance holds their socket (when combined
 *    with a Redis Socket.IO adapter).
 *
 * 3. **Presence tracking** — online status and socket IDs are tracked in
 *    Redis so that:
 *    - `NotificationService` can check whether a user is online before
 *      deciding to send an email instead of (or in addition to) an in-app
 *      notification.
 *    - Multi-instance deployments stay consistent without sticky sessions.
 *
 * 4. **emitToUser()** — public method called by `NotificationService` to
 *    push real-time events to a specific user's personal room.
 *
 * 5. **Badge sync** — on connection the gateway emits the current unread
 *    count from Redis so the client badge is immediately up-to-date.
 *
 * Authentication
 * ──────────────
 * Pass the JWT access token in the Socket.IO handshake:
 *
 *   Option A (preferred — never visible in server logs):
 *     ```js
 *     const socket = io('/notifications', {
 *       auth: { token: accessToken },
 *     });
 *     ```
 *
 *   Option B (Authorization header):
 *     ```js
 *     const socket = io('/notifications', {
 *       extraHeaders: { Authorization: `Bearer ${accessToken}` },
 *     });
 *     ```
 *
 * Client-side events to listen for
 * ─────────────────────────────────
 * | Event                   | Payload                                        |
 * |-------------------------|------------------------------------------------|
 * | `connected`             | `{ socketId, userId, unreadCount }`            |
 * | `notification:new`      | `{ notification }` — new in-app notification   |
 * | `notification:read`     | `{ notificationId }` — single mark-as-read     |
 * | `notification:read-all` | `{}` — all notifications marked as read        |
 * | `unread-count`          | `{ count }` — updated badge count              |
 * | `error`                 | `{ message, code }` — gateway-level error      |
 *
 * Client-side events to emit
 * ──────────────────────────
 * | Event              | Payload              | Description                  |
 * |--------------------|----------------------|------------------------------|
 * | `subscribe`        | `{ topics: string[] }`| Subscribe to specific topics |
 * | `unsubscribe`      | `{ topics: string[] }`| Unsubscribe from topics      |
 * | `ping`             | `{}`                  | Heartbeat / keepalive        |
 *
 * Scaling
 * ───────
 * For multi-instance deployments install `@socket.io/redis-adapter` and
 * configure it in the module bootstrap.  All emits using `server.to(room)`
 * will then fan-out across all instances automatically.
 */
@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: '/notifications',
  transports: ['websocket', 'polling'],
  pingInterval: 25_000,
  pingTimeout: 20_000,
})
export class NotificationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // Lifecycle hooks
  // ─────────────────────────────────────────────────────────────────────────────

  afterInit(_server: Server): void {
    this.logger.log(
      'NotificationGateway initialised — Socket.IO /notifications namespace ready.',
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // handleConnection — authenticate and set up the socket
  // ─────────────────────────────────────────────────────────────────────────────

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    try {
      // ── 1. Extract JWT from handshake ─────────────────────────────────────
      const token = this.extractToken(client);

      if (!token) {
        this.rejectClient(client, 'Authentication token is missing.');
        return;
      }

      // ── 2. Verify & decode the JWT ────────────────────────────────────────
      const jwtSecret = this.configService.get<string>(
        'JWT_SECRET',
        'fallback-secret',
      );

      let payload: { sub: string; email: string; role: string };
      try {
        payload = await this.jwtService.verifyAsync(token, {
          secret: jwtSecret,
        });
      } catch (err) {
        this.rejectClient(
          client,
          `Invalid or expired token: ${(err as Error).message}`,
        );
        return;
      }

      // ── 3. Attach user identity to the socket instance ────────────────────
      client.userId = payload.sub;
      client.userEmail = payload.email;
      client.userRole = payload.role;

      // ── 4. Join personal room ─────────────────────────────────────────────
      await client.join(`user:${client.userId}`);

      // ── 5. Track online status in Redis ───────────────────────────────────
      await this.setOnline(client);

      // ── 6. Fetch current unread count from Redis ──────────────────────────
      const unreadCount = await this.getUnreadCount(client.userId);

      // ── 7. Acknowledge successful connection ──────────────────────────────
      client.emit('connected', {
        socketId: client.id,
        userId: client.userId,
        unreadCount,
        message: 'Connected to notification server.',
      });

      this.logger.log(
        `[Notifications] Connected: socketId=${client.id} | ` +
          `userId=${client.userId} | unread=${unreadCount}`,
      );
    } catch (err) {
      this.logger.error(
        `[Notifications] Unexpected error in handleConnection: ${err?.message}`,
        err?.stack,
      );
      this.rejectClient(client, 'Internal server error during authentication.');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // handleDisconnect — clean up presence data
  // ─────────────────────────────────────────────────────────────────────────────

  async handleDisconnect(client: AuthenticatedSocket): Promise<void> {
    if (!client.userId) {
      // Unauthenticated socket — nothing to clean up
      return;
    }

    try {
      // ── 1. Remove this socket from the Redis hash ─────────────────────────
      await this.redisService
        .hdel(socketKey(client.userId), client.id)
        .catch(() => null);

      // ── 2. Check if the user has other active sockets ─────────────────────
      const remainingSockets = await this.redisService
        .hkeys(socketKey(client.userId))
        .catch(() => [] as string[]);

      if (remainingSockets.length === 0) {
        // No more connections for this user — mark offline
        await this.redisService.del(onlineKey(client.userId)).catch(() => null);
      }

      this.logger.log(
        `[Notifications] Disconnected: socketId=${client.id} | userId=${client.userId}`,
      );
    } catch (err) {
      this.logger.error(
        `[Notifications] Error in handleDisconnect for userId=${client.userId}: ${err?.message}`,
        err?.stack,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // subscribe — client subscribes to specific notification topics
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Allows the client to subscribe to named topic rooms
   * (e.g. `project:abc123`, `contract:xyz789`) for scoped notifications.
   *
   * This is optional — all personal notifications are always delivered to
   * the `user:<userId>` room regardless of topic subscriptions.
   */
  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { topics: string[] },
  ): Promise<void> {
    if (!this.assertAuthenticated(client)) return;

    const { topics } = payload;

    if (!Array.isArray(topics) || topics.length === 0) {
      client.emit('error', {
        message: 'topics must be a non-empty array of strings.',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    // Sanitise topic names — only allow alphanumeric, colon, hyphen, underscore
    const safeTopics = topics
      .filter((t) => typeof t === 'string')
      .map((t) => t.trim())
      .filter((t) => /^[a-zA-Z0-9:_\-]{1,100}$/.test(t));

    await Promise.all(safeTopics.map((topic) => client.join(`topic:${topic}`)));

    client.emit('subscribed', { topics: safeTopics });

    this.logger.debug(
      `[Notifications] userId=${client.userId} subscribed to topics: ${safeTopics.join(', ')}`,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // unsubscribe — client unsubscribes from specific notification topics
  // ─────────────────────────────────────────────────────────────────────────────

  @SubscribeMessage('unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { topics: string[] },
  ): Promise<void> {
    if (!this.assertAuthenticated(client)) return;

    const { topics } = payload;

    if (!Array.isArray(topics) || topics.length === 0) return;

    await Promise.all(
      topics
        .filter((t) => typeof t === 'string')
        .map((t) => client.leave(`topic:${t.trim()}`)),
    );

    client.emit('unsubscribed', { topics });

    this.logger.debug(
      `[Notifications] userId=${client.userId} unsubscribed from topics: ${topics.join(', ')}`,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ping — keepalive / heartbeat
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Responds to client heartbeat pings with a `pong` event.
   * Also refreshes the Redis online-status TTL so the user stays
   * marked as online while they keep the tab open.
   */
  @SubscribeMessage('ping')
  async handlePing(
    @ConnectedSocket() client: AuthenticatedSocket,
  ): Promise<void> {
    if (!client.userId) return;

    // Refresh online-status TTL
    await this.redisService
      .setex(onlineKey(client.userId), ONLINE_TTL_SECONDS, '1')
      .catch(() => null);

    client.emit('pong', { timestamp: new Date().toISOString() });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Public API — called by NotificationService
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Emits a real-time event to a specific user's personal room.
   *
   * Called by `NotificationService.createNotification()` after persisting the
   * notification to the database so the user receives it instantly without
   * polling.
   *
   * Works across multiple server instances when the Redis Socket.IO adapter
   * is configured (events are published to Redis Pub/Sub and picked up by
   * whichever instance holds the user's socket).
   *
   * @param userId  Target user's UUID — emits to `user:<userId>` room.
   * @param event   Socket.IO event name (e.g. `'notification:new'`).
   * @param data    Payload to deliver to the client.
   */
  emitToUser(userId: string, event: string, data: unknown): void {
    if (!this.server) {
      this.logger.warn(
        `[Notifications] emitToUser called before server is initialised. ` +
          `Dropping event "${event}" for userId=${userId}.`,
      );
      return;
    }

    this.server.to(`user:${userId}`).emit(event, data);

    this.logger.debug(
      `[Notifications] emitToUser: userId=${userId} | event="${event}"`,
    );
  }

  /**
   * Emits a real-time event to all subscribers of a named topic room.
   *
   * Useful for broadcast-style notifications (e.g. platform announcements)
   * where the target is a group rather than a single user.
   *
   * @param topic  Topic identifier (joined as `topic:<topic>`).
   * @param event  Socket.IO event name.
   * @param data   Payload to deliver.
   */
  emitToTopic(topic: string, event: string, data: unknown): void {
    if (!this.server) return;

    this.server.to(`topic:${topic}`).emit(event, data);

    this.logger.debug(
      `[Notifications] emitToTopic: topic=${topic} | event="${event}"`,
    );
  }

  /**
   * Broadcasts a real-time event to every connected authenticated user.
   *
   * Use sparingly — only for platform-wide announcements.
   *
   * @param event  Socket.IO event name.
   * @param data   Payload to deliver.
   */
  broadcast(event: string, data: unknown): void {
    if (!this.server) return;

    this.server.emit(event, data);

    this.logger.debug(
      `[Notifications] broadcast: event="${event}"`,
    );
  }

  /**
   * Returns whether the given user has at least one active connection to this
   * gateway namespace.
   *
   * Checks the Redis online-status key rather than querying Socket.IO's in-memory
   * adapter, so it works correctly in multi-instance deployments.
   *
   * @param userId  User UUID to check.
   */
  async isUserOnline(userId: string): Promise<boolean> {
    try {
      const value = await this.redisService.get(onlineKey(userId));
      return value === '1';
    } catch {
      return false;
    }
  }

  /**
   * Increments the in-memory + Redis unread notification counter for a user
   * and immediately emits an updated `unread-count` event to their socket.
   *
   * Called by `NotificationService` after persisting a new notification so
   * the client badge updates without an explicit poll.
   *
   * @param userId  Target user's UUID.
   */
  async incrementUnreadCount(userId: string): Promise<void> {
    try {
      const newCount = await this.redisService.incr(unreadKey(userId));
      this.emitToUser(userId, 'unread-count', { count: newCount });
    } catch (err) {
      this.logger.warn(
        `[Notifications] Failed to increment unread count for userId=${userId}: ${err?.message}`,
      );
    }
  }

  /**
   * Resets the Redis unread notification counter for a user to 0 and emits
   * the updated count.
   *
   * Called by `NotificationService.markAllAsRead()`.
   *
   * @param userId  Target user's UUID.
   */
  async resetUnreadCount(userId: string): Promise<void> {
    try {
      await this.redisService.set(unreadKey(userId), '0');
      this.emitToUser(userId, 'unread-count', { count: 0 });
    } catch (err) {
      this.logger.warn(
        `[Notifications] Failed to reset unread count for userId=${userId}: ${err?.message}`,
      );
    }
  }

  /**
   * Decrements the Redis unread notification counter for a user by 1 (minimum 0)
   * and emits the updated count.
   *
   * Called by `NotificationService.markAsRead()` for a single notification.
   *
   * @param userId  Target user's UUID.
   */
  async decrementUnreadCount(userId: string): Promise<void> {
    try {
      const current = await this.getUnreadCount(userId);
      const newCount = Math.max(0, current - 1);
      await this.redisService.set(unreadKey(userId), String(newCount));
      this.emitToUser(userId, 'unread-count', { count: newCount });
    } catch (err) {
      this.logger.warn(
        `[Notifications] Failed to decrement unread count for userId=${userId}: ${err?.message}`,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Reads the current unread notification count from Redis.
   * Returns 0 on cache miss or error.
   */
  private async getUnreadCount(userId: string): Promise<number> {
    try {
      const raw = await this.redisService.get(unreadKey(userId));
      return raw ? parseInt(raw, 10) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Marks a socket's user as online in Redis:
   *   - Sets a TTL-based presence key (`notif:online:<userId>`)
   *   - Adds the socket ID to a hash of active sockets for this user
   *     (`notif:socket:<userId>`) so multi-tab / multi-device connections
   *     are tracked correctly.
   */
  private async setOnline(client: AuthenticatedSocket): Promise<void> {
    await Promise.allSettled([
      this.redisService.setex(onlineKey(client.userId), ONLINE_TTL_SECONDS, '1'),
      this.redisService.hset(
        socketKey(client.userId),
        client.id,
        new Date().toISOString(),
      ),
    ]);
  }

  /**
   * Extracts the JWT bearer token from the Socket.IO handshake.
   *
   * Priority order:
   *   1. `socket.handshake.auth.token`          — Socket.IO auth object (preferred)
   *   2. `Authorization: Bearer <token>` header — HTTP upgrade headers
   *   3. `socket.handshake.query.token`          — query string (least secure)
   */
  private extractToken(client: Socket): string | null {
    // Option 1: Socket.IO auth object
    const authToken = (client.handshake.auth as Record<string, string>)?.token;
    if (authToken && typeof authToken === 'string' && authToken.trim()) {
      return authToken.trim();
    }

    // Option 2: Authorization header
    const authHeader = client.handshake.headers?.authorization as string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token) return token;
    }

    // Option 3: Query parameter (visible in server logs — discouraged)
    const queryToken = (client.handshake.query as Record<string, string>)?.token;
    if (queryToken && typeof queryToken === 'string' && queryToken.trim()) {
      this.logger.warn(
        `[Notifications] JWT passed as query param for socket ${client.id} — ` +
          'prefer socket.handshake.auth.token to avoid token leakage in server logs.',
      );
      return queryToken.trim();
    }

    return null;
  }

  /**
   * Emits an `error` event to the client and then disconnects the socket.
   * Used to cleanly reject unauthenticated or unauthorised connections.
   *
   * @param client  The socket to reject.
   * @param reason  Human-readable rejection reason sent to the client.
   */
  private rejectClient(client: Socket, reason: string): void {
    client.emit('error', {
      message: reason,
      code: 'AUTH_ERROR',
    });
    client.disconnect(true);
    this.logger.warn(
      `[Notifications] Socket ${client.id} rejected: ${reason}`,
    );
  }

  /**
   * Guards an event handler by verifying the socket is authenticated.
   * Returns `true` if authenticated; otherwise sends an `error` event
   * to the client and returns `false`.
   *
   * @param client  The socket that triggered the event.
   */
  private assertAuthenticated(client: AuthenticatedSocket): boolean {
    if (!client.userId) {
      client.emit('error', {
        message: 'You must be authenticated to perform this action.',
        code: 'AUTH_REQUIRED',
      });
      return false;
    }
    return true;
  }
}
