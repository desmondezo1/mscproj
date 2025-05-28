import React, { useState, useEffect } from 'react';
import { Button, Card, Container, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ConnectButton, useWallet } from '@suiet/wallet-kit';

const WalletConnect: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const { user, refreshUser, connectWallet } = useAuth();
  const navigate = useNavigate();
  
  // Use the wallet hook from Suiet wallet kit
  const wallet = useWallet();
  
  // Monitor wallet connection status
  useEffect(() => {
    if (wallet.connected && wallet.account) {
      handleSuccessfulConnection();
    }
  }, [wallet.connected, wallet.account]);
  
  const handleSuccessfulConnection = async () => {
    try {
      if (!wallet.account) {
        throw new Error('No wallet account available');
      }
      
      // Log the connected wallet information
      console.log('Connected wallet:', wallet.name);
      console.log('Wallet address:', wallet.account.address);
      
      // Call the connectWallet function to update the backend
      await connectWallet();
      
      // Refresh user data to get the updated state
      await refreshUser();
      
      // Navigate to dashboard
      navigate('/dashboard', { state: { walletConnected: true } });
    } catch (err) {
      setError('Failed to update user record with wallet address.');
      console.error(err);
    }
  };
  
  return (
    <Container className="fade-in">
      <h1 className="mb-4">Connect Your SUI Wallet</h1>
      <p className="mb-4">
        Connecting your SUI wallet allows you to securely manage your digital identity and credentials.
      </p>
      
      {error && <Alert variant="danger">{error}</Alert>}
      
      {wallet.connected && wallet.account ? (
        <Alert variant="success">
          <div className="d-flex align-items-center">
            <div className="me-3">
              <i className="bi bi-check-circle-fill" style={{ fontSize: '2rem' }}></i>
            </div>
            <div>
              <strong>Wallet Connected Successfully!</strong>
              <br />
              <small className="wallet-address">
                {wallet.account.address.slice(0, 10)}...{wallet.account.address.slice(-8)}
              </small>
            </div>
          </div>
          <div className="mt-3">
            <Button
              variant="primary"
              onClick={() => navigate('/dashboard', { state: { walletConnected: true } })}
            >
              Continue to Dashboard
            </Button>
          </div>
        </Alert>
      ) : (
        <Card className="mb-4">
          <Card.Body className="text-center">
            <Card.Title>Connect with SUI Wallet</Card.Title>
            <Card.Text>
              To continue, please connect your SUI wallet by clicking the button below.
            </Card.Text>
            <div className="my-4">
              {/* Using the official ConnectButton from Suiet wallet kit */}
              <ConnectButton />
            </div>
            <Card.Text className="small text-muted">
              Connecting a wallet allows the application to request approval for transactions.
              Your private keys always remain secure and under your control.
            </Card.Text>
          </Card.Body>
        </Card>
      )}
      
      <div className="mt-4">
        <h4>What is a SUI Wallet?</h4>
        <p>
          A SUI wallet is a secure digital wallet that allows you to interact with the SUI blockchain.
          It stores your private keys and enables you to sign transactions and manage your digital assets.
        </p>
        <h5>Popular SUI Wallets:</h5>
        <ul>
          <li><a href="https://suiet.app/" target="_blank" rel="noopener noreferrer">Suiet Wallet</a></li>
          <li><a href="https://sui.io/wallet" target="_blank" rel="noopener noreferrer">SUI Wallet</a></li>
          <li><a href="https://ethoswallet.xyz/" target="_blank" rel="noopener noreferrer">Ethos Wallet</a></li>
        </ul>
      </div>
    </Container>
  );
};

export default WalletConnect; 