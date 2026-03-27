import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { Redis as RedisClient } from 'ioredis';

/**
 * RedisService
 *
 * A thin, injectable wrapper around the ioredis client that exposes
 * the most commonly-used Redis operations as typed async methods.
 *
 * Connection
 * ──────────
 * The ioredis client is created on service construction and configured
 * from environment variables via ConfigService:
 *
 *   REDIS_URL       redis://[[user:]pass@]host[:port][/db]  (highest priority)
 *   REDIS_HOST      default: localhost
 *   REDIS_PORT      default: 6379
 *   REDIS_PASSWORD  optional
 *   REDIS_DB        database index, default: 0
 *
 * ioredis automatically reconnects on transient failures using an
 * exponential back-off strategy, so the service is resilient to brief
 * Redis restarts without any extra configuration.
 *
 * Methods
 * ───────
 * String operations:
 *   get(key)                       → string | null
 *   set(key, value)                → 'OK'
 *   setex(key, seconds, value)     → 'OK'   (set with TTL)
 *   del(key)                       → number of keys deleted
 *   exists(key)                    → boolean
 *   incr(key)                      → new integer value
 *   decr(key)                      → new integer value
 *   expire(key, seconds)           → 1 if TTL set, 0 if key not found
 *   ttl(key)                       → seconds remaining (-1 = no TTL, -2 = missing)
 *   keys(pattern)                  → string[]
 *
 * Hash operations:
 *   hset(key, field, value)        → number of fields added
 *   hget(key, field)               → string | null
 *   hdel(key, field)               → number of fields deleted
 *   hgetall(key)                   → Record<string, string>
 *   hkeys(key)                     → string[]
 *   hvals(key)                     → string[]
 *   hmset(key, data)               → 'OK'
 *
 * List operations:
 *   lpush(key, ...values)          → new list length
 *   rpush(key, ...values)          → new list length
 *   lrange(key, start, stop)       → string[]
 *   llen(key)                      → list length
 *
 * Set operations:
 *   sadd(key, ...members)          → number added
 *   srem(key, ...members)          → number removed
 *   smembers(key)                  → string[]
 *   sismember(key, member)         → boolean
 *
 * Sorted-set operations:
 *   zadd(key, score, member)       → number added
 *   zrange(key, start, stop)       → string[]
 *   zrangebyscore(key, min, max)   → string[]
 *   zrem(key, member)              → number removed
 *   zcard(key)                     → cardinality
 *
 * Pub/Sub:
 *   publish(channel, message)      → number of receivers
 *   subscribe(channel, handler)    → void
 *   unsubscribe(channel)           → void
 *
 * Utility:
 *   flushdb()                      → 'OK'   (TEST USE ONLY)
 *   ping()                         → 'PONG'
 *   isHealthy()                    → boolean
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  /** Primary client — used for all read/write commands. */
  private client: RedisClient;

  /**
   * Dedicated subscriber client.
   *
   * ioredis clients that enter subscriber mode (via .subscribe()) cannot
   * issue regular commands.  We therefore maintain a separate client for
   * pub/sub so the main client remains available for normal operations.
   *
   * This client is created lazily on the first .subscribe() call.
   */
  private subscriberClient: RedisClient | null = null;

  constructor(private readonly configService: ConfigService) {
    this.client = this.createClient('main');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Lifecycle hooks
  // ─────────────────────────────────────────────────────────────────────────────

  async onModuleInit(): Promise<void> {
    // ioredis connects lazily — ping to confirm the connection on startup
    try {
      const pong = await this.client.ping();
      if (pong === 'PONG') {
        this.logger.log('Redis connection established ✔');
      } else {
        this.logger.warn(`Unexpected PING response: ${pong}`);
      }
    } catch (err) {
      this.logger.error('Redis connection failed on startup', (err as Error).stack);
      // Do NOT throw — a Redis outage should not prevent the app from starting.
      // Operations will fail gracefully (callers handle null returns / errors).
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Closing Redis connections…');
    try {
      await this.client.quit();
      if (this.subscriberClient) {
        await this.subscriberClient.quit();
      }
      this.logger.log('Redis connections closed ✔');
    } catch (err) {
      this.logger.error('Error closing Redis connections', (err as Error).stack);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // String operations
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Gets the value of a key.
   * Returns `null` if the key does not exist.
   */
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  /**
   * Sets the value of a key with no expiry.
   */
  async set(key: string, value: string | number): Promise<'OK'> {
    return this.client.set(key, String(value));
  }

  /**
   * Sets the value of a key with an expiry time in seconds.
   * Equivalent to the Redis command: SET key value EX seconds
   */
  async setex(key: string, seconds: number, value: string | number): Promise<'OK'> {
    return this.client.setex(key, seconds, String(value));
  }

  /**
   * Sets the value of a key only if it does NOT already exist.
   * Returns 1 if the key was set, 0 if it already existed.
   *
   * Useful for distributed locks and idempotency guards.
   */
  async setnx(key: string, value: string | number): Promise<0 | 1> {
    // @ts-ignore
    return (this.client as any).setnx(key, String(value));
  }

  /**
   * Deletes one or more keys.
   * Returns the number of keys that were removed.
   */
  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return this.client.del(...keys);
  }

  /**
   * Returns whether the key exists in Redis.
   */
  async exists(key: string): Promise<boolean> {
    const count = await this.client.exists(key);
    return count > 0;
  }

  /**
   * Atomically increments the integer value of a key by 1.
   * If the key does not exist it is initialised to 0 before the increment.
   * Returns the new value.
   */
  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  /**
   * Atomically increments the integer value of a key by `amount`.
   * Returns the new value.
   */
  async incrby(key: string, amount: number): Promise<number> {
    return this.client.incrby(key, amount);
  }

  /**
   * Atomically decrements the integer value of a key by 1.
   * Returns the new value.
   */
  async decr(key: string): Promise<number> {
    return this.client.decr(key);
  }

  /**
   * Sets a TTL (in seconds) on an existing key.
   * Returns 1 if the TTL was set, 0 if the key does not exist.
   */
  async expire(key: string, seconds: number): Promise<0 | 1> {
    // @ts-ignore
    return (this.client as any).expire(key, seconds);
  }

  /**
   * Returns the remaining TTL of a key in seconds.
   *   -1 → key exists but has no TTL
   *   -2 → key does not exist
   *   n  → seconds remaining
   */
  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  /**
   * Returns all keys matching the given glob pattern.
   *
   * ⚠️  WARNING: KEYS is O(N) and blocks Redis during execution.
   * Use SCAN-based patterns in production for large key spaces.
   * This method is provided for convenience in low-key-count scenarios
   * (e.g. listing all active sessions for a user).
   */
  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }

  /**
   * Returns the type of the value stored at a key.
   * Possible values: 'string', 'list', 'set', 'zset', 'hash', 'none'
   */
  async type(key: string): Promise<string> {
    return this.client.type(key);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Hash operations
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Sets the value of a single field in a Redis hash.
   * Returns the number of new fields that were added (0 if updated, 1 if new).
   */
  async hset(key: string, field: string, value: string | number): Promise<number> {
    return this.client.hset(key, field, String(value));
  }

  /**
   * Gets the value of a field in a Redis hash.
   * Returns `null` if the key or field does not exist.
   */
  async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }

  /**
   * Deletes one or more fields from a Redis hash.
   * Returns the number of fields that were removed.
   */
  async hdel(key: string, ...fields: string[]): Promise<number> {
    if (fields.length === 0) return 0;
    return this.client.hdel(key, ...fields);
  }

  /**
   * Returns all fields and their values from a Redis hash.
   * Returns an empty object `{}` if the key does not exist.
   */
  async hgetall(key: string): Promise<Record<string, string>> {
    const result = await this.client.hgetall(key);
    return result ?? {};
  }

  /**
   * Returns all field names in a Redis hash.
   */
  async hkeys(key: string): Promise<string[]> {
    return this.client.hkeys(key);
  }

  /**
   * Returns all values in a Redis hash.
   */
  async hvals(key: string): Promise<string[]> {
    return this.client.hvals(key);
  }

  /**
   * Sets multiple fields on a Redis hash in a single command.
   * Equivalent to `HSET key field1 val1 field2 val2 …`
   */
  async hmset(key: string, data: Record<string, string | number>): Promise<'OK'> {
    const flat: string[] = [];
    for (const [field, value] of Object.entries(data)) {
      flat.push(field, String(value));
    }
    return this.client.hmset(key, ...flat);
  }

  /**
   * Returns the number of fields in a Redis hash.
   */
  async hlen(key: string): Promise<number> {
    return this.client.hlen(key);
  }

  /**
   * Returns whether the specified field exists in a Redis hash.
   */
  async hexists(key: string, field: string): Promise<boolean> {
    const result = await this.client.hexists(key, field);
    return result === 1;
  }

  /**
   * Atomically increments the integer value of a hash field by `increment`.
   * Returns the new value.
   */
  async hincrby(key: string, field: string, increment: number): Promise<number> {
    return this.client.hincrby(key, field, increment);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // List operations
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Prepends one or more values to a list.
   * Returns the new length of the list.
   */
  async lpush(key: string, ...values: (string | number)[]): Promise<number> {
    return this.client.lpush(key, ...values.map(String));
  }

  /**
   * Appends one or more values to a list.
   * Returns the new length of the list.
   */
  async rpush(key: string, ...values: (string | number)[]): Promise<number> {
    return this.client.rpush(key, ...values.map(String));
  }

  /**
   * Returns the specified range of elements from a list.
   * Indices are 0-based; use -1 as `stop` to get to the end.
   */
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.client.lrange(key, start, stop);
  }

  /**
   * Returns the length of the list at the specified key.
   */
  async llen(key: string): Promise<number> {
    return this.client.llen(key);
  }

  /**
   * Removes and returns the first element of a list.
   * Returns `null` if the list is empty or the key does not exist.
   */
  async lpop(key: string): Promise<string | null> {
    return this.client.lpop(key);
  }

  /**
   * Removes and returns the last element of a list.
   * Returns `null` if the list is empty or the key does not exist.
   */
  async rpop(key: string): Promise<string | null> {
    return this.client.rpop(key);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Set operations
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Adds one or more members to a Redis set.
   * Returns the number of members that were added (duplicates are ignored).
   */
  async sadd(key: string, ...members: (string | number)[]): Promise<number> {
    return this.client.sadd(key, ...members.map(String));
  }

  /**
   * Removes one or more members from a Redis set.
   * Returns the number of members that were removed.
   */
  async srem(key: string, ...members: (string | number)[]): Promise<number> {
    return this.client.srem(key, ...members.map(String));
  }

  /**
   * Returns all members of a Redis set.
   */
  async smembers(key: string): Promise<string[]> {
    return this.client.smembers(key);
  }

  /**
   * Returns whether the given value is a member of the set.
   */
  async sismember(key: string, member: string): Promise<boolean> {
    const result = await this.client.sismember(key, member);
    return result === 1;
  }

  /**
   * Returns the number of members in a set.
   */
  async scard(key: string): Promise<number> {
    return this.client.scard(key);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Sorted set operations
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Adds a member with the given score to a sorted set.
   * Returns the number of new elements added.
   */
  async zadd(key: string, score: number, member: string): Promise<number | string> {
    return this.client.zadd(key, score, member);
  }

  /**
   * Returns members in a sorted set between the given rank indices.
   * Includes scores when `withScores` is true.
   */
  async zrange(
    key: string,
    start: number,
    stop: number,
    withScores = false,
  ): Promise<string[]> {
    if (withScores) {
      return this.client.zrange(key, start, stop, 'WITHSCORES');
    }
    return this.client.zrange(key, start, stop);
  }

  /**
   * Returns members in a sorted set with scores between `min` and `max`.
   */
  async zrangebyscore(
    key: string,
    min: number | '-inf',
    max: number | '+inf',
  ): Promise<string[]> {
    return this.client.zrangebyscore(key, min, max);
  }

  /**
   * Removes one or more members from a sorted set.
   * Returns the number of members removed.
   */
  async zrem(key: string, ...members: string[]): Promise<number> {
    return this.client.zrem(key, ...members);
  }

  /**
   * Returns the number of members in a sorted set.
   */
  async zcard(key: string): Promise<number> {
    return this.client.zcard(key);
  }

  /**
   * Returns the score of a member in a sorted set.
   * Returns `null` if the member or key does not exist.
   */
  async zscore(key: string, member: string): Promise<string | null> {
    return this.client.zscore(key, member);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Pub / Sub
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Publishes a message to a Redis channel.
   * Returns the number of subscribers that received the message.
   */
  async publish(channel: string, message: string): Promise<number> {
    return this.client.publish(channel, message);
  }

  /**
   * Subscribes to a Redis channel on the dedicated subscriber client.
   *
   * The `handler` callback is invoked for every message received on the channel.
   *
   * ioredis manages the subscriber client lifecycle — it will automatically
   * re-subscribe after a reconnection.
   *
   * @param channel  The channel name to subscribe to.
   * @param handler  Callback invoked with (channel, message) for each message.
   */
  async subscribe(
    channel: string,
    handler: (channel: string, message: string) => void,
  ): Promise<void> {
    const sub = this.getSubscriberClient();
    await sub.subscribe(channel);
    sub.on('message', handler);
    this.logger.debug(`Subscribed to Redis channel: ${channel}`);
  }

  /**
   * Subscribes to channels matching a glob pattern.
   *
   * @param pattern  Glob pattern (e.g. 'notifications:*')
   * @param handler  Callback invoked with (pattern, channel, message).
   */
  async psubscribe(
    pattern: string,
    handler: (pattern: string, channel: string, message: string) => void,
  ): Promise<void> {
    const sub = this.getSubscriberClient();
    await sub.psubscribe(pattern);
    sub.on('pmessage', handler);
    this.logger.debug(`Pattern-subscribed to Redis: ${pattern}`);
  }

  /**
   * Unsubscribes from a Redis channel on the subscriber client.
   *
   * @param channel  The channel to unsubscribe from.
   *                 Omit to unsubscribe from all channels.
   */
  async unsubscribe(channel?: string): Promise<void> {
    if (!this.subscriberClient) return;
    if (channel) {
      await this.subscriberClient.unsubscribe(channel);
    } else {
      await this.subscriberClient.unsubscribe();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Utility
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Sends a PING to Redis and returns the response.
   * Returns 'PONG' on a healthy connection.
   */
  async ping(): Promise<string> {
    return this.client.ping();
  }

  /**
   * Returns `true` if Redis is reachable and responding to PING.
   * Safe to call from a health-check endpoint.
   */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.client.ping();
      return response === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Deletes all keys in the current database.
   *
   * ⚠️  DANGER: Only use in test environments!
   * This will wipe ALL data from the Redis database.
   */
  async flushdb(): Promise<'OK'> {
    if (process.env.NODE_ENV === 'production') {
      this.logger.error('flushdb() called in production — operation blocked.');
      throw new Error('flushdb() is not permitted in production environments.');
    }
    return this.client.flushdb();
  }

  /**
   * Returns a reference to the underlying ioredis client instance.
   *
   * Use sparingly — prefer the typed helper methods above.
   * Useful for commands not yet wrapped by this service (e.g. SCAN cursors,
   * pipeline/multi-exec batches).
   */
  get ioredis(): RedisClient {
    return this.client;
  }

  /**
   * Creates and returns a Redis pipeline (batch of commands executed atomically).
   *
   * Example:
   * ```typescript
   * const pipe = this.redisService.pipeline();
   * pipe.set('key1', 'val1');
   * pipe.expire('key1', 3600);
   * pipe.incr('counter');
   * const results = await pipe.exec();
   * ```
   */
  pipeline() {
    return this.client.pipeline();
  }

  /**
   * Creates and returns a Redis multi (MULTI/EXEC transaction).
   *
   * All commands in the multi block are queued and executed atomically.
   */
  multi() {
    return this.client.multi();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Creates and configures an ioredis client instance.
   *
   * Connection priority:
   *   1. REDIS_URL  — full connection string (recommended for cloud providers)
   *   2. REDIS_HOST / REDIS_PORT / REDIS_PASSWORD / REDIS_DB — individual params
   *
   * @param label  A human-readable label for log messages ('main' | 'subscriber').
   */
  private createClient(label: string): RedisClient {
    const redisUrl = this.configService.get<string>('REDIS_URL');

    const commonOptions = {
      // Reconnect strategy: exponential back-off with a 5-second cap
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 200, 5_000);
        this.logger.warn(
          `[Redis:${label}] Connection attempt ${times} — retrying in ${delay}ms…`,
        );
        return delay;
      },
      // Reconnect when a connection error occurs (not just a timeout)
      reconnectOnError: (err: Error) => {
        const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
        if (targetErrors.some((e) => err.message.includes(e))) {
          return true;
        }
        return false;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    };

    let client: RedisClient;

    if (redisUrl) {
      client = new Redis(redisUrl, commonOptions);
    } else {
      const host     = this.configService.get<string>('REDIS_HOST', 'localhost');
      const port     = this.configService.get<number>('REDIS_PORT', 6379);
      const password = this.configService.get<string>('REDIS_PASSWORD');
      const db       = this.configService.get<number>('REDIS_DB', 0);

      client = new Redis({
        host,
        port,
        ...(password ? { password } : {}),
        db,
        ...commonOptions,
      });
    }

    // ── Event listeners ──────────────────────────────────────────────────────
    client.on('connect', () => {
      this.logger.log(`[Redis:${label}] Connecting…`);
    });

    client.on('ready', () => {
      this.logger.log(`[Redis:${label}] Ready ✔`);
    });

    client.on('error', (err: Error) => {
      this.logger.error(`[Redis:${label}] Error: ${err.message}`, err.stack);
    });

    client.on('close', () => {
      this.logger.warn(`[Redis:${label}] Connection closed.`);
    });

    client.on('reconnecting', () => {
      this.logger.warn(`[Redis:${label}] Reconnecting…`);
    });

    client.on('end', () => {
      this.logger.warn(`[Redis:${label}] Connection ended permanently.`);
    });

    return client;
  }

  /**
   * Returns the dedicated subscriber client, creating it lazily on first use.
   *
   * ioredis clients that have called .subscribe() / .psubscribe() enter
   * "subscriber mode" and can no longer execute regular commands.
   * Maintaining a separate client for pub/sub keeps the main client available
   * for normal read/write operations.
   */
  private getSubscriberClient(): RedisClient {
    if (!this.subscriberClient) {
      this.logger.debug('Creating dedicated Redis subscriber client…');
      this.subscriberClient = this.createClient('subscriber');
    }
    return this.subscriberClient;
  }
}
