import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import 'bootstrap/dist/css/bootstrap.min.css';
import { WalletProvider } from '@suiet/wallet-kit';
import '@suiet/wallet-kit/style.css';

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <WalletProvider>
        <App />
      </WalletProvider>
    </React.StrictMode>
  );
}
