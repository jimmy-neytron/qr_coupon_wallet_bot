import { describe, expect, it } from 'vitest';
import { displayUserName, normalizeSearch } from '../text';

describe('text utils', () => {
  it('normalizes search values', () => {
    expect(normalizeSearch('  SALE500  ')).toBe('sale500');
  });

  it('formats user display names', () => {
    expect(displayUserName(null)).toBe('Неизвестно');
    expect(displayUserName({ first_name: 'Даша', last_name: 'Сырцева' })).toBe('Даша Сырцева');
    expect(displayUserName({ username: 'coupon_user' })).toBe('@coupon_user');
    expect(displayUserName({})).toBe('Пользователь');
  });
});
