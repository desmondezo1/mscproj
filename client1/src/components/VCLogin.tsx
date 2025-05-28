import React, { useState } from 'react';
import { Button, Form, Modal, Alert, Spinner } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';

interface VCLoginProps {
  show: boolean;
  onHide: () => void;
}

const VCLogin: React.FC<VCLoginProps> = ({ show, onHide }) => {
  const { loginWithVC, error: authError, loading } = useAuth();
  const [inputMethod, setInputMethod] = useState<'paste' | 'upload'>('paste');
  const [vcJson, setVcJson] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string>('');
  const [processing, setProcessing] = useState<boolean>(false);
  
  // Reset form when modal is opened/closed
  const handleShow = () => {
    setInputMethod('paste');
    setVcJson('');
    setFile(null);
    setError('');
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setProcessing(true);
    
    try {
      // Get the VC JSON
      let vcData: any;
      
      if (inputMethod === 'paste') {
        // Use the pasted JSON
        if (!vcJson) {
          throw new Error('Please enter your Verifiable Credential JSON');
        }
        
        try {
          vcData = JSON.parse(vcJson);
        } catch (err) {
          throw new Error('Invalid JSON format. Please check your input.');
        }
      } else {
        // Use the uploaded file
        if (!file) {
          throw new Error('Please select a Verifiable Credential file');
        }
        
        const fileContent = await readFileAsText(file);
        
        try {
          vcData = JSON.parse(fileContent);
        } catch (err) {
          throw new Error('Invalid JSON file. Please check the file content.');
        }
      }
      
      // Validate that it looks like a VC
      if (!vcData['@context'] || !vcData.type || !vcData.type.includes('VerifiableCredential')) {
        throw new Error('Invalid Verifiable Credential format. The document must include @context and type fields.');
      }
      
      // Attempt to login with the VC
      const result = await loginWithVC(vcData);
      
      if (result === true) {
        // Successfully authenticated, modal will be closed by parent component
        onHide();
        window.location.href = '/dashboard'; // Redirect to dashboard
      } else if (result && result.redirectUrl) {
        // If the server returned a redirect URL
        window.location.href = result.redirectUrl;
      } else {
        throw new Error('Authentication failed. Please check your credential and try again.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };
  
  // Read file content as text
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target?.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsText(file);
    });
  };
  
  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };
  
  return (
    <Modal show={show} onHide={onHide} onShow={handleShow} centered>
      <Modal.Header closeButton>
        <Modal.Title>Login with Verifiable Credential</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-muted mb-3">
          Use a Verifiable Credential to authenticate. You can either paste the credential JSON or upload a file.
        </p>
        
        {(error || authError) && (
          <Alert variant="danger">
            {error || authError}
          </Alert>
        )}
        
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Input Method</Form.Label>
            <div>
              <Form.Check
                inline
                type="radio"
                label="Paste JSON"
                name="inputMethod"
                id="paste-method"
                checked={inputMethod === 'paste'}
                onChange={() => setInputMethod('paste')}
              />
              <Form.Check
                inline
                type="radio"
                label="Upload File"
                name="inputMethod"
                id="upload-method"
                checked={inputMethod === 'upload'}
                onChange={() => setInputMethod('upload')}
              />
            </div>
          </Form.Group>
          
          {inputMethod === 'paste' ? (
            <Form.Group className="mb-3">
              <Form.Label>Verifiable Credential JSON</Form.Label>
              <Form.Control
                as="textarea"
                rows={8}
                value={vcJson}
                onChange={(e) => setVcJson(e.target.value)}
                placeholder='{"@context": ["https://www.w3.org/2018/credentials/v1"], "type": ["VerifiableCredential"], ...}'
                disabled={processing || loading}
              />
            </Form.Group>
          ) : (
            <Form.Group className="mb-3">
              <Form.Label>Upload Verifiable Credential</Form.Label>
              <Form.Control
                type="file"
                accept=".json"
                onChange={handleFileChange}
                disabled={processing || loading}
              />
              {file && (
                <p className="text-muted mt-2">
                  Selected file: {file.name}
                </p>
              )}
            </Form.Group>
          )}
          
          <div className="d-grid mt-4">
            <Button 
              variant="primary" 
              type="submit"
              disabled={processing || loading}
            >
              {(processing || loading) ? (
                <>
                  <Spinner
                    as="span"
                    animation="border"
                    size="sm"
                    role="status"
                    aria-hidden="true"
                    className="me-2"
                  />
                  Authenticating...
                </>
              ) : (
                'Login'
              )}
            </Button>
          </div>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <div className="w-100 text-center text-muted">
          <small>
            Your credential will be securely processed by the Protocol Bridge service.
          </small>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default VCLogin; 