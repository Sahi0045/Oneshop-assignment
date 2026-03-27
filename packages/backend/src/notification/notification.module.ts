import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";

import { NotificationController } from "./notification.controller";
import { NotificationService } from "./notification.service";
import { NotificationGateway } from "./notification.gateway";
import { PrismaModule } from "../common/prisma/prisma.module";
import { RedisModule } from "../common/redis/redis.module";

/**
 * NotificationModule
 *
 * Provides multi-channel notification delivery for the freelancer platform:
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  Channel           │ Mechanism                                          │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │  In-app (real-time)│ Socket.IO /notifications namespace (Gateway)       │
 * │  In-app (persisted)│ Prisma → Notification table                        │
 * │  Email             │ SendGrid (@sendgrid/mail)                           │
 * │  Push (future)     │ FCM stub — wire up when mobile app is ready        │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Architecture
 * ────────────
 * NotificationService is the single entry-point for creating notifications.
 * Other feature modules (PaymentModule, ProjectModule, ChatModule) should
 * import NotificationModule and inject NotificationService to dispatch
 * notifications without coupling to the delivery mechanism.
 *
 * NotificationGateway exposes an `emitToUser(userId, event, data)` helper
 * that NotificationService uses to push real-time events over Socket.IO.
 * The gateway also manages user authentication at handshake time so only
 * authenticated users receive notifications.
 *
 * NotificationController exposes REST endpoints for:
 *   - Fetching paginated notification history
 *   - Marking individual or all notifications as read
 *   - Getting the unread notification count (badge number)
 *
 * Redis usage
 * ───────────
 * • Unread count is cached per user: `notif:unread:<userId>` (INCR / SET 0)
 * • Socket ID map: `notif:socket:<userId>` (HSET) for multi-instance awareness
 *
 * Microservice extraction path
 * ────────────────────────────
 * When splitting into a standalone notification microservice:
 *   1. Consume Kafka topics (bid.received, payment.received, milestone.approved,
 *      contract.started, …) instead of being called in-process.
 *   2. Replace PrismaModule with an HTTP/gRPC client for user lookups.
 *   3. Keep NotificationGateway + SendGrid integration unchanged.
 *   4. Add a Redis Pub/Sub subscriber so the gateway can fan-out events
 *      across multiple notification-service instances.
 */
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET", "fallback-secret"),
        signOptions: {
          expiresIn: configService.get<string>("JWT_EXPIRES_IN", "15m"),
        },
      }),
    }),
  ],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationGateway],
  exports: [NotificationService, NotificationGateway, JwtModule],
})
export class NotificationModule {}
