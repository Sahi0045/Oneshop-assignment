import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { ProjectModule } from './project/project.module';
import { PaymentModule } from './payment/payment.module';
import { ChatModule } from './chat/chat.module';
import { NotificationModule } from './notification/notification.module';
import { ReviewModule } from './review/review.module';
import { DisputeModule } from './dispute/dispute.module';
import { AdminModule } from './admin/admin.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';

@Module({
  imports: [
    // ─── Configuration (global) ────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
      expandVariables: true,
    }),

    // ─── Rate Limiting ─────────────────────────────────────────────────────────
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          name: 'default',
          ttl: configService.get<number>('THROTTLE_TTL', 60000),
          limit: configService.get<number>('THROTTLE_LIMIT', 100),
        },
        {
          name: 'auth',
          ttl: 60000,
          limit: 10,
        },
      ],
    }),

    // ─── Core Infrastructure (global) ──────────────────────────────────────────
    PrismaModule,
    RedisModule,

    // ─── Feature Modules ───────────────────────────────────────────────────────
    AuthModule,
    ProjectModule,
    PaymentModule,
    ChatModule,
    NotificationModule,
    ReviewModule,
    DisputeModule,
    AdminModule,
  ],
})
export class AppModule {}
