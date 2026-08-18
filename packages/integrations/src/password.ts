/**
 * Password hashing.
 *
 * docs/AUTH_PAYMENTS.md requires Argon2id or a library-recommended strong
 * hash. `@node-rs/argon2` ships prebuilt binaries (no node-gyp on Windows)
 * and its defaults follow current OWASP guidance (m=19456 KiB, t=2, p=1).
 * The PHC-format string is stored in `users.password_hash`, so parameters
 * can be raised later without invalidating existing hashes.
 */

import { hash, verify } from "@node-rs/argon2";

export async function hashPassword(password: string): Promise<string> {
  return hash(password);
}

/**
 * Constant-time verification. Returns false instead of throwing on a
 * missing hash so login flows cannot distinguish "no password set" from
 * "wrong password" by error type.
 */
export async function verifyPassword(
  password: string,
  passwordHash: string | null,
): Promise<boolean> {
  if (passwordHash === null) return false;
  try {
    return await verify(passwordHash, password);
  } catch {
    // Malformed/stored-non-Argon2 hash: treat as a failed login, never crash.
    return false;
  }
}
