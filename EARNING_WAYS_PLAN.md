# Earning Ways — INR / Telegram-only Investment Platform

**Status:** plan → implementation record (this file is updated as the build lands).
**Source of truth for the flow:** the existing `expotrading/` project. This is a **strict re-implementation of the same flow system**, with two things changed: the money unit is **INR everywhere** and the only payment rail is **Telegram**.

> **Hinglish summary:** `expotrading` ka poora flow (signup → plans → invest → ROI → wallet → transfer → withdraw →
> referral → admin panel) waise hi rahega, bas **USDT/crypto ka kuch bhi nahi** hoga. Sab kuch **₹ (INR)** me.
> Payment sirf **Telegram Stars** se. Purchase ke turant baad **plan automatic ACTIVE**. Withdrawal me member apna
> **UPI ID + QR code** dega. Admin panel ka flow same, labels ₹ me.

---

## 1. Requirements → where it lands

| # | Requirement (as given) | Where it lands |
|---|---|---|
| 1 | This project is like that one — implement the same thing | Whole architecture cloned from `expotrading/` (3 apps: server, user, admin) |
| 2 | Everything in **INR**, nothing in USDT | Schema `inrBalance` / `currency = INR`; every UI label `₹`; no crypto copy anywhere |
| 3 | **Telegram payment system only** | Telegram Stars (`XTR`) is the only rail — Coinbase checkout + webhook **deleted** |
| 4 | **Automatic plan active** after purchase | `settleStarsPayment()` creates the investment as `ACTIVE` (+ referral bonus) in the same DB transaction |
| 5 | **Simple dashboard** | Member dashboard = balance, active plans, invested, ROI earned, recent activity |
| 6 | User **UPI ID + QR upload** at withdrawal | `Withdraw` page collects amount + UPI ID + QR image (the QR is **mandatory**); `Withdrawal` row snapshots both; admin sees them |
| 7 | Every existing function present, no USDT left | All routes/controllers/pages ported; crypto-only pieces removed and replaced with INR equivalents |
| 8 | Admin panel **same flow, INR** | Every admin page kept, `usdtBalance`→`inrBalance`, `USDT`→`₹`, Stars pricing panel re-based on INR |
| 9 | Strictly learn from `expotradex`, same flow | Same routes, same service boundaries, same access-policy model, same test style |
| 10 | Referral **optional** at signup | Referral code field labelled optional, blank = valid signup, no wallet address field |

---

## 2. What is deliberately removed (no USDT anywhere)

| Removed | Reason |
|---|---|
| `coinbase-commerce-node` dependency, `controller/payment.ts`, `routes/payment.routes.ts`, `settlePayment()` | Second payment rail; requirement #3 |
| `/api/payment/checkout`, `/api/payment/webhook` + their access rules + raw-body middleware | Coinbase-only endpoints |
| `User.walletAddress`, `User.usdtBalance`, `Wallet.walletAddress`, `Wallet.currency = 'USDT'` | On-chain concepts |
| `Transaction.currency = 'USDT'`, `Withdrawal.destinationAddress` | On-chain concepts |
| `Payment.chargeId`, `Payment.creditedAt`, `Payment.inrAmount` | Coinbase settlement / duplicate of `amount` once INR-native |
| `TelegramStarsSetting.starsPerUsdt`, `usdtInrRate` | Replaced by a single INR-native rate |
| `CryptoMarquee.tsx`, "BEP-20 network only" alerts, "Send USDT / paste transaction hash" branch, `0x...` placeholders, crypto marquee/price tickers, "10% on USDT" copy | Crypto UI |
| `env`: `COINBASE_API_KEY`, `COINBASE_WEBHOOK_SECRET`, `STARS_PER_USDT`, `USDT_INR_RATE` | Crypto configuration |

**Nothing else is dropped.** Users, plans, investments, ROI records, transactions, transfers, referrals (5 levels),
notifications, support tickets, enquiries, settings, dashboard aggregates, admin CRUD and the access policy all stay.

---

## 3. Repository layout

```text
Earning_ways/
├── EARNING_WAYS_PLAN.md          # this document
├── earning-ways-server/          # Express + TypeScript + Prisma (MySQL)  ← ex expo-trading-server-main
├── earning-ways-user/            # Member app: React + Vite              ← ex expo-trading-user-main
└── earning-ways-admin/           # Admin app:  React + Vite              ← ex expo-trading-admin-main
```

Cloned from `expotrading/` excluding `node_modules`, `dist`, `generated/`, `public/` (compiled JS) and
`.test-build/`. The source project is **not modified at all**.

Dev ports follow the existing CORS allow-list: **API 4000 · user app 8080 · admin app 8081**
(both vite configs were 8080 in the source snapshot — the admin one is corrected to 8081).

---

## 4. Data model (Prisma / MySQL)

Same models and relations as the source, with the crypto columns replaced:

```prisma
model User {
  id           String   @id @default(uuid())
  name         String?
  email        String   @unique
  passwordHash String
  upiId        String?                    // payout identity (was walletAddress)
  inrBalance   Decimal  @default("0.00") @db.Decimal(14, 2)   // was usdtBalance
  referralCode String   @unique
  referredById String?                    // optional referral (see §8)
  ...                                     // totals, level, tokenVersion — unchanged
}

model Wallet {
  userId    String   @id
  upiId     String?                       // was walletAddress
  qrCodeUrl String?                       // member payout QR
  currency  String   @default("INR")
  balance   Decimal  @default("0.00") @db.Decimal(14, 2)
}

model Payment {                           // Stars intent (was COINBASE | TELEGRAM_STARS)
  id               String  @id @default(uuid())
  userId           String
  amount           Decimal @db.Decimal(14, 2)   // principal, INR
  currency         String  @default("INR")
  provider         String  @default("TELEGRAM_STARS")
  status           String  @default("PENDING")  // PENDING | CONFIRMED | REFUNDED | EXPIRED
  planId           String?
  starsAmount      Int?                          // XTR actually charged
  telegramChargeId String? @unique
  telegramUserId   String?
  invoiceUrl       String? @db.Text
  confirmedAt      DateTime?
  investmentId     String?
}

model Withdrawal {
  id        String   @id @default(uuid())
  userId    String
  amount    Decimal  @db.Decimal(14, 2)
  upiId     String                       // was destinationAddress
  qrCodeUrl String?                      // member-uploaded payout QR snapshot
  status    WithdrawalStatus @default(PENDING)
  ...
}

model TelegramStarsSetting {              // admin-managed, never in the public settings response
  botToken / botUsername / webhookSecret / webhookUrl
  starsPerInr        Decimal?  @db.Decimal(18, 6)   // Stars charged per ₹1 (was starsPerUsdt)
  maxStarsPerInvoice Int       @default(10000)
  isEnabled          Boolean   @default(false)
}

model QrCode {                            // UNUSED: the platform-deposit feature was removed (see §13.7)
  qrCodeUrl Json?
  upiId     String?                       // was wallentaddress (typo fixed)
}
```

Money is stored as `Decimal(14, 2)` — paise-precise INR, no floating point at the boundary.

**Migrations:** the 30 inherited migration folders are replaced by **one clean `init` migration** (this is a new
project, not a continuation of the old database).

---

## 5. Payment flow — Telegram Stars only (INR-native)

```text
Invest Now
  └─ Step 1: pick plan                     (a plan has ONE fixed price in ₹, enforced server-side)
  └─ Step 2: confirm → POST /api/payment/telegram/invoice { planId, amount }
        ├─ plan rules re-checked server-side (planInvestmentTerms)
        ├─ stars = ceil(amount × starsPerInr)   ← admin-configured, capped per invoice
        ├─ Payment row persisted as PENDING first (an early webhook can still resolve it)
        └─ Telegram createInvoiceLink (currency XTR) → invoiceUrl returned to the modal
  └─ Member pays inside Telegram
        └─ POST /api/payment/telegram/webhook  (public, authenticated by X-Telegram-Bot-Api-Secret-Token)
              ├─ pre_checkout_query → answered only when the intent is PENDING and the Stars match
              └─ successful_payment → settleStarsPayment()
                    · claims status PENDING → CONFIRMED (idempotent: a replay creates nothing)
                    · creates the Investment with status **ACTIVE**            ← requirement #4
                    · applies the referral bonus in the same transaction
                    · links Payment.investmentId
  └─ Modal polls /api/payment/telegram/status/:paymentId → shows "Plan active"
```

Pricing model (INR-native, no conversion chain):

```text
investment amount  = ₹X                        (what the member typed; what the plan is worth)
INR charged        = ₹X                        (no rate conversion at all)
Stars charged      = ceil(X × starsPerInr)     (admin sets how many Stars equal ₹1)
```

Example at `starsPerInr = 0.55`: a **₹5,000** investment shows **₹5,000** and charges **2,750 Stars**.
If the rail is not configured the endpoint answers `503` and the UI hides the Telegram checkout.

The wallet is **not** credited by a Stars payment — the money is invested, exactly like the source project.
Over-cap invoices are refused with a clear message telling the member to contact support (there is no USDT
fallback any more).

### Can one plan be bought more than once? Yes — a repeat purchase is a re-invest

There is deliberately **no per-plan duplicate guard**: buying a plan the member already owns creates a
**second ACTIVE investment** next to the first, each with its own amount, ROI terms and Telegram charge id,
and the earlier investment is left untouched. Idempotency is enforced per *payment* (a replayed webhook can
never double-credit), not per *plan*, so a genuine second purchase is honoured. The member app matches that:
an owned plan shows its "Subscribed" badge plus a live **Invest Again** button (the dialog then reads
"Invest again in <plan>") instead of a dead button. Locked by the suite
(`telegram-stars.test.mjs` → "the same plan can be invested in again") and checked in the browser run.

---

## 6. Withdrawal flow — UPI ID + QR code

```text
Member: Withdraw page
  ├─ amount (₹, min from settings, 10% deduction preview, balance + guard checked server-side)
  ├─ UPI ID  (required, validated as a UPI VPA)
  └─ QR image (REQUIRED upload)  → POST /api/withdraw/qr → { url }
        └─ Cloudinary when the credentials are real, otherwise stored on the API's local
           /uploads volume so the flow works in local development too
  └— POST /api/withdraw/create { userId, amount, upiId, qrCodeUrl }
        ├─ atomic debit: wallet + user balance guarded by `>= amount`
        ├─ Withdrawal row snapshots upiId + qrCodeUrl (the admin pays what was requested)
        └─ ledger transaction WITHDRAW / PENDING

Admin: Withdrawals page
  ├─ list with member name/email, ₹ amount, UPI ID and the QR thumbnail
  └─ Approve (ledger SUCCESS) / Reject (ledger FAILED + atomic refund) — same flow as the source
```

The `Wallet` page keeps its balance + ledger role and shows the member's saved payout details
(UPI ID + QR) so the withdraw form can prefill them.

---

## 7. Admin panel — same flow, INR

| Page | Change |
|---|---|
| Dashboard | ₹ KPI labels, no crypto cards |
| Users | `Balance (₹)`, UPI ID column, edit form in ₹ |
| Plans | one **Investment Amount (₹)** per plan instead of a min/max range (the create/edit dialog sends `investmentAmount`; the API stores both columns equal to it), ROI copy in ₹ |
| Investments / user investments | ₹ amounts, "auto-activated by Telegram" note |
| Payments (Stars) | `Stars per ₹1` field, ₹ totals, "Invested (₹)" card; bot token / webhook / setup actions unchanged |
| Withdrawals | UPI ID + QR preview, Approve / Reject |
| Payout UPI & QR | **Removed.** It stored the platform's own deposit UPI id + QR image, and after the Redeem page went away no screen read it. The admin page, the member `useQrCode()` hook, `/api/qr-code/add|get`, the route mount and the sidebar entry are all deleted (verified `404` as an authenticated admin) |
| Settings | Minimum withdrawal (₹) |
| ROI / Transactions / Transfers / Referrals / Support / Enquiries / Notifications / About | ₹ labels, no crypto copy |

---

## 8. Registration — referral optional

```text
POST /api/user/create { name, email, password, upiId?, referredByCode? }
  ├─ referredByCode absent or blank  → normal signup, no referrer  (requirement #10)
  ├─ referredByCode present but wrong → 400 "Invalid referral code"
  └─ referredByCode present and valid → referredById set, referrer totalReferrals +1,
                                        Referral row created (level 1, 5%, ACTIVE)
```

The wallet address field is gone from the signup form — a payout UPI ID is collected where it matters
(withdrawal / payout details) instead of at account creation.

---

## 9. Local setup & run

```bash
# 1) database (MySQL 8 must be running)
mysql -uroot -plocaldev123 -e "CREATE DATABASE IF NOT EXISTS earning_ways \
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 2) each app
cd earning-ways-server && npm install && npx prisma migrate deploy && npm run dev   # :4000
cd earning-ways-user   && npm install && npm run dev                                # :8080
cd earning-ways-admin  && npm install && npm run dev                                # :8081
```

`earning-ways-server/.env` (new values):

```env
PORT=4000
NODE_ENV=development
JWT_SECRET=<existing 32-byte hex>
DATABASE_URL="mysql://root:localdev123@127.0.0.1:3306/earning_ways"
FRONTEND_URL=http://localhost:8080
FRONTEND_URL1=http://localhost:8081
CLOUD_NAME= / CLOUD_API_KEY= / CLOUD_API_SECRET= / CLOUD_FOLDER=earning-ways
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_WEBHOOK_SECRET=
STARS_PER_INR=
TELEGRAM_STARS_MAX_PER_INVOICE=10000
TELEGRAM_STARS_ENABLED=false
```

First admin: `POST /api/admin/register` is super-admin-only, so the first super admin is seeded directly in the
database (documented in the implementation notes) — the same bootstrap the source project needs.

---

## 10. Verification plan (what "done" means)

| Check | Command | Expected |
|---|---|---|
| Server types | `cd earning-ways-server && npx tsc --noEmit` | exit 0 |
| Server suite | `npm test` | all tests pass (auth / money / investment / security / telegram-stars) |
| Server build | `npm run build` | exit 0 |
| Schema | `npx prisma migrate diff --from-migrations …` | "This is an empty migration." — on a `lower_case_table_names=1` server use the live-DB comparison in §12 instead |
| User app | `npx tsc --noEmit && npx vite build` | exit 0 |
| Admin app | `npx tsc --noEmit && npx vite build` | exit 0 |
| No USDT left | `grep -ri "usdt\|bep-20\|coinbase\|erc20\|trc20"` over the three source trees | only this plan file may match |
| Live flow | browser E2E over CDP (dev servers + MySQL + real Chrome) | member signup → invest in ₹ → Stars invoice started → admin login → payments/withdrawal pages render, plan auto-activates on a simulated settlement |

Every check is run as a plain command and its exit status is read; failures are fixed, never skipped.

---

## 11. Build record — what is implemented

Everything below is written in this repository (source only; the inherited
`expotrading/` project was not modified):

| Area | State |
|---|---|
| `earning-ways-server` schema | INR money (`Decimal(14,2)`), `upiId` everywhere an address used to be, Telegram-only `Payment`, `Withdrawal.upiId + qrCodeUrl`, `TelegramStarsSetting.starsPerInr`, single clean `init` migration (old history deleted) |
| Coinbase rail | Deleted: `service/payment.ts`, `controller/payment.ts`, `routes/payment.routes.ts`, the dependency, both env keys, both access rules, the raw-body middleware and the route mount |
| Services | `amount.ts` (INR primitives), `investmentTerms.ts`, `referralBonus.ts` (shared by both activation paths), `storage.ts` (Cloudinary → local `uploads/` fallback), `money.ts` (INR + UPI), `telegramStars.ts` (INR-native + auto-activation) |
| Auto-activation | `settleStarsPayment()` creates the investment `ACTIVE` and credits the referral bonus in the same transaction; the admin-assisted `/api/investment/create` applies the same rule and is now admin-only |
| Withdrawal UPI + QR | `POST /api/withdraw/qr` uploads/stores the image, `POST /api/withdraw/create` snapshots `upiId` + `qrCodeUrl`, member app collects both, admin list and detail view show both |
| Access policy | Coinbase rules removed, `/withdraw/qr` added for the authenticated member, `/investment/create` falls through to admin-only. The `/qr-code/*` rules went with the removed platform-deposit feature; unknown paths still default to role enforcement |
| JWT | Issuer/audience renamed to `earning-ways-api` / `earning-ways-app` |
| Tests | `auth`, `money`, `investment`, `security`, `telegram-stars` rewritten for INR/UPI/Stars-only, plus new coverage: optional referral signup, investment auto-activation + referral bonus, UPI/QR snapshot, `confirmedInr` totals, admin-only payout details |
| User app | Stars-only checkout in ₹ (USDT branch and transaction-hash step deleted), Wallet = balance + payout UPI, Withdraw = UPI + QR upload, Settings = payout UPI, sign-up referral optional and no wallet address field, crypto marquee replaced by `RatesMarquee`, ₹ formatting and copy in Dashboard/Redeem/Referrals/Transactions/Transfer/Plans/Footer/Index |
| Admin app | Payments = Stars per ₹1 + ₹ totals/columns, Withdrawals = UPI + QR preview, Users = ₹ balance + UPI, payout UPI & QR page, Settings/minimum withdrawal in ₹, sidebar and page titles rebranded |
| Redeem feature | **Removed** from the member app: `pages/app/Redeem.tsx` deleted, its route, sidebar entry and the Wallet shortcut are gone (no redeem endpoint ever existed on the server) |
| Referrals | **Count + earning only**: the "Level 1 Referrals" card, the per-row level/bonus copy, the admin "Referrals Per Level" chart and the "Current Level" column are gone, and the landing page no longer advertises multi-level income (the platform pays one flat referral bonus) |
| Member notifications | New `service/notify.ts` writes a `Notification` row plus the member's `UserNotification` link **inside the caller's transaction**: investing (both the Stars settlement and the admin-assisted activation) and a processed withdrawal (paid, or rejected with the refund already applied) |
| Withdrawal QR mandatory | End to end: `POST /api/withdraw/create` answers `400 Payout QR code is required`, `createWithdrawal()` refuses to run without one, and the withdraw form blocks submit with a clear reason |
| Plan pricing | **One fixed amount per plan.** The admin dialog asks for a single `Investment Amount (₹)`; `POST/PUT /api/subscription/*` store it in both `minimumInvestment` and `maximumInvestment`, so the member pays exactly that price. `planInvestmentTerms()` refuses any other amount with `This plan invests a fixed amount of X`, and the member's checkout shows a read-only amount |

## 12. Verification record — these checks were run, these are the real results

Run on this Windows machine against the local MariaDB 11.4.4 on `127.0.0.1:3306`, with the
three services live and real Chrome driven over the DevTools Protocol. Every row is a plain
command whose exit status was read.

| Check | Command | Result |
|---|---|---|
| API dependencies | `cd earning-ways-server && npm install` | exit 0, Prisma client generated |
| API types | `npx tsc --noEmit` | exit 0 |
| API suite | `npm test` | **50/50 pass** |
| API build | `npm run build` | exit 0 |
| Database | `npx prisma migrate dev --name init` | applied; `npx prisma migrate status` → *Database schema is up to date!* |
| Schema ↔ live DB | `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code` | *No difference detected.* (exit 0) |
| Member app | `npx tsc --noEmit && npx vite build` | exit 0 |
| Admin app | `npx tsc --noEmit && npx vite build` | exit 0 |
| No USDT left | `grep -rniE "usdt\|bep-?20\|erc-?20\|trc-?20\|coinbase\|bnb\|binance"` over `*/src`, `*/tests`, `prisma`, `.env.example` | 2 hits, both non-code: the E2E's own *negative* assertion, and the inherited binary whitepaper (§13.6) |
| Live flow | `node tests/browser-e2e.local.mjs` | **37/37 pass**, exit 0 |

Local dev data comes from `node prisma/seed.mjs`: the member, the super admin
(`admin@local.test`), an active plan, the Stars settings and one CONFIRMED Stars payment, so
the browser run has a deterministic stack to drive.

What the browser run actually exercised: member login → the member navigation has no *Redeem* entry
any more → the referrals page shows only the referral count and the earning, with no level income →
Subscriptions lists plans → the plan the member
already owns offers an enabled *Invest Again* button that opens its amount step → *Invest Now*
opens the amount step **in rupees** → no cryptocurrency wording is offered → checkout goes straight
to the Telegram Stars step → it shows **₹500.00** and the admin-configured **275 Stars** → exactly
one payment method is offered → the invoice call reaches the API and surfaces the provider's
`Unauthorized` (no live bot token, as expected) → admin login → Payments settings render the saved
`0.55` Stars/₹ and `10000` cap, the masked token/secret hints and INR enabled → the payments table
lists the CONFIRMED ₹ payment → the ₹ totals card → the admin sidebar no longer offers *Payout UPI & QR* → the
plan page shows one fixed amount with no investment range → the create-plan dialog opens with a single
*Investment Amount (₹)* field and no min/max fields → the user-investment page renders ₹ and no `$` →
the member's notification feed shows an admin-sent notification → no uncaught
exceptions and no unexpected console errors in either app.

It also pins the new withdrawal rule: the form labels the payout QR *required*, and a submit with no QR
attached is refused with a clear reason before any API call is made — while the API itself answers
`400 Payout QR code is required` to the same request made directly.

### Requirement checks run against the live stack (real API, real MariaDB)

A one-off probe (deleted after the run) drove the running server with no stubs: a withdrawal created with
a QR and approved by an admin, then a paid Stars invoice settled through the real webhook, and finally the
member's own `GET /api/notifications/<id>` feed. The feed returned exactly the two expected rows:

```
SUCCESS: Investment activated — ₹100.00 invested in Starter Plan is active now. 5000 Telegram Stars were received.
SUCCESS: Withdrawal paid — Your withdrawal of ₹50.00 was approved and sent to UPI localmember@bank.
```

The probe then restored the seed state: 1 investment, 1 CONFIRMED payment, 0 notifications, ₹500 balance.
The browser run covers the member-facing half of the same requirement: it seeds a notification through
the admin endpoint and then proves the member's own `/app/notifications` feed renders it, cleaning up
after itself.

A second probe covered the fixed-plan pricing through the live API: `POST /api/subscription/create` with
`investmentAmount: 1500` answered `201` and stored `min=1500 max=1500`, `PUT` moved it to `2000`, a `0`
price was refused with `investmentAmount must be greater than 0`, investing `1500` or `2500` in the `2000`
plan was refused with `This plan invests a fixed amount of 2000`, and exactly `2000` was accepted. The probe
then deleted its plan, investment and notification.
The running API was rebuilt (`npm run build` → `node public/index.js`) before this run, because the
previously running process was still serving the older build.

### Two real bugs the verification caught (both fixed)

1. `POST /api/withdraw/qr` sat in the **public** block of the access policy, so anyone could upload
   an image without a session. Moved behind member auth.
2. `tests/browser-e2e.local.mjs` held an unbalanced assertion — `waitFor(\`Boolean(…includes('Payout
   UPI'))\`)` was missing its closing paren, so every attempt threw a `SyntaxError` that `waitFor`
   swallowed, and the check reported a *missing feature* after a blind 15s wait. Fixed, and `waitFor`
   now re-throws when the expression **never once** returned a value, so a broken assertion can no
   longer masquerade as a failing feature.

### One tooling caveat (not a defect)

`prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel …` reports the whole
schema as both added and removed on this box. That is case folding, not drift: the local server runs
MariaDB with `lower_case_table_names=1`, so the shadow rebuild lowercases the tables (most models
carry no `@@map`) and Prisma's diff engine then matches neither the tables nor their 17 foreign keys.
Evidence that it is the tool and not the schema: the same command with **identical input on both
sides** (`--from-migrations … --to-migrations …`) does report *No difference detected*, and the
authoritative live comparison in the table above is empty too. On MySQL/MariaDB with
`lower_case_table_names=0` (the normal Linux server) the §10 check returns *This is an empty migration.*

### What is genuinely still required

1. **A live Telegram bot token and a public https webhook.** The rail is fully implemented and the
   browser run proves the checkout reaches the API, but Telegram cannot call `http://localhost` and no
   real Stars can be spent from here — so "member pays → investment auto-activates" is proven by the
   automated suite with a stubbed Bot API, not with real money.
2. **Real Cloudinary credentials.** `CLOUD_NAME=local-placeholder` at the moment, so a payout QR is
   stored on the API's local `uploads/` volume instead (works, but it is local disk).
3. **Brand assets.** `earning-ways-user/src/assets/logo/Expotradex-dark.png` and
   `assets/pdf/Expotradex (1).pdf` are the inherited files, and `Index.tsx` still offers that
   whitepaper as a download — it is the old project's document. The surrounding copy still says
   "Expotradex" in `pages/About.tsx`, `pages/app/About.tsx`, `pages/Contact.tsx` and the `logo.svg`
   comment. Every *functional* surface (nav, footer, auth, dashboard, plans, checkout, wallet,
   withdraw, settings, admin) is already rebranded and in rupees.

The `.env`, database and first-admin steps that used to be listed here are **done**: `.env`
(`DATABASE_URL` → `earning_ways`, `CLOUD_FOLDER`, `STARS_PER_INR`, no crypto keys) and
`prisma/seed.mjs` supply the local stack, and the `CryptoMarquee` re-export was deleted once nothing
imported it.

## 13. Open items / limitations (honest list)

1. **Real Stars payments** need a live bot token + Stars balance; the automated suite stubs the Bot API.
2. **Webhook registration** needs a public https URL — Telegram cannot call `http://localhost` (clear `400`).
3. **Cloudinary** credentials in the inherited `.env` are placeholders, so image upload uses the local-disk
   fallback in development; set real credentials to store payout QRs in Cloudinary.
4. **Refunds** (`refundStarPayment`) stay implemented-but-not-exposed, exactly as in the source project, until a
   policy for what happens to an investment when Stars are refunded is decided.
5. Compliance note carried over: Telegram requires Stars for digital goods sold inside Telegram apps; selling an
   investment product on a website is a grey area of that policy and the bot owner carries dispute responsibility.
6. **Inherited brand assets are still in the member app**: the logo PNG and the whitepaper PDF named in
   §12 are the source project's files and the whitepaper is linked from the landing page. Replace them (or drop the
   link) before showing this to members.
7. **The platform-deposit feature was deleted** (decision taken after the Redeem page went away): admin page,
   `useQrCode()`, `/api/qr-code/add|get`, the route mount and the sidebar entry. What survives is the `QrCode`
   model/table in `schema.prisma` — no code reads it, and dropping it needs its own migration, so it was left in
   place deliberately. Note this is **not** the member's own payout QR from §6, which stays mandatory per withdrawal.
7. **Dead inherited OTP helpers**: `src/utils/otp.utils.ts` and `src/utils/otp/` are unused (nothing imports them)
   and they read `process.env.EMAIL_USER`, while `.env.example` documents `USER_EMAIL`. Harmless today because
   sign-up needs no email verification, but they are the reason the two names disagree — align or delete them when
   e-mail verification is added.
