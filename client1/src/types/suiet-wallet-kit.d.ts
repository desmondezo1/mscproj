declare module '@suiet/wallet-kit' {
  import { ReactNode } from 'react';

  export interface WalletAccount {
    address: string;
    publicKey?: string;
  }

  export interface WalletInfo {
    name: string;
    icon?: string;
    version?: string;
    description?: string;
  }

  export interface WalletProviderProps {
    children: ReactNode;
    defaultWalletName?: string;
    autoConnect?: boolean;
    onConnectError?: (err: unknown) => void;
  }

  export interface WalletContextType {
    connected: boolean;
    connecting: boolean;
    account: WalletAccount | null;
    name: string | null;
    wallets: WalletInfo[];
    select: (walletName: string) => Promise<void>;
    disconnect: () => void;
    signMessage: (params: { message: Uint8Array }) => Promise<string>;
    signTransaction: (params: { transaction: any }) => Promise<any>;
    signAndExecuteTransaction: (params: { transaction: any }) => Promise<any>;
    getAccounts: () => Promise<WalletAccount[]>;
  }

  export function WalletProvider(props: WalletProviderProps): JSX.Element;
  export function ConnectButton(props?: { label?: string }): JSX.Element;
  export function useWallet(): WalletContextType;
} 