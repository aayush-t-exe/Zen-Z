import { describe, expect, it } from 'vitest';
import { isAuthorized, isValidReviewPassword } from './logic';

describe('isAuthorized', () => {
  it('rejects when no secret is configured', () => {
    expect(isAuthorized('anything', undefined)).toBe(false);
  });

  it('rejects a missing provided secret', () => {
    expect(isAuthorized(null, 'expected')).toBe(false);
  });

  it('rejects a wrong provided secret', () => {
    expect(isAuthorized('wrong', 'expected')).toBe(false);
  });

  it('accepts a matching secret', () => {
    expect(isAuthorized('expected', 'expected')).toBe(true);
  });
});

describe('isValidReviewPassword', () => {
  it('rejects null', () => {
    expect(isValidReviewPassword(null)).toBe(false);
  });

  it('rejects non-numeric strings', () => {
    expect(isValidReviewPassword('abcdef')).toBe(false);
  });

  it('rejects the wrong length', () => {
    expect(isValidReviewPassword('12345')).toBe(false);
    expect(isValidReviewPassword('1234567')).toBe(false);
  });

  it('accepts exactly 6 digits', () => {
    expect(isValidReviewPassword('482913')).toBe(true);
  });
});
