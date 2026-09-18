import { describe, it, expect } from 'vitest';
import {
  assertIdentifier, quoteIdent, assertUserSchema, assertPostgresType,
  generateKey, keyRole, hashKey, maskKey, safeEqual,
  StratumError, err, toErrorResponse,
} from '../src/index.js';

describe('identifiers', () => {
  it('accepts valid identifiers', () => {
    expect(assertIdentifier('users')).toBe('users');
    expect(quoteIdent('created_at')).toBe('"created_at"');
  });

  it('rejects SQL injection attempts', () => {
    for (const bad of ['users; DROP TABLE x', 'users"', "u'; --", '1users', '', 'a'.repeat(64)]) {
      expect(() => assertIdentifier(bad)).toThrow(StratumError);
    }
  });

  it('refuses system schemas', () => {
    expect(() => assertUserSchema('pg_catalog')).toThrow(/managed by the system/);
    expect(() => assertUserSchema('information_schema')).toThrow();
    expect(() => assertUserSchema('stratum')).toThrow();
    expect(assertUserSchema('public')).toBe('public');
  });
});

describe('postgres types', () => {
  it('allows known types and parameterised types', () => {
    expect(assertPostgresType('TEXT')).toBe('text');
    expect(assertPostgresType('varchar(255)')).toBe('varchar(255)');
    expect(assertPostgresType('numeric(10,2)')).toBe('numeric(10,2)');
    expect(assertPostgresType('text[]')).toBe('text[]');
  });

  it('rejects arbitrary strings', () => {
    expect(() => assertPostgresType('text; DROP TABLE users')).toThrow();
    expect(() => assertPostgresType('nonexistent_type')).toThrow();
  });
});

describe('api keys', () => {
  it('generates prefixed keys with the right role', () => {
    const pub = generateKey('public');
    const sec = generateKey('secret');
    expect(pub.startsWith('strat_public_')).toBe(true);
    expect(sec.startsWith('strat_secret_')).toBe(true);
    expect(keyRole(pub)).toBe('public');
    expect(keyRole(sec)).toBe('secret');
    expect(keyRole('garbage')).toBeNull();
  });

  it('hashes deterministically and never returns the raw key', () => {
    const k = generateKey('secret');
    expect(hashKey(k)).toBe(hashKey(k));
    expect(hashKey(k)).not.toContain(k);
    expect(hashKey(k)).toHaveLength(64);
  });

  it('masks keys for display', () => {
    const k = generateKey('public');
    const masked = maskKey(k);
    expect(masked.startsWith('strat_public_')).toBe(true);
    expect(masked).toContain('…');
    expect(masked.length).toBeLessThan(k.length);
  });

  it('compares in constant time without throwing on length mismatch', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('errors', () => {
  it('maps codes to statuses', () => {
    expect(err('TABLE_NOT_FOUND', 'x').status).toBe(404);
    expect(err('RATE_LIMITED', 'x').status).toBe(429);
  });

  it('hides internal detail in production', () => {
    const res = toErrorResponse(new Error('connection string postgres://user:pw@host'), true);
    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('An internal error occurred.');
    expect(JSON.stringify(res.body)).not.toContain('pw@host');
  });

  it('keeps client errors intact in production', () => {
    const res = toErrorResponse(err('TABLE_NOT_FOUND', 'The requested table does not exist.'), true);
    expect(res.body.error.code).toBe('TABLE_NOT_FOUND');
    expect(res.body.error.message).toBe('The requested table does not exist.');
  });
});
