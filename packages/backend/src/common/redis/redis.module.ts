import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

/**
 * RedisModule
 *
 * A globally-scoped NestJS module that provides a single shared RedisService
 * instance (backed by ioredis) to every other module in the application.
 *
 * The @Global() decorator means consuming modules do NOT need to import
 * RedisModule — they simply inject RedisService directly:
 *
 * ```typescript
 * @Injectable()
 * export class AuthService {
 *   constructor(private readonly redisService: RedisService) {}
 * }
 * ```
 *
 * Configuration
 * ─────────────
 * The Redis connection is configured from environment variables via ConfigService:
 *
 *   REDIS_URL   redis://[[username:]password@]host[:port][/db-number]
 *               Takes priority over individual REDIS_HOST / REDIS_PORT / REDIS_PASSWORD.
 *
 *   REDIS_HOST  (default: localhost)
 *   REDIS_PORT  (default: 6379)
 *   REDIS_PASSWORD  (optional)
 *   REDIS_DB    Database index (default: 0)
 *
 * Usage patterns
 * ──────────────
 * • Auth     — store refresh-token hashes, email-verify tokens, password-reset tokens
 * • Cache    — project view counts (write-behind), user profile cache
 * • Sessions — online-presence keys (TTL-based), socket-ID hashes
 * • Pub/Sub  — cross-instance real-time event fan-out (future)
 *
 * Microservice extraction path
 * ────────────────────────────
 * When splitting a feature into a standalone microservice:
 *   1. Keep RedisModule in the new service unchanged.
 *   2. The shared Redis instance can be used as the Pub/Sub transport
 *      between the monolith and the new microservice during the transition.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    RedisService,
  ],
  exports: [RedisService],
})
export class RedisModule {}
