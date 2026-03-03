/**
 * Pure domain logic for identity reconciliation.
 * No I/O; safe to use inside transactions for decisions and response building.
 *
 * Edge cases handled:
 * - Empty or whitespace-only input → treated as null; at least one required.
 * - Oversized email/phone → rejected to avoid abuse and DB issues.
 */
import type { Contact } from '@prisma/client';
import type { IdentifyResponse } from '../../types/identify';
import type { NormalizedIdentity, IdentityValidation } from './types';

const MAX_EMAIL_LENGTH = 500;
const MAX_PHONE_LENGTH = 50;

/**
 * Normalize and validate request input.
 * - Trims whitespace; empty string becomes null.
 * - At least one of email or phoneNumber must be present and non-empty after trim.
 * - Enforces max lengths to avoid abuse and DB issues.
 */
export function normalizeAndValidate(
  email?: string | null,
  phoneNumber?: string | null
): IdentityValidation {
  const e = typeof email === 'string' ? email.trim() : null;
  const p = typeof phoneNumber === 'string' ? phoneNumber.trim() : null;
  const identity: NormalizedIdentity = {
    email: e && e.length > 0 ? e : null,
    phoneNumber: p && p.length > 0 ? p : null,
  };

  if (!identity.email && !identity.phoneNumber) {
    return { valid: false, error: 'At least one of email or phoneNumber must be provided' };
  }
  if (identity.email != null && identity.email.length > MAX_EMAIL_LENGTH) {
    return { valid: false, error: `Email must be at most ${MAX_EMAIL_LENGTH} characters` };
  }
  if (identity.phoneNumber != null && identity.phoneNumber.length > MAX_PHONE_LENGTH) {
    return { valid: false, error: `Phone number must be at most ${MAX_PHONE_LENGTH} characters` };
  }

  return { valid: true, identity };
}

/** True if the chain has at least one contact with this exact (email, phoneNumber) pair */
export function hasExactMatch(
  contacts: Contact[],
  email: string | null,
  phoneNumber: string | null
): boolean {
  return contacts.some(
    (c) => (c.email ?? null) === email && (c.phoneNumber ?? null) === phoneNumber
  );
}

/** True if the request brings new email or phone not already present in the chain */
export function hasNewInfo(
  contacts: Contact[],
  identity: NormalizedIdentity
): boolean {
  const emails = new Set(
    contacts.map((c) => c.email).filter((v): v is string => v != null && v !== '')
  );
  const phones = new Set(
    contacts
      .map((c) => c.phoneNumber)
      .filter((v): v is string => v != null && v !== '')
  );
  if (
    identity.email != null &&
    identity.email !== '' &&
    !emails.has(identity.email)
  )
    return true;
  if (
    identity.phoneNumber != null &&
    identity.phoneNumber !== '' &&
    !phones.has(identity.phoneNumber)
  )
    return true;
  return false;
}

/**
 * Build API response from linked contacts and canonical primary id.
 * Primary's email/phone first; then secondaries; deduplicated.
 */
export function buildIdentifyResponse(
  contacts: Contact[],
  primaryId: number
): IdentifyResponse {
  const primary = contacts.find((c) => c.id === primaryId) ?? contacts[0];
  const secondaries = contacts.filter((c) => c.id !== primaryId);

  const emails: string[] = [];
  const phoneNumbers: string[] = [];

  if (primary.email) emails.push(primary.email);
  if (primary.phoneNumber) phoneNumbers.push(primary.phoneNumber);

  for (const c of secondaries) {
    if (c.email && !emails.includes(c.email)) emails.push(c.email);
    if (c.phoneNumber && !phoneNumbers.includes(c.phoneNumber))
      phoneNumbers.push(c.phoneNumber);
  }

  return {
    contact: {
      primaryContatctId: primaryId,
      emails,
      phoneNumbers,
      secondaryContactIds: secondaries.map((c) => c.id),
    },
  };
}
