import { describe, expect, it } from 'vitest';
import {
  createInviteLink,
  createInviteStartParam,
  createTelegramInviteLink,
  extractInviteCodeFromStartParam,
  getInviteCodeFromLaunchParams,
  normalizeBotUsername,
  normalizeInviteCode,
  normalizeMiniAppName,
} from '../inviteLink';

describe('inviteLink utils', () => {
  it('normalizes bot usernames, mini app names and invite codes', () => {
    expect(normalizeBotUsername(' @qr_coupon_wallet_bot ')).toBe('qr_coupon_wallet_bot');
    expect(normalizeBotUsername('')).toBeNull();
    expect(normalizeMiniAppName(' /coupons/ ')).toBe('coupons');
    expect(normalizeMiniAppName('')).toBeNull();
    expect(normalizeInviteCode(' ABCD-1234 ')).toBe('ABCD-1234');
    expect(normalizeInviteCode('')).toBeNull();
  });

  it('creates and extracts Telegram start parameters', () => {
    expect(createInviteStartParam('ABCD-1234')).toBe('invite_ABCD-1234');
    expect(createInviteStartParam('')).toBeNull();
    expect(extractInviteCodeFromStartParam('invite_ABCD-1234')).toBe('ABCD-1234');
    expect(extractInviteCodeFromStartParam('other_ABCD-1234')).toBeNull();
  });

  it('creates Telegram Mini App direct invite links', () => {
    expect(createTelegramInviteLink('ABCD-1234', '@qr_coupon_wallet_bot', 'coupons')).toBe(
      'https://t.me/qr_coupon_wallet_bot/coupons?startapp=invite_ABCD-1234',
    );
    expect(createTelegramInviteLink('ABCD-1234', '', 'coupons')).toBeNull();
    expect(createTelegramInviteLink('ABCD-1234', 'qr_coupon_wallet_bot', '')).toBeNull();
  });

  it('does not fall back to a website link for invite sharing', () => {
    expect(createInviteLink('ABCD-1234', { botUsername: 'qr_coupon_wallet_bot', miniAppName: 'coupons' })).toBe(
      'https://t.me/qr_coupon_wallet_bot/coupons?startapp=invite_ABCD-1234',
    );
    expect(createInviteLink('ABCD-1234', { botUsername: 'qr_coupon_wallet_bot' })).toBe('');
    expect(createInviteLink('ABCD-1234', { miniAppName: 'coupons' })).toBe('');
  });

  it('reads invite code from Telegram start_param before browser query', () => {
    expect(getInviteCodeFromLaunchParams({ startParam: 'invite_FROM-TG', search: '?invite=FROM-URL' })).toBe('FROM-TG');
    expect(getInviteCodeFromLaunchParams({ search: '?invite=FROM-URL' })).toBe('FROM-URL');
  });

  it('can read invite code from current window query', () => {
    window.history.pushState({}, '', '/?invite=FROM-WINDOW');
    expect(getInviteCodeFromLaunchParams()).toBe('FROM-WINDOW');
  });
});
