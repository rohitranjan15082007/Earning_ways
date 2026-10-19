# Earning Ways — Access & Money Handling

This document describes how the API authenticates callers and how money moves.
It replaces the inherited `expotrading` notes, which described a Coinbase
(USDT) rail that no longer exists in this project.

## 1. Configuration the server refuses to boot without

| Variable | Rule |
| --- | --- |
| `JWT_SECRET` | Required, at least 32 bytes. Startup fails otherwise (`JWT.assertConfigured()`). |
| `DATABASE_URL` | MySQL connection string; `prisma migrate deploy` applies the schema. |
| `CLOUD_NAME` / `CLOUD_API_KEY` / `CLOUD_API_SECRET` | Cloudinary image hosting. If they are absent or rejected, uploaded payout QR codes are stored in this server's own `uploads/` folder and served from `/uploads`. |

Optional Telegram Stars fallbacks (the admin panel is the source of truth):
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`,
`STARS_PER_INR`, `TELEGRAM_STARS_MAX_PER_INVOICE`, `TELEGRAM_STARS_ENABLED`.

## 2. Authentication and authorisation

* Tokens are HS256 JWTs with the issuer `earning-ways-api` and audience
  `earning-ways-app`, carrying `id`, `kind` (`user` | `admin`) and
  `tokenVersion`. A password change or logout increments `tokenVersion`, so
  every token issued earlier is refused.
* `src/routes/access.routes.ts` is mounted before every domain router. A listed
  rule proceeds to its controller; **everything unlisted defaults to
  authenticated admin-only**. Case and trailing-slash variants are normalized
  before the check so a lowercase public rule cannot authorise another handler.
* Public by necessity: member sign-up/login, admin login, enquiry, site
  settings, the plan catalog, the Telegram Stars config/webhook.
* `POST /api/payment/telegram/webhook` authenticates with the
  `X-Telegram-Bot-Api-Secret-Token` header (constant-time compared) over the
  exact raw bytes, because Telegram signs nothing.
* `POST /api/investment/create` and `PUT|GET /api/qr-code/*` are **operations
  only**: a member can never record a purchase for themselves, and the platform's
  own payout UPI id is not public data.

## 3. Money rules

* Every amount is **INR**, stored as `Decimal(14, 2)` — paise precise, never
  floating point. `paymentAmount()` in `src/service/amount.ts` is the only entry
  point for validating an amount (positive, at most two decimal places).
* Balances live in two places on purpose: `Wallet.balance` (member-facing) and
  `User.inrBalance` (guarded). Every debit is conditional on `>= amount` and both
  rows move inside one transaction, so concurrent requests cannot overdraw.
* Withdrawals debit immediately, snapshot the member's `upiId` and uploaded
  `qrCodeUrl`, and write a `WITHDRAW` ledger row. Approving marks the ledger
  `SUCCESS`; rejecting refunds atomically; only a `PENDING` request can be
  processed or deleted, and duplicates return `409`.
* Transfers are created `PENDING`, move money only on approval, and cannot be
  reopened once processed.

## 4. Telegram Stars (the only payment rail)

* `POST /api/payment/telegram/invoice` prices one invoice from the plan and the
  admin-configured `starsPerInr`, persists the intent as `PENDING` **before**
  calling Telegram, and expires the intent if Telegram rejects the invoice — so
  no payable orphan is ever left behind.
* A confirmed payment is claimed with a conditional `status = PENDING` update.
  In the same transaction it creates the investment as **`ACTIVE`** (a purchase
  activates the plan with no admin step), credits the referrer's bonus, and
  links `Payment.investmentId`. A replayed webhook creates nothing.
* The wallet is deliberately **not** credited: the money is invested, not
  deposited.
* `refundStarPayment` exists in `src/service/telegramStars.ts` but is not
  exposed yet — the policy for what happens to an investment when Stars are
  refunded still has to be decided.

## 5. Still required before production

This is not a complete production security review. Outstanding items:

1. Live verification of a real Telegram Stars payment (bot token + Stars
   balance) and of `setWebhook` against a public https URL.
2. Real-MySQL verification of withdrawal/transfer concurrency (the suite models
   transactions with serialized doubles).
3. Production-grade shared rate limiting, multi-instance session revocation
   timing, browser-storage hardening and deployment configuration.
4. Compliance: Telegram requires Stars for digital goods sold *inside* Telegram
   apps, and the bot owner carries dispute responsibility for the grey area of
   selling an investment product on a website.
