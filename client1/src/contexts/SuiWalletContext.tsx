import React, { createContext, useContext } from 'react';
import { useWallet, WalletContextType } from '@suiet/wallet-kit';

// Create a context that will just forward the Suiet wallet kit's context
const SuiWalletContext = createContext<WalletContextType | undefined>(undefined);

// A simple provider that forwards the Suiet wallet kit's context
export const SuiWalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const wallet = useWallet();
  
  return (
    <SuiWalletContext.Provider value={wallet}>
      {children}
    </SuiWalletContext.Provider>
  );
};

// Hook for using the wallet context - this is just a convenience wrapper
export const useSuiWallet = (): WalletContextType => {
  const context = useContext(SuiWalletContext);
  if (context === undefined) {
    throw new Error('useSuiWallet must be used within a SuiWalletProvider, or use useWallet directly from @suiet/wallet-kit');
  }
  return context;
}; 