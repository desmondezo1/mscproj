import React, { useState, useEffect } from 'react';
import { Card, Button, Alert, Form, Row, Col, Spinner, Badge, Modal } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import { bridgeService, credentialService } from '../services/apiService';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

interface CredentialSchema {
  id: string;
  type: string;
  version: string;
  description: string;
  properties: Record<string, any>;
}

interface Credential {
  id: string;
  type: string | string[];
  issuer: string;
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: {
    id?: string;
    [key: string]: any;
  };
  proof?: any;
  status?: string;
}

interface CredentialResponse {
  credential: Credential;
  status: string;
  type: string;
  created: string;
}

const CredentialManagement: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [schemas, setSchemas] = useState<CredentialSchema[]>([]);
  const [loading, setLoading] = useState(true);
  const [issuingCredential, setIssuingCredential] = useState(false);
  const [selectedType, setSelectedType] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [showCredentialModal, setShowCredentialModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedCredential, setSelectedCredential] = useState<Credential | null>(null);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>('');
  
  // Fetch credential schemas
  useEffect(() => {
    const fetchSchemas = async () => {
      try {
        const response = await credentialService.getSchemas();
        const schemasResult = response.data;
        setSchemas(schemasResult);
        
        if (schemasResult.length > 0) {
          setSelectedType(schemasResult[0].type);
        }
      } catch (error: any) {
        console.error('Error fetching credential schemas:', error);
        setStatusMessage(`Error: ${error.response?.data?.error || error.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSchemas();
  }, []);
  
  // Fetch user's credentials from the backend
  const fetchCredentials = async () => {
    try {
      const response = await credentialService.getUserCredentials();
      if (response.data) {
        // Map the credentials - response.data is already an array of credential objects
        const mappedCredentials = Array.isArray(response.data) ? response.data : [response.data];
        const validCredentials = mappedCredentials
          .map(credential => {
            // Ensure we have a valid ID
            if (!credential.id) {
              console.error('Credential missing ID:', credential);
              return null;
            }

            return {
              id: credential.id,
              type: credential.type || ['VerifiableCredential'],
              status: credential.status || 'active',
              issuanceDate: credential.issuanceDate,
              issuer: credential.issuer,
              credentialSubject: credential.credentialSubject || {},
              '@context': credential['@context'] || ['https://www.w3.org/2018/credentials/v1'],
              proof: credential.proof
            } as Credential;
          })
          .filter((cred): cred is Credential => cred !== null);

        setCredentials(validCredentials);
      } else {
        setCredentials([]);
      }
    } catch (error: any) {
      console.error('Error fetching credentials:', error);
      setStatusMessage(`Error fetching credentials: ${error.response?.data?.error || error.message}`);
      setCredentials([]);
    }
  };
  
  // Generate dummy data based on schema
  const generateDummyData = (schema: CredentialSchema) => {
    if (!schema || !schema.properties) return {};
    
    const data: Record<string, any> = {};
    
    // Use user data when available
    if (schema.type === 'IdentityCredential') {
      data.name = user?.name || `${user?.firstName || ''} ${user?.lastName || ''}`;
      data.email = user?.email || 'user@example.com';
    } else if (schema.type === 'EmailCredential') {
      data.email = user?.email || 'user@example.com';
      data.verified = true;
      data.verificationDate = new Date().toISOString();
    } else if (schema.type === 'RoleCredential') {
      data.roles = user?.roles || ['user'];
      data.context = 'https://example.com/roles';
    } else {
      // Generate default data for other credential types
      Object.keys(schema.properties).forEach(prop => {
        if (prop === 'id') return;
        
        const propDef = schema.properties[prop];
        if (propDef.type === 'string') {
          data[prop] = `Sample ${prop}`;
        } else if (propDef.type === 'boolean') {
          data[prop] = true;
        } else if (propDef.type === 'array') {
          data[prop] = ['Sample'];
        } else if (propDef.type === 'number') {
          data[prop] = 0;
        } else if (propDef.type === 'object') {
          data[prop] = {};
        }
      });
    }
    
    return data;
  };
  
  // Handle issuing a new credential
  const handleIssueCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType) {
      setStatusMessage('Please select a credential type');
      return;
    }
    setIssuingCredential(true);
    setStatusMessage('');
    try {
      const schema = schemas.find(s => s.type === selectedType);
      if (!schema) {
        throw new Error(`Schema not found for type: ${selectedType}`);
      }
      const claims = generateDummyData(schema);
      const response = await bridgeService.issueCredential(selectedType, claims);
      const data = response.data as CredentialResponse;
      if (data.credential) {
        setStatusMessage(`Successfully issued ${selectedType} credential!`);
        // Add the new credential to the list immediately
        setCredentials(prevCredentials => [...prevCredentials, data.credential]);
        // Also refresh from backend to ensure consistency
        await fetchCredentials();
      } else {
        throw new Error('No credential returned from server');
      }
    } catch (error: any) {
      console.error('Error issuing credential:', error);
      setStatusMessage(`Error: ${error.response?.data?.error || error.message}`);
    } finally {
      setIssuingCredential(false);
    }
  };
  
  // Handle viewing a credential's details
  const handleViewCredential = (credential: Credential) => {
    if (!credential?.id) {
      console.error('Invalid credential (missing ID):', credential);
      return;
    }
    setSelectedCredential(credential);
    setShowCredentialModal(true);
  };

  // Generate a shareable URL for the credential
  const generateShareUrl = (cred: Credential) => {
    if (!cred?.id) {
      console.error('Invalid credential for share URL (missing ID):', cred);
      return '';
    }
    const backendApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
    return `${backendApiUrl}/credentials/public/${cred.id}`;
  };

  // Handle showing the QR code modal
  const handleShowQRCode = (credential: Credential) => {
    if (!credential?.id) {
      console.error('Invalid credential for QR code (missing ID):', credential);
      return;
    }
    setSelectedCredential(credential);
    const url = generateShareUrl(credential);
    if (url) {
      setShareUrl(url);
      setShowQRModal(true);
    }
  };

  // Verify the credential
  const handleVerifyCredential = async () => {
    if (!selectedCredential || !selectedCredential.id) {
      console.error('Invalid credential for verification:', selectedCredential);
      return;
    }

    setVerifying(true);
    try {
      const response = await credentialService.verifyCredential(selectedCredential);
      setVerificationResult(response.data);
    } catch (err: any) {
      setVerificationResult({
        verified: false,
        error: err.message || 'Verification failed'
      });
    } finally {
      setVerifying(false);
    }
  };
  
  // Get credential type as string
  const getCredentialType = (credential: Credential) => {
    if (!credential) return 'Unknown';
    if (Array.isArray(credential.type)) {
      // Find the first non-VerifiableCredential type
      const type = credential.type.find(t => t !== 'VerifiableCredential');
      return type || credential.type[0] || 'Unknown';
    }
    return credential.type || 'Unknown';
  };
  
  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  };
  
  // Fetch credentials on component mount
  useEffect(() => {
    fetchCredentials();
  }, []);
  
  if (loading) {
    return (
      <div className="text-center my-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
        <p className="mt-2">Loading credentials...</p>
      </div>
    );
  }
  
  if (!user?.walletConnected) {
    return (
      <div>
        <h1 className="mb-4">Credential Management</h1>
        <Alert variant="warning">
          <Alert.Heading>Wallet Not Connected</Alert.Heading>
          <p>
            You need to connect an SSI wallet before you can manage credentials.
            Please complete the wallet connection process first.
          </p>
          <hr />
          <div className="d-flex justify-content-end">
            <Button variant="outline-primary" href="/wallet/connect">
              Connect Wallet
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-4">Credential Management</h1>
      
      <Card className="shadow-sm mb-4">
        <Card.Header className="bg-primary text-white">Issue New Credential</Card.Header>
        <Card.Body>
          {statusMessage && (
            <Alert variant={statusMessage.startsWith('Error') ? 'danger' : 'success'} dismissible onClose={() => setStatusMessage('')}>
              {statusMessage}
            </Alert>
          )}
          
          <Form onSubmit={handleIssueCredential}>
            <Form.Group className="mb-3">
              <Form.Label>Credential Type</Form.Label>
              <Form.Select 
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                disabled={issuingCredential}
              >
                {schemas.map(schema => (
                  <option key={schema.type} value={schema.type}>
                    {schema.type}
                  </option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted">
                {schemas.find(s => s.type === selectedType)?.description || 'No description available'}
              </Form.Text>
            </Form.Group>
            
            <Button 
              variant="primary" 
              type="submit" 
              disabled={issuingCredential || !selectedType}
            >
              {issuingCredential ? (
                <>
                  <Spinner
                    as="span"
                    animation="border"
                    size="sm"
                    role="status"
                    aria-hidden="true"
                    className="me-2"
                  />
                  Issuing...
                </>
              ) : (
                'Issue Credential'
              )}
            </Button>
          </Form>
        </Card.Body>
      </Card>
      
      <h2 className="h4 mb-3">Your Credentials</h2>
      
      {credentials.length === 0 ? (
        <Alert variant="info">
          You don't have any credentials yet. Issue your first credential using the form above.
        </Alert>
      ) : (
        <Row xs={1} md={2} lg={3} className="g-4">
          {credentials.map((credential) => {
            if (!credential) return null;
            
            const credType = getCredentialType(credential);
            
            return (
              <Col key={credential.id || Math.random()}>
                <Card className="h-100 shadow-sm">
                  <Card.Header className="bg-light">
                    <Badge bg="primary" className="me-2">
                      {credType}
                    </Badge>
                    {credential.status === 'active' && (
                      <Badge bg="success">Active</Badge>
                    )}
                  </Card.Header>
                  <Card.Body>
                    <Card.Title className="h5">
                      {credType}
                    </Card.Title>
                    <Card.Text className="mb-2">
                      <small className="text-muted">
                        Issued: {formatDate(credential.issuanceDate)}
                        {credential.expirationDate && (
                          <><br />Expires: {formatDate(credential.expirationDate)}</>
                        )}
                      </small>
                    </Card.Text>
                    <div className="card-text">
                      {credential.credentialSubject && Object.entries(credential.credentialSubject)
                        .filter(([key]) => key !== 'id')
                        .slice(0, 3)
                        .map(([key, value]) => (
                          <div key={key} className="mb-1">
                            <strong>{key}:</strong> {
                              typeof value === 'object' 
                                ? 'Complex value' 
                                : String(value).substring(0, 30) + (String(value).length > 30 ? '...' : '')
                            }
                          </div>
                        ))}
                      {credential.credentialSubject && Object.keys(credential.credentialSubject).length > 4 && (
                        <div className="text-muted">+ more fields</div>
                      )}
                    </div>
                  </Card.Body>
                  <Card.Footer className="d-flex justify-content-between">
                    <Button 
                      variant="outline-primary" 
                      size="sm"
                      onClick={() => handleViewCredential(credential)}
                    >
                      Details
                    </Button>
                    <Button 
                      variant="primary" 
                      size="sm"
                      onClick={() => handleShowQRCode(credential)}
                    >
                      View Credential
                    </Button>
                  </Card.Footer>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
      
      {/* Credential Details Modal */}
      <Modal
        show={showCredentialModal}
        onHide={() => setShowCredentialModal(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton className="bg-light">
          <Modal.Title>
            {selectedCredential && (
              <>
                <Badge bg="primary" className="me-2">
                  {Array.isArray(selectedCredential.type) 
                    ? selectedCredential.type.find(t => t !== 'VerifiableCredential') 
                    : selectedCredential.type}
                </Badge>
                Credential Details
              </>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedCredential && (
            <>
              <div className="mb-3">
                <strong>ID:</strong> {selectedCredential.id}
              </div>
              <div className="mb-3">
                <strong>Issuer:</strong> {selectedCredential.issuer}
              </div>
              <div className="mb-3">
                <strong>Issuance Date:</strong> {formatDate(selectedCredential.issuanceDate)}
              </div>
              {selectedCredential.expirationDate && (
                <div className="mb-3">
                  <strong>Expiration Date:</strong> {formatDate(selectedCredential.expirationDate)}
                </div>
              )}
              <div className="mb-3">
                <strong>Subject ID:</strong> {selectedCredential.credentialSubject.id || 'Not specified'}
              </div>
              
              <h5 className="mt-4 mb-3">Credential Subject</h5>
              <div className="bg-light p-3 rounded">
                {Object.entries(selectedCredential.credentialSubject)
                  .filter(([key]) => key !== 'id')
                  .map(([key, value]) => (
                    <div key={key} className="mb-2">
                      <strong>{key}:</strong> {
                        typeof value === 'object' 
                          ? JSON.stringify(value, null, 2) 
                          : String(value)
                      }
                    </div>
                  ))}
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCredentialModal(false)}>
            Close
          </Button>
          <Button 
            variant="primary"
            onClick={() => {
              setShowCredentialModal(false);
              if (selectedCredential) {
                handleShowQRCode(selectedCredential);
              }
            }}
          >
            View QR Code
          </Button>
        </Modal.Footer>
      </Modal>

      {/* QR Code Modal */}
      <Modal
        show={showQRModal}
        onHide={() => setShowQRModal(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton className="bg-light">
          <Modal.Title>
            {selectedCredential && (
              <>
                <Badge bg="primary" className="me-2">
                  {Array.isArray(selectedCredential.type) 
                    ? selectedCredential.type.find(t => t !== 'VerifiableCredential') 
                    : selectedCredential.type}
                </Badge>
                Credential QR Code
              </>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedCredential && (
            <div className="text-center">
              <div className="mb-4">
                <div className="d-inline-block p-3 bg-white border rounded">
                  <QRCodeSVG 
                    value={shareUrl} 
                    size={250}
                    level="H"
                    includeMargin={true}
                  />
                </div>
              </div>
              
              <div className="mb-4">
                <h5>Scan this QR code to claim your credential</h5>
                <p className="text-muted">
                  This QR code contains a link to download the raw credential JSON.
                </p>
              </div>

              <div className="mb-4">
                <h5 className="mb-2">Share URL</h5>
                <div className="d-flex justify-content-center">
                  <input 
                    type="text" 
                    value={shareUrl} 
                    readOnly 
                    className="form-control me-2 text-center"
                    style={{ maxWidth: '500px' }}
                  />
                  <Button 
                    variant="outline-primary"
                    onClick={() => {
                      navigator.clipboard.writeText(shareUrl);
                      alert('URL copied to clipboard!');
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>

              <div className="mb-4">
                <h5 className="mb-2">Raw Credential JSON</h5>
                <div className="bg-light p-3 rounded text-start" style={{ maxHeight: '200px', overflow: 'auto' }}>
                  <pre style={{ whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(selectedCredential, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="d-grid gap-2 d-md-flex justify-content-md-center">
                <a 
                  href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(selectedCredential, null, 2))}`} 
                  download={`credential-${selectedCredential.id}.json`}
                  className="btn btn-outline-primary btn-lg"
                >
                  Download Raw JSON
                </a>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleVerifyCredential}
                  disabled={verifying}
                >
                  {verifying ? 'Verifying...' : 'Verify Credential'}
                </Button>
              </div>

              {verificationResult && (
                <Alert 
                  variant={verificationResult.verified ? 'success' : 'danger'} 
                  className="mt-4 text-start"
                >
                  <Alert.Heading>{verificationResult.verified ? 'Verification Successful' : 'Verification Failed'}</Alert.Heading>
                  {verificationResult.verified ? (
                    <p>This credential has been successfully verified.</p>
                  ) : (
                    <p>Verification failed: {verificationResult.error}</p>
                  )}
                </Alert>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowQRModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default CredentialManagement;
