import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { connectDb, disconnectDb } from '../src/lib/db/mongoose';
import { Region } from '../src/models/region.model';
import { Agent } from '../src/models/agent.model';
import { AgentUser } from '../src/models/agent-user.model';
import { Admin } from '../src/models/admin.model';
import { Commission } from '../src/models/commission.model';
import { PayoutBatch } from '../src/models/payout-batch.model';
import { PerformanceEvent } from '../src/models/performance-event.model';
import { hashPassword } from '../src/lib/auth/password';
import { computeCommissionAmounts } from '../src/lib/money/commission-math';
import { PLATFORM_FEE_RATE_BP } from '../src/lib/config/commission';

const SEED_FILE = join(process.cwd(), 'scripts', '.seeded-ids.json');

/**
 * EDIT THIS BLOCK BEFORE RUNNING.
 *
 * Replace each `email` with the real address you want to sign in as,
 * or leave the default `.example.cm` addresses if you just want to
 * test locally. Every agent's password will be `agent12345` unless
 * you change `AGENT_PASSWORD` below.
 */
const AGENT_PASSWORD = 'agent12345';

const AGENTS = [
  {
    fullName: 'Awa Ngwa',
    email: 'awa@example.cm',
    phone: '+237677000001',
    region: 'Douala',
    ref: 'AWA01',
    rate: 500,
  },
  {
    fullName: 'Brice Mbarga',
    email: 'brice@example.cm',
    phone: '+237677123456',
    region: 'Yaoundé',
    ref: 'BRI02',
    rate: 500,
  },
  {
    fullName: 'Chantal Eyenga',
    email: 'chantal@example.cm',
    phone: '+237699204118',
    region: 'Douala',
    ref: 'CHA03',
    rate: 500,
  },
  {
    fullName: 'Divine Tchoumi',
    email: 'divine@example.cm',
    phone: '+237650332907',
    region: 'Bafoussam',
    ref: 'DIV04',
    rate: 500,
  },
  {
    fullName: 'Fabrice Nkeng',
    email: 'fabrice@example.cm',
    phone: '+237677458220',
    region: 'Buea',
    ref: 'FAB05',
    rate: 500,
  },
  {
    fullName: 'Paul Essomba',
    email: 'paul@example.cm',
    phone: '+237699871004',
    region: 'Kribi',
    ref: 'PAU06',
    rate: 500,
  },
  {
    fullName: 'Solange Atangana',
    email: 'solange@example.cm',
    phone: '+237651090336',
    region: 'Yaoundé',
    ref: 'SOL07',
    rate: 500,
  },
  {
    fullName: 'Jean-Baptiste Meka',
    email: 'jb@example.cm',
    phone: '+237677310665',
    region: 'Douala',
    ref: 'JBM08',
    rate: 500,
  },
  {
    fullName: 'Marceline Dubois',
    email: 'marceline@example.cm',
    phone: '+237699445871',
    region: 'Buea',
    ref: 'MAR09',
    rate: 500,
  },
  {
    fullName: 'Robert Fouda',
    email: 'robert@example.cm',
    phone: '+237650118902',
    region: 'Kribi',
    ref: 'ROB10',
    rate: 500,
  },
];

const REGIONS = [
  { name: 'Douala', code: 'DLA' },
  { name: 'Yaoundé', code: 'YDE' },
  { name: 'Buea', code: 'BUE' },
  { name: 'Bafoussam', code: 'BAF' },
  { name: 'Kribi', code: 'KRI' },
];

// --- Helpers to build dates in WAT ---
function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function dateInMonthsAgo(months: number, day: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  d.setDate(day);
  d.setUTCHours(12, 0, 0, 0);
  return d;
}

function periodFromDate(d: Date): string {
  const shifted = new Date(d.getTime() + 60 * 60 * 1000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

function dayKeyFromDate(d: Date): string {
  const shifted = new Date(d.getTime() + 60 * 60 * 1000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Every object we create during seeding is collected here so the clear
 * script can delete exactly those and nothing else.
 */
type SeedManifest = {
  regions: string[];
  agents: string[];
  agentUsers: string[];
  commissions: string[];
  payoutBatches: string[];
  performanceEvents: string[];
  seededAt: string;
};

async function seed() {
  console.log('Connecting to database...');
  await connectDb();

  const manifest: SeedManifest = {
    regions: [],
    agents: [],
    agentUsers: [],
    commissions: [],
    payoutBatches: [],
    performanceEvents: [],
    seededAt: new Date().toISOString(),
  };

  // ---------- REGIONS ----------
  console.log('Ensuring regions exist...');
  const regionByName: Record<string, import('mongoose').Types.ObjectId> = {};
  for (const def of REGIONS) {
    // Upsert by name (case-insensitive via nameKey normalization).
    const existing = await Region.findOne({ name: def.name });
    if (existing) {
      regionByName[def.name] = existing._id;
      console.log(`  - ${def.name} (already exists)`);
    } else {
      const created = await Region.create({ name: def.name, code: def.code });
      regionByName[def.name] = created._id;
      manifest.regions.push(String(created._id));
      console.log(`  - ${def.name} (created)`);
    }
  }

  // ---------- ADMIN (must exist) ----------
  const admin = await Admin.findOne({}).sort({ _id: 1 });
  if (!admin) {
    console.error('No admin found. Run the bootstrap admin step first.');
    process.exit(1);
  }
  console.log(`Using admin: ${admin.email}`);

  // ---------- AGENTS ----------
  console.log('Ensuring agents and their logins exist...');
  const passwordHash = await hashPassword(AGENT_PASSWORD);
  const agents = [];

  for (const def of AGENTS) {
    // Skip if the email already exists (idempotent).
    const existing = await Agent.findOne({ email: def.email });
    if (existing) {
      console.log(`  - ${def.fullName} (already exists)`);
      agents.push(existing);
      continue;
    }

    const agent = await Agent.create({
      fullName: def.fullName,
      type: 'AGENT',
      email: def.email,
      phone: def.phone,
      regionId: regionByName[def.region],
      referralCode: def.ref,
      status: 'ACTIVE',
      onboardingStage: 'ONBOARDED',
      commissionRate: def.rate,
      payoutPreference: { method: 'MOBILE_MONEY', provider: 'MTN MoMo', accountNumber: def.phone },
    });
    manifest.agents.push(String(agent._id));

    const agentUser = await AgentUser.create({
      agentId: agent._id,
      email: agent.email,
      passwordHash,
    });
    manifest.agentUsers.push(String(agentUser._id));

    agents.push(agent);
    console.log(`  - ${def.fullName} (created)`);
  }

  // ---------- COMMISSIONS ----------
  // Guard against re-running: if this agent already has commissions,
  // assume the seed has already happened and skip. Prevents double data.
  console.log('Checking commissions...');
  const anyCommission = await Commission.countDocuments({});
  if (anyCommission > 0) {
    console.log(`  Skipping commission seed: ${anyCommission} commissions already exist.`);
  } else {
    console.log('Seeding commissions, batches, and performance...');
    await seedCommissionsAndBatches(admin._id, agents, manifest);
    await seedPerformanceEvents(admin._id, agents, manifest);
  }

  // ---------- WRITE MANIFEST ----------
  mkdirSync(join(process.cwd(), 'scripts'), { recursive: true });
  writeFileSync(SEED_FILE, JSON.stringify(manifest, null, 2));
  console.log(`\nWrote seed manifest to ${SEED_FILE}`);

  console.log('\nSeed complete.');
  console.log(`  Admin: sign in with your existing account.`);
  console.log(`  Agent: ${AGENTS[0].email} / ${AGENT_PASSWORD}`);
  console.log(`  Agent: ${AGENTS[1].email} / ${AGENT_PASSWORD}`);

  await disconnectDb();
  process.exit(0);
}

async function seedCommissionsAndBatches(
  adminId: import('mongoose').Types.ObjectId,
  agents: Awaited<ReturnType<typeof Agent.findOne>>[],
  manifest: SeedManifest,
) {
  const currentPeriod = periodFromDate(new Date());

  // Helper to build one commission + return its doc.
  async function mkCommission(opts: {
    agentId: import('mongoose').Types.ObjectId;
    coreCustomerId: string;
    amount: number;
    daysAgo: number;
    status: 'PENDING' | 'VERIFIED' | 'APPROVED' | 'PAID';
    paidAt?: Date;
    reversesCommissionId?: import('mongoose').Types.ObjectId | null;
    reason?: string;
  }) {
    const amounts = computeCommissionAmounts(
      { amount: opts.amount, currency: 'XAF' },
      Math.abs(opts.amount) === opts.amount ? 500 : 500, // rate is 500 bp always
      PLATFORM_FEE_RATE_BP,
    );
    const c = await Commission.create({
      agentId: opts.agentId,
      coreCustomerId: opts.coreCustomerId,
      firstPaymentConfirmedAt: daysAgo(opts.daysAgo),
      period: currentPeriod,
      baseAmount: { amount: opts.amount, currency: 'XAF' },
      rateApplied: 500,
      platformFeeRateApplied: PLATFORM_FEE_RATE_BP,
      grossAmount: amounts.grossAmount,
      platformFee: amounts.platformFee,
      netAmount: amounts.netAmount,
      status: opts.status,
      createdBy: adminId,
      paidAt: opts.paidAt,
      reversesCommissionId: opts.reversesCommissionId ?? null,
      reason: opts.reason,
    });
    manifest.commissions.push(String(c._id));
    return c;
  }

  // Awa — mix: 4 approved, 2 pending, 3 paid history
  const awa = agents[0]!;
  for (let i = 0; i < 4; i++) {
    await mkCommission({
      agentId: awa._id,
      coreCustomerId: `CUST-AWA-PD-${i}`,
      amount: 20000,
      daysAgo: 10 + i,
      status: 'APPROVED',
    });
  }
  for (let i = 0; i < 2; i++) {
    await mkCommission({
      agentId: awa._id,
      coreCustomerId: `CUST-AWA-PEND-${i}`,
      amount: 15000,
      daysAgo: 2 + i,
      status: 'PENDING',
    });
  }
  const awaPaid = [];
  for (let i = 0; i < 3; i++) {
    const c = await mkCommission({
      agentId: awa._id,
      coreCustomerId: `CUST-AWA-PAID-${i}`,
      amount: 30000,
      daysAgo: 30 + i,
      status: 'PAID',
      paidAt: dateInMonthsAgo(0, 5),
    });
    awaPaid.push(c);
  }

  // Brice — reversal pair + approved balance
  const brice = agents[1]!;
  const original = await mkCommission({
    agentId: brice._id,
    coreCustomerId: 'CUST-BRI-REV',
    amount: 40000,
    daysAgo: 15,
    status: 'APPROVED',
  });
  await mkCommission({
    agentId: brice._id,
    coreCustomerId: 'CUST-BRI-REV',
    amount: -40000,
    daysAgo: 15,
    status: 'PENDING',
    reversesCommissionId: original._id,
    reason: 'First payment was refunded to the tenant.',
  });
  for (let i = 0; i < 5; i++) {
    await mkCommission({
      agentId: brice._id,
      coreCustomerId: `CUST-BRI-OK-${i}`,
      amount: 25000,
      daysAgo: 5 + i,
      status: 'APPROVED',
    });
  }

  // Chantal — below minimum
  const chantal = agents[2]!;
  await mkCommission({
    agentId: chantal._id,
    coreCustomerId: 'CUST-CHA-LOW',
    amount: 3000,
    daysAgo: 3,
    status: 'APPROVED',
  });

  // Divine — processing batch
  const divine = agents[3]!;
  const divineComms = [];
  for (let i = 0; i < 3; i++) {
    const c = await mkCommission({
      agentId: divine._id,
      coreCustomerId: `CUST-DIV-${i}`,
      amount: 30000,
      daysAgo: 12 + i,
      status: 'APPROVED',
    });
    divineComms.push(c);
  }
  const totalDivine = divineComms.reduce((s, c) => s + c.netAmount.amount, 0);
  const batchDivine = await PayoutBatch.create({
    agentId: divine._id,
    period: currentPeriod,
    commissionIds: divineComms.map((c) => c._id),
    totalAmount: { amount: totalDivine, currency: 'XAF' },
    status: 'PROCESSING',
    method: 'MOBILE_MONEY',
    createdBy: adminId,
    approvedBy: adminId,
    approvedAt: daysAgo(1),
  });
  manifest.payoutBatches.push(String(batchDivine._id));
  await Commission.updateMany(
    { _id: { $in: divineComms.map((c) => c._id) } },
    { $set: { payoutBatchId: batchDivine._id } },
  );

  // Fabrice — failed batch
  const fabrice = agents[4]!;
  const fabComms = [];
  for (let i = 0; i < 2; i++) {
    const c = await mkCommission({
      agentId: fabrice._id,
      coreCustomerId: `CUST-FAB-${i}`,
      amount: 25000,
      daysAgo: 20 + i,
      status: 'APPROVED',
    });
    fabComms.push(c);
  }
  const totalFab = fabComms.reduce((s, c) => s + c.netAmount.amount, 0);
  const batchFab = await PayoutBatch.create({
    agentId: fabrice._id,
    period: currentPeriod,
    commissionIds: fabComms.map((c) => c._id),
    totalAmount: { amount: totalFab, currency: 'XAF' },
    status: 'FAILED',
    method: 'MOBILE_MONEY',
    createdBy: adminId,
    approvedBy: adminId,
    approvedAt: daysAgo(2),
    failedAt: daysAgo(1),
    failureReason: 'MoMo timeout, the transfer did not complete',
  });
  manifest.payoutBatches.push(String(batchFab._id));

  // Awa — paid batch
  const totalAwaPaid = awaPaid.reduce((s, c) => s + c.netAmount.amount, 0);
  const batchAwa = await PayoutBatch.create({
    agentId: awa._id,
    period: currentPeriod,
    commissionIds: awaPaid.map((c) => c._id),
    totalAmount: { amount: totalAwaPaid, currency: 'XAF' },
    status: 'PAID',
    method: 'MOBILE_MONEY',
    createdBy: adminId,
    approvedBy: adminId,
    approvedAt: daysAgo(7),
    paidBy: adminId,
    paidAt: dateInMonthsAgo(0, 5),
    paymentReference: '8841207731',
  });
  manifest.payoutBatches.push(String(batchAwa._id));
  await Commission.updateMany(
    { _id: { $in: awaPaid.map((c) => c._id) } },
    { $set: { payoutBatchId: batchAwa._id } },
  );

  // Remaining agents (Paul, Solange, JB, Marceline, Robert) — light data
  for (let i = 5; i < agents.length; i++) {
    const a = agents[i]!;
    await mkCommission({
      agentId: a._id,
      coreCustomerId: `CUST-${a.referralCode}-1`,
      amount: 20000,
      daysAgo: 5,
      status: 'APPROVED',
    });
    await mkCommission({
      agentId: a._id,
      coreCustomerId: `CUST-${a.referralCode}-2`,
      amount: 15000,
      daysAgo: 3,
      status: 'PENDING',
    });
  }
}

async function seedPerformanceEvents(
  adminId: import('mongoose').Types.ObjectId,
  agents: Awaited<ReturnType<typeof Agent.findOne>>[],
  manifest: SeedManifest,
) {
  for (const agent of agents) {
    for (let m = 5; m >= 0; m--) {
      for (let d = 1; d <= 5; d++) {
        const day = new Date();
        day.setMonth(day.getMonth() - m);
        day.setDate(10 + d * 3);
        const dKey = dayKeyFromDate(day);
        const dateObj = new Date(`${dKey}T12:00:00Z`);
        const evt = await PerformanceEvent.create({
          agentId: agent._id,
          dayKey: dKey,
          date: dateObj,
          leadsGenerated: Math.floor(Math.random() * 5) + 1,
          dealsClosed: Math.floor(Math.random() * 2),
          propertiesReferred: Math.floor(Math.random() * 3),
          landlordsOnboarded: 0,
          tenantsOnboarded: Math.floor(Math.random() * 2),
          revenueAttributed: { amount: Math.floor(Math.random() * 100000), currency: 'XAF' },
          createdBy: adminId,
        });
        manifest.performanceEvents.push(String(evt._id));
      }
    }
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
