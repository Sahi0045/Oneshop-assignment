import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * PrismaModule
 *
 * A globally-scoped NestJS module that provides PrismaService to every
 * other module in the application without needing to be explicitly imported.
 *
 * The @Global() decorator ensures that PrismaService is available application-wide
 * via NestJS's dependency injection container — modules only need to inject
 * PrismaService directly without listing PrismaModule in their `imports` array.
 *
 * Why global?
 * ───────────
 * Prisma's PrismaClient maintains a connection pool to the database.
 * Creating multiple PrismaClient instances (one per feature module) would
 * exhaust the database connection pool and cause performance issues.
 * Declaring PrismaModule as @Global() guarantees that exactly ONE
 * PrismaService instance is shared across all modules (singleton scope).
 *
 * Usage in feature modules
 * ────────────────────────
 * Because PrismaModule is global, feature modules do NOT need to import it:
 *
 * ```typescript
 * // ✅  Just inject PrismaService directly — no import needed
 * @Injectable()
 * export class ProjectService {
 *   constructor(private readonly prisma: PrismaService) {}
 * }
 * ```
 *
 * If you ever need to import PrismaModule explicitly (e.g. in a standalone
 * testing module), add it to the `imports` array of your test module:
 *
 * ```typescript
 * // In a Jest test module:
 * const module = await Test.createTestingModule({
 *   imports: [PrismaModule],
 *   providers: [ProjectService],
 * }).compile();
 * ```
 *
 * Lifecycle
 * ─────────
 * PrismaService implements OnModuleInit and OnModuleDestroy:
 *   - onModuleInit()    → calls this.$connect() to open the DB connection
 *   - onModuleDestroy() → calls this.$disconnect() to cleanly close it
 *
 * NestJS calls these hooks automatically during application startup and
 * graceful shutdown respectively.
 *
 * Microservice extraction path
 * ────────────────────────────
 * When splitting a feature module into a standalone microservice:
 *   1. Keep PrismaModule + PrismaService in the new service's module.
 *   2. The original monolith replaces the Prisma dependency with an
 *      HTTP/gRPC client that calls the new microservice.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports:   [PrismaService],
})
export class PrismaModule {}
