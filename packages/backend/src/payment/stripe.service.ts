import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

/**
 * StripeService
 *
 * A thin, injectable wrapper around the Stripe Node.js SDK.
 * All raw Stripe API calls are centralised here so that:
 *
 *   1. PaymentService contains only business logic (no SDK details).
 *   2. The Stripe client can be easily mocked in unit tests.
 *   3. Error handling, logging, and idempotency keys are applied
 *      consistently across every SDK call.
 *
 * Supported operations
 * ────────────────────
 *   • createPaymentIntent   — fund the escrow wallet before work begins
 *   • retrievePaymentIntent — look up a PaymentIntent by ID
 *   • createTransfer        — release milestone funds to a freelancer's
 *                             Stripe Connect account
 *   • createRefund          — refund a PaymentIntent (fully or partially)
 *   • constructEvent        — verify and parse a Stripe webhook payload
 *   • createConnectedAccount — onboard a freelancer for payouts
 *   • createAccountLink      — generate an onboarding / dashboard link
 *   • createPayout           — initiate a payout to a freelancer's bank
 *   • retrieveBalance        — fetch the platform's Stripe balance
 */
@Injectable()
export class StripeService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');

    if (!secretKey) {
      this.logger.warn(
        'STRIPE_SECRET_KEY is not set. Stripe calls will fail. ' +
          'Set it in your .env file before accepting payments.',
      );
    }

    this.stripe = new Stripe(secretKey ?? 'sk_test_placeholder', {
      apiVersion: '2025-02-24.acacia',
      typescript: true,
      appInfo: {
        name: 'FreelancerPlatform',
        version: '1.0.0',
      },
      maxNetworkRetries: 3,   // automatic retry on transient network errors
      timeout: 30_000,        // 30-second timeout per request
    });

    this.logger.log('Stripe SDK initialised.');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PaymentIntents — escrow funding
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Creates a Stripe PaymentIntent representing the amount the client will
   * place into escrow.  The amount is in the smallest currency unit (cents).
   *
   * @param amountCents   Amount in cents (e.g. 250000 for $2 500.00).
   * @param currency      ISO 4217 currency code, lowercase (default: 'usd').
   * @param metadata      Arbitrary key-value pairs attached to the intent
   *                      (e.g. contractId, projectId, clientId).
   * @param idempotencyKey Optional idempotency key to prevent duplicate charges.
   */
  async createPaymentIntent(
    amountCents: number,
    currency: string = 'usd',
    metadata: Stripe.MetadataParam = {},
    idempotencyKey?: string,
  ): Promise<Stripe.PaymentIntent> {
    try {
      this.logger.debug(
        `Creating PaymentIntent: amount=${amountCents} ${currency.toUpperCase()} ` +
          `metadata=${JSON.stringify(metadata)}`,
      );

      const params: Stripe.PaymentIntentCreateParams = {
        amount:   amountCents,
        currency: currency.toLowerCase(),
        metadata,
        // Capture manually so we can confirm only after contract validation
        capture_method: 'automatic',
        // Send a receipt email if the customer has an email on their object
        receipt_email: metadata['clientEmail'] as string | undefined,
        description: metadata['description'] as string | undefined,
      };

      const options: Stripe.RequestOptions = {};
      if (idempotencyKey) {
        options.idempotencyKey = idempotencyKey;
      }

      const intent = await this.stripe.paymentIntents.create(params, options);

      this.logger.log(
        `PaymentIntent created: ${intent.id} | status: ${intent.status} | ` +
          `amount: ${amountCents} ${currency.toUpperCase()}`,
      );

      return intent;
    } catch (err) {
      this.handleStripeError('createPaymentIntent', err);
    }
  }

  /**
   * Retrieves a PaymentIntent by its Stripe ID.
   *
   * @param paymentIntentId  Stripe PaymentIntent ID (pi_xxx).
   */
  async retrievePaymentIntent(
    paymentIntentId: string,
  ): Promise<Stripe.PaymentIntent> {
    try {
      const intent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

      this.logger.debug(
        `PaymentIntent retrieved: ${intent.id} | status: ${intent.status}`,
      );

      return intent;
    } catch (err) {
      this.handleStripeError('retrievePaymentIntent', err);
    }
  }

  /**
   * Confirms a PaymentIntent using an existing payment method.
   * Useful for server-side confirmation flows.
   *
   * @param paymentIntentId   Stripe PaymentIntent ID.
   * @param paymentMethodId   Stripe PaymentMethod ID (pm_xxx).
   */
  async confirmPaymentIntent(
    paymentIntentId: string,
    paymentMethodId: string,
  ): Promise<Stripe.PaymentIntent> {
    try {
      const intent = await this.stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: paymentMethodId,
      });

      this.logger.log(
        `PaymentIntent confirmed: ${intent.id} | status: ${intent.status}`,
      );

      return intent;
    } catch (err) {
      this.handleStripeError('confirmPaymentIntent', err);
    }
  }

  /**
   * Cancels a PaymentIntent that has not yet been captured / succeeded.
   *
   * @param paymentIntentId  Stripe PaymentIntent ID.
   * @param reason           Optional cancellation reason.
   */
  async cancelPaymentIntent(
    paymentIntentId: string,
    reason?: Stripe.PaymentIntentCancelParams.CancellationReason,
  ): Promise<Stripe.PaymentIntent> {
    try {
      const intent = await this.stripe.paymentIntents.cancel(
        paymentIntentId,
        reason ? { cancellation_reason: reason } : undefined,
      );

      this.logger.log(
        `PaymentIntent cancelled: ${intent.id} | reason: ${reason ?? 'none'}`,
      );

      return intent;
    } catch (err) {
      this.handleStripeError('cancelPaymentIntent', err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Transfers — milestone payouts to freelancers (Stripe Connect)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Creates a Stripe Transfer to move funds from the platform's Stripe account
   * to a freelancer's connected Stripe account.
   *
   * This is called when the client approves a milestone.  The amount should
   * be the milestone amount minus the platform fee.
   *
   * @param amountCents            Amount to transfer, in cents.
   * @param currency               ISO 4217 currency code (default: 'usd').
   * @param destinationAccountId   The freelancer's Stripe Connect account ID (acct_xxx).
   * @param metadata               Arbitrary key-value pairs (e.g. milestoneId, contractId).
   * @param transferGroup          Optional group ID to link related transfers
   *                               (typically the PaymentIntent ID).
   * @param idempotencyKey         Optional idempotency key.
   */
  async createTransfer(
    amountCents: number,
    currency: string = 'usd',
    destinationAccountId: string,
    metadata: Stripe.MetadataParam = {},
    transferGroup?: string,
    idempotencyKey?: string,
  ): Promise<Stripe.Transfer> {
    try {
      this.logger.debug(
        `Creating Transfer: amount=${amountCents} ${currency.toUpperCase()} ` +
          `→ ${destinationAccountId}`,
      );

      const params: Stripe.TransferCreateParams = {
        amount:      amountCents,
        currency:    currency.toLowerCase(),
        destination: destinationAccountId,
        metadata,
        ...(transferGroup ? { transfer_group: transferGroup } : {}),
      };

      const options: Stripe.RequestOptions = {};
      if (idempotencyKey) {
        options.idempotencyKey = idempotencyKey;
      }

      const transfer = await this.stripe.transfers.create(params, options);

      this.logger.log(
        `Transfer created: ${transfer.id} | amount: ${amountCents} ${currency.toUpperCase()} ` +
          `→ ${destinationAccountId}`,
      );

      return transfer;
    } catch (err) {
      this.handleStripeError('createTransfer', err);
    }
  }

  /**
   * Reverses (cancels) a Transfer.  Use this when a milestone is disputed
   * or if funds need to be returned to the platform account.
   *
   * @param transferId   Stripe Transfer ID (tr_xxx).
   * @param amountCents  Amount to reverse (omit to reverse the full transfer).
   * @param metadata     Reason / context metadata.
   */
  async reverseTransfer(
    transferId: string,
    amountCents?: number,
    metadata: Stripe.MetadataParam = {},
  ): Promise<Stripe.TransferReversal> {
    try {
      const reversal = await this.stripe.transfers.createReversal(transferId, {
        ...(amountCents ? { amount: amountCents } : {}),
        metadata,
      });

      this.logger.log(
        `Transfer reversed: ${reversal.id} | transfer: ${transferId} ` +
          `| amount: ${amountCents ?? 'full'}`,
      );

      return reversal;
    } catch (err) {
      this.handleStripeError('reverseTransfer', err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Refunds
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Issues a refund for a PaymentIntent.  Can be full or partial.
   *
   * @param paymentIntentId  Stripe PaymentIntent ID (pi_xxx).
   * @param amountCents      Amount to refund in cents. Omit for a full refund.
   * @param reason           Optional refund reason (duplicate | fraudulent | requested_by_customer).
   * @param metadata         Arbitrary metadata attached to the refund.
   */
  async createRefund(
    paymentIntentId: string,
    amountCents?: number,
    reason?: Stripe.RefundCreateParams.Reason,
    metadata: Stripe.MetadataParam = {},
  ): Promise<Stripe.Refund> {
    try {
      this.logger.debug(
        `Creating Refund: paymentIntentId=${paymentIntentId} ` +
          `amount=${amountCents ?? 'full'} reason=${reason ?? 'none'}`,
      );

      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        ...(amountCents ? { amount: amountCents } : {}),
        ...(reason ? { reason } : {}),
        metadata,
      });

      this.logger.log(
        `Refund created: ${refund.id} | paymentIntent: ${paymentIntentId} ` +
          `| amount: ${amountCents ?? 'full'} | status: ${refund.status}`,
      );

      return refund;
    } catch (err) {
      this.handleStripeError('createRefund', err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Webhooks
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Verifies the Stripe webhook signature and constructs the event object.
   *
   * The raw request body (Buffer) is required for signature verification —
   * make sure `rawBody: true` is set when creating the NestJS app and that
   * the webhook route bypasses the global JSON body parser.
   *
   * @param payload          Raw request body as a Buffer or string.
   * @param signature        Value of the `stripe-signature` HTTP header.
   * @param webhookSecret    Webhook endpoint signing secret (whsec_xxx).
   *                         Defaults to the STRIPE_WEBHOOK_SECRET env var.
   */
  constructEvent(
    payload: Buffer | string,
    signature: string,
    webhookSecret?: string,
  ): Stripe.Event {
    const secret =
      webhookSecret ??
      this.configService.get<string>('STRIPE_WEBHOOK_SECRET', '');

    if (!secret) {
      throw new InternalServerErrorException(
        'STRIPE_WEBHOOK_SECRET is not configured. ' +
          'Webhook signature verification cannot proceed.',
      );
    }

    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        secret,
      );

      this.logger.debug(
        `Webhook event constructed: ${event.type} | id: ${event.id}`,
      );

      return event;
    } catch (err) {
      this.logger.warn(
        `Webhook signature verification failed: ${(err as Error).message}`,
      );
      throw err; // Let PaymentService handle it as a BadRequestException
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Stripe Connect — freelancer onboarding & payouts
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Creates a Stripe Express connected account for a freelancer.
   * Returns the account ID to be stored on the User record.
   *
   * @param email        Freelancer's email address (pre-fills the onboarding form).
   * @param country      ISO 3166-1 alpha-2 country code (e.g. 'US', 'GB').
   * @param metadata     Arbitrary metadata (e.g. freelancerId).
   */
  async createConnectedAccount(
    email: string,
    country: string = 'US',
    metadata: Stripe.MetadataParam = {},
  ): Promise<Stripe.Account> {
    try {
      const account = await this.stripe.accounts.create({
        type:         'express',
        email,
        country,
        metadata,
        capabilities: {
          transfers: { requested: true },
        },
        business_type: 'individual',
        settings: {
          payouts: {
            schedule: { interval: 'weekly', weekly_anchor: 'friday' },
          },
        },
      });

      this.logger.log(
        `Connected account created: ${account.id} | email: ${email} | country: ${country}`,
      );

      return account;
    } catch (err) {
      this.handleStripeError('createConnectedAccount', err);
    }
  }

  /**
   * Generates a Stripe Account Link for the Express onboarding flow.
   * The returned URL should be redirected to so the freelancer can complete
   * identity verification and bank account setup.
   *
   * @param accountId    Stripe connected account ID (acct_xxx).
   * @param refreshUrl   URL to redirect to if the link expires.
   * @param returnUrl    URL to redirect to after onboarding is complete.
   */
  async createAccountLink(
    accountId: string,
    refreshUrl: string,
    returnUrl: string,
  ): Promise<Stripe.AccountLink> {
    try {
      const link = await this.stripe.accountLinks.create({
        account:     accountId,
        refresh_url: refreshUrl,
        return_url:  returnUrl,
        type:        'account_onboarding',
        collect:     'eventually_due',
      });

      this.logger.debug(
        `Account link created for: ${accountId} | expires: ${link.expires_at}`,
      );

      return link;
    } catch (err) {
      this.handleStripeError('createAccountLink', err);
    }
  }

  /**
   * Creates a Stripe Login Link for a connected account's Express dashboard.
   * Allows the freelancer to view their balance and payout history.
   *
   * @param accountId  Stripe connected account ID (acct_xxx).
   */
  async createLoginLink(accountId: string): Promise<Stripe.LoginLink> {
    try {
      const link = await this.stripe.accounts.createLoginLink(accountId);

      this.logger.debug(`Login link created for connected account: ${accountId}`);

      return link;
    } catch (err) {
      this.handleStripeError('createLoginLink', err);
    }
  }

  /**
   * Retrieves a connected Stripe account by its ID.
   *
   * @param accountId  Stripe connected account ID (acct_xxx).
   */
  async retrieveConnectedAccount(accountId: string): Promise<Stripe.Account> {
    try {
      return await this.stripe.accounts.retrieve(accountId);
    } catch (err) {
      this.handleStripeError('retrieveConnectedAccount', err);
    }
  }

  /**
   * Creates an instant payout for a freelancer's connected account.
   * Only available to accounts with an instant payout-capable debit card.
   *
   * @param amountCents     Amount to pay out, in cents.
   * @param currency        ISO 4217 currency code.
   * @param accountId       Stripe connected account ID (acct_xxx).
   * @param destination     Stripe bank account or card ID to pay out to.
   * @param metadata        Arbitrary metadata.
   */
  async createPayout(
    amountCents: number,
    currency: string = 'usd',
    accountId: string,
    destination?: string,
    metadata: Stripe.MetadataParam = {},
  ): Promise<Stripe.Payout> {
    try {
      const payout = await this.stripe.payouts.create(
        {
          amount:   amountCents,
          currency: currency.toLowerCase(),
          ...(destination ? { destination } : {}),
          metadata,
        },
        { stripeAccount: accountId },
      );

      this.logger.log(
        `Payout created: ${payout.id} | amount: ${amountCents} ${currency.toUpperCase()} ` +
          `→ account: ${accountId} | status: ${payout.status}`,
      );

      return payout;
    } catch (err) {
      this.handleStripeError('createPayout', err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Balance
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Retrieves the platform's available Stripe balance.
   * Useful for displaying funds available for payouts in admin dashboards.
   */
  async retrieveBalance(): Promise<Stripe.Balance> {
    try {
      const balance = await this.stripe.balance.retrieve();

      this.logger.debug(
        `Balance retrieved: available=${JSON.stringify(balance.available)} ` +
          `pending=${JSON.stringify(balance.pending)}`,
      );

      return balance;
    } catch (err) {
      this.handleStripeError('retrieveBalance', err);
    }
  }

  /**
   * Retrieves the balance for a specific connected account.
   *
   * @param accountId  Stripe connected account ID (acct_xxx).
   */
  async retrieveConnectedAccountBalance(accountId: string): Promise<Stripe.Balance> {
    try {
      const balance = await this.stripe.balance.retrieve({
        stripeAccount: accountId,
      } as any);

      return balance;
    } catch (err) {
      this.handleStripeError('retrieveConnectedAccountBalance', err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Customers (optional — for saving payment methods)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Creates or retrieves a Stripe Customer for a platform user.
   * Storing the Customer ID on the User record allows saving payment methods
   * so clients don't have to re-enter card details for each project.
   *
   * @param email      Customer's email address.
   * @param name       Customer's full name.
   * @param metadata   Arbitrary metadata (e.g. userId).
   */
  async createCustomer(
    email: string,
    name: string,
    metadata: Stripe.MetadataParam = {},
  ): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.create({
        email,
        name,
        metadata,
      });

      this.logger.log(`Stripe Customer created: ${customer.id} | email: ${email}`);

      return customer;
    } catch (err) {
      this.handleStripeError('createCustomer', err);
    }
  }

  /**
   * Retrieves a Stripe Customer by ID.
   *
   * @param customerId  Stripe Customer ID (cus_xxx).
   */
  async retrieveCustomer(customerId: string): Promise<Stripe.Customer | Stripe.DeletedCustomer> {
    try {
      return await this.stripe.customers.retrieve(customerId);
    } catch (err) {
      this.handleStripeError('retrieveCustomer', err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Expose the raw Stripe instance for advanced use-cases
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Returns the underlying Stripe SDK instance.
   * Use sparingly — prefer the typed helper methods above.
   */
  get client(): Stripe {
    return this.stripe;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Normalises Stripe errors into a loggable format and re-throws them.
   *
   * Stripe errors include a `type` property that categorises the failure:
   *   - StripeCardError          — card was declined
   *   - StripeRateLimitError     — too many requests
   *   - StripeInvalidRequestError— invalid parameters
   *   - StripeAPIError           — API-side failure
   *   - StripeConnectionError    — network error
   *   - StripeAuthenticationError— invalid API key
   *
   * All Stripe errors are re-thrown as-is so the calling service can handle
   * them and translate them into the appropriate HTTP exception.
   */
  private handleStripeError(operation: string, err: any): never {
    if (err instanceof Stripe.errors.StripeError) {
      this.logger.error(
        `[Stripe] ${operation} failed | type: ${err.type} | ` +
          `code: ${err.code ?? 'n/a'} | message: ${err.message}`,
        err.stack,
      );
    } else {
      this.logger.error(
        `[Stripe] ${operation} failed with unexpected error: ${err?.message ?? err}`,
        err?.stack,
      );
    }

    throw err;
  }
}
