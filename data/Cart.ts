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

// Helper (you already have this)
async function computeWispayBalance(rfidNumber: bigint): Promise<number> {
  const agg = await prisma.wispay.aggregate({
    where: { rfid: rfidNumber },
    _sum: { credit: true, debit: true },
  });
  const sumCredit = Number(agg._sum.credit ?? 0);
  const sumDebit  = Number(agg._sum.debit  ?? 0);
  return sumCredit - sumDebit;
}

// GET /api/wispay/balances
export async function getAllWispayBalances(c: Context) {
  // 1. Load all users (only the fields we need)
  const users = await prisma.user.findMany({
    select: {
      rfid: true,
      fname: true,
      lname: true,
      position: true,
    },
    orderBy: { lname: 'asc' },
  });

  // 2. For each user, compute their balance
  const withBalances = await Promise.all(
    users.map(async (u) => ({
      ...u,
      balance: (await computeWispayBalance(u.rfid)).toFixed(2),
    }))
  );

  return c.json({ success: true, data: withBalances });
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

    // Get user information
    const user = await prisma.user.findFirst({
      where: { rfid: rfidNumber },
      select: {
        fname: true,
        mname: true,
        lname: true,
        type: true,
        grade: true,
        section: true,
      },
    });

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    const balance = await computeWispayBalance(rfidNumber);
    
    return c.json({ 
      success: true, 
      credit: balance.toFixed(2), 
      rfid,
      user: {
        name: `${user.fname} ${user.mname} ${user.lname}`.replace(/\s+/g, ' ').trim(),
        type: user.type,
        grade: user.grade,
        section: user.section
      }
    });
  } catch (err) {
    console.error('Error fetching total Wispay credit:', err);
    return c.json({
      error: 'Failed to fetch total credit',
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

    // First, find the user by RFID
    const user = await prisma.user.findFirst({
      where: { rfid: rfidNumber },
      select: {
        fname: true,
        mname: true,
        lname: true,
        type: true,
        grade: true,
        section: true,
      },
    });

    if (!user) {
      return c.json({ 
        error: 'User not found',
        details: `No user found with RFID: ${rfid}`
      }, 404);
    }

    const creditAmount = parseFloat(amount);
    if (isNaN(creditAmount) || creditAmount <= 0) {
      return c.json({ error: 'Invalid or non-positive amount' }, 400);
    }

    // Get current balance before adding credit
    const currentBalance = await computeWispayBalance(rfidNumber);

    // Create the credit transaction
    const transaction = await prisma.wispay.create({
      data: {
        rfid: rfidNumber,
        debit: 0,
        credit: creditAmount,
        empid,
        username,
        refcode: `CREDIT-${Date.now()}`,
        transdate: new Date(),
        processedby: username,
        product_type: 'Top Up',
        product_name: 'Account Top Up',
        quantity: 1,
      },
    });

    // Get updated balance after adding credit
    const newBalance = currentBalance + creditAmount;

    return c.json({
      success: true,
      message: 'Credit added successfully',
      user: {
        name: `${user.fname} ${user.mname} ${user.lname}`.replace(/\s+/g, ' ').trim(),
        type: user.type,
        grade: user.grade,
        section: user.section
      },
      transaction: {
        id: transaction.id,
        amount: creditAmount.toFixed(2),
        date: transaction.transdate
      },
      balance: {
        previous: currentBalance.toFixed(2),
        new: newBalance.toFixed(2)
      }
    });
  } catch (err) {
    console.error('Error adding Wispay credit:', err);
    return c.json({
      error: 'Failed to add credit',
      details: process.env.NODE_ENV === 'development' ? (err as Error).message : null,
    }, 500);
  }
}

// /api/wispay/user
export async function getUsersData(c: Context) {
  try {
    // First get all users with their basic info
    const users = await prisma.user.findMany({
      select: {
        id: true,
        rfid: true,
        fname: true,
        lname: true,
        position: true,
      },
      where: {
        position: {
          not: undefined
        }
      },
      orderBy: { lname: 'asc' },
    });

    // Then calculate balance for each user
    const usersWithBalances = await Promise.all(
      users.map(async (user) => {
        // Calculate balance if user has RFID
        const balance = user.rfid 
          ? (await computeWispayBalance(user.rfid)).toFixed(2)
          : '0.00';
        
        return {
          ...user,
          rfid: user.rfid?.toString() ?? null, // Convert BigInt to string
          balance // Add balance field
        };
      })
    );

    return c.json({ 
      success: true, 
      users: usersWithBalances 
    }, 200);
  } catch (err) {
    console.error('Error fetching users:', err);
    return c.json({ 
      error: 'Unable to fetch users',
      details: process.env.NODE_ENV === 'development' ? (err instanceof Error ? err.message : String(err)) : null
    }, 500);
  }
}

// /api/wispay/user/balances
export async function getUsersBalancesData(c: Context) {
  try {
    // Get all users with RFID
    const users = await prisma.user.findMany({
      select: {
        rfid: true,
      },
      where: {
        rfid: {
          not: undefined
        }
      }
    });

    // Calculate balances for each user
    const balances = await Promise.all(
      users.map(async (user) => {
        const balance = await computeWispayBalance(user.rfid);
        return {
          rfid: user.rfid.toString(),
          balance: balance.toFixed(2)
        };
      })
    );

    return c.json(balances, 200);
  } catch (err) {
    console.error('Error fetching balances:', err);
    return c.json({ 
      error: 'Unable to fetch balances',
      details: process.env.NODE_ENV === 'development' ? (err instanceof Error ? err.message : String(err)) : null
    }, 500);
  }
}