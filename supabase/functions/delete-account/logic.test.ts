import { describe, expect, it } from 'vitest';
import { resolveTargetUserId, isAdminDeletion, photoStoragePath } from './logic';

describe('resolveTargetUserId', () => {
  it('targets the caller when no userId is requested (self-delete path)', () => {
    expect(resolveTargetUserId('caller-1', undefined)).toBe('caller-1');
  });

  it('targets the caller when userId is null', () => {
    expect(resolveTargetUserId('caller-1', null)).toBe('caller-1');
  });

  it('targets the caller when userId is an empty string', () => {
    expect(resolveTargetUserId('caller-1', '')).toBe('caller-1');
  });

  it('targets the requested user when provided (admin path)', () => {
    expect(resolveTargetUserId('caller-1', 'other-2')).toBe('other-2');
  });
});

describe('isAdminDeletion', () => {
  it('is false when the target is the caller', () => {
    expect(isAdminDeletion('caller-1', 'caller-1')).toBe(false);
  });

  it('is true when the target differs from the caller', () => {
    expect(isAdminDeletion('caller-1', 'other-2')).toBe(true);
  });
});

describe('photoStoragePath', () => {
  it('matches the fixed upload path used at profile creation', () => {
    expect(photoStoragePath('user-123')).toBe('user-123/profile.jpg');
  });
});
