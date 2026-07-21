export interface StoredWalletSession {
  connected: true;
  providerId: string;
  walletName: string;
  type: 'injected' | 'walletconnect';
  updatedAt: string;
}

export interface WalletStorage {
  read(): StoredWalletSession | null;
  write(session: StoredWalletSession): void;
  clear(): void;
}

export const WALLET_STORAGE_KEY = 'b20-wallet-session';
