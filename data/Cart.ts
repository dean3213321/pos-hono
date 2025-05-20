import { type Context } from "hono";
import { PrismaClient } from '@prisma/client';

// Extended Prisma client with BigInt handling
const prisma = new PrismaClient().$extends({
  result: {
    wispay: {
      rfid: {
        needs: { rfid: true },
        compute(wispay) {
          return wispay.rfid.toString();
        },
      },
    },
  },
});

// Helper to compute current balance (credits minus debits)
async function computeWispayBalance(rfidNumber: bigint): Promise<number> {
  const agg = await prisma.wispay.aggregate({
    where: { rfid: rfidNumber },
    _sum: { credit: true, debit: true },
  });
  const sumCredit = Number(agg._sum.credit ?? 0);
  const sumDebit  = Number(agg._sum.debit  ?? 0);
  return sumCredit - sumDebit;
}
// GET /api/wispay/credit?rfid=...
export async function getWispayCreditByRfidData(c: Context) {
  try {
    const { rfid } = c.req.query();
    if (!rfid) {
      return c.json({ error: 'RFID is required' }, 400);
    }

    let rfidNumber: bigint;
    try {
      rfidNumber = BigInt(rfid);
    } catch {
      return c.json({ error: 'Invalid RFID format' }, 400);
    }

    const balance = await computeWispayBalance(rfidNumber);
    return c.json({ success: true, credit: balance.toFixed(2), rfid });
  } catch (err) {
    console.error('Error fetching total Wispay credit:', err);
    return c.json({
      error: 'Failed to fetch total credit',
      details: process.env.NODE_ENV === 'development' ? (err as Error).message : null,
    }, 500);
  }
}

// POST /api/wispay/payment
export async function processWispayPaymentData(c: Context) {
  try {
    const { rfid, amount, empid, username, product_name, quantity } = await c.req.json();
    // Validate required fields
    if (!rfid || !amount || !empid || !username) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return c.json({ error: 'Invalid or non-positive amount' }, 400);
    }

    let rfidNumber: bigint;
    try {
      rfidNumber = BigInt(rfid);
    } catch {
      return c.json({ error: 'Invalid RFID format' }, 400);
    }

    const currentBalance = await computeWispayBalance(rfidNumber);
    if (currentBalance < paymentAmount) {
      return c.json({
        error: 'Insufficient credit',
        totalCredit: currentBalance.toFixed(2),
        requiredAmount: paymentAmount.toFixed(2),
      }, 400);
    }

    const transaction = await prisma.wispay.create({
      data: {
        rfid:        rfidNumber,
        debit:       paymentAmount,
        credit:      0,
        empid,
        username,
        refcode:     `PAY-${Date.now()}`,
        transdate:   new Date(),
        processedby: username,
        product_type:'POS Payment',
        product_name:product_name || 'POS Purchase',
        quantity:     quantity ? parseFloat(quantity) : 1,
      },
    });

    const newBalance = currentBalance - paymentAmount;
    return c.json({
      success: true,
      message: 'Payment processed successfully',
      newBalance: newBalance.toFixed(2),
      transactionId: transaction.id,
      rfid,
    });
  } catch (err) {
    console.error('Error processing Wispay payment:', err);
    return c.json({
      error: 'Failed to process payment',
      details: process.env.NODE_ENV === 'development' ? (err as Error).message : null,
    }, 500);
  }
}

// POST /api/wispay/credit
export async function addWispayCreditData(c: Context) {
  try {
    const { rfid, amount, empid, username } = await c.req.json();
    // Validate required fields
    if (!rfid || !amount || !empid || !username) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    let rfidNumber: bigint;
    try {
      rfidNumber = BigInt(rfid);
    } catch {
      return c.json({ error: 'Invalid RFID format' }, 400);
    }

    const creditAmount = parseFloat(amount);
    if (isNaN(creditAmount) || creditAmount <= 0) {
      return c.json({ error: 'Invalid or non-positive amount' }, 400);
    }

    const transaction = await prisma.wispay.create({
      data: {
        rfid:        rfidNumber,
        debit:       0,
        credit:      creditAmount,
        empid,
        username,
        refcode:     `CREDIT-${Date.now()}`,
        transdate:   new Date(),
        processedby: username,
        product_type:'Top Up',
        product_name:'Account Top Up',
        quantity:     1,
      },
    });

    const balance = await computeWispayBalance(rfidNumber);
    return c.json({
      success: true,
      message: 'Credit added successfully',
      newBalance: balance.toFixed(2),
      transactionId: transaction.id,
    });
  } catch (err) {
    console.error('Error adding Wispay credit:', err);
    return c.json({
      error: 'Failed to add credit',
      details: process.env.NODE_ENV === 'development' ? (err as Error).message : null,
    }, 500);
  }
}

