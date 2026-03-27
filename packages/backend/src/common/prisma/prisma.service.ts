import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaService
 *
 * Extends PrismaClient so that every Prisma model accessor (e.g.
 * `this.prisma.user`, `this.prisma.project`) is available directly on the
 * service instance via normal NestJS dependency injection.
 *
 * Lifecycle
 * ─────────
 * • onModuleInit    → opens the database connection pool ($connect)
 * • onModuleDestroy → cleanly closes the connection pool ($disconnect)
 *
 * NestJS calls these hooks automatically during application bootstrap and
 * graceful shutdown, so you never need to call connect/disconnect manually.
 *
 * Usage
 * ─────
 * Because PrismaModule is declared @Global(), simply inject PrismaService
 * anywhere in the application without importing PrismaModule first:
 *
 * ```typescript
 * @Injectable()
 * export class ProjectService {
 *   constructor(private readonly prisma: PrismaService) {}
 *
 *   async findAll() {
 *     return this.prisma.project.findMany();
 *   }
 * }
 * ```
 *
 * Transactions
 * ────────────
 * Use `this.prisma.$transaction([...])` for sequential operations that must
 * succeed or fail atomically:
 *
 * ```typescript
 * const [bid, project] = await this.prisma.$transaction([
 *   this.prisma.bid.create({ data: { ... } }),
 *   this.prisma.project.update({ where: { id }, data: { bidCount: { increment: 1 } } }),
 * ]);
 * ```
 *
 * For interactive transactions (where you need to read before writing):
 *
 * ```typescript
 * await this.prisma.$transaction(async (tx) => {
 *   const project = await tx.project.findUnique({ where: { id } });
 *   if (project.status !== 'OPEN') throw new Error('Not open');
 *   await tx.bid.create({ data: { projectId: id, ... } });
 * });
 * ```
 *
 * Middleware / Extensions
 * ───────────────────────
 * Add Prisma middleware in onModuleInit() before $connect() if needed:
 *
 * ```typescript
 * async onModuleInit() {
 *   this.$use(async (params, next) => {
 *     const before = Date.now();
 *     const result = await next(params);
 *     const after  = Date.now();
 *     this.logger.debug(`Query ${params.model}.${params.action} took ${after - before}ms`);
 *     return result;
 *   });
 *   await this.$connect();
 * }
 * ```
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      // Log queries in development; only errors and warnings in production
      log:
        process.env.NODE_ENV === 'development'
          ? [
              { emit: 'event', level: 'query' },
              { emit: 'stdout', level: 'info' },
              { emit: 'stdout', level: 'warn' },
              { emit: 'stdout', level: 'error' },
            ]
          : [
              { emit: 'stdout', level: 'warn' },
              { emit: 'stdout', level: 'error' },
            ],

      // Connection settings — tune these for your database server
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Lifecycle hooks
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Called by NestJS when the application module is initialised.
   * Opens the Prisma connection pool and wires up optional query logging.
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Connecting to the database…');

    // Wire up query-level logging in development mode
    if (process.env.NODE_ENV === 'development') {
      // The `query` event is emitted for every SQL statement Prisma executes.
      // Use this sparingly in production — it can generate a lot of log output.
      (this as any).$on('query', (event: any) => {
        this.logger.debug(
          `[Prisma Query] ${event.query} — params: ${event.params} — duration: ${event.duration}ms`,
        );
      });
    }

    try {
      await this.$connect();
      this.logger.log('Database connection established ✔');
    } catch (err) {
      this.logger.error('Failed to connect to the database', (err as Error).stack);
      // Re-throw so NestJS fails fast during startup rather than running with
      // no database connection and producing confusing runtime errors.
      throw err;
    }
  }

  /**
   * Called by NestJS during graceful shutdown (SIGTERM / SIGINT).
   * Closes all open database connections in the Prisma connection pool.
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Closing database connection…');

    try {
      await this.$disconnect();
      this.logger.log('Database connection closed ✔');
    } catch (err) {
      this.logger.error(
        'Error while disconnecting from the database',
        (err as Error).stack,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Health-check helper
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Executes a lightweight raw SQL query to verify the database connection is
   * alive.  Used by health-check endpoints (e.g. `/health`).
   *
   * Returns `true` if the database responds correctly, `false` otherwise.
   *
   * ```typescript
   * // In a HealthController:
   * const dbHealthy = await this.prisma.isHealthy();
   * ```
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Soft-delete helper
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * A convenience wrapper for performing a soft delete on any Prisma model
   * that has a `deletedAt` field.
   *
   * Instead of physically removing the row, this sets `deletedAt` to the
   * current timestamp, preserving the record for audit/moderation purposes.
   *
   * @param model  The Prisma model delegate (e.g. `this.prisma.project`).
   * @param id     The record's primary key (UUID string).
   *
   * @example
   * await this.prisma.softDelete(this.prisma.project, projectId);
   */
  async softDelete(
    model: { update: (args: any) => Promise<any> },
    id: string,
  ): Promise<void> {
    await model.update({
      where: { id },
      data:  { deletedAt: new Date() },
    });
  }
}
