/**
 * DEV-ONLY PREVIEW FIXTURES — used only when `VITE_DEV_PREVIEW=true`.
 *
 * Why: this machine has no MySQL (`DATABASE_URL` = 127.0.0.1:3306), and login/live data is
 * impossible without `earning-ways-server`. Every endpoint therefore has a realistic payload
 * here; the shapes mirror the server controllers (`src/controller/*.ts`, `prisma/schema.prisma`),
 * so the hooks cannot tell the difference.
 *
 * Production build: when the flag is not set, `resolveFixture()` returns nothing and
 * `apiClient` uses the real network — this file has no effect.
 *
 * The numbers are mock data, sized for one realistic member account.
 */

export interface FixtureResponse {
  status: number;
  body: unknown;
}

/** The member who is signed in during preview. */
export const PREVIEW_USER = {
  id: "preview-user-0001",
  name: "Rohit W.",
  email: "rohit@example.com",
  upiId: "rohit@bank",
  referralCode: "RW24X",
  inrBalance: "12480.00",
  totalReferrals: 12,
  totalEarnings: "420.00",
  currentLevel: 1,
} as const;

/** Second member — used in the transfer and referral lists. */
const PEER = {
  id: "preview-user-0002",
  name: "Anita K.",
  email: "anita@example.com",
  referralCode: "AK77P",
} as const;

const THIRD = {
  id: "preview-user-0003",
  name: "Vikas M.",
  email: "vikas@example.com",
  referralCode: "VM31Q",
} as const;

const NOW = new Date();
/** ISO timestamp for n days ago, so history dates look realistic. */
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();
const daysAhead = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000).toISOString();

/* ------------------------------------------------------------------ user */

const userRecord = () => ({
  ...PREVIEW_USER,
  // Same shape after a PUT to user/:id.
  createdAt: daysAgo(120),
  updatedAt: daysAgo(1),
  wallet: {
    userId: PREVIEW_USER.id,
    upiId: PREVIEW_USER.upiId,
    qrCodeUrl: null,
    currency: "INR",
    balance: PREVIEW_USER.inrBalance,
    createdAt: daysAgo(120),
    updatedAt: daysAgo(1),
  },
  referredBy: null,
});

const loginBody = () => ({
  message: "User logged in successfully",
  data: userRecord(),
  token: "dev-preview-token",
});

const signupBody = () => ({
  message: "User created successfully",
  data: userRecord(),
  token: "dev-preview-token",
});

const referralsByUserBody = () => ({
  totalReferrals: 12,
  referrals: [
    { id: "ref-u1", name: "Anita K.", email: "anita@example.com", referralCode: "AK77P", createdAt: daysAgo(14), updatedAt: daysAgo(14) },
    { id: "ref-u2", name: "Vikas M.", email: "vikas@example.com", referralCode: "VM31Q", createdAt: daysAgo(9), updatedAt: daysAgo(9) },
    { id: "ref-u3", name: "Sneha P.", email: "sneha@example.com", referralCode: "SP12L", createdAt: daysAgo(4), updatedAt: daysAgo(4) },
  ],
});

/* ------------------------------------------------------------------ dashboard */

const CHART_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"];
/** Month-wise ROI credits plus referral bonuses, through October, as in the design mockup. */
const MONTHLY_ROI = [0, 0, 0, 200, 220, 240, 260, 280, 300, 340];
const MONTHLY_REFERRAL = [0, 0, 0, 40, 40, 60, 60, 70, 80, 70];

const dashboardBody = () => {
  let cumulative = 0;
  const balanceData = CHART_MONTHS.map((month, index) => {
    cumulative += MONTHLY_ROI[index] + MONTHLY_REFERRAL[index];
    return { month, balance: Number(cumulative.toFixed(4)) };
  });
  const referralData = CHART_MONTHS.map((month, index) => ({
    month,
    earnings: Number(MONTHLY_REFERRAL[index].toFixed(4)),
  }));

  return {
    success: true,
    data: {
      userName: PREVIEW_USER.name,
      referralLink: `http://localhost:8080/auth/signup?referralId=${PREVIEW_USER.referralCode}`,
      kpis: {
        totalInvested: 10000,
        currentBalance: 12480,
        monthlyROI: 160,
        dailyROI: 160,
        referralEarnings: 420,
        maximumEarning: 25000,
      },
      charts: { balanceData, referralData },
      summary: {
        totalInvested: 10000,
        profitEarned: 2060,
        roiPercentage: "+20.60%",
      },
      activeSubscriptions: {
        count: 2,
        plans: [
          {
            planName: "Growth",
            duration: "6 Months",
            amountInvested: "10000",
            roiRate: "10% Monthly",
            roiType: "Monthly",
            remaining: "4 months remaining",
            status: "ACTIVE",
          },
          {
            planName: "Starter",
            duration: "3 Months",
            amountInvested: "5000",
            roiRate: "8% Monthly",
            roiType: "Monthly",
            remaining: "1 month remaining",
            status: "ACTIVE",
          },
        ],
      },
    },
  };
};

/* ------------------------------------------------------------------ wallet */

const walletBody = () => ({
  data: {
    userId: PREVIEW_USER.id,
    upiId: PREVIEW_USER.upiId,
    qrCodeUrl: null,
    currency: "INR",
    balance: PREVIEW_USER.inrBalance,
    createdAt: daysAgo(120),
    updatedAt: daysAgo(1),
    user: { id: PREVIEW_USER.id, name: PREVIEW_USER.name, email: PREVIEW_USER.email },
  },
});

/* ------------------------------------------------------------------ transactions */

const transaction = (
  index: number,
  type: string,
  amount: string,
  status: string,
  days: number,
  description: string,
) => ({
  id: `tx-${index}`,
  userId: PREVIEW_USER.id,
  type,
  amount,
  currency: "INR",
  status,
  description,
  meta: null,
  investmentId: type === "INVESTMENT" ? "inv-1" : null,
  createdAt: daysAgo(days),
  user: { id: PREVIEW_USER.id, name: PREVIEW_USER.name, email: PREVIEW_USER.email },
  investment:
    type === "INVESTMENT"
      ? { id: "inv-1", amountInvested: "10000", status: "ACTIVE" }
      : null,
});

const transactionsBody = () => ({
  data: [
    transaction(9912, "ROI", "160.00", "SUCCESS", 1, "ROI credit · Growth plan"),
    transaction(9881, "REFERRAL_BONUS", "50.00", "SUCCESS", 2, "Referral bonus · level 1"),
    transaction(9860, "WITHDRAW", "500.00", "PENDING", 4, "Withdrawal request · rohit@bank"),
    transaction(9802, "TRANSFER", "250.00", "SUCCESS", 6, "Transfer to Anita K."),
    transaction(9755, "ROI", "120.00", "SUCCESS", 8, "ROI credit · Starter plan"),
    transaction(9710, "INVESTMENT", "10000.00", "SUCCESS", 21, "Growth plan · 6 months"),
  ],
});

/* ------------------------------------------------------------------ withdrawals */

const withdrawalsBody = () => ({
  data: [
    {
      id: "wd-4821",
      userId: PREVIEW_USER.id,
      amount: 1000,
      upiId: PREVIEW_USER.upiId,
      qrCodeUrl: null,
      status: "APPROVED",
      processedAt: daysAgo(1),
      createdAt: daysAgo(2),
      updatedAt: daysAgo(1),
      user: { id: PREVIEW_USER.id, name: PREVIEW_USER.name, email: PREVIEW_USER.email },
    },
    {
      id: "wd-4790",
      userId: PREVIEW_USER.id,
      amount: 500,
      upiId: PREVIEW_USER.upiId,
      qrCodeUrl: null,
      status: "PENDING",
      processedAt: null,
      createdAt: daysAgo(4),
      updatedAt: daysAgo(4),
      user: { id: PREVIEW_USER.id, name: PREVIEW_USER.name, email: PREVIEW_USER.email },
    },
    {
      id: "wd-4712",
      userId: PREVIEW_USER.id,
      amount: 2000,
      upiId: PREVIEW_USER.upiId,
      qrCodeUrl: null,
      status: "REJECTED",
      processedAt: daysAgo(7),
      createdAt: daysAgo(8),
      updatedAt: daysAgo(7),
      user: { id: PREVIEW_USER.id, name: PREVIEW_USER.name, email: PREVIEW_USER.email },
    },
  ],
});

const createdWithdrawalBody = () => ({
  message: "Withdrawal request created successfully",
  data: {
    id: "wd-new",
    userId: PREVIEW_USER.id,
    amount: 1000,
    upiId: PREVIEW_USER.upiId,
    qrCodeUrl: "https://example.com/preview/payout-qr.png",
    status: "PENDING",
    processedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    user: { id: PREVIEW_USER.id, name: PREVIEW_USER.name, email: PREVIEW_USER.email },
  },
});

/* ------------------------------------------------------------------ transfers */

const transfersSentBody = () => ({
  data: [
    {
      id: "tr-2201",
      senderId: PREVIEW_USER.id,
      receiverId: PEER.id,
      amount: 250,
      status: "SUCCESS",
      note: "Split for the plan",
      createdAt: daysAgo(6),
      updatedAt: daysAgo(6),
      sender: { id: PREVIEW_USER.id, name: PREVIEW_USER.name, email: PREVIEW_USER.email },
      receiver: { id: PEER.id, name: PEER.name, email: PEER.email },
    },
    {
      id: "tr-2188",
      senderId: PREVIEW_USER.id,
      receiverId: THIRD.id,
      amount: 500,
      status: "PENDING",
      note: null,
      createdAt: daysAgo(9),
      updatedAt: daysAgo(9),
      sender: { id: PREVIEW_USER.id, name: PREVIEW_USER.name, email: PREVIEW_USER.email },
      receiver: { id: THIRD.id, name: THIRD.name, email: THIRD.email },
    },
  ],
});

const transfersReceivedBody = () => ({
  data: [
    {
      id: "tr-2199",
      senderId: THIRD.id,
      receiverId: PREVIEW_USER.id,
      amount: 300,
      status: "SUCCESS",
      note: "Thanks!",
      createdAt: daysAgo(7),
      updatedAt: daysAgo(7),
      sender: { id: THIRD.id, name: THIRD.name, email: THIRD.email },
      receiver: { id: PREVIEW_USER.id, name: PREVIEW_USER.name, email: PREVIEW_USER.email },
    },
  ],
});

/* ------------------------------------------------------------------ referrals */

const referralRelation = (id: string, index: number, peer: { id: string; name: string; email: string }, level: number, days: number) => ({
  id,
  referrerId: PREVIEW_USER.id,
  referredUserId: peer.id,
  level,
  bonusPercentage: 0.05,
  bonusStartDate: daysAgo(days),
  bonusEndDate: daysAhead(360 - days),
  status: "ACTIVE",
  createdAt: daysAgo(days),
  updatedAt: daysAgo(days),
  referrer: { id: PREVIEW_USER.id, name: PREVIEW_USER.name, email: PREVIEW_USER.email },
  referredUser: { id: peer.id, name: peer.name, email: peer.email },
});

const referralsByReferrerBody = () => ({
  data: [
    referralRelation("rf-1", 0, PEER, 1, 14),
    referralRelation("rf-2", 1, THIRD, 1, 9),
    referralRelation("rf-3", 2, { id: "preview-user-0004", name: "Sneha P.", email: "sneha@example.com" }, 2, 4),
  ],
});

/* ------------------------------------------------------------------ plans */

const subscriptionPlan = (
  id: string,
  name: string,
  minimumInvestment: number,
  maximumInvestment: number | null,
  roiPerMonth: number,
  durationInMonths: number,
  description: string,
  isSubscribed: boolean,
  maximumEarning: number | null,
) => ({
  id,
  name,
  minimumInvestment,
  maximumInvestment,
  roiPerMonth,
  roiPerDay: null,
  maximumEarning,
  durationInMonths,
  description,
  isActive: true,
  createdAt: daysAgo(90),
  updatedAt: daysAgo(20),
  isSubscribed,
});

const plansBody = () => ({
  data: [
    subscriptionPlan("plan-starter", "Starter", 5000, 25000, 0.08, 3, "3 months · 8% monthly ROI", true, 12500),
    subscriptionPlan("plan-growth", "Growth", 10000, 100000, 0.1, 6, "6 months · 10% monthly ROI", true, 25000),
    subscriptionPlan("plan-premium", "Premium", 25000, 500000, 0.12, 12, "12 months · 12% monthly ROI", false, null),
  ],
  hasAnySubscriptions: true,
});

/* ------------------------------------------------------------------ notifications */

const notificationItem = (
  index: number,
  title: string,
  message: string,
  type: string,
  days: number,
  meta: Record<string, unknown> | null = null,
) => ({
  id: `un-${index}`,
  userId: PREVIEW_USER.id,
  notificationId: `nt-${index}`,
  createdAt: daysAgo(days),
  notification: {
    id: `nt-${index}`,
    title,
    message,
    type,
    meta,
    expiresAt: null,
    createdAt: daysAgo(days),
    updatedAt: daysAgo(days),
  },
});

const notificationsBody = () => ({
  success: true,
  data: [
    notificationItem(1, "ROI credited", "₹160 credited for your Growth plan (day 45).", "SUCCESS", 0.08, { actionUrl: "/app/wallet" }),
    notificationItem(2, "Withdrawal processing", "Your ₹1,000 request is being processed.", "WARNING", 1),
    notificationItem(3, "New referral joined", "Vikas M. joined using your referral link.", "INFO", 4, { actionUrl: "/app/referrals" }),
    notificationItem(4, "Plan activated", "Growth plan (6 months) is now active.", "SUCCESS", 21),
  ],
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalItems: 4,
    itemsPerPage: 10,
    hasNextPage: false,
    hasPrevPage: false,
  },
});

/* ------------------------------------------------------------------ roi records */

const roiRecord = (index: number, weekNumber: number, roiAmount: string, days: number) => ({
  id: `roi-${index}`,
  userId: PREVIEW_USER.id,
  investmentId: "inv-1",
  weekNumber,
  roiAmount,
  isReferralBonusApplied: false,
  creditedForDate: daysAgo(days),
  createdAt: daysAgo(days),
  user: { id: PREVIEW_USER.id, name: PREVIEW_USER.name, email: PREVIEW_USER.email },
  investment: {
    id: "inv-1",
    amountInvested: "10000",
    status: "ACTIVE",
    plan: { id: "plan-growth", name: "Growth" },
  },
});

const roiRecordsBody = () => ({
  data: [
    roiRecord(1, 1, "160.00", 1),
    roiRecord(2, 2, "120.00", 8),
    roiRecord(3, 3, "160.00", 15),
    roiRecord(4, 4, "120.00", 22),
  ],
  pagination: { currentPage: 1, totalPages: 1, totalItems: 4, itemsPerPage: 10 },
});

/* ------------------------------------------------------------------ setting + payments */

const settingBody = () => ({
  success: true,
  message: "setting fetched successfully",
  data: {
    id: "setting-1",
    phoneNumber: "+91 99999 99999",
    email: "support@earningways.in",
    activeUser: "1240",
    totalUser: "3180",
    location: "India",
    maxiumEarningReturn: 2.5,
    withdrawalApprovalLimit: "50000.00",
    createdAt: daysAgo(200),
    updatedAt: daysAgo(3),
  },
});

const starsConfigBody = () => ({
  data: {
    enabled: true,
    botUsername: "EarningWaysBot",
    starsPerInr: "0.55",
    maxStarsPerInvoice: 10000,
  },
});

/** POST /payment/telegram/invoice — the hook treats `res.data` itself as StarsIntent (no wrapper). */
const starsInvoiceBody = (stars = 5500, amount = "10000") => ({
  paymentId: "pay-preview-1",
  invoiceUrl: "https://t.me/EarningWaysBot?start=preview-invoice",
  stars,
  amount,
  botUsername: "EarningWaysBot",
});

const starsStatusBody = () => ({
  data: {
    id: "pay-preview-1",
    status: "PENDING",
    amount: "10000",
    stars: 5500,
    planId: "plan-growth",
    investmentId: null,
    telegramChargeId: null,
    confirmedAt: null,
  },
});

/* ------------------------------------------------------------------ resolver */

/**
 * url → fixture. `null` means this endpoint has no fixture, so the real network runs.
 * Path matching order matters: specific paths first, `/user/:id` last.
 */
export function resolveFixture(config: { url?: string; method?: string }): FixtureResponse | null {
  const url = config.url ?? "";
  const path = url.split("?")[0].replace(/\/+$/, "");
  if (!path) return null;

  // auth + user
  if (path === "/user/login") return { status: 200, body: loginBody() };
  if (path === "/user/create") return { status: 201, body: signupBody() };
  if (path.startsWith("/user/referrals/")) return { status: 200, body: referralsByUserBody() };
  if (/^\/user\/[^/]+$/.test(path)) return { status: 200, body: { data: userRecord() } };

  // dashboard
  if (path.startsWith("/user-dashboard/")) return { status: 200, body: dashboardBody() };

  // wallet
  if (path === "/wallet/create") return { status: 201, body: { message: "Wallet created successfully", data: walletBody().data } };
  if (path.startsWith("/wallet/")) return { status: 200, body: walletBody() };

  // money movement
  if (path === "/withdraw/create") return { status: 201, body: createdWithdrawalBody() };
  if (path === "/withdraw/qr") return { status: 201, body: { message: "Payout QR uploaded successfully", data: { qrCodeUrl: "https://example.com/preview/payout-qr.png", storage: "local" } } };
  if (path.startsWith("/withdraw/user/")) return { status: 200, body: withdrawalsBody() };
  if (path === "/transfer/create") return { status: 201, body: { message: "Transfer created successfully", data: transfersSentBody().data[0] } };
  if (path.startsWith("/transfer/sender/")) return { status: 200, body: transfersSentBody() };
  if (path.startsWith("/transfer/receiver/")) return { status: 200, body: transfersReceivedBody() };

  // records + history
  if (path.startsWith("/transaction/user/")) return { status: 200, body: transactionsBody() };
  if (path.startsWith("/record/all")) return { status: 200, body: roiRecordsBody() };
  if (path.startsWith("/referral/referrer/")) return { status: 200, body: referralsByReferrerBody() };

  // catalogue + misc
  if (path.startsWith("/subscription/all")) return { status: 200, body: plansBody() };
  if (path.startsWith("/notifications/")) return { status: 200, body: notificationsBody() };
  if (path === "/setting") return { status: 200, body: settingBody() };
  if (path === "/enquiry") return { status: 201, body: { success: true, message: "Enquiry created successfully", data: { id: "enq-preview-1" } } };

  // Telegram Stars (only payment rail)
  if (path === "/payment/telegram/config") return { status: 200, body: starsConfigBody() };
  if (path === "/payment/telegram/invoice") return { status: 200, body: starsInvoiceBody() };
  if (path.startsWith("/payment/telegram/status/")) return { status: 200, body: starsStatusBody() };

  return null;
}
