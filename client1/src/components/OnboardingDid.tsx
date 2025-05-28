import React, { useState, useEffect } from 'react';
import { Card, Form, Button, Alert, Spinner, Container } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWallet, ConnectButton } from '@suiet/wallet-kit';
import { didService } from '../services/apiService';

// Define DID method options
const DID_METHODS = [
  { id: 'ethr', name: 'Ethereum', description: 'Ethereum blockchain-based DID' },
  { id: 'web', name: 'Web', description: 'Web domain-based DID' },
  { id: 'key', name: 'Key', description: 'Cryptographic key-based DID' },
  { id: 'sov', name: 'Sovrin', description: 'Sovrin network DID' },
  { id: 'sui', name: 'SUI', description: 'SUI blockchain-based DID' }
];

const OnboardingDid: React.FC = () => {
  // Form state
  const [method, setMethod] = useState<string>('key');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [didDocument, setDidDocument] = useState<string>('');
  const [didId, setDidId] = useState<string>('');
  
  // Auth and wallet contexts
  const { refreshUser } = useAuth();
  const wallet = useWallet();
  
  const navigate = useNavigate();
  
  // Handle changes to the selected DID method
  useEffect(() => {
    // Reset error when method changes
    setError(null);
  }, [method]);
  
  // Clear error when wallet connects
  useEffect(() => {
    if (wallet.connected && error?.includes('SUI wallet connection required')) {
      setError(null);
    }
  }, [wallet.connected, error]);
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate SUI wallet connection for SUI DID method
    if (method === 'sui' && !wallet.connected) {
      setError('SUI wallet connection required for SUI DID method. Please connect your wallet.');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      let response;
      
      console.log(`Creating DID with method: ${method}`);
      if (method === 'sui' && wallet.account) {
        console.log(`Using wallet account:`, wallet.account);
        
        // For SUI DIDs, we need to create the DID on-chain first
        try {
          // Generate a DID string based on the wallet address
          const didString = `did:sui:${wallet.account.address}`;
          
          // Create a DID document
          const didDocument = {
            '@context': [
              'https://www.w3.org/ns/did/v1',
              'https://w3id.org/security/suites/ed25519-2020/v1'
            ],
            id: didString,
            controller: [didString],
            verificationMethod: [
              {
                id: `${didString}#key-1`,
                type: 'Ed25519VerificationKey2020',
                controller: didString,
                publicKeyMultibase: wallet.account.publicKey
              }
            ],
            authentication: [`${didString}#key-1`],
            assertionMethod: [`${didString}#key-1`]
          };

          // Serialize the DID document to a string
          const didDocumentString = JSON.stringify(didDocument);
          
          console.log('Registering DID on blockchain:', didString);

          try {
            // Try direct blockchain registration first
            const walletData = {
              address: wallet.account.address,
              publicKey: wallet.account.publicKey,
              wallet: wallet 
            };
            
            // Register the DID on the blockchain
            response = await didService.createDid(method, walletData);
            console.log('SUI DID created and registered on blockchain:', response);
          } catch (directError) {
            console.error('Error with direct blockchain registration:', directError);
            console.log('Falling back to server-side registration...');
            
            // Fall back to server-side registration
            const walletData = {
              address: wallet.account.address,
              publicKey: wallet.account.publicKey
            };
            
            response = await didService.createDid(method, walletData);
            console.log('SUI DID created via server-side registration:', response);
          }
        } catch (blockchainError) {
          console.error('Error registering DID on blockchain:', blockchainError);
          setError(`Failed to register DID on the SUI blockchain: ${blockchainError instanceof Error ? blockchainError.message : String(blockchainError)}`);
          setLoading(false);
          return;
        }
      } else {
        // For other DIDs, just use the method
        response = await didService.createDid(method);
      }
      
      console.log('DID creation response:', response);
      
      // Store DID document and ID for display
      if (response && response.data) {
        setDidDocument(JSON.stringify(response.data.didDocument, null, 2));
        setDidId(response.data.did || response.data.didDocument?.id || 'Unknown DID');
        
        // Refresh user to update DID status
        await refreshUser();
        
        // Set success state
        setSuccess(true);
        
        // Log the success state to help with debugging
        console.log('DID creation successful, showing success state:', {
          success: true,
          didId: response.data.did || response.data.didDocument?.id,
          didDocumentLength: JSON.stringify(response.data.didDocument).length
        });
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      console.error('Error creating DID:', err);
      setError('Failed to create DID. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle wallet disconnect
  const handleDisconnect = () => {
    if (typeof wallet.disconnect === 'function') {
      wallet.disconnect();
    }
  };
  
  // Handle manual navigation to dashboard
  const handleGoToDashboard = () => {
    navigate('/dashboard', { state: { didCreated: true } });
  };
  
  return (
    <Container className="fade-in">
      <h1 className="mb-4">Create Your Digital Identity</h1>
      
      {success ? (
        <Card className="shadow-sm mb-4">
          <Card.Body className="text-center">
            <div className="mb-3">
              <i className="bi bi-check-circle-fill text-success" style={{ fontSize: '3rem' }}></i>
            </div>
            <h2>DID Successfully Created!</h2>
            <p className="mb-3">
              Your Decentralized Identifier has been created and registered.
            </p>
            <div className="bg-light p-3 mb-3 text-start rounded" style={{ maxHeight: '150px', overflow: 'auto' }}>
              <p className="mb-1"><strong>Your DID:</strong></p>
              <code className="d-block mb-2">{didId}</code>
              {didDocument && (
                <>
                  <p className="mb-1"><strong>DID Document:</strong></p>
                  <pre className="small mb-0" style={{ whiteSpace: 'pre-wrap' }}>
                    {didDocument}
                  </pre>
                </>
              )}
            </div>
            <Button 
              variant="primary" 
              onClick={handleGoToDashboard}
              className="mt-2"
            >
              Go to Dashboard
            </Button>
          </Card.Body>
        </Card>
      ) : (
        <>
          {error && <Alert variant="danger">{error}</Alert>}
          
          <Card className="shadow-sm mb-4">
            <Card.Body>
              <h2 className="h4 mb-4">Choose Your DID Method</h2>
              
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-4">
                  <Form.Label>DID Method</Form.Label>
                  <Form.Select 
                    value={method} 
                    onChange={(e) => setMethod(e.target.value)}
                    disabled={loading}
                  >
                    {DID_METHODS.map(didMethod => (
                      <option key={didMethod.id} value={didMethod.id}>
                        {didMethod.name} DID (did:{didMethod.id})
                      </option>
                    ))}
                  </Form.Select>
                  
                  <Form.Text className="text-muted">
                    {DID_METHODS.find(m => m.id === method)?.description}
                    {method === 'sui' && (
                      <>
                        <br />
                        <strong>Note:</strong> SUI DID method requires a connected SUI wallet.
                        {wallet.connected && wallet.account && (
                          <>
                            <br />
                            <span className="text-success">
                              <i className="bi bi-check-circle-fill me-1"></i>
                              Wallet connected: {wallet.account.address.slice(0, 8)}...{wallet.account.address.slice(-6)}
                            </span>
                          </>
                        )}
                      </>
                    )}
                  </Form.Text>
                </Form.Group>
                
                {/* Show connect button when SUI is selected but not connected */}
                {method === 'sui' && !wallet.connected && (
                  <div className="text-center mb-4 p-3 border rounded bg-light">
                    <p className="mb-3">
                      <strong>Connect your SUI wallet</strong> to continue with SUI DID creation:
                    </p>
                    <div className="d-flex justify-content-center mb-2">
                      <ConnectButton />
                    </div>
                  </div>
                )}
                
                {/* Show wallet info and disconnect option when connected */}
                {method === 'sui' && wallet.connected && wallet.account && (
                  <div className="text-center mb-4 p-3 border rounded bg-light">
                    <div className="d-flex justify-content-between align-items-center">
                      <div className="text-start">
                        <p className="mb-1"><strong>Wallet Connected</strong></p>
                        <p className="mb-0 small">
                          <span className="wallet-address">
                            {wallet.account.address.slice(0, 12)}...{wallet.account.address.slice(-8)}
                          </span>
                        </p>
                      </div>
                      <Button 
                        variant="outline-secondary" 
                        size="sm" 
                        onClick={handleDisconnect}
                      >
                        <i className="bi bi-power me-1"></i>
                        Disconnect
                      </Button>
                    </div>
                  </div>
                )}
                
                <div className="d-grid gap-2">
                  <Button 
                    variant="primary" 
                    type="submit" 
                    disabled={loading || (method === 'sui' && !wallet.connected)}
                  >
                    {loading ? (
                      <>
                        <Spinner
                          as="span"
                          animation="border"
                          size="sm"
                          role="status"
                          aria-hidden="true"
                          className="me-2"
                        />
                        Creating DID...
                      </>
                    ) : (
                      'Create DID'
                    )}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
          
          <Card className="shadow-sm">
            <Card.Body>
              <h3 className="h5 mb-3">What is a Decentralized Identifier (DID)?</h3>
              <p>
                A DID is a new type of identifier that enables verifiable, self-sovereign digital identity.
                DIDs are:
              </p>
              <ul>
                <li><strong>Decentralized:</strong> No central issuing agency is required</li>
                <li><strong>Persistent:</strong> They don't require the continued operation of an underlying organization</li>
                <li><strong>Cryptographically verifiable:</strong> Proving control of a DID can be done through cryptography</li>
                <li><strong>Resolvable:</strong> You can look up metadata about the identifier</li>
              </ul>
              <p className="mb-0">
                Creating a DID is the first step in your journey toward self-sovereign identity.
              </p>
            </Card.Body>
          </Card>
        </>
      )}
    </Container>
  );
};

export default OnboardingDid; 