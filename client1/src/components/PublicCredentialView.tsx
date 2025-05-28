import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { credentialService } from '../services/apiService';

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

// This component serves raw JSON as an API endpoint
const PublicCredentialView: React.FC = () => {
  const { credentialId } = useParams<{ credentialId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    const handleApiResponse = async () => {
      // We need to completely take over the response
      // First, halt the normal React rendering process
      document.body.innerHTML = '';
      document.head.innerHTML = '';

      // Add proper JSON content-type header
      const metaContentType = document.createElement('meta');
      metaContentType.httpEquiv = 'Content-Type';
      metaContentType.content = 'application/json; charset=utf-8';
      document.head.appendChild(metaContentType);

      if (!credentialId) {
        respondWithJson({ error: 'No credential ID provided' });
        return;
      }

      try {
        // In a real implementation, fetch credential from server
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Create a simulated credential based on the ID
        const simulatedCredential: Credential = {
          id: credentialId,
          type: ['VerifiableCredential', 'IdentityCredential'],
          issuer: 'did:example:issuer',
          issuanceDate: new Date().toISOString(),
          expirationDate: new Date(Date.now() + (365 * 86400000)).toISOString(),
          credentialSubject: {
            id: 'did:example:subject',
            name: 'Jane Doe',
            email: 'jane.doe@example.com'
          },
          proof: {
            type: 'Ed25519Signature2020',
            created: new Date().toISOString(),
            verificationMethod: 'did:example:issuer#key-1',
            proofPurpose: 'assertionMethod',
            proofValue: 'zJUF7bdYwUiLZUYJ9gKGVQyxPvAGQFdh9XKFJb2nWy6FD5NAyNQK5xQB7bXnMQeiqbNSG3azahNQ8oZEQeBeTxip'
          },
          status: 'active'
        };

        respondWithJson(simulatedCredential);
      } catch (err: any) {
        respondWithJson({ error: err.message || 'Failed to load credential' });
      }
    };

    // Helper function to respond with JSON
    const respondWithJson = (data: any) => {
      // Set proper JSON header for content-type
      const style = document.createElement('style');
      style.textContent = 'body { display: none; }'; // Hide any potential UI
      document.head.appendChild(style);

      // Output the data as pre-formatted text (will appear as plain JSON)
      const pre = document.createElement('pre');
      pre.textContent = JSON.stringify(data, null, 2);
      document.body.appendChild(pre);

      // Modify mime type
      document.documentElement.innerHTML = '';
      document.open('application/json');
      document.write(JSON.stringify(data, null, 2));
      document.close();
    };

    handleApiResponse();
    
    // Cleanup not needed since we completely took over
  }, [credentialId, navigate]);

  // Return null as rendering is handled directly
  return null;
};

export default PublicCredentialView; 