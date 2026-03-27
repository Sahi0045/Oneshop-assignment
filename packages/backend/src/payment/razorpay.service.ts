import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Razorpay from 'razorpay';
import crypto from 'crypto';

/**
 * RazorpayService
 *
 * A thin, injectable wrapper around the Razorpay Node.js SDK.
 * Provides the same interface as StripeService for consistency.
 *
 * Supported operations:
 *   • createOrder          — create a Razorpay Order (equivalent to PaymentIntent)
 *   • verifyPaymentSignature — verify webhook/payment signature
 *   • createTransfer       — transfer funds to linked account
 *   • createRefund         — refund a payment
 *   • createContact        — create a contact for payouts
 *   • createFundAccount    — link bank account for payouts
 *   • createPayout         — initiate payout to freelancer
 */
@Injectable()
export class RazorpayService {
  private readonly razorpay: Razorpay;
  private readonly logger = new Logger(RazorpayService.name);
  private readonly webhookSecret: string;

  constructor(private readonly configService: ConfigService) {
    const keyId = this.configService.get<string>('RAZORPAY_KEY_ID');
    const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET');
    this.webhookSecret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET', '');

    if (!keyId || !keySecret) {
      this.logger.warn(
        'RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not set. ' +
          'Razorpay calls will fail. Set them in your .env file.',
      );
    }

    this.razorpay = new Razorpay({
      key_id: keyId ?? 'rzp_test_placeholder',
      key_secret: keySecret ?? 'placeholder_secret',
    });

    this.logger.log('Razorpay SDK initialised.');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Orders — escrow funding (equivalent to Stripe PaymentIntent)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Creates a Razorpay Order representing the escrow deposit.
   * Amount is in paise (smallest currency unit, 100 paise = 1 INR).
   *
   * @param amountPaise   Amount in paise (e.g. 250000 for ₹2,500.00).
   * @param currency      ISO 4217 currency code (default: 'INR').
   * @param receipt       Unique receipt ID for idempotency.
   * @param notes         Arbitrary key-value pairs (metadata).
   */
  async createOrder(
    amountPaise: number,
    currency: string = 'INR',
    receipt: string,
    notes: Record<string, any> = {},
  ): Promise<any> {
    try {
      this.logger.debug(
        `Creating Razorpay Order: amount=${amountPaise} ${currency} receipt=${receipt}`,
      );

      const order = await this.razorpay.orders.create({
        amount: amountPaise,
        currency: currency.toUpperCase(),
        receipt,
        notes,
      });

      this.logger.log(
        `Razorpay Order created: ${order.id} | status: ${order.status} | ` +
          `amount: ${amountPaise} ${currency}`,
      );

      return order;
    } catch (err) {
      this.handleRazorpayError('createOrder', err);
    }
  }

  /**
   * Fetches a Razorpay Order by its ID.
   *
   * @param orderId  Razorpay Order ID (order_xxx).
   */
  async fetchOrder(orderId: string): Promise<any> {
    try {
      const order = await this.razorpay.orders.fetch(orderId);
      this.logger.debug(`Razorpay Order fetched: ${order.id} | status: ${order.status}`);
      return order;
    } catch (err) {
      this.handleRazorpayError('fetchOrder', err);
    }
  }

  /**
   * Fetches a Razorpay Payment by its ID.
   *
   * @param paymentId  Razorpay Payment ID (pay_xxx).
   */
  async fetchPayment(paymentId: string): Promise<any> {
    try {
      const payment = await this.razorpay.payments.fetch(paymentId);
      this.logger.debug(`Razorpay Payment fetched: ${payment.id} | status: ${payment.status}`);
      return payment;
    } catch (err) {
      this.handleRazorpayError('fetchPayment', err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Transfers — milestone payouts to freelancers (Route)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Creates a Razorpay Transfer to move funds to a linked account.
   * Requires Razorpay Route (similar to Stripe Connect).
   *
   * @param amountPaise       Amount to transfer in paise.
   * @param currency          ISO 4217 currency code (default: 'INR').
   * @param accountId         Linked account ID (acc_xxx).
   * @param notes             Arbitrary metadata.
   */
  async createTransfer(
    amountPaise: number,
    currency: string = 'INR',
    accountId: string,
    notes: Record<string, any> = {},
  ): Promise<any> {
    try {
      this.logger.debug(
        `Creating Razorpay Transfer: amount=${amountPaise} ${currency} → ${accountId}`,
      );

      const transfer = await this.razorpay.transfers.create({
        amount: amountPaise,
        currency: currency.toUpperCase(),
        account: accountId,
        notes,
      });

      this.logger.log(
        `Razorpay Transfer created: ${transfer.id} | amount: ${amountPaise} ${currency} ` +
          `→ ${accountId}`,
      );

      return transfer;
    } catch (err) {
      this.handleRazorpayError('createTransfer', err);
    }
  }

  /**
   * Reverses a Razorpay Transfer.
   *
   * @param transferId  Razorpay Transfer ID (trf_xxx).
   * @param amountPaise Amount to reverse (omit for full reversal).
   */
  async reverseTransfer(
    transferId: string,
    amountPaise?: number,
  ): Promise<any> {
    try {
      const reversal = await this.razorpay.transfers.reverse(transferId, {
        ...(amountPaise ? { amount: amountPaise } : {}),
      });

      this.logger.log(
        `Razorpay Transfer reversed: ${reversal.id} | transfer: ${transferId}`,
      );

      return reversal;
    } catch (err) {
      this.handleRazorpayError('reverseTransfer', err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Refunds
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Issues a refund for a Razorpay Payment.
   *
   * @param paymentId    Razorpay Payment ID (pay_xxx).
   * @param amountPaise  Amount to refund in paise (omit for full refund).
   * @param notes        Arbitrary metadata.
   */
  async createRefund(
    paymentId: string,
    amountPaise?: number,
    notes: Record<string, any> = {},
  ): Promise<any> {
    try {
      this.logger.debug(
        `Creating Razorpay Refund: paymentId=${paymentId} amount=${amountPaise ?? 'full'}`,
      );

      const refund = await this.razorpay.payments.refund(paymentId, {
        ...(amountPaise ? { amount: amountPaise } : {}),
        notes,
      });

      this.logger.log(
        `Razorpay Refund created: ${refund.id} | payment: ${paymentId} | ` +
          `amount: ${amountPaise ?? 'full'} | status: ${refund.status}`,
      );

      return refund;
    } catch (err) {
      this.handleRazorpayError('createRefund', err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Payouts — freelancer withdrawals
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Creates a contact for payouts (freelancer profile).
   *
   * @param name   Freelancer's full name.
   * @param email  Freelancer's email.
   * @param contact Freelancer's phone number.
   * @param type   Contact type (default: 'vendor').
   */
  async createContact(
    name: string,
    email: string,
    contact: string,
    type: string = 'vendor',
  ): Promise<any> {
    try {
      const contactObj = await this.razorpay.contacts.create({
        name,
        email,
        contact,
        type,
      });

      this.logger.log(`Razorpay Contact created: ${contactObj.id} | email: ${email}`);
      return contactObj;
    } catch (err) {
      this.handleRazorpayError('createContact', err);
    }
  }

  /**
   * Creates a fund account (bank account or UPI) for payouts.
   *
   * @param contactId     Razorpay Contact ID (cont_xxx).
   * @param accountType   'bank_account' | 'vpa' (UPI).
   * @param accountDetails Bank account or UPI details.
   */
  async createFundAccount(
    contactId: string,
    accountType: 'bank_account' | 'vpa',
    accountDetails: any,
  ): Promise<any> {
    try {
      const fundAccount = await this.razorpay.fundAccount.create({
        contact_id: contactId,
        account_type: accountType,
        [accountType]: accountDetails,
      });

      this.logger.log(
        `Razorpay Fund Account created: ${fundAccount.id} | type: ${accountType}`,
      );

      return fundAccount;
    } catch (err) {
      this.handleRazorpayError('createFundAccount', err);
    }
  }

  /**
   * Creates a payout to a freelancer's fund account.
   *
   * @param amountPaise    Amount to payout in paise.
   * @param currency       ISO 4217 currency code (default: 'INR').
   * @param fundAccountId  Razorpay Fund Account ID (fa_xxx).
   * @param mode           Payout mode: 'IMPS' | 'NEFT' | 'RTGS' | 'UPI'.
   * @param purpose        Purpose code (e.g. 'payout').
   * @param notes          Arbitrary metadata.
   */
  async createPayout(
    amountPaise: number,
    currency: string = 'INR',
    fundAccountId: string,
    mode: string = 'IMPS',
    purpose: string = 'payout',
    notes: Record<string, any> = {},
  ): Promise<any> {
    try {
      const payout = await this.razorpay.payouts.create({
        account_number: this.configService.get<string>('RAZORPAY_ACCOUNT_NUMBER'),
        amount: amountPaise,
        currency: currency.toUpperCase(),
        fund_account_id: fundAccountId,
        mode,
        purpose,
        notes,
      });

      this.logger.log(
        `Razorpay Payout created: ${payout.id} | amount: ${amountPaise} ${currency} ` +
          `→ ${fundAccountId} | status: ${payout.status}`,
      );

      return payout;
    } catch (err) {
      this.handleRazorpayError('createPayout', err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Webhooks
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Verifies the Razorpay webhook signature.
   *
   * @param payload    Raw request body as string.
   * @param signature  Value of the 'x-razorpay-signature' HTTP header.
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.webhookSecret) {
      throw new InternalServerErrorException(
        'RAZORPAY_WEBHOOK_SECRET is not configured. ' +
          'Webhook signature verification cannot proceed.',
      );
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payload)
        .digest('hex');

      const isValid = expectedSignature === signature;

      if (!isValid) {
        this.logger.warn('Razorpay webhook signature verification failed.');
      } else {
        this.logger.debug('Razorpay webhook signature verified successfully.');
      }

      return isValid;
    } catch (err) {
      this.logger.error('Razorpay webhook signature verification error', err);
      return false;
    }
  }

  /**
   * Verifies a payment signature (for frontend payment confirmation).
   *
   * @param orderId       Razorpay Order ID.
   * @param paymentId     Razorpay Payment ID.
   * @param signature     Signature from Razorpay response.
   */
  verifyPaymentSignature(
    orderId: string,
    paymentId: string,
    signature: string,
  ): boolean {
    try {
      const keySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET', '');
      const body = `${orderId}|${paymentId}`;

      const expectedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(body)
        .digest('hex');

      return expectedSignature === signature;
    } catch (err) {
      this.logger.error('Razorpay payment signature verification error', err);
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Expose the raw Razorpay instance for advanced use-cases
  // ─────────────────────────────────────────────────────────────────────────────

  get client(): Razorpay {
    return this.razorpay;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────────

  private handleRazorpayError(operation: string, err: any): never {
    this.logger.error(
      `[Razorpay] ${operation} failed | ` +
        `statusCode: ${err?.statusCode ?? 'n/a'} | ` +
        `error: ${err?.error?.description ?? err?.message ?? err}`,
      err?.stack,
    );

    throw err;
  }
}
