import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { timingSafeEqual } from 'node:crypto';
import prisma from '../config/prisma.js';
import { Prisma } from '../../generated/prisma/index.js';
import { PaymentError, paymentAmount } from '../service/amount.js';
import { planInvestmentTerms } from '../service/investmentTerms.js';
import { recordAdminAction } from '../service/audit.js';
import {
  answerPreCheckoutQuery,
  createInvoiceLink,
  isTestEnvironment,
  loadStarsConfig,
  loadStarsSettingsRow,
  publicStarsConfig,
  readStarsPayment,
  registerWebhook,
  settleStarsPayment,
  starsForAmount,
  verifyBot,
  STARS_CURRENCY,
} from '../service/telegramStars.js';

// Telegram Stars — the only payment option on this platform. Reads never touch
// the wallet: a confirmed payment activates the plan's investment immediately.

const PAYMENT_STATUSES = ['PENDING', 'CONFIRMED', 'REFUNDED', 'EXPIRED'];
const BOT_TOKEN_PATTERN = /^\d{5,}:[A-Za-z0-9_-]{20,}$/;
const BOT_USERNAME_PATTERN = /^[A-Za-z0-9_]{3,32}$/;
const WEBHOOK_SECRET_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

const fail = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof PaymentError) return res.status(error.status).json({ error: error.message });
  console.error(`${fallback}:`, error);
  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: fallback });
};

const secureEquals = (left: string, right: string) => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};

const maskSecret = (value: string | null) => {
  if (!value) return null;
  if (value.length <= 8) return '••••';
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
};

const numberInRange = (value: unknown, min: number, max: number, field: string): Prisma.Decimal => {
  const invalid = new PaymentError(`${field} must be a number between ${min} and ${max}`);
  if (typeof value !== 'string' && typeof value !== 'number') throw invalid;
  let parsed: Prisma.Decimal;
  try {
    parsed = new Prisma.Decimal(value);
  } catch {
    throw invalid;
  }
  if (!parsed.isFinite() || parsed.lessThan(min) || parsed.greaterThan(max)) throw invalid;
  return parsed;
};

/** Public display config: prices and the bot name, never credentials. */
export const getStarsConfig = async (_req: Request, res: Response) => {
  try {
    return res.status(StatusCodes.OK).json({ data: publicStarsConfig(await loadStarsConfig()) });
  } catch {
    // Not configured or disabled — the UI simply hides the INR option.
    return res.status(StatusCodes.OK).json({ data: { enabled: false, botUsername: null, starsPerInr: null } });
  }
};

/** Creates a Stars invoice for a member's investment. */
export const createStarsInvoice = async (req: Request, res: Response) => {
  const principal = res.locals.principal;
  if (!principal) return res.status(StatusCodes.UNAUTHORIZED).json({ error: 'Authentication required' });
  if (principal.kind !== 'user') {
    return res.status(StatusCodes.FORBIDDEN).json({ error: 'Stars checkout requires a member account' });
  }

  try {
    const config = await loadStarsConfig();
    if (!config.isEnabled) {
      return res.status(StatusCodes.SERVICE_UNAVAILABLE).json({ error: 'Telegram Stars payments are currently disabled' });
    }

    const planId = req.body?.planId;
    if (typeof planId !== 'string' || !planId) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: 'planId is required' });
    }

    const amount = paymentAmount(req.body?.amount);
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) return res.status(StatusCodes.NOT_FOUND).json({ error: 'Subscription plan not found' });

    // Same plan rules as the manual rail, so a Stars payment can never buy an
    // amount the plan would not accept.
    planInvestmentTerms(plan, amount);

    // The member invests rupees and the admin decides how many Telegram Stars one
    // rupee is worth, so there is exactly one conversion in the whole flow.
    const stars = starsForAmount(amount, config.starsPerInr, config.maxStarsPerInvoice);

    // Persist the intent first so an early webhook can resolve it by id.
    const payment = await prisma.payment.create({
      data: {
        userId: principal.id,
        amount,
        currency: 'INR',
        provider: 'TELEGRAM_STARS',
        status: 'PENDING',
        planId: plan.id,
        starsAmount: stars,
      },
    });

    let invoiceUrl: string;
    try {
      invoiceUrl = await createInvoiceLink(config, {
        paymentId: payment.id,
        stars,
        title: `Investment - ${plan.name}`,
        description: `INR ${amount.toString()} investment for ${plan.name} (${plan.durationInMonths} months). Paid with ${stars} Telegram Stars.`,
      });
      await prisma.payment.update({ where: { id: payment.id }, data: { invoiceUrl } });
    } catch (error) {
      // No payable invoice exists, so the intent must not stay payable.
      await prisma.payment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { status: 'EXPIRED' } })
        .catch(updateError => console.error('Failed to expire unpaid Stars intent:', updateError));
      throw error;
    }

    return res.status(StatusCodes.OK).json({
      paymentId: payment.id,
      invoiceUrl,
      stars,
      amount: amount.toString(),
      botUsername: config.botUsername,
    });
  } catch (error) {
    return fail(res, error, 'Failed to create Telegram Stars invoice');
  }
};

/** Polled by the invest modal until the webhook confirms the payment. */
export const getStarsPaymentStatus = async (req: Request, res: Response) => {
  const principal = res.locals.principal;
  if (!principal) return res.status(StatusCodes.UNAUTHORIZED).json({ error: 'Authentication required' });

  try {
    const paymentId = req.params.paymentId as string;
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.provider !== 'TELEGRAM_STARS') {
      return res.status(StatusCodes.NOT_FOUND).json({ error: 'Payment not found' });
    }
    if (principal.kind !== 'admin' && payment.userId !== principal.id) {
      return res.status(StatusCodes.FORBIDDEN).json({ error: 'This payment belongs to another account' });
    }

    return res.status(StatusCodes.OK).json({
      data: {
        id: payment.id,
        status: payment.status,
        amount: payment.amount.toString(),
        stars: payment.starsAmount,
        planId: payment.planId,
        investmentId: payment.investmentId,
        telegramChargeId: payment.telegramChargeId,
        confirmedAt: payment.confirmedAt,
      },
    });
  } catch (error) {
    return fail(res, error, 'Failed to read payment status');
  }
};

/**
 * Telegram webhook. Public by necessity, authenticated by the secret token that
 * Telegram echoes back in `X-Telegram-Bot-Api-Secret-Token`.
 */
export const telegramWebhook = async (req: Request, res: Response) => {
  let config;
  try {
    config = await loadStarsConfig();
  } catch (error) {
    console.error('Telegram webhook is not configured:', error);
    return res.status(StatusCodes.SERVICE_UNAVAILABLE).json({ error: 'Payment webhook is not configured' });
  }
  if (!config.webhookSecret) {
    return res.status(StatusCodes.SERVICE_UNAVAILABLE).json({ error: 'Payment webhook is not configured' });
  }
  const received = req.get('x-telegram-bot-api-secret-token');
  if (!received || !secureEquals(received, config.webhookSecret)) {
    return res.status(StatusCodes.UNAUTHORIZED).json({ error: 'Invalid webhook secret' });
  }
  if (!Buffer.isBuffer(req.body)) {
    return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Raw JSON body is required' });
  }

  let update: Record<string, any>;
  try {
    update = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Invalid JSON payload' });
  }

  const preCheckout = update?.pre_checkout_query;
  if (preCheckout) {
    const queryId = typeof preCheckout.id === 'string' ? preCheckout.id : '';
    let ok = false;
    let reason = 'This invoice is no longer available.';
    try {
      const payloadId = typeof preCheckout.invoice_payload === 'string' ? preCheckout.invoice_payload : '';
      const intent = payloadId ? await prisma.payment.findUnique({ where: { id: payloadId } }) : null;
      if (!intent || intent.provider !== 'TELEGRAM_STARS') reason = 'Payment reference not found.';
      else if (intent.status !== 'PENDING') reason = 'This invoice has already been processed.';
      else if (preCheckout.currency !== STARS_CURRENCY || intent.starsAmount !== preCheckout.total_amount) {
        reason = 'Invoice amount does not match the order.';
      } else ok = true;
    } catch (error) {
      console.error('Failed to validate pre-checkout query:', error);
    }
    let delivered = false;
    if (queryId) {
      try {
        await answerPreCheckoutQuery(config, queryId, ok, reason);
        delivered = true;
      } catch (error) {
        console.error('Failed to answer pre-checkout query:', error);
      }
    }
    // `answered` only reports the answer we sent, which is what matters to Telegram.
    return res.status(StatusCodes.OK).json({ received: true, answered: delivered && ok });
  }

  if (update?.message?.successful_payment) {
    try {
      const result = await settleStarsPayment(readStarsPayment(update));
      console.log(`Telegram Stars payment settled (credited=${result.credited}, investment=${result.investmentId})`);
      return res.status(StatusCodes.OK).json({ received: true, credited: result.credited });
    } catch (error) {
      if (error instanceof PaymentError && error.status !== 503) {
        // A permanent mismatch needs a human, not a retry.
        console.error('Telegram Stars settlement refused:', error.message);
        return res.status(StatusCodes.OK).json({ received: true, credited: false, error: error.message });
      }
      console.error('Telegram Stars settlement failed:', error);
      return res.status(StatusCodes.SERVICE_UNAVAILABLE).json({ error: 'Payment settlement failed; retry required' });
    }
  }

  return res.status(StatusCodes.OK).json({ received: true });
};

/** Admin: paginated Stars payments with totals. */
export const listStarsPayments = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query.limit ?? '10'), 10) || 10));
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    const where: Prisma.PaymentWhereInput = { provider: 'TELEGRAM_STARS' };
    if (status && PAYMENT_STATUSES.includes(status)) where.status = status;
    if (search) {
      where.OR = [
        { telegramChargeId: { contains: search } },
        { user: { email: { contains: search } } },
        { user: { name: { contains: search } } },
      ];
    }

    const [total, payments, confirmed] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.payment.aggregate({
        where: { provider: 'TELEGRAM_STARS', status: 'CONFIRMED' },
        _count: { _all: true },
        _sum: { starsAmount: true, amount: true },
      }),
    ]);

    // Payment has no relation to SubscriptionPlan, so plan names are resolved in
    // one extra query instead of changing the existing schema relations.
    const planIds = [...new Set(payments.map(payment => payment.planId).filter((id): id is string => Boolean(id)))];
    const plans = planIds.length
      ? await prisma.subscriptionPlan.findMany({ where: { id: { in: planIds } }, select: { id: true, name: true } })
      : [];
    const planNames = new Map(plans.map(plan => [plan.id, plan.name]));

    return res.status(StatusCodes.OK).json({
      data: payments.map(payment => ({
        id: payment.id,
        user: payment.user,
        plan: payment.planId ? { id: payment.planId, name: planNames.get(payment.planId) ?? null } : null,
        amountInr: payment.amount.toString(),
        stars: payment.starsAmount,
        status: payment.status,
        telegramChargeId: payment.telegramChargeId,
        telegramUserId: payment.telegramUserId,
        investmentId: payment.investmentId,
        invoiceUrl: payment.invoiceUrl,
        createdAt: payment.createdAt,
        confirmedAt: payment.confirmedAt,
      })),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) || 0 },
      stats: {
        confirmedCount: confirmed._count._all,
        confirmedStars: confirmed._sum.starsAmount ?? 0,
        confirmedInr: confirmed._sum.amount ? confirmed._sum.amount.toString() : '0',
      },
    });
  } catch (error) {
    return fail(res, error, 'Failed to load Telegram Stars payments');
  }
};

/** Admin: current settings with the secrets masked. */
export const getStarsSettings = async (_req: Request, res: Response) => {
  try {
    const row = await loadStarsSettingsRow();
    return res.status(StatusCodes.OK).json({
      data: {
        botToken: maskSecret(row?.botToken ?? null),
        botTokenSet: Boolean(row?.botToken || process.env.TELEGRAM_BOT_TOKEN),
        botUsername: row?.botUsername ?? process.env.TELEGRAM_BOT_USERNAME ?? null,
        webhookSecret: maskSecret(row?.webhookSecret ?? null),
        webhookSecretSet: Boolean(row?.webhookSecret || process.env.TELEGRAM_WEBHOOK_SECRET),
        webhookUrl: row?.webhookUrl ?? null,
        starsPerInr: row?.starsPerInr ? row.starsPerInr.toString() : process.env.STARS_PER_INR ?? null,
        maxStarsPerInvoice: row?.maxStarsPerInvoice ?? Number(process.env.TELEGRAM_STARS_MAX_PER_INVOICE ?? 10000),
        isEnabled: row?.isEnabled ?? process.env.TELEGRAM_STARS_ENABLED === 'true',
        // Read-only: it comes from TELEGRAM_TEST_ENV, so the panel can show
        // whether live payments or Telegram's test environment are in use.
        testEnvironment: isTestEnvironment(),
      },
    });
  } catch (error) {
    return fail(res, error, 'Failed to load Telegram Stars settings');
  }
};

/** Admin: update credentials, rates and the enable switch. */
export const updateStarsSettings = async (req: Request, res: Response) => {
  const principal = res.locals.principal;
  try {
    const body = req.body ?? {};
    const data: Prisma.TelegramStarsSettingUpdateInput = {};

    if (typeof body.botToken === 'string' && body.botToken.trim()) {
      if (!BOT_TOKEN_PATTERN.test(body.botToken.trim())) {
        throw new PaymentError('Bot token format is invalid (expected 123456:ABC...)');
      }
      data.botToken = body.botToken.trim();
    }
    if (typeof body.botUsername === 'string') {
      const username = body.botUsername.trim().replace(/^@/, '');
      if (username && !BOT_USERNAME_PATTERN.test(username)) throw new PaymentError('Bot username is invalid');
      data.botUsername = username || null;
    }
    if (typeof body.webhookSecret === 'string' && body.webhookSecret.trim()) {
      const secret = body.webhookSecret.trim();
      if (!WEBHOOK_SECRET_PATTERN.test(secret)) {
        throw new PaymentError('Webhook secret must be 8-64 characters of A-Z, a-z, 0-9, _ or -');
      }
      data.webhookSecret = secret;
    }
    if (body.starsPerInr !== undefined && body.starsPerInr !== '') {
      data.starsPerInr = numberInRange(body.starsPerInr, 0.0001, 1_000_000, 'Stars per INR');
    }
    if (body.maxStarsPerInvoice !== undefined && body.maxStarsPerInvoice !== '') {
      const max = Number(body.maxStarsPerInvoice);
      if (!Number.isInteger(max) || max < 1 || max > 1_000_000) {
        throw new PaymentError('Maximum Stars per invoice must be an integer between 1 and 1000000');
      }
      data.maxStarsPerInvoice = max;
    }
    if (typeof body.isEnabled === 'boolean') data.isEnabled = body.isEnabled;
    if (typeof body.webhookUrl === 'string') {
      const url = body.webhookUrl.trim();
      if (url && !/^https:\/\/[^\s]+$/.test(url)) throw new PaymentError('Webhook URL must be a public https URL');
      data.webhookUrl = url || null;
    }

    if (Object.keys(data).length === 0) throw new PaymentError('At least one setting is required');
    if (principal?.id) data.updatedById = principal.id;

    const row = await loadStarsSettingsRow();
    const saved = row
      ? await prisma.telegramStarsSetting.update({ where: { id: row.id }, data })
      : await prisma.telegramStarsSetting.create({ data: data as Prisma.TelegramStarsSettingCreateInput });

    // Only the field NAMES are recorded — never the token or the webhook secret.
    await recordAdminAction(principal, {
      action: 'stars:credentials',
      entity: 'setting',
      entityId: saved.id,
      summary: `Telegram Stars settings updated: ${Object.keys(data).join(', ') || 'no fields'}`,
      after: { fields: Object.keys(data), isEnabled: saved.isEnabled, starsPerInr: saved.starsPerInr?.toString() ?? null },
    }, req);

    return res.status(StatusCodes.OK).json({
      message: 'Telegram Stars settings saved',
      data: {
        botToken: maskSecret(saved.botToken),
        botTokenSet: Boolean(saved.botToken),
        botUsername: saved.botUsername,
        webhookSecret: maskSecret(saved.webhookSecret),
        webhookSecretSet: Boolean(saved.webhookSecret),
        webhookUrl: saved.webhookUrl,
        starsPerInr: saved.starsPerInr ? saved.starsPerInr.toString() : null,
        maxStarsPerInvoice: saved.maxStarsPerInvoice,
        isEnabled: saved.isEnabled,
      },
    });
  } catch (error) {
    return fail(res, error, 'Failed to save Telegram Stars settings');
  }
};

/** Admin: verify the bot and register the webhook with Telegram. */
export const setupStarsBot = async (req: Request, res: Response) => {
  try {
    const config = await loadStarsConfig();
    const me = await verifyBot(config);

    const requested = typeof req.body?.webhookUrl === 'string' ? req.body.webhookUrl.trim() : '';
    const webhookUrl = requested || config.webhookUrl || '';
    if (!/^https:\/\/[^\s]+/.test(webhookUrl)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        error: 'A public https webhook URL is required (Telegram cannot call http://localhost)',
        bot: { id: me.id, username: me.username ?? null },
      });
    }
    if (!config.webhookSecret) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Set and save a webhook secret before registering' });
    }

    await registerWebhook(config, webhookUrl, config.webhookSecret);
    const row = await loadStarsSettingsRow();
    if (row) await prisma.telegramStarsSetting.update({ where: { id: row.id }, data: { webhookUrl } });

    return res.status(StatusCodes.OK).json({
      message: 'Webhook registered with Telegram',
      bot: { id: me.id, username: me.username ?? null },
      webhookUrl,
    });
  } catch (error) {
    return fail(res, error, 'Failed to register the Telegram webhook');
  }
};

export const telegramStarsController = {
  getStarsConfig,
  createStarsInvoice,
  getStarsPaymentStatus,
  telegramWebhook,
  listStarsPayments,
  getStarsSettings,
  updateStarsSettings,
  setupStarsBot,
};

export default telegramStarsController;
