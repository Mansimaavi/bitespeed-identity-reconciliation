/**
 * Domain types for identity reconciliation.
 * Keeps service layer independent of HTTP and persistence details.
 */

/** Normalized identity: trimmed, empty string treated as null */
export interface NormalizedIdentity {
  email: string | null;
  phoneNumber: string | null;
}

/** Validation result for incoming identify request */
export interface IdentityValidation {
  valid: boolean;
  error?: string;
  identity?: NormalizedIdentity;
}
