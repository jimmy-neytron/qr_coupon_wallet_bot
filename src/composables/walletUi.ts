import { inject, type InjectionKey } from 'vue';

export type WalletUiContext = Record<string, unknown>;

export const walletUiKey = Symbol('walletUi') as InjectionKey<WalletUiContext>;

/**
 * Returns shared UI controller provided by App.vue to routed screens.
 */
export function useWalletUi<T extends WalletUiContext = WalletUiContext>() {
  const context = inject(walletUiKey) as T | undefined;

  if (!context) {
    throw new Error('Wallet UI context is not provided');
  }

  return context;
}
