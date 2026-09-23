import { describe, expect, it } from 'vitest';
import { isAuthorized, renderCodePage } from './logic';

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

describe('renderCodePage', () => {
  it('includes the code in the rendered page', () => {
    expect(renderCodePage('482913')).toContain('482913');
  });
});
