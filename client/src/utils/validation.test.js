import { describe, it, expect } from 'vitest';
import { validatePassword } from './validation';

describe('validatePassword', () => {
  it('accepts a strong password', () => {
    expect(validatePassword('Sup3rSecret!')).toBeNull();
  });

  it('rejects empty, short, letter-less and digit-less passwords', () => {
    expect(validatePassword('')).toBeTruthy();
    expect(validatePassword('abc1')).toMatch(/at least 8/);
    expect(validatePassword('12345678')).toMatch(/at least one letter/);
    expect(validatePassword('abcdefghij')).toMatch(/at least one number/);
  });

  it('rejects passwords over 72 characters', () => {
    expect(validatePassword('a1'.repeat(40))).toMatch(/72/);
  });

  it('handles non-string input', () => {
    expect(validatePassword(null)).toBeTruthy();
    expect(validatePassword(12345678)).toBeTruthy();
  });
});
