/**
 * Request and response types for the /identify endpoint.
 */

/** Request body - at least one of email or phoneNumber must be present */
export interface IdentifyRequest {
  email?: string | null;
  phoneNumber?: string | number | null;
}

/** Response contact object as per spec (primaryContatctId is spec typo) */
export interface IdentifyResponse {
  contact: {
    primaryContatctId: number;
    emails: string[];
    phoneNumbers: string[];
    secondaryContactIds: number[];
  };
}
