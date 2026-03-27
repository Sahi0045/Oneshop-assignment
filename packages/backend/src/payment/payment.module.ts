import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { StripeService } from './stripe.service';
import { RazorpayService } from './razorpay.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';

/**
 * PaymentModule
 *
 * Encapsulates the full payment lifecycle for the freelancer platform:
 *
 *   1. **Stripe PaymentIntents** — clients fund escrow by creating a
 *      PaymentIntent for the contracted amount before work begins.
 *
 *   2. **Razorpay Orders** — alternative payment gateway for Indian market
 *      (UPI, bank transfers, cards).
 *
 *   3. **Webhook processing** — Stripe and Razorpay webhooks notify the platform when
 *      a payment succeeds or fails so the escrow state can be updated.
 *
 *   4. **Milestone management** — freelancers submit milestones for review;
 *      clients approve (triggering a Stripe Transfer to the freelancer's
 *      connected account) or request revisions.
 *
 *   5. **Refunds** — full or partial refunds for escrow deposits with
 *      support for dispute resolution.
 *
 *   6. **Dispute hold & release** — contracts can be placed on hold during
 *      disputes, with admin-mediated resolution (full refund, partial refund,
 *      or release to freelancer).
 *
 *   7. **Withdrawals** — freelancers request payouts of their available
 *      balance to their bank account via Stripe Connect payouts or Razorpay
 *      payouts (UPI, IMPS, NEFT, RTGS).
 *
 *   8. **Transaction history** — paginated ledger of all financial events
 *      (escrow deposits, milestone releases, refunds, withdrawals).
 *
 * Design notes
 * ────────────
 * • StripeService and RazorpayService are thin wrappers around their respective
 *   SDKs, injected into PaymentService via DI so they can be swapped / mocked in tests.
 *
 * • All SDK calls live in StripeService/RazorpayService; PaymentService contains
 *   only business logic and Prisma interactions.
 *
 * • The raw-body middleware needed for webhook signature verification
 *   is enabled globally in main.ts via `rawBody: true` on NestFactory.create().
 *
 * • Both PrismaModule and RedisModule are declared global, so they do not
 *   need to be re-exported from this module.
 *
 * Microservice extraction path
 * ────────────────────────────
 * When splitting this into a standalone payment microservice:
 *   1. Replace PrismaModule with a lightweight HTTP/gRPC client that talks
 *      to the project/user microservices for ownership checks.
 *   2. Replace inline Kafka stubs with real ClientKafka producers.
 *   3. Move StripeService + RazorpayService + PaymentService into the new package unchanged.
 */
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
  ],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    StripeService,
    RazorpayService,
  ],
  exports: [PaymentService, StripeService, RazorpayService],
})
export class PaymentModule {}
