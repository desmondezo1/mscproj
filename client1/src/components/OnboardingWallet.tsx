import React, { useState } from 'react';
import { Container, Card, Button, Alert, Table } from 'react-bootstrap';
import { ConnectButton, useWallet } from '@suiet/wallet-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useNavigate } from 'react-router-dom';

const OnboardingWallet: React.FC = () => {
  const wallet = useWallet();
  const navigate = useNavigate();
  const [signedMessage, setSignedMessage] = useState<string | null>(null);
  const [txResult, setTxResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Handle signing a message
  const handleSignMessage = async () => {
    try {
      setError(null);
      const message = new TextEncoder().encode("Hello from Protocol Bridge!");
      const signature = await wallet.signMessage({
        message
      });
      setSignedMessage(signature);
      console.log("Message signed:", signature);
    } catch (err) {
      console.error("Error signing message:", err);
      setError(`Failed to sign message: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };
  
  // Handle a test transaction
  const handleTestTransaction = async () => {
    try {
      setError(null);
      
      // Create a simple transaction
      const tx = new Transaction();
      
      // Add a simple move call (this is just for demonstration)
      tx.moveCall({
        target: '0x2::sui::transfer_sui',
        arguments: [
          tx.object('0x0000000000000000000000000000000000000000000000000000000000000006'),
          tx.pure.u64(1000) // Just 1000 MIST (very small amount)
        ],
      });
      
      // Sign and execute the transaction
      const result = await wallet.signAndExecuteTransaction({
        transaction: tx,
      });
      
      setTxResult(JSON.stringify(result, null, 2));
      console.log("Transaction executed:", result);
    } catch (err) {
      console.error("Error executing transaction:", err);
      setError(`Failed to execute transaction: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };
  
  // Continue to the next step
  const handleContinue = () => {
    navigate('/dashboard', { state: { walletConnected: true } });
  };
  
  return (
    <Container className="mt-4">
      <h1>Wallet Onboarding</h1>
      <p className="lead">
        Connect your SUI wallet to enable blockchain capabilities in Protocol Bridge.
      </p>
      
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      <Card className="mb-4">
        <Card.Body>
          <Card.Title>Step 1: Connect Your Wallet</Card.Title>
          <Card.Text>
            Click the button below to connect your SUI wallet.
          </Card.Text>
          <div className="d-flex justify-content-center my-4">
            <ConnectButton />
          </div>
        </Card.Body>
      </Card>
      
      {wallet.connected && (
        <>
          <Alert variant="success">
            <strong>Wallet Connected Successfully!</strong>
            <div className="mt-2">
              <small>
                Wallet: {wallet.name}<br />
                Address: <code>{wallet.account?.address}</code>
              </small>
            </div>
          </Alert>
          
          <Card className="mb-4">
            <Card.Body>
              <Card.Title>Step 2: Test Wallet Functions</Card.Title>
              <Card.Text>
                Let's test your wallet's functionality by signing a message and executing a test transaction.
              </Card.Text>
              
              <div className="d-flex gap-2 my-3">
                <Button 
                  variant="outline-primary" 
                  onClick={handleSignMessage}
                  disabled={!wallet.connected}
                >
                  Sign Message
                </Button>
                <Button 
                  variant="outline-primary" 
                  onClick={handleTestTransaction}
                  disabled={!wallet.connected}
                >
                  Test Transaction
                </Button>
              </div>
              
              {signedMessage && (
                <div className="mt-3">
                  <h6>Signed Message:</h6>
                  <div className="bg-light p-2 rounded">
                    <code style={{ wordBreak: 'break-all' }}>{signedMessage}</code>
                  </div>
                </div>
              )}
              
              {txResult && (
                <div className="mt-3">
                  <h6>Transaction Result:</h6>
                  <div className="bg-light p-2 rounded">
                    <pre style={{ whiteSpace: 'pre-wrap', maxHeight: '200px', overflow: 'auto' }}>
                      {txResult}
                    </pre>
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>
          
          <Card className="mb-4">
            <Card.Body>
              <Card.Title>Step 3: Wallet Information</Card.Title>
              
              <Table striped bordered hover className="mt-3">
                <thead>
                  <tr>
                    <th>Property</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Wallet Name</td>
                    <td>{wallet.name || 'Unknown'}</td>
                  </tr>
                  <tr>
                    <td>Address</td>
                    <td><code>{wallet.account?.address || 'Not available'}</code></td>
                  </tr>
                  <tr>
                    <td>Public Key</td>
                    <td><code>{wallet.account?.publicKey || 'Not available'}</code></td>
                  </tr>
                  <tr>
                    <td>Connection Status</td>
                    <td>{wallet.connected ? 'Connected' : 'Disconnected'}</td>
                  </tr>
                </tbody>
              </Table>
            </Card.Body>
          </Card>
          
          <div className="d-flex justify-content-end mb-5">
            <Button variant="primary" onClick={handleContinue}>
              Continue to Dashboard
            </Button>
          </div>
        </>
      )}
    </Container>
  );
};

export default OnboardingWallet; 