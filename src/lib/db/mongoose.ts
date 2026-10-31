import mongoose, { type Mongoose } from 'mongoose';

declare global {
  // eslint-disable-next-line no-var
  var __mongoose: { conn: Mongoose | null; promise: Promise<Mongoose> | null } | undefined;
}

const cached = global.__mongoose ?? (global.__mongoose = { conn: null, promise: null });

function mongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }
  return uri;
}

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.MONGODB_URI_TEST);

/**
 * Connects or returns the cached connection. Idempotent.
 *
 * IMPORTANT: The cached connection can die (idle timeout, Atlas failover,
 * network drop). If the cached connection exists but is not in the
 * `connected` state, we discard it and reconnect. Without this, a
 * long-running process (or a long test suite) would hand out a dead
 * connection and every subsequent operation would fail.
 *
 * Do NOT call this from React components or layouts — call it from route
 * handlers, services, or instrumentation.ts.
 */
export async function connectDb(): Promise<Mongoose> {
  // Live connection — reuse it.
  if (cached.conn && cached.conn.connection.readyState === 1) {
    return cached.conn;
  }

  // Cached but not connected — stale. Drop it and reconnect.
  if (cached.conn || cached.promise) {
    try {
      if (cached.conn) await cached.conn.disconnect();
    } catch {
      // Ignore: we're already replacing it.
    }
    cached.conn = null;
    cached.promise = null;
  }

  cached.promise = mongoose.connect(mongoUri(), {
    maxPoolSize: isTest ? 3 : 10,
    serverSelectionTimeoutMS: isTest ? 15000 : 5000,
    autoIndex: !isProduction,
  });

  cached.conn = await cached.promise;
  return cached.conn;
}

export function isDbConnected(): boolean {
  return cached.conn !== null && mongoose.connection.readyState === 1;
}

export async function disconnectDb(): Promise<void> {
  if (cached.conn) {
    await cached.conn.disconnect();
  }
  cached.conn = null;
  cached.promise = null;
}
