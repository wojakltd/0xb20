export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  balanceRaw: string;
  balance: string;
}

export interface ParsedRecipient {
  address: string;
  amount: string;
  amountRaw: string;
}

export interface RecipientParseResult {
  recipients: ParsedRecipient[];
  errors: string[];
  totalRaw: string;
  totalFormatted: string;
}

export interface TransactionRequest {
  to: string;
  data: string;
  value?: string;
}
