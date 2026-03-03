/**
 * Contact repository: all DB access for identity reconciliation.
 * Every function accepts a Prisma transaction client so the full flow can run in one transaction.
 */
import type { PrismaClient } from '@prisma/client';
import { Contact, LinkPrecedence } from '@prisma/client';

/** Transaction client type (same shape as PrismaClient for model access) */
export type Tx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/** Fetch all non-deleted contacts matching email or phone, ordered by createdAt */
export async function findMatchingContacts(
  tx: Tx,
  email: string | null,
  phoneNumber: string | null
): Promise<Contact[]> {
  if (!email && !phoneNumber) return [];
  const or: Array<{ email?: string; phoneNumber?: string }> = [];
  if (email) or.push({ email });
  if (phoneNumber) or.push({ phoneNumber });

  return tx.contact.findMany({
    where: { OR: or, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Resolve the primary contact ID by following linkedId.
 * Handles orphaned secondaries (missing linked): treat self as primary.
 */
export async function resolvePrimaryId(tx: Tx, contact: Contact): Promise<number> {
  if (contact.linkPrecedence === LinkPrecedence.primary) return contact.id;
  if (contact.linkedId == null) return contact.id;

  const linked = await tx.contact.findUnique({
    where: { id: contact.linkedId, deletedAt: null },
  });
  if (!linked) return contact.id; // edge case: linked deleted/orphaned
  return resolvePrimaryId(tx, linked);
}

/**
 * All contacts linked to this primary: primary + every contact with linkedId = primaryId.
 * Sorted by createdAt (oldest first).
 */
export async function findAllLinkedToPrimary(tx: Tx, primaryId: number): Promise<Contact[]> {
  const primary = await tx.contact.findFirst({
    where: { id: primaryId, deletedAt: null },
  });
  if (!primary) return [];

  const secondaries = await tx.contact.findMany({
    where: { linkedId: primaryId, deletedAt: null },
  });

  const all = [primary, ...secondaries];
  return all.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

/**
 * Among the given primary IDs, return the contact with the earliest createdAt.
 * Returns null if list is empty or none found (edge case: all deleted).
 */
export async function findOldestPrimary(
  tx: Tx,
  primaryIds: number[]
): Promise<Contact | null> {
  if (primaryIds.length === 0) return null;
  const list = await tx.contact.findMany({
    where: { id: { in: primaryIds }, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });
  return list[0] ?? null;
}

/** Create a new primary contact (Case 1). */
export async function createPrimaryContact(
  tx: Tx,
  email: string | null,
  phoneNumber: string | null
): Promise<Contact> {
  return tx.contact.create({
    data: {
      email,
      phoneNumber,
      linkPrecedence: LinkPrecedence.primary,
    },
  });
}

/** Create a secondary contact linked to the given primary (Case 2). */
export async function createSecondaryContact(
  tx: Tx,
  primaryId: number,
  email: string | null,
  phoneNumber: string | null
): Promise<Contact> {
  return tx.contact.create({
    data: {
      email,
      phoneNumber,
      linkedId: primaryId,
      linkPrecedence: LinkPrecedence.secondary,
    },
  });
}

/**
 * Demote the given primaries to secondary and point them (and their secondaries) to canonical primary.
 * Keeps the graph consistent in one transaction.
 */
export async function demotePrimariesToSecondary(
  tx: Tx,
  canonicalPrimaryId: number,
  formerPrimaryIds: number[]
): Promise<void> {
  for (const id of formerPrimaryIds) {
    await tx.contact.update({
      where: { id },
      data: {
        linkPrecedence: LinkPrecedence.secondary,
        linkedId: canonicalPrimaryId,
      },
    });
    await tx.contact.updateMany({
      where: { linkedId: id },
      data: { linkedId: canonicalPrimaryId },
    });
  }
}
