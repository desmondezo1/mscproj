import axios from 'axios';
import { getFullnodeUrl, SuiClient, SuiHTTPTransport } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';

// Base API URL
const API_URL = import.meta.env.VITE_API_URL;

// Constants for SUI blockchain
const PACKAGE_ID = import.meta.env.VITE_SUI_PACKAGE_ID || '0xe9e54cddeaba84ab70174cbaa1dbbbc46138e5bc696fe9e2704f31b30383a8ca'; 
const REGISTRY_ID = import.meta.env.VITE_SUI_REGISTRY_ID || '0xfd4c30168e3d66d64aa15beec99fddef76d50d01a62c36eaf772ecbcbcdba34a';
const SUI_RPC_URL = import.meta.env.VITE_SUI_RPC_URL || getFullnodeUrl('devnet');

// Set up axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      if (error.response.status === 401) {
        // Unauthorized - clear token and reload page
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Initialize Sui client
const transport = new SuiHTTPTransport({
  url: SUI_RPC_URL,
});
const suiClient = new SuiClient({ transport });

// Authentication services
export const authService = {
  // Get user info
  getCurrentUser: () => api.get('/auth/user'),
  
  // Get SAML metadata
  getSamlMetadata: () => api.get('/auth/saml/metadata')
};

// DID services
export const didService = {
  // Create a new DID
  createDid: async (method: string, walletData?: any) => {
    // For SUI method, include wallet address and public key
    if (method === 'sui' && walletData) {
      // Generate a unique identifier for the DID
      const didId = `did:sui:${walletData.address}`;
      
      // Create a DID document
      const didDocument = {
        '@context': [
          'https://www.w3.org/ns/did/v1',
          'https://w3id.org/security/suites/ed25519-2020/v1'
        ],
        id: didId,
        controller: [didId],
        verificationMethod: [
          {
            id: `${didId}#key-1`,
            type: 'Ed25519VerificationKey2020',
            controller: didId,
            publicKeyMultibase: walletData.publicKey
          }
        ],
        authentication: [`${didId}#key-1`],
        assertionMethod: [`${didId}#key-1`]
      };
      
      const didDocumentString = JSON.stringify(didDocument);
      
      try {
        console.log('[DID Service] Registering DID on blockchain:', didId);
        
        let registerResponse = null;
        let registrationMethod = 'direct';
        
        // Try to register on blockchain if wallet is available
        if (walletData.wallet) {
          try {
            // Use the suiBlockchainService to register the DID
            registerResponse = await suiBlockchainService.registerDid(didId, didDocumentString, walletData.wallet);
            console.log('[DID Service] DID registered on blockchain via direct method:', registerResponse);
          } catch (blockchainError) {
            console.warn('[DID Service] Direct blockchain registration failed:', blockchainError);
            console.log('[DID Service] Falling back to server-side registration...');
            
            // Fall back to server-side registration
            registerResponse = await suiBlockchainService.registerDid(didId, didDocumentString, null);
            registrationMethod = 'server';
            console.log('[DID Service] DID registered on blockchain via server method:', registerResponse);
          }
        } else {
          // Use server-side registration if no wallet provided
          registerResponse = await suiBlockchainService.registerDid(didId, didDocumentString, null);
          registrationMethod = 'server';
          console.log('[DID Service] DID registered on blockchain via server method:', registerResponse);
        }
        
        if (!registerResponse || !registerResponse.success) {
          throw new Error(`Blockchain registration failed: ${JSON.stringify(registerResponse || {})}`);
        }
        
        // Now send to the backend with isRegisteredOnChain flag
        const response = await api.post('/did', { 
          method,
          walletAddress: walletData.address,
          publicKey: walletData.publicKey,
          did: didId,
          didDocument: didDocument,
          isRegisteredOnChain: true,
          transactionDigest: registerResponse?.transactionDigest,
          registrationMethod 
        });
        
        return response;
      } catch (error: any) {
        console.error('[DID Service] Error registering DID on blockchain:', error);
        
        // If it's an Axios error, provide more details
        if (error.response) {
          const statusCode = error.response.status;
          const errorMessage = error.response.data?.error || 'Unknown server error';
          throw new Error(`Failed to register DID (HTTP ${statusCode}): ${errorMessage}`);
        }
        
        throw new Error(`Failed to register DID on blockchain: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // For other methods, just include the method
    return api.post('/did', { method });
  },
  
  // Get a DID by ID
  getDid: (did: string) => api.get(`/did/${encodeURIComponent(did)}`),
  
  // Verify a DID
  verifyDid: (did: string) => api.get(`/did/${encodeURIComponent(did)}/verify`),
  
  // Update a DID document
  updateDid: (did: string, didDocument: any) => api.put(`/did/${encodeURIComponent(did)}`, { didDocument }),
  
  // Deactivate a DID
  deactivateDid: (did: string) => api.delete(`/did/${encodeURIComponent(did)}`),
  
  // Transfer control of a DID
  transferControl: (did: string, newController: string) => 
    api.post(`/did/${encodeURIComponent(did)}/transfer`, { newController })
};

// Credential services
export const credentialService = {
  // Get credential schemas
  getSchemas: () => api.get('/credentials/schemas'),
  
  // Get a credential schema by type
  getSchema: (type: string) => api.get(`/credentials/schemas/${type}`),
  
  // Verify a credential
  verifyCredential: (credential: any) => api.post('/credentials/verify', { credential }),
  
  // Create a verifiable presentation
  createPresentation: (credentials: any[], options?: any) => 
    api.post('/credentials/presentation', { credentials, options }),
  
  // Verify a presentation
  verifyPresentation: (presentation: any) => 
    api.post('/credentials/presentation/verify', { presentation }),
  
  // Get all credentials for the authenticated user
  getUserCredentials: () => api.get('/credentials'),
};

// Wallet services
export const walletService = {
  // Create a connection invitation
  createConnectionInvitation: (options?: any) => api.post('/wallet/connections', options),
  
  // Get connection status
  getConnectionStatus: (connectionId: string) => api.get(`/wallet/connections/${connectionId}`),
  
  // Get all connections
  getUserConnections: () => api.get('/wallet/connections'),
  
  // Offer a credential
  offerCredential: (connectionId: string, credential: any) => 
    api.post('/wallet/credentials/offer', { connectionId, credential }),
  
  // Get credential offer status
  getCredentialOfferStatus: (credentialOfferId: string) => 
    api.get(`/wallet/credentials/offer/${credentialOfferId}`),
  
  // Request presentation of credentials
  requestPresentation: (connectionId: string, credentialTypes: string[], options?: any) => 
    api.post('/wallet/presentations/request', { connectionId, credentialTypes, options }),
  
  // Get presentation request status
  getPresentationRequestStatus: (presentationRequestId: string) => 
    api.get(`/wallet/presentations/request/${presentationRequestId}`)
};

export interface BridgeLoginResponse {
  success: boolean;
  result?: {
    success: boolean;
    token: string;
    user: {
      email: string;
      name: string;
      did: string;
      roles: string[];
      migrationPhase: string;
      walletConnected: boolean;
    };
  };
  error?: string;
}

// Bridge services
export const bridgeService = {
  // Connect wallet
  connectWallet: () => api.post('/bridge/wallet/connect'),
  
  // Check wallet connection status
  checkConnectionStatus: (connectionId: string) => 
    api.get(`/bridge/wallet/connection/${connectionId}`),
  
  // Issue credential
  issueCredential: (credentialType: string, claims?: any) => 
    api.post('/bridge/credentials/issue', { credentialType, claims }),
  
  // Check credential offer status
  checkCredentialOfferStatus: (credentialOfferId: string) => 
    api.get(`/bridge/credentials/offer/${credentialOfferId}`),
  
  // Convert identity to credentials
  convertIdentityToCredentials: () => 
    api.post('/bridge/convert/identity-to-credentials'),
  
  // Request credential verification
  requestCredentialVerification: (credentialTypes: string[]) => 
    api.post('/bridge/credentials/verify', { credentialTypes }),
  
  // Check presentation request status
  checkPresentationRequestStatus: (presentationRequestId: string) => 
    api.get(`/bridge/presentations/request/${presentationRequestId}`),
  
  // Translate between identity protocols
  translateProtocol: (identity: any, sourceProtocol: string, targetProtocol: string) => 
    api.post('/bridge/translate', { identity, sourceProtocol, targetProtocol }),
  
  // Get migration statistics
  getMigrationStats: () => api.get('/bridge/stats'),
  
  // Login with Verifiable Credential
  async loginWithVC(credential: any): Promise<BridgeLoginResponse> {
    const response = await api.post('/bridge/roundtrip', {
      protocol: 'vc',
      data: credential
    });
    return response.data;
  },
};

// SUI blockchain services
export const suiBlockchainService = {
  // Get network status
  getNetworkStatus: () => api.get('/bridge/blockchain/sui/status'),
  
  // Get SUI DID registry information
  getDidRegistryInfo: () => api.get('/bridge/blockchain/sui/did-registry'),
  
  // Sign and register DID on SUI blockchain
  registerDid: async (did: string, didDocument: string, wallet: any): Promise<any> => {
    console.log('[DEBUG-blockchainService] Starting registerDID', { did, documentLength: didDocument.length });

    try {
      // First try to use the server-side registration endpoint as fallback
      if (!wallet || !wallet.address) {
        console.log('[Blockchain Service] No wallet provided, using server-side registration');
        
        // Send registration request to backend
        const response = await api.post('/bridge/blockchain/sui/register-did', { 
          did, 
          didDocument,
          signature: wallet?.signature 
        });
        
        return response.data;
      }
      
      console.log('[Blockchain Service] Registering DID using direct blockchain interaction');
      
      // Create a new transaction to register the DID
      const tx = new Transaction();
      
      // Convert the document string to bytes array for the Move call
      const documentBytes = Array.from(new TextEncoder().encode(didDocument));
      
      // Build the Move call to register the DID
      tx.moveCall({
        target: `${PACKAGE_ID}::did_registry::register_did`,
        arguments: [
          tx.object(REGISTRY_ID),
          tx.pure.string(did),
          tx.pure.vector('u8', documentBytes)
        ],
      });
      
      // If this is a @suiet/wallet-kit wallet
      if (wallet.signAndExecuteTransaction) {
        const result = await wallet.signAndExecuteTransaction({ transaction: tx });
        console.log('[Blockchain Service] Transaction executed successfully, digest:', result.digest);
        
        return {
          success: true,
          did,
          transactionDigest: result.digest,
          message: 'DID registered on SUI blockchain'
        };
      } 
      // If the wallet doesn't have the signAndExecuteTransaction method, use server-side registration
      else {
        console.log('[Blockchain Service] Wallet does not support direct transaction signing, using server-side registration');
        const response = await api.post('/bridge/blockchain/sui/register-did', { 
          did, 
          didDocument,
          signature: wallet?.signature 
        });
        
        return response.data;
      }
    } catch (error) {
      console.error('[Blockchain Service] Error registering DID:', error);
      throw new Error(`Failed to register DID on blockchain: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
  
  // Resolve DID from SUI blockchain
  resolveDid: async (did: string, wallet: any): Promise<string | null> => {
    try {
      // Try to resolve using server first (simpler approach)
      try {
        const response = await api.get(`/bridge/blockchain/sui/resolve-did/${encodeURIComponent(did)}`);
        if (response.data && response.data.didDocument) {
          return response.data.didDocument;
        }
      } catch (serverError) {
        console.log('[Blockchain Service] Server-side resolution failed, trying direct blockchain interaction');
      }
      
      // If server-side resolution fails, try direct blockchain interaction
      if (!wallet || !wallet.address) {
        console.error('[Blockchain Service] No wallet connected for resolving DID');
        return null;
      }
      
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::did_registry::resolve_did`,
        arguments: [
          tx.object(REGISTRY_ID),
          tx.pure.string(did)
        ],
      });
      
      const result = await suiClient.devInspectTransactionBlock({
        sender: wallet.address,
        transactionBlock: tx,
      });
      
      if (result.effects?.status?.status === 'success') {
        const documentBytesRaw = result.results?.[0]?.returnValues?.[0]?.[0];
        if (documentBytesRaw) {
          const documentBytes = new Uint8Array(documentBytesRaw);
          return new TextDecoder().decode(documentBytes);
        }
      }
      
      return null;
    } catch (error) {
      console.error('[Blockchain Service] Error resolving DID:', error);
      return null;
    }
  },
  
  // Check if a DID is registered on the blockchain
  isDIDRegistered: async (did: string, wallet: any): Promise<boolean> => {
    const document = await suiBlockchainService.resolveDid(did, wallet);
    return document !== null;
  }
};

// Identity services
export const identityService = {
  // Get user's identity mapping
  getUserMapping: () => api.get('/identity/mapping'),
  
  // Update user's identity mapping
  updateUserMapping: (updateData: any) => api.put('/identity/mapping', updateData),
  
  // Add a DID to user's identity mapping
  addDid: (did: string, didMethod: string) => 
    api.post('/identity/mapping/did', { did, didMethod }),
  
  // Connect a wallet to user's identity mapping
  connectWallet: (connectionId: string) => 
    api.post('/identity/mapping/wallet', { connectionId }),
  
  // Update migration phase
  updateMigrationPhase: (phase: string) => 
    api.post('/identity/mapping/phase', { phase }),
  
  // Get migration phase statistics
  getPhaseStats: () => api.get('/identity/phases/stats')
};

export default {
  authService,
  didService,
  credentialService,
  walletService,
  bridgeService,
  identityService,
  suiBlockchainService
}; 