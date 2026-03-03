/**
 * Unit tests for reconcileIdentity — mocks Prisma transaction and repository.
 */
import { reconcileIdentity } from '../index';
import * as repo from '../repository';
import type { Contact } from '@prisma/client';
import { LinkPrecedence } from '@prisma/client';

jest.mock('../../../prisma/client', () => ({
  prisma: {
    $transaction: jest.fn(),
  },
}));

jest.mock('../repository');

const { prisma } = require('../../../prisma/client');

function mockTx() {
  const tx = {} as any;
  (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (t: typeof tx) => Promise<any>) =>
    fn(tx)
  );
  return tx;
}

describe('reconcileIdentity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws ValidationError when both email and phone are empty', async () => {
    await expect(reconcileIdentity(null, null)).rejects.toThrow(
      'At least one of email or phoneNumber must be provided'
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('creates primary when no matches (Case 1)', async () => {
    mockTx();
    (repo.findMatchingContacts as jest.Mock).mockResolvedValue([]);
    const primary: Contact = {
      id: 1,
      email: 'a@x.com',
      phoneNumber: '+1',
      linkedId: null,
      linkPrecedence: LinkPrecedence.primary,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    (repo.createPrimaryContact as jest.Mock).mockResolvedValue(primary);

    const result = await reconcileIdentity('a@x.com', '+1');

    expect(repo.findMatchingContacts).toHaveBeenCalled();
    expect(repo.createPrimaryContact).toHaveBeenCalled();
    expect(result.contact.primaryContatctId).toBe(1);
    expect(result.contact.emails).toContain('a@x.com');
    expect(result.contact.phoneNumbers).toContain('+1');
    expect(result.contact.secondaryContactIds).toEqual([]);
  });

  it('returns existing chain when no new info (Case 2 - duplicate request)', async () => {
    mockTx();
    const primary: Contact = {
      id: 1,
      email: 'a@x.com',
      phoneNumber: '+1',
      linkedId: null,
      linkPrecedence: LinkPrecedence.primary,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    (repo.findMatchingContacts as jest.Mock).mockResolvedValue([primary]);
    (repo.resolvePrimaryId as jest.Mock).mockResolvedValue(1);
    (repo.findAllLinkedToPrimary as jest.Mock).mockResolvedValue([primary]);

    const result = await reconcileIdentity('a@x.com', '+1');

    expect(repo.createSecondaryContact).not.toHaveBeenCalled();
    expect(result.contact.primaryContatctId).toBe(1);
    expect(result.contact.emails).toEqual(['a@x.com']);
  });

  it('creates secondary when new info present (Case 2)', async () => {
    mockTx();
    const primary: Contact = {
      id: 1,
      email: 'a@x.com',
      phoneNumber: null,
      linkedId: null,
      linkPrecedence: LinkPrecedence.primary,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    const secondary: Contact = {
      id: 2,
      email: 'a@x.com',
      phoneNumber: '+1',
      linkedId: 1,
      linkPrecedence: LinkPrecedence.secondary,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    (repo.findMatchingContacts as jest.Mock).mockResolvedValue([primary]);
    (repo.resolvePrimaryId as jest.Mock).mockResolvedValue(1);
    (repo.findAllLinkedToPrimary as jest.Mock)
      .mockResolvedValueOnce([primary])
      .mockResolvedValueOnce([primary, secondary]);
    (repo.createSecondaryContact as jest.Mock).mockResolvedValue(secondary);

    const result = await reconcileIdentity('a@x.com', '+1');

    expect(repo.createSecondaryContact).toHaveBeenCalledWith(
      expect.anything(),
      1,
      'a@x.com',
      '+1'
    );
    expect(result.contact.primaryContatctId).toBe(1);
    expect(result.contact.phoneNumbers).toContain('+1');
    expect(result.contact.secondaryContactIds).toContain(2);
  });

  it('merges multiple primaries, oldest stays primary (Case 3)', async () => {
    mockTx();
    const older: Contact = {
      id: 1,
      email: 'old@x.com',
      phoneNumber: null,
      linkedId: null,
      linkPrecedence: LinkPrecedence.primary,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date(),
      deletedAt: null,
    };
    const newer: Contact = {
      id: 2,
      email: null,
      phoneNumber: '+1',
      linkedId: null,
      linkPrecedence: LinkPrecedence.primary,
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date(),
      deletedAt: null,
    };
    (repo.findMatchingContacts as jest.Mock).mockResolvedValue([older, newer]);
    (repo.resolvePrimaryId as jest.Mock).mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    (repo.findOldestPrimary as jest.Mock).mockResolvedValue(older);
    (repo.findAllLinkedToPrimary as jest.Mock).mockResolvedValue([older, newer]);

    const result = await reconcileIdentity('old@x.com', '+1');

    expect(repo.demotePrimariesToSecondary).toHaveBeenCalledWith(
      expect.anything(),
      1,
      [2]
    );
    expect(result.contact.primaryContatctId).toBe(1);
    expect(result.contact.emails).toContain('old@x.com');
    expect(result.contact.phoneNumbers).toContain('+1');
  });
});
