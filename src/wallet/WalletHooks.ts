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
  callContract(to: string, data: string): Promise<string>;
  readTokenInfo(tokenAddress: string): Promise<TokenInfo>;
  readTokenAllowance(tokenAddress: string, ownerAddress: string, spenderAddress: string): Promise<string>;
  readContractCode(address: string): Promise<string>;
  estimateGas(transaction: TransactionRequest): Promise<string>;
  sendTransaction(transaction: TransactionRequest): Promise<string>;
  waitForTransactionReceipt(transactionHash: string, options?: {
    timeoutMs?: number;
    intervalMs?: number;
  }): Promise<unknown>;
  requestTokenApproval(token: string, spender: string, amountRaw: string): Promise<string>;
}

declare global {
  interface Window {
    B20Wallet: LaboratoryWalletService;
  }
}
