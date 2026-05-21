import { describe, expect, it, vi } from 'vitest';
import { formatDate, isExpired } from '../date';

describe('date utils', () => {
  it('formats dates and empty values', () => {
    expect(formatDate(null)).toBe('Не указан');
    expect(formatDate('2026-05-21')).toBe('21.05.2026');
  });

  it('detects expired dates relative to today', () => {
    vi.setSystemTime(new Date('2026-05-21T12:00:00.000Z'));
    expect(isExpired(null)).toBe(false);
    expect(isExpired('2026-05-20')).toBe(true);
    expect(isExpired('2026-05-21')).toBe(false);
    expect(isExpired('2026-05-22')).toBe(false);
    vi.useRealTimers();
  });
});
