import { BadRequestError } from '@/lib/errors/app-error';
import { EMAIL_RE } from './regex';

export type LoginBody = {
  email: string;
  password: string;
  rememberMe?: boolean;
};

/**
 * Validates a login request body.
 * Throws BadRequestError with a generic message — the route's catch maps
 * every auth failure to the same "Invalid credentials" response.
 */
export function parseLoginBody(input: unknown): LoginBody {
  if (typeof input !== 'object' || input === null) {
    throw new BadRequestError('Invalid credentials');
  }
  const { email, password, rememberMe } = input as {
    email?: unknown;
    password?: unknown;
    rememberMe?: unknown;
  };
  if (typeof email !== 'string' || typeof password !== 'string') {
    throw new BadRequestError('Invalid credentials');
  }
  const trimmedEmail = email.trim().toLowerCase();
  if (!EMAIL_RE.test(trimmedEmail)) {
    throw new BadRequestError('Invalid credentials');
  }
  if (password.length === 0) {
    throw new BadRequestError('Invalid credentials');
  }
  let parsedRemember: boolean | undefined;
  if (rememberMe !== undefined) {
    if (typeof rememberMe !== 'boolean') {
      throw new BadRequestError('Invalid credentials');
    }
    parsedRemember = rememberMe;
  }
  return { email: trimmedEmail, password, rememberMe: parsedRemember };
}

/**
 * Reads and validates a JSON body. Any parse error becomes the same
 * generic failure, so malformed JSON does not distinguish itself.
 */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new BadRequestError('Invalid credentials');
  }
}
