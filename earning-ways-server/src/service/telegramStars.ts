import prisma from '../config/prisma.js';
import { Prisma } from '../../generated/prisma/index.js';
import { PaymentError, paymentAmount } from './amount.js';
import { planInvestmentTerms } from './investmentTerms.js';
import { applyReferralBonus } from './referralBonus.js';
import { inrText, notifyUser } from './notify.js';

// Telegram Stars rail — the only payment method on this platform.
//
// Pricing is INR-native: the member invests rupees, the plan is worth rupees,
// and the admin decides how many Telegram Stars equal one rupee. There is no
// second currency anywhere in this module.
//
// Credentials and pricing are managed from the admin panel
// (telegram_stars_settings); environment variables are only a fallback/default
// so a fresh deployment can be bootstrapped. Nothing here runs at import time,
// so a missing configuration can never stop the API from starting.

export const STARS_CURRENCY = 'XTR';
const BOT_API_BASE = 'https://api.telegram.org';
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Telegram's dedicated test environment is the same API with `/test/` before the
 * method name, and it is what the Stars documentation points at for testing
 * payments. It stays OFF unless `TELEGRAM_TEST_ENV` is explicitly truthy, so a
 * production deployment can never drift into it by accident.
 */
export const isTestEnvironment = (): boolean =>
  /^(1|true|yes|on)$/i.test((process.env.TELEGRAM_TEST_ENV ?? '').trim());

/** The exact Bot API URL for a method, in whichever environment is configured. */
export const methodUrl = (token: string, method: string): string =>
  `${BOT_API_BASE}/bot${token}${isTestEnvironment() ? '/test' : ''}/${method}`;

export type StarsConfig = {
  botToken: string;
  botUsername: string | null;
  webhookSecret: string | null;
  webhookUrl: string | null;
  starsPerInr: Prisma.Decimal;
  maxStarsPerInvoice: number;
  isEnabled: boolean;
  testEnvironment: boolean;
};

export type StarsSettingRow = {
  id: string;
  botToken: string | null;
  botUsername: string | null;
  webhookSecret: string | null;
  webhookUrl: string | null;
  starsPerInr: Prisma.Decimal | null;
  maxStarsPerInvoice: number;
  isEnabled: boolean;
} | null;

export async function loadStarsSettingsRow(): Promise<StarsSettingRow> {
  return (await prisma.telegramStarsSetting.findFirst({})) ?? null;
}

const pick = (row: StarsSettingRow, column: string, env: string | undefined): unknown => {
  const stored = (row as Record<string, unknown> | null)?.[column];
  if (stored !== null && stored !== undefined && stored !== '') return stored;
  return env && env !== '' ? env : undefined;
};

const asDecimal = (value: unknown): Prisma.Decimal | null => {
  // Stored rates come back from Prisma as Decimal instances, not as strings.
  if (value instanceof Prisma.Decimal) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    try {
      return new Prisma.Decimal(value);
    } catch {
      return null;
    }
  }
  return null;
};

const asText = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null;

/**
 * Resolves the active configuration. Throws a 503 PaymentError when the rail is
 * not configured, which the routes translate into "not available" responses.
 */
export async function loadStarsConfig(): Promise<StarsConfig> {
  const row = await loadStarsSettingsRow();
  const botToken = pick(row, 'botToken', process.env.TELEGRAM_BOT_TOKEN);
  const botUsername = pick(row, 'botUsername', process.env.TELEGRAM_BOT_USERNAME);
  const starsPerInr = pick(row, 'starsPerInr', process.env.STARS_PER_INR);
  const maxStarsPerInvoice = row?.maxStarsPerInvoice
    ?? Number(process.env.TELEGRAM_STARS_MAX_PER_INVOICE ?? 10000);
  const isEnabled = row ? row.isEnabled : process.env.TELEGRAM_STARS_ENABLED === 'true';

  if (typeof botToken !== 'string' || !/^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(botToken)) {
    throw new PaymentError('Telegram Stars bot token is not configured', 503);
  }
  const starsRate = asDecimal(starsPerInr);
  if (!starsRate || !starsRate.greaterThan(0)) {
    throw new PaymentError('Stars per INR rate is not configured', 503);
  }
  if (!Number.isInteger(maxStarsPerInvoice) || maxStarsPerInvoice <= 0) {
    throw new PaymentError('Maximum Stars per invoice is not configured correctly', 503);
  }

  const storedUsername = asText(botUsername);
  return {
    botToken,
    botUsername: storedUsername ? storedUsername.replace(/^@/, '') : null,
    webhookSecret: asText(pick(row, 'webhookSecret', process.env.TELEGRAM_WEBHOOK_SECRET)),
    webhookUrl: asText(pick(row, 'webhookUrl', undefined)),
    starsPerInr: starsRate,
    maxStarsPerInvoice,
    isEnabled,
    testEnvironment: isTestEnvironment(),
  };
}

/** Display-only configuration; never contains the token or the webhook secret. */
export function publicStarsConfig(config: StarsConfig) {
  return {
    enabled: config.isEnabled,
    botUsername: config.botUsername,
    starsPerInr: config.starsPerInr.toString(),
    maxStarsPerInvoice: config.maxStarsPerInvoice,
    testEnvironment: config.testEnvironment,
  };
}

/** Stars are a whole number; anything above the cap is refused instead of guessed. */
export function starsForAmount(inrAmount: Prisma.Decimal, starsPerInr: Prisma.Decimal, maxStars: number): number {
  const stars = inrAmount.mul(starsPerInr).ceil();
  if (stars.lessThan(1)) throw new PaymentError('Amount is too small to pay in Telegram Stars');
  if (stars.greaterThan(maxStars)) {
    throw new PaymentError(
      `This amount needs ${stars.toString()} Stars, above the ${maxStars} Stars limit per invoice. Please contact support to invest this amount.`,
    );
  }
  return stars.toNumber();
}

/** Thin Bot API client. `fetch` is available in Node 18+, so no dependency. */
export async function telegramApi<T = unknown>(token: string, method: string, payload?: Record<string, unknown>): Promise<T> {
  let response: Response;
  try {
    response = await fetch(methodUrl(token, method), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload ?? {}),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    console.error(`Telegram ${method} request failed:`, error);
    throw new PaymentError('Telegram is unreachable; retry shortly', 503);
  }
  const body = await response.json().catch(() => null) as { ok?: boolean; result?: T; description?: string } | null;
  if (!response.ok || !body?.ok) {
    console.error(`Telegram ${method} rejected:`, body?.description ?? response.status);
    throw new PaymentError(body?.description || 'Telegram rejected the request', 503);
  }
  return body.result as T;
}

export async function createInvoiceLink(config: StarsConfig, input: { paymentId: string; stars: number; title: string; description: string }): Promise<string> {
  const link = await telegramApi<string>(config.botToken, 'createInvoiceLink', {
    title: input.title.slice(0, 32),
    description: input.description.slice(0, 255),
    // The payload carries our own intent id, so a confirmed payment needs no
    // Telegram account linking to find its member and plan.
    payload: input.paymentId,
    currency: STARS_CURRENCY,
    // Exactly one price item and no provider token are required for Stars.
    prices: [{ label: 'Telegram Stars', amount: input.stars }],
  });
  if (typeof link !== 'string' || !link) throw new PaymentError('Telegram returned an empty invoice link', 503);
  return link;
}

export async function answerPreCheckoutQuery(config: StarsConfig, queryId: string, ok: boolean, errorMessage?: string): Promise<void> {
  await telegramApi(config.botToken, 'answerPreCheckoutQuery', {
    pre_checkout_query_id: queryId,
    ok,
    ...(ok ? {} : { error_message: (errorMessage || 'This invoice can no longer be paid.').slice(0, 200) }),
  });
}

export async function refundStarPayment(config: StarsConfig, telegramUserId: string, chargeId: string): Promise<void> {
  await telegramApi(config.botToken, 'refundStarPayment', {
    user_id: telegramUserId,
    telegram_payment_charge_id: chargeId,
  });
}

export async function verifyBot(config: StarsConfig) {
  return telegramApi<{ id: number; username?: string }>(config.botToken, 'getMe');
}

export async function registerWebhook(config: StarsConfig, url: string, secret: string) {
  return telegramApi(config.botToken, 'setWebhook', {
    url,
    secret_token: secret,
    allowed_updates: ['pre_checkout_query', 'message'],
    drop_pending_updates: false,
  });
}

/** Reads the Stars fields out of a Telegram `successful_payment` object. */
export type StarsPaymentUpdate = {
  invoicePayload?: unknown;
  chargeId?: unknown;
  totalAmount?: unknown;
  currency?: unknown;
  telegramUserId?: unknown;
};

export function readStarsPayment(update: unknown): StarsPaymentUpdate {
  // Telegram delivers the receipt as a message: update.message.successful_payment.
  const message = (update as {
    message?: { successful_payment?: Record<string, unknown>; from?: { id?: unknown } };
  } | null)?.message;
  const successful = message?.successful_payment;
  if (!successful || typeof successful !== 'object') throw new PaymentError('Missing successful payment payload');
  return {
    invoicePayload: successful.invoice_payload,
    chargeId: successful.telegram_payment_charge_id,
    totalAmount: successful.total_amount,
    currency: successful.currency,
    telegramUserId: message?.from?.id,
  };
}

/**
 * Confirms a paid Stars invoice and activates the plan.
 *
 * The investment is created **ACTIVE** (a purchase activates the plan with no
 * admin step) and the referrer's bonus is credited in the same transaction.
 * Idempotent: the conditional claim on status = PENDING means a replayed
 * webhook can never create a second investment. The wallet is deliberately NOT
 * credited — the money is invested, not deposited.
 */
export async function settleStarsPayment(payload: StarsPaymentUpdate): Promise<{ credited: boolean; investmentId: string | null }> {
  const paymentId = typeof payload.invoicePayload === 'string' ? payload.invoicePayload : '';
  const chargeId = typeof payload.chargeId === 'string' ? payload.chargeId : '';
  const totalAmount = payload.totalAmount;
  if (!paymentId || !chargeId || typeof totalAmount !== 'number' || !Number.isInteger(totalAmount)) {
    throw new PaymentError('Successful payment is missing its payment identity');
  }
  if (payload.currency !== STARS_CURRENCY) {
    throw new PaymentError(`Unsupported payment currency: ${String(payload.currency)}`);
  }
  const telegramUserId = payload.telegramUserId === undefined || payload.telegramUserId === null
    ? null
    : String(payload.telegramUserId);

  return prisma.$transaction(async tx => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new PaymentError('Payment intent not found', 503);
    if (payment.provider !== 'TELEGRAM_STARS') throw new PaymentError('Payment does not belong to the Telegram Stars rail');
    if (payment.starsAmount !== totalAmount) throw new PaymentError('Paid Stars amount does not match the invoice');
    if (payment.telegramChargeId !== null && payment.telegramChargeId !== chargeId) {
      throw new PaymentError('Payment already settled with a different charge');
    }
    if (payment.status === 'CONFIRMED') {
      // Replayed update for a payment we already delivered.
      return { credited: false, investmentId: payment.investmentId };
    }
    if (payment.status !== 'PENDING') throw new PaymentError('Payment is no longer payable', 409);

    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: { status: 'CONFIRMED', telegramChargeId: chargeId, telegramUserId, confirmedAt: new Date() },
    });
    if (claimed.count !== 1) {
      const existing = await tx.payment.findUnique({ where: { id: payment.id } });
      if (existing?.status === 'CONFIRMED' && existing.telegramChargeId === chargeId) {
        return { credited: false, investmentId: existing.investmentId };
      }
      throw new PaymentError('Payment could not be claimed', 409);
    }

    const plan = payment.planId
      ? await tx.subscriptionPlan.findUnique({ where: { id: payment.planId } })
      : null;
    if (!plan) throw new PaymentError('Subscription plan for this payment no longer exists', 409);

    const amount = paymentAmount(payment.amount.toString());
    const terms = planInvestmentTerms(plan, amount);

    const investment = await tx.investment.create({
      data: {
        userId: payment.userId,
        planId: plan.id,
        amountInvested: amount,
        roiPercentage: terms.roiPercentage,
        // The Telegram charge id is the payment reference for this investment.
        transactionId: chargeId,
        startDate: terms.startDate,
        endDate: terms.endDate,
        // Automatic activation: paying for the plan is what turns it on.
        status: 'ACTIVE',
        totalReturn: null,
      },
    });

    // Referrer bonus for the newly activated investment, in the same transaction
    // as the activation itself so the ledger can never disagree with the plan.
    await applyReferralBonus(tx, {
      userId: payment.userId,
      investmentId: investment.id,
      amountInvested: amount,
      investmentCreatedAt: investment.createdAt,
    });

    // The member is told their plan went live at the same moment the money moved.
    await notifyUser(tx, {
      userId: payment.userId,
      title: 'Investment activated',
      message: `${inrText(amount)} invested in ${plan.name} is active now. ${totalAmount} Telegram Stars were received.`,
      type: 'SUCCESS',
      meta: { investmentId: investment.id, planId: plan.id, amount: amount.toString(), stars: totalAmount },
    });

    await tx.payment.update({ where: { id: payment.id }, data: { investmentId: investment.id } });

    return { credited: true, investmentId: investment.id };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}
