import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('useTelegram', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.stubGlobal('window', window);
    delete (window as any).Telegram;
  });

  it('initializes without Telegram and falls back to prompt scanner', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('  QR-TEXT  ');
    const { useTelegram } = await import('../useTelegram');
    const telegram = useTelegram();

    telegram.init();

    expect(telegram.isReady.value).toBe(true);
    expect(telegram.isTelegram.value).toBe(false);
    await expect(telegram.scanQrCode()).resolves.toBe('QR-TEXT');
  });

  it('uses Telegram WebApp APIs when available', async () => {
    const ready = vi.fn();
    const expand = vi.fn();
    const disableVerticalSwipes = vi.fn();
    const notificationOccurred = vi.fn();
    const impactOccurred = vi.fn();
    const offEvent = vi.fn();
    const onEvent = vi.fn();
    const showScanQrPopup = vi.fn((_options, callback) => callback('TG-QR'));

    (window as any).Telegram = {
      WebApp: {
        initData: 'telegram-init-data',
        initDataUnsafe: { user: { id: 1, first_name: 'Dev' } },
        ready,
        expand,
        enableClosingConfirmation: vi.fn(),
        isVersionAtLeast: () => true,
        disableVerticalSwipes,
        setHeaderColor: vi.fn(),
        setBackgroundColor: vi.fn(),
        HapticFeedback: { notificationOccurred, impactOccurred },
        onEvent,
        offEvent,
        showScanQrPopup,
      },
    };

    const { useTelegram } = await import('../useTelegram');
    const telegram = useTelegram();
    telegram.init();

    expect(ready).toHaveBeenCalled();
    expect(expand).toHaveBeenCalled();
    expect(disableVerticalSwipes).toHaveBeenCalled();
    expect(telegram.initData.value).toBe('telegram-init-data');
    telegram.hapticSuccess();
    telegram.hapticError();
    telegram.hapticLight();
    expect(notificationOccurred).toHaveBeenCalledWith('success');
    expect(notificationOccurred).toHaveBeenCalledWith('error');
    expect(impactOccurred).toHaveBeenCalledWith('light');
    await expect(telegram.scanQrCode()).resolves.toBe('TG-QR');
    expect(onEvent).toHaveBeenCalledWith('scanQrPopupClosed', expect.any(Function));
    expect(offEvent).toHaveBeenCalledWith('scanQrPopupClosed', expect.any(Function));
  });
});
