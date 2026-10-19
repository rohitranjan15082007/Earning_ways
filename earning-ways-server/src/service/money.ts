import prisma from '../config/prisma.js';
import { Prisma } from '../../generated/prisma/index.js';
import { PaymentError, paymentAmount } from './amount.js';
import { inrText, notifyUser } from './notify.js';

// Balances are held twice on purpose: `Wallet.balance` is the member-facing
// payout wallet and `User.inrBalance` is the guarded account balance. Both are
// moved together inside one transaction and every debit is conditional on
// `>= amount`, so a concurrent withdrawal can never overdraw the account.

const options = { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted };
const userSelect = { select: { id: true, name: true, email: true } };
const transferInclude = { sender: userSelect, receiver: userSelect };
const CURRENCY = 'INR';

async function debit(tx: Prisma.TransactionClient, userId: string, amount: Prisma.Decimal) {
  const wallet = await tx.wallet.updateMany({
    where: { userId, currency: CURRENCY, balance: { gte: amount } },
    data: { balance: { decrement: amount } },
  });
  if (wallet.count !== 1) throw new PaymentError('Insufficient balance or missing INR wallet');
  const user = await tx.user.updateMany({
    where: { id: userId, inrBalance: { gte: amount } },
    data: { inrBalance: { decrement: amount } },
  });
  if (user.count !== 1) throw new PaymentError('Insufficient user balance; reconcile account balances', 409);
}
async function credit(tx: Prisma.TransactionClient, userId: string, amount: Prisma.Decimal) {
  const wallet = await tx.wallet.updateMany({ where: { userId, currency: CURRENCY }, data: { balance: { increment: amount } } });
  if (wallet.count !== 1) throw new PaymentError('Matching INR wallet required', 409);
  await tx.user.update({ where: { id: userId }, data: { inrBalance: { increment: amount } } });
}

/**
 * A withdrawal request carries the member's UPI id and the QR image they
 * uploaded for the payout. Both are snapshotted on the request so operations
 * pays exactly what was asked for, even if the profile changes later. The QR is
 * mandatory: operations pays from that image, so a request without one could not
 * be processed.
 */
export async function createWithdrawal(
  userId: string,
  value: unknown,
  upiId: string,
  qrCodeUrl: string,
) {
  const amount = paymentAmount(value);
  if (amount.lessThan(10)) throw new PaymentError('Minimum withdrawal amount is 10');
  if (typeof qrCodeUrl !== 'string' || !qrCodeUrl.trim()) {
    throw new PaymentError('Payout QR code is required');
  }
  const qrImage = qrCodeUrl.trim();
  return prisma.$transaction(async tx => {
    await debit(tx, userId, amount);
    const withdrawal = await tx.withdrawal.create({
      data: { userId, amount, upiId, qrCodeUrl: qrImage, status: 'PENDING', processedAt: null },
    });
    await tx.transaction.create({ data: {
      userId, type: 'WITHDRAW', amount, currency: CURRENCY, status: 'PENDING',
      description: `Withdrawal request to UPI ${upiId}`, meta: { withdrawalId: withdrawal.id },
    } });
    return withdrawal;
  }, options);
}

export async function processWithdrawal(id: string, status: 'APPROVED' | 'REJECTED', remove = false) {
  return prisma.$transaction(async tx => {
    const withdrawal = await tx.withdrawal.findUnique({ where: { id } });
    if (!withdrawal) throw new PaymentError('Withdrawal not found', 404);
    paymentAmount(withdrawal.amount.toString());
    // Claim first: approvals, rejection and deletion all contend on this row.
    const claimed = await tx.withdrawal.updateMany({ where: { id, status: 'PENDING' }, data: { status, processedAt: new Date() } });
    if (claimed.count !== 1) throw new PaymentError('Withdrawal is already processed', 409);
    const ledger = await tx.transaction.findMany({ where: {
      userId: withdrawal.userId, type: 'WITHDRAW', status: 'PENDING', amount: withdrawal.amount,
      currency: CURRENCY, meta: { path: '$.withdrawalId', equals: id },
    } });
    if (ledger.length !== 1) throw new PaymentError('Withdrawal ledger link missing or ambiguous; reconciliation required', 409);
    const updatedLedger = await tx.transaction.updateMany({ where: { id: ledger[0]!.id, status: 'PENDING' }, data: {
      status: status === 'APPROVED' ? 'SUCCESS' : 'FAILED',
      ...(status === 'REJECTED' ? { description: 'Withdrawal Rejected - Refunded' } : {}),
    } });
    if (updatedLedger.count !== 1) throw new PaymentError('Withdrawal ledger already processed', 409);
    if (status === 'REJECTED') await credit(tx, withdrawal.userId, withdrawal.amount);

    // The member is told the outcome as soon as the decision is committed; a
    // rejected request has already been refunded above, so the note can say so.
    await notifyUser(tx, {
      userId: withdrawal.userId,
      title: status === 'APPROVED' ? 'Withdrawal paid' : 'Withdrawal rejected',
      message: status === 'APPROVED'
        ? `Your withdrawal of ${inrText(withdrawal.amount)} was approved and sent to UPI ${withdrawal.upiId}.`
        : `Your withdrawal of ${inrText(withdrawal.amount)} was rejected; the amount is back in your balance.`,
      type: status === 'APPROVED' ? 'SUCCESS' : 'WARNING',
      meta: { withdrawalId: id, amount: withdrawal.amount.toString(), status },
    });

    if (remove) { await tx.withdrawal.delete({ where: { id } }); return null; }
    return tx.withdrawal.findUnique({ where: { id }, include: { user: userSelect } });
  }, options);
}

export async function createTransfer(senderId: string, receiverId: string, value: unknown, note?: string) {
  const amount = paymentAmount(value);
  if (senderId === receiverId) throw new PaymentError('Sender and receiver cannot be the same');
  // Pending requests do not reserve money. Approval performs the guarded debit.
  return prisma.$transaction(async tx => {
    const wallets = await tx.wallet.findMany({ where: { userId: { in: [senderId, receiverId] }, currency: CURRENCY } });
    if (wallets.length !== 2) throw new PaymentError('Sender and receiver INR wallets required');
    const sender = wallets.find(wallet => wallet.userId === senderId)!;
    if (sender.balance.lessThan(amount)) throw new PaymentError('Insufficient balance in sender wallet');
    return tx.transfer.create({ data: { senderId, receiverId, amount, status: 'PENDING', ...(note !== undefined ? { note } : {}) }, include: transferInclude });
  }, options);
}

export async function updateTransfer(id: string, input: { amount?: unknown; status?: unknown; note?: unknown }) {
  if (input.status !== undefined && (typeof input.status !== 'string' || !['PENDING', 'SUCCESS', 'FAILED'].includes(input.status))) throw new PaymentError('Invalid transfer status');
  if (input.note !== undefined && typeof input.note !== 'string') throw new PaymentError('Note must be a string');
  const requestedAmount = input.amount !== undefined ? paymentAmount(input.amount) : undefined;
  return prisma.$transaction(async tx => {
    const transfer = await tx.transfer.findUnique({ where: { id } });
    if (!transfer) throw new PaymentError('Transfer not found', 404);
    if (transfer.status !== 'PENDING') throw new PaymentError('Processed transfers are immutable', 409);
    const amount = requestedAmount ?? paymentAmount(transfer.amount.toString());
    const status = (input.status ?? 'PENDING') as 'PENDING' | 'SUCCESS' | 'FAILED';
    const claimed = await tx.transfer.updateMany({
      where: { id, status: 'PENDING', amount: transfer.amount, updatedAt: transfer.updatedAt },
      data: { amount, status, ...(typeof input.note === 'string' ? { note: input.note } : {}) },
    });
    if (claimed.count !== 1) throw new PaymentError('Transfer changed concurrently; refresh and retry', 409);
    if (status === 'SUCCESS') {
      if (transfer.senderId === transfer.receiverId) throw new PaymentError('Invalid self-transfer', 409);
      await debit(tx, transfer.senderId, amount);
      await credit(tx, transfer.receiverId, amount);
      await tx.transaction.create({ data: { userId: transfer.senderId, type: 'TRANSFER', amount, currency: CURRENCY, status: 'SUCCESS', description: 'Transfer sent', meta: { transferId: id, direction: 'OUT', counterpartyId: transfer.receiverId } } });
      await tx.transaction.create({ data: { userId: transfer.receiverId, type: 'TRANSFER', amount, currency: CURRENCY, status: 'SUCCESS', description: 'Transfer received', meta: { transferId: id, direction: 'IN', counterpartyId: transfer.senderId } } });
    }
    return tx.transfer.findUnique({ where: { id }, include: transferInclude });
  }, options);
}

export async function deleteTransfer(id: string) {
  // Conditional deletion races on the same row as approval: it cannot erase a
  // successful transfer after approval has committed.
  const removed = await prisma.transfer.deleteMany({ where: { id, status: { in: ['PENDING', 'FAILED'] } } });
  if (removed.count !== 1) throw new PaymentError('Transfer missing or successful; cannot delete', 409);
}
