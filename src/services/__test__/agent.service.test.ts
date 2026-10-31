import { describe, it, expect, beforeAll } from 'vitest';
import { Types } from 'mongoose';
import { connectDb } from '@/lib/db/mongoose';
import { assertNoUnpaidCommissions } from '../agent.service';

const hasTestDb = Boolean(process.env.MONGODB_URI_TEST);

describe.skipIf(!hasTestDb)('assertNoUnpaidCommissions', () => {
  beforeAll(async () => {
    await connectDb();
  });

  it('resolves when the agent has no unpaid commissions', async () => {
    await expect(assertNoUnpaidCommissions(new Types.ObjectId())).resolves.toBeUndefined();
  });
});
