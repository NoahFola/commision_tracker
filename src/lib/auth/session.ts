import { randomBytes } from 'node:crypto';
import { Types } from 'mongoose';
import { connectDb } from '@/lib/db/mongoose';
import { Session, type SessionDoc, type SessionSubjectType } from '@/models/session.model';

export const SESSION_COOKIE_NAME = 'epsihome_session';

/** Sliding idle TTL for a default session. */
export const SESSION_IDLE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
/** Absolute TTL for a default session. */
export const SESSION_ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Sliding idle TTL when the caller opts into "remember me". */
export const SESSION_IDLE_REMEMBERED_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
/** Absolute TTL when the caller opts into "remember me". */
export const SESSION_ABSOLUTE_REMEMBERED_MS = 180 * 24 * 60 * 60 * 1000; // 180 days

export type SessionSubject = {
  type: SessionSubjectType;
  id: Types.ObjectId;
};

/**
 * Creates a new session row and returns the cookie value (the session _id).
 * The caller sets the cookie; this function does not touch headers.
 *
 * Callers should pass a hashed user-agent if they want UA binding; the hash
 * is stored, never the raw UA. Pass `undefined` to skip.
 */
export type CreateSessionOptions = {
  userAgentHash?: string;
  rememberMe?: boolean;
};

export async function createSession(
  subject: SessionSubject,
  options: CreateSessionOptions = {},
): Promise<{ sessionId: string; expiresAt: Date }> {
  await connectDb();

  const now = new Date();
  const idleMs = options.rememberMe ? SESSION_IDLE_REMEMBERED_MS : SESSION_IDLE_MS;
  const absoluteMs = options.rememberMe ? SESSION_ABSOLUTE_REMEMBERED_MS : SESSION_ABSOLUTE_MS;
  const expiresAt = new Date(now.getTime() + absoluteMs);
  const idleExpiresAt = new Date(now.getTime() + idleMs);

  const sessionId = randomBytes(32).toString('base64url');

  await Session.create({
    _id: sessionId,
    subjectType: subject.type,
    subjectId: subject.id,
    expiresAt,
    idleExpiresAt,
    lastSeenAt: now,
    userAgentHash: options.userAgentHash,
  });

  return { sessionId, expiresAt };
}

/**
 * Looks up a session by its cookie value.
 * Returns null for: unknown ID, idle-expired, absolutely-expired.
 * Refreshes the sliding window on success.
 */
export async function readSession(sessionId: string): Promise<SessionDoc | null> {
  if (!sessionId || typeof sessionId !== 'string') return null;

  await connectDb();

  const session = await Session.findById(sessionId).lean<SessionDoc>();
  if (!session) return null;

  const now = new Date();
  if (session.expiresAt.getTime() <= now.getTime()) {
    // Absolute expiry — delete it so it can't be resurrected.
    await Session.deleteOne({ _id: sessionId }).catch(() => undefined);
    return null;
  }
  if (session.idleExpiresAt.getTime() <= now.getTime()) {
    await Session.deleteOne({ _id: sessionId }).catch(() => undefined);
    return null;
  }

  // Refresh sliding window.
  const nextIdle = new Date(now.getTime() + SESSION_IDLE_MS);
  await Session.updateOne(
    { _id: sessionId },
    { $set: { lastSeenAt: now, idleExpiresAt: nextIdle } },
  ).catch(() => undefined);

  return session;
}

/**
 * Explicitly extends the sliding window. Not needed after readSession
 * (it already refreshes), but useful for a dedicated "/api/auth/refresh".
 */
export async function refreshSession(sessionId: string): Promise<boolean> {
  await connectDb();
  const now = new Date();
  const result = await Session.updateOne(
    {
      _id: sessionId,
      expiresAt: { $gt: now },
      idleExpiresAt: { $gt: now },
    },
    { $set: { lastSeenAt: now, idleExpiresAt: new Date(now.getTime() + SESSION_IDLE_MS) } },
  );
  return result.modifiedCount === 1;
}

/** Deletes one session. Idempotent. */
export async function revokeSession(sessionId: string): Promise<void> {
  await connectDb();
  await Session.deleteOne({ _id: sessionId });
}

/**
 * Deletes every session for a subject. Use on suspend, password change,
 * admin action, or any event that should log the subject out everywhere.
 * Idempotent.
 */
export async function revokeAllSessionsFor(
  subjectType: SessionSubjectType,
  subjectId: Types.ObjectId,
): Promise<number> {
  await connectDb();
  const result = await Session.deleteMany({ subjectType, subjectId });
  return result.deletedCount ?? 0;
}

/**
 * Builds the Set-Cookie header value for a session.
 * Kept here — not in routes — so cookie attributes are consistent everywhere.
 */
export function buildSessionCookie(sessionId: string, expiresAt: Date, remember = false): string {
  const attrs = [
    `${SESSION_COOKIE_NAME}=${sessionId}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Expires=${expiresAt.toUTCString()}`,
  ];
  if (remember) {
    // Max-Age is authoritative; browsers use it over Expires. Setting
    // it persists the cookie across browser restarts.
    const seconds = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
    attrs.push(`Max-Age=${seconds}`);
  }
  if (process.env.NODE_ENV === 'production') {
    attrs.push('Secure');
  }
  return attrs.join('; ');
}

/** Builds the Set-Cookie header value that clears the session cookie. */
export function buildClearSessionCookie(): string {
  const attrs = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ];
  if (process.env.NODE_ENV === 'production') {
    attrs.push('Secure');
  }
  return attrs.join('; ');
}

/** Reads the session cookie value from a raw Cookie header, or null. */
export function readSessionCookieFromHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE_NAME) {
      const value = rest.join('=');
      return value.length > 0 ? value : null;
    }
  }
  return null;
}
