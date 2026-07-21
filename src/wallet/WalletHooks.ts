import type { TokenInfo, TransactionRequest } from './WalletUtils';
import type { WalletProviderConfig, WalletState } from './WalletProvider';

export interface LaboratoryWalletService {
  init(config?: Partial<WalletProviderConfig>): Promise<WalletState>;
  subscribe(callback: (state: WalletState) => void): () => void;
  getState(): WalletState;
  discoverWallets(): Promise<WalletState['providers']>;
  restoreConnection(): Promise<WalletState>;
  connect(providerId?: string): Promise<WalletState>;
  disconnect(): Promise<WalletState>;
  signMessage(message: string): Promise<string>;
  switchToBase(): Promise<WalletState>;
  readTokenInfo(tokenAddress: string): Promise<TokenInfo>;
  estimateGas(transaction: TransactionRequest): Promise<string>;
  sendTransaction(transaction: TransactionRequest): Promise<string>;
  requestTokenApproval(token: string, spender: string, amountRaw: string): Promise<string>;
}

declare global {
  interface Window {
    B20Wallet: LaboratoryWalletService;
  }
}
