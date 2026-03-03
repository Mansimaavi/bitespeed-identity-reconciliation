/**
 * Unit tests for identity domain logic (pure functions).
 */
import {
  normalizeAndValidate,
  hasExactMatch,
  hasNewInfo,
  buildIdentifyResponse,
} from '../domain';
import type { Contact } from '@prisma/client';

describe('normalizeAndValidate', () => {
  it('accepts valid email only', () => {
    const result = normalizeAndValidate('user@example.com', null);
    expect(result.valid).toBe(true);
    expect(result.identity).toEqual({ email: 'user@example.com', phoneNumber: null });
  });

  it('accepts valid phone only', () => {
    const result = normalizeAndValidate(null, '+1234567890');
    expect(result.valid).toBe(true);
    expect(result.identity).toEqual({ email: null, phoneNumber: '+1234567890' });
  });

  it('accepts both email and phone', () => {
    const result = normalizeAndValidate('a@b.com', '+1');
    expect(result.valid).toBe(true);
    expect(result.identity).toEqual({ email: 'a@b.com', phoneNumber: '+1' });
  });

  it('trims whitespace', () => {
    const result = normalizeAndValidate('  a@b.com  ', '  555  ');
    expect(result.valid).toBe(true);
    expect(result.identity).toEqual({ email: 'a@b.com', phoneNumber: '555' });
  });

  it('rejects when both are empty', () => {
    expect(normalizeAndValidate(null, null).valid).toBe(false);
    expect(normalizeAndValidate('', '').valid).toBe(false);
    expect(normalizeAndValidate('   ', '   ').valid).toBe(false);
  });

  it('rejects oversized email', () => {
    const result = normalizeAndValidate('a'.repeat(501), null);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('at most 500');
  });

  it('rejects oversized phone', () => {
    const result = normalizeAndValidate(null, '1'.repeat(51));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('at most 50');
  });
});

describe('hasExactMatch', () => {
  const contacts: Contact[] = [
    { id: 1, email: 'a@x.com', phoneNumber: null, linkedId: null, linkPrecedence: 'primary', createdAt: new Date(), updatedAt: new Date(), deletedAt: null },
    { id: 2, email: null, phoneNumber: '+1', linkedId: 1, linkPrecedence: 'secondary', createdAt: new Date(), updatedAt: new Date(), deletedAt: null },
  ];

  it('returns true when exact match exists', () => {
    expect(hasExactMatch(contacts, 'a@x.com', null)).toBe(true);
    expect(hasExactMatch(contacts, null, '+1')).toBe(true);
  });

  it('returns false when no exact (email, phone) pair', () => {
    expect(hasExactMatch(contacts, 'a@x.com', '+1')).toBe(false);
    expect(hasExactMatch(contacts, 'b@x.com', null)).toBe(false);
  });
});

describe('hasNewInfo', () => {
  const identity = { email: 'new@x.com' as string | null, phoneNumber: '+99' as string | null };
  const contacts: Contact[] = [
    { id: 1, email: 'a@x.com', phoneNumber: '+1', linkedId: null, linkPrecedence: 'primary', createdAt: new Date(), updatedAt: new Date(), deletedAt: null },
  ];

  it('returns true when email is new', () => {
    expect(hasNewInfo(contacts, { ...identity, email: 'new@x.com', phoneNumber: null })).toBe(true);
  });

  it('returns true when phone is new', () => {
    expect(hasNewInfo(contacts, { ...identity, email: null, phoneNumber: '+99' })).toBe(true);
  });

  it('returns false when both already in chain', () => {
    expect(hasNewInfo(contacts, { email: 'a@x.com', phoneNumber: '+1' })).toBe(false);
  });
});

describe('buildIdentifyResponse', () => {
  const primary: Contact = {
    id: 1,
    email: 'primary@x.com',
    phoneNumber: '+1',
    linkedId: null,
    linkPrecedence: 'primary',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
  const secondary: Contact = {
    id: 2,
    email: 'sec@x.com',
    phoneNumber: '+2',
    linkedId: 1,
    linkPrecedence: 'secondary',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  it('puts primary email/phone first and deduplicates', () => {
    const result = buildIdentifyResponse([primary, secondary], 1);
    expect(result.contact.primaryContatctId).toBe(1);
    expect(result.contact.emails).toEqual(['primary@x.com', 'sec@x.com']);
    expect(result.contact.phoneNumbers).toEqual(['+1', '+2']);
    expect(result.contact.secondaryContactIds).toEqual([2]);
  });

  it('deduplicates emails and phones from secondaries', () => {
    const dup: Contact = {
      ...secondary,
      id: 3,
      email: 'primary@x.com',
      phoneNumber: '+2',
    };
    const result = buildIdentifyResponse([primary, secondary, dup], 1);
    expect(result.contact.emails).toEqual(['primary@x.com', 'sec@x.com']);
    expect(result.contact.phoneNumbers).toEqual(['+1', '+2']);
    expect(result.contact.secondaryContactIds).toHaveLength(2);
  });
});
