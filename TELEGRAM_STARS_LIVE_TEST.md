# Real Telegram Stars payment — live test runbook

`earning-ways-server/tests/telegram-stars-live.mjs` drives the **real** rail: a real bot
token on `api.telegram.org`, a real invoice link, a real `successful_payment` webhook from
Telegram, and the plan activation that follows. Nothing is mocked.

The local placeholder token (`1234…3456`, bot `earningways_local_bot`, webhook
`api.example.com`) is *not* a bot, so right now `check` fails on purpose:

```
4/6 live checks passed
failed: the stored bot token is accepted by Telegram, a public https webhook is registered
```

## What you need before it can pass

| Need | Why | How |
| --- | --- | --- |
| A real bot | `createInvoiceLink` is called with the bot token | `@BotFather` → `/newbot` → copy `123456:ABC…` (in the test environment the token must be a test-environment bot token) |
| A public **https** URL | Telegram must be able to POST the webhook; it cannot call `http://localhost:4000` | a tunnel (`cloudflared tunnel --url http://localhost:4000`) or a deployed API |
| A webhook secret | Telegram echoes it back in `X-Telegram-Bot-Api-Secret-Token` | the admin page already holds one; any 8–64 char `A-Za-z0-9_-` |
| A cheap plan | a plan has ONE fixed amount, so the invoice is that amount | create e.g. a ₹10 plan for the test, or use Starter ₹100 |
| Telegram Stars | the payer buys them in-app (price depends on country/VAT) | see the Star Pricing table on `core.telegram.org/bots/payments-stars` |
| A member account | the invoice is created for a signed-in member | `user@local.test` / `User@12345` on the local database |

> The **stored admin row wins over `.env`**, so save the real token where the UI saves it.
> Keep the Stars rate honest: `starsPerInr = 0.55` means 1 Star ≈ ₹1.82, so make sure that
> is not below what a Star actually costs you.

## Steps

```bash
cd earning-ways-server
npm run build                       # the harness imports the service from public/

# 1. save the real bot (skip if you already saved it on the Stars Payments page)
node tests/telegram-stars-live.mjs token --bot-token 123456:ABC… --bot-username my_bot

# 2. expose the API and register the webhook
cloudflared tunnel --url http://localhost:4000        # prints https://xxxx.trycloudflare.com
node tests/telegram-stars-live.mjs webhook \
  --url https://xxxx.trycloudflare.com/api/payment/telegram/webhook

# 3. prove the wiring before spending anything
node tests/telegram-stars-live.mjs check
# → 6/6, including "getMe → @my_bot"

# 4. the real payment: open the printed link in Telegram and pay the Stars
node tests/telegram-stars-live.mjs pay --plan "Starter Plan" --timeout 900
```

`pay` prints the invoice, then waits for Telegram's own webhook and checks:

- Telegram confirmed the payment (a genuine `successful_payment`)
- a real `telegram_payment_charge_id` and the payer's Telegram id were stored
- the charged Stars equal the invoice
- **exactly one** investment exists for that charge, it is `ACTIVE`, and its amount matches
- the member got the "Investment activated" notification
- a live totals line (confirmed payments, ₹, Stars)

Refund if you do not want to keep the test purchase:

```bash
# charge id lives on Payment.telegramChargeId / Investment.transactionId
# POST https://api.telegram.org/bot<token>/refundStarPayment  { user_id, telegram_payment_charge_id }
```

The admin panel's **Stars Payments** page then shows the payment as `CONFIRMED`; the investment
appears as an active plan for the member, and the referrer's bonus is credited in the same
transaction when the member was referred.

## Testing in Telegram's own test environment (no real Stars)

This repo is wired for it: `TELEGRAM_TEST_ENV=true` in `.env` makes every Bot API call use
Telegram's dedicated test environment, which is the same API with `/test/` before the method
name (`core.telegram.org/bots/payments-stars` → *Testing Payments* → Bot API docs). The
service builds the URL in `methodUrl()` (`src/service/telegramStars.ts`), and the admin
settings response reports which environment is live:

```bash
node tests/telegram-stars-live.mjs check
#  stored settings → environment  Telegram TEST environment (every method gets /test/)
#  production getMe → Unauthorized
#  test-env getMe   → id …, @…            ← which environment your token belongs to
```

`check` probes **both** environments, so it tells you exactly which one accepts the token you saved.

### Getting a test-environment bot (one-time)

The test environment has **separate users and separate bots**, so a normal production bot token
will be refused there (and vice-versa — `check` shows which side accepts yours). To get a test bot:

1. Connect a Telegram account to the test servers. Telegram documents this on
   `core.telegram.org/bots/features` → *Testing Your Bot*: on mobile **tap the Settings icon 10 times**,
   on **Telegram Desktop open ☰ Settings → Shift + Alt + Right-click “Add Account” → *Test Server***.
   Sign in on that account (it is a separate account with its own chats).
2. Message **@BotFather** from that test account, `/newbot`, and copy the token.
3. Save that token on the admin **Stars Payments** page (the stored row wins over `.env`), keep
   `TELEGRAM_TEST_ENV=true`, then `node tests/telegram-stars-live.mjs check` → the *test-env getMe*
   line should show your bot and the production line should stay `Unauthorized`.

What the test environment is good for: the whole wiring — `createInvoiceLink`, the webhook,
`pre_checkout_query` → `answerPreCheckoutQuery`, `successful_payment` settlement, activation,
notifications, refund calls. What it cannot prove: that a real customer's Stars actually arrive,
because the test environment has its own users/chats and **buying test Stars is not reliably
possible** in the official clients (users report the same on Telegram's issue tracker). If
`pay` prints a link that cannot be paid on your account, the honest options are:

1. keep the test environment for plumbing (everything above), and
2. do **one** acceptance payment in production with the smallest plan you are willing to buy
   (`TELEGRAM_TEST_ENV=false`, then the ₹10 plan from this runbook), refundable afterwards with
   `refundStarPayment`.

Switching back to production is a one-line change: `TELEGRAM_TEST_ENV=false` (or delete the
line) and `npm run build`, then re-register the webhook — the webhook URL is stored per
environment, so register it once in each.

## Before you go live (Telegram's own checklist)

- The bot must answer **`/paysupport`** and offer **`/terms`**, and the user must accept the
  terms before paying. This bot only handles `pre_checkout_query` and
  `message.successful_payment` (see `src/controller/telegramStars.ts`), so command handling
  is still missing.
- Turn on 2-step verification for the Telegram account that owns the bot.
- Keep `telegramChargeId` — it is the only handle for a refund.
- Prices/disputes: you are responsible for refunds; `refundStarPayment` is already wrapped in
  `src/service/telegramStars.ts`.
