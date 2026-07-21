export type {
  Eip1193Provider,
  LaboratoryChainId as TestChainId,
  LaboratoryWalletProvider,
  LaboratoryWalletProviderType as WalletProviderType,
  WalletProfile,
  WalletState as WalletReadModel
} from '../../src/wallet/WalletProvider';

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
