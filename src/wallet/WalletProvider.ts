export type LaboratoryChainId = '0x1' | '0x2105' | '0xa' | '0xa4b1' | '0x89' | string;

export type LaboratoryWalletProviderType = 'injected' | 'walletconnect';

export interface Eip1193Provider {
  request(args: {
    method: string;
    params?: unknown[] | Record<string, unknown>;
  }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  disconnect?(): Promise<void>;
}

export interface LaboratoryWalletProvider {
  id: string;
  name: string;
  rdns?: string;
  icon?: string;
  type: LaboratoryWalletProviderType;
  disabled?: boolean;
  provider: Eip1193Provider | null;
}

export interface WalletProfile {
  baseName: string;
  ens: string;
  avatar: string;
}

export interface WalletState {
  initialized: boolean;
  restoring: boolean;
  providers: Omit<LaboratoryWalletProvider, 'provider'>[];
  selectedProviderId: string;
  walletName: string;
  address: string;
  shortAddress: string;
  chainId: LaboratoryChainId;
  network: string;
  balance: string;
  profile: WalletProfile | null;
  status: 'DISCONNECTED' | 'CONNECTING' | 'SCANNING' | 'CONNECTED' | 'ERROR';
  message: string;
  error: string;
  connected: boolean;
  lastUpdatedAt: string;
  baseChainId: LaboratoryChainId;
  isBase: boolean;
}

export interface WalletProviderConfig {
  storageKey: string;
  walletConnectProjectId: string;
  baseChainId: LaboratoryChainId;
  appName: string;
  appDescription: string;
  appUrl: string;
  appIcon: string;
  autoRestore: boolean;
}
