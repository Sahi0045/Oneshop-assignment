import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";

import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";
import { ChatGateway } from "./chat.gateway";
import { PrismaModule } from "../common/prisma/prisma.module";
import { RedisModule } from "../common/redis/redis.module";

/**
 * ChatModule
 *
 * Provides real-time messaging capabilities through two complementary layers:
 *
 * 1. **WebSocket layer** (ChatGateway)
 *    - Socket.IO gateway on the `/chat` namespace
 *    - JWT authentication at handshake time
 *    - Events: join-conversation, send-message, typing, stop-typing, mark-read
 *    - Users are automatically joined to a personal room (`user:<id>`) on connect
 *    - Typing indicators are broadcast to room members except the sender
 *
 * 2. **REST layer** (ChatController)
 *    - Fallback HTTP endpoints for environments where WebSockets are unavailable
 *      (e.g. serverless functions, some corporate proxies)
 *    - CRUD on conversations and messages
 *    - Mark-as-read and unread-count endpoints
 *
 * State management
 * ────────────────
 * - Active socket connections are tracked in Redis (hash keyed by userId)
 *   so that `ChatGateway.emitToUser()` works across multiple server instances
 *   (horizontal scaling / sticky sessions not required).
 * - Message persistence is handled by Prisma (PostgreSQL).
 * - Unread counts are cached in Redis and invalidated on mark-as-read.
 *
 * Microservice extraction path
 * ────────────────────────────
 * When splitting into a standalone chat microservice:
 *   1. Replace PrismaModule with an HTTP/gRPC client.
 *   2. Replace the in-process ChatGateway with a dedicated Socket.IO server.
 *   3. Use Redis Pub/Sub (already available via RedisService) for cross-instance
 *      message fan-out instead of the current in-memory Socket.IO adapter.
 *   4. Wire up the Redis Socket.IO adapter (@socket.io/redis-adapter) for
 *      multi-node deployments.
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
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService, ChatGateway, JwtModule],
})
export class ChatModule {}
