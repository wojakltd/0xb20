import type { ParsedRecipient, TransactionRequest } from '../wallet/WalletUtils';

export interface TokenSenderContractConfig {
  chainId: '0x2105' | string;
  network: 'BASE' | string;
  contractAddress: string;
  contractName: string;
  approvalMode: 'exact';
  maxRecipients: number;
}

export interface TokenSenderPreview {
  token: string;
  tokenSymbol: string;
  recipients: ParsedRecipient[];
  totalWallets: number;
  totalRaw: string;
  totalFormatted: string;
  estimatedGas: string;
}

export interface TokenSenderContract {
  approve(token: string, spender: string, amountRaw: string): Promise<string>;
  send(token: string, recipients: string[], amountsRaw: string[]): Promise<string>;
  estimateSend(token: string, recipients: string[], amountsRaw: string[]): Promise<string>;
  buildSendTransaction(token: string, recipients: string[], amountsRaw: string[]): TransactionRequest;
}
