import { computed, markRaw, ref, shallowRef } from 'vue';
import type { TelegramWebApp, TelegramWebAppUser } from '../types/telegram';

const tg = shallowRef<TelegramWebApp | null>(null);
const isReady = ref(false);

function getTelegram(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

export function useTelegram() {
  const init = () => {
    const webApp = getTelegram();
    tg.value = webApp ? markRaw(webApp) : null;

    if (!tg.value) {
      isReady.value = true;
      return;
    }

    tg.value.ready();
    tg.value.expand();
    tg.value.enableClosingConfirmation?.();

    if (tg.value.isVersionAtLeast?.('7.7')) {
      tg.value.disableVerticalSwipes?.();
    }

    try {
      tg.value.setHeaderColor?.('secondary_bg_color');
      tg.value.setBackgroundColor?.('secondary_bg_color');
    } catch {
      // Telegram clients differ by platform/version; visual setup is optional.
    }

    isReady.value = true;
  };

  const initData = computed(() => tg.value?.initData || '');
  const unsafeUser = computed<TelegramWebAppUser | null>(() => tg.value?.initDataUnsafe?.user ?? null);
  const isTelegram = computed(() => Boolean(tg.value?.initData));

  const hapticSuccess = () => tg.value?.HapticFeedback?.notificationOccurred?.('success');
  const hapticError = () => tg.value?.HapticFeedback?.notificationOccurred?.('error');
  const hapticLight = () => tg.value?.HapticFeedback?.impactOccurred?.('light');

  const scanQrCode = (text = 'Наведите камеру на QR-код купона'): Promise<string | null> => {
    const webApp = tg.value ?? getTelegram();

    const showScanQrPopup = webApp?.showScanQrPopup;

    if (!webApp || !showScanQrPopup) {
      const value = window.prompt('Telegram QR-сканер недоступен. Вставьте строку QR/промокод вручную:');
      return Promise.resolve(value?.trim() || null);
    }

    return new Promise((resolve) => {
      let settled = false;

      const cleanup = () => {
        webApp.offEvent?.('scanQrPopupClosed', onClosed);
      };

      const finish = (value: string | null) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value?.trim() || null);
      };

      const onClosed = () => finish(null);

      webApp.onEvent?.('scanQrPopupClosed', onClosed);
      showScanQrPopup.call(webApp, { text }, (data) => {
        finish(data);
        return true;
      });
    });
  };

  return {
    tg,
    init,
    initData,
    unsafeUser,
    isReady,
    isTelegram,
    scanQrCode,
    hapticSuccess,
    hapticError,
    hapticLight,
  };
}
