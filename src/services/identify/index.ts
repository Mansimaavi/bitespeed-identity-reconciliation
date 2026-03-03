/**
 * Identity Reconciliation Service — orchestration and transaction boundary.
 *
 * Runs the entire reconciliation in a single Prisma transaction so that:
 * - No concurrent request can see a half-updated state.
 * - All reads and writes are consistent (repeatable read within the tx).
 *
 * Cases:
 * 1. No matching contact → create PRIMARY.
 * 2. One primary chain + new info + no duplicate row → create SECONDARY.
 * 3. Multiple primary chains (e.g. email in A, phone in B) → merge (oldest stays PRIMARY).
 */
import { prisma } from '../../prisma/client';
import type { IdentifyResponse } from '../../types/identify';
import { ValidationError } from '../../utils/errors';
import {
  normalizeAndValidate,
  hasNewInfo,
  hasExactMatch,
  buildIdentifyResponse,
} from './domain';
import * as repo from './repository';

export async function reconcileIdentity(
  email?: string | null,
  phoneNumber?: string | null
): Promise<IdentifyResponse> {
  const validation = normalizeAndValidate(email, phoneNumber);
  if (!validation.valid || !validation.identity) {
    throw new ValidationError(validation.error ?? 'Invalid identity input');
  }
  const identity = validation.identity;

  return prisma.$transaction(async (tx) => {
    const matches = await repo.findMatchingContacts(
      tx,
      identity.email,
      identity.phoneNumber
    );

    // --- CASE 1: No existing contact ---
    if (matches.length === 0) {
      const primary = await repo.createPrimaryContact(
        tx,
        identity.email,
        identity.phoneNumber
      );
      return buildIdentifyResponse([primary], primary.id);
    }

    const primaryIds = await Promise.all(
      matches.map((m) => repo.resolvePrimaryId(tx, m))
    );
    const uniquePrimaryIds = [...new Set(primaryIds)];

    // --- CASE 3: Multiple primaries → merge ---
    if (uniquePrimaryIds.length > 1) {
      const oldest = await repo.findOldestPrimary(tx, uniquePrimaryIds);
      if (!oldest) {
        // Edge case: all primaries deleted between match and merge (race)
        throw new Error('Could not resolve oldest primary during merge');
      }
      const others = uniquePrimaryIds.filter((id) => id !== oldest.id);
      if (others.length > 0) {
        await repo.demotePrimariesToSecondary(tx, oldest.id, others);
      }
      const allLinked = await repo.findAllLinkedToPrimary(tx, oldest.id);
      return buildIdentifyResponse(allLinked, oldest.id);
    }

    // --- Single primary chain ---
    const primaryId = uniquePrimaryIds[0];
    const allLinked = await repo.findAllLinkedToPrimary(tx, primaryId);

    const shouldCreateSecondary =
      hasNewInfo(allLinked, identity) && !hasExactMatch(allLinked, identity.email, identity.phoneNumber);

    if (shouldCreateSecondary) {
      await repo.createSecondaryContact(
        tx,
        primaryId,
        identity.email,
        identity.phoneNumber
      );
      const updated = await repo.findAllLinkedToPrimary(tx, primaryId);
      return buildIdentifyResponse(updated, primaryId);
    }

    return buildIdentifyResponse(allLinked, primaryId);
  });
}
