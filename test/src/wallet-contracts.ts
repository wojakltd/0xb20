export type TestChainId = '0x1' | '0x2105' | '0xa' | '0xa4b1' | '0x89' | string;

export type WalletProviderType = 'injected' | 'walletconnect';

export interface LaboratoryWalletProvider {
  id: string;
  name: string;
  rdns?: string;
  icon?: string;
  type: WalletProviderType;
  disabled?: boolean;
  provider: {
    request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
    on?(event: string, handler: (...args: unknown[]) => void): void;
  } | null;
}

export interface WalletProfile {
  baseName: string;
  ens: string;
  avatar: string;
}

export interface WalletReadModel {
  status: 'Disconnected' | 'CONNECTED' | 'ERROR';
  wallet: string;
  address: string;
  shortAddress: string;
  baseName: string;
  ens: string;
  chainId: TestChainId;
  network: string;
  balance: string;
  access: 'Pending' | 'GRANTED' | 'GRANTED / BASE RECOMMENDED';
}

export interface SignatureExperiment {
  message: string;
  signature: string;
  verifiedClientSide: boolean;
}

export interface LaboratoryExperimentModule {
  id: string;
  title: string;
  status: 'READY' | 'ACTIVE' | 'PAUSED';
  readOnly: boolean;
}
