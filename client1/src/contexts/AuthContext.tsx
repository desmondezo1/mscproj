//protocol-bridge/client1/src/contexts/AuthContext.tsx
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';
import { bridgeService, BridgeLoginResponse } from '../services/apiService';

// User type definition
interface User {
  id: string;
  email: string;
  name?: string;
  roles?: string[];
  migrationPhase: string;
  did?: string;
  walletConnected: boolean;
  [key: string]: any;
}

// JWT token payload
interface JwtPayload {
  sub: string;
  email: string;
  name?: string;
  roles?: string[];
  migration_phase?: string;
  did?: string;
  wallet_connected?: boolean;
  exp: number;
  [key: string]: any;
}

// Auth context type
interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  login: () => void;
  loginWithVC: (verifiableCredential: any) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<User>;
  connectWallet: () => Promise<any>;
  issueCredential: (credentialType: string, claims?: any) => Promise<any>;
  convertIdentityToCredentials: () => Promise<any>;
  checkConnectionStatus: (connectionId: string) => Promise<any>;
  checkCredentialOfferStatus: (credentialOfferId: string) => Promise<any>;
  getIdentityMapping: () => Promise<any>;
  createDid: (method: string) => Promise<any>;
  getMigrationStats: () => Promise<any>;
}

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider props
interface AuthProviderProps {
  children: ReactNode;
}

// Provider component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // API base URL
  const apiUrl = import.meta.env.VITE_API_URL;
  
  // Set up axios with authentication token
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);
  
  // Load user info when token changes
  useEffect(() => {
    const loadUser = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      
      try {
        // Check if token is expired
        const decodedToken = jwtDecode<JwtPayload>(token);
        const currentTime = Date.now() / 1000;
        
        if (decodedToken.exp < currentTime) {
          // Token is expired
          logout();
          return;
        }
        
        // Token is valid, get user info
        const response = await axios.get(`${apiUrl}/auth/user`);
        
        setUser(response.data);
        setIsAuthenticated(true);
      } catch (err) {
        console.error('Error loading user:', err);
        setError('Failed to authenticate token');
        logout();
      } finally {
        setLoading(false);
      }
    };
    
    loadUser();
  }, [token, apiUrl]);
  
  // Check URL for token parameter on initial load
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const urlToken = queryParams.get('token');
    
    if (urlToken) {
      // Found token in URL
      localStorage.setItem('token', urlToken);
      setToken(urlToken);
      
      // Remove token from URL to prevent sharing
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);
  
  // Handle login
  const login = () => {
    // Redirect to API for SAML authentication
    window.location.href = `${apiUrl}/auth/saml`;
  };
  
  // Handle login with Verifiable Credential
  const loginWithVC = async (credential: any): Promise<{ success: boolean; error?: string }> => {
    const startTime = performance.now();
    try {
      console.log('Starting VC login process', {
        did: credential.credentialSubject?.id,
        type: credential.type
      });
      
      const response = await bridgeService.loginWithVC(credential);
      
      if (response.success && response.result?.token) {
        const { token, user } = response.result;
        
        console.log('VC login successful', {
          did: user.did,
          email: user.email,
          migrationPhase: user.migrationPhase
        });
        
        // Store token
        localStorage.setItem('token', token);
        setToken(token);
        
        // Set user state
        setUser({
          id: user.did,
          email: user.email,
          name: user.name,
          roles: user.roles,
          did: user.did,
          authProvider: 'vc',
          migrationPhase: user.migrationPhase,
          walletConnected: user.walletConnected
        });
        
        // Set authentication state
        setIsAuthenticated(true);
        
        const duration = performance.now() - startTime;
        console.log('VC login completed', {
          duration: `${duration.toFixed(2)}ms`,
          success: true
        });
        
        return { success: true };
      }
      
      throw new Error(response.error || 'Failed to authenticate with credential');
    } catch (error) {
      const duration = performance.now() - startTime;
      console.error('VC login failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration.toFixed(2)}ms`
      });
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to authenticate with credential'
      };
    }
  };
  
  // Handle logout
  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
  };
  
  // Refresh user data
  const refreshUser = async (): Promise<User> => {
    try {
      const response = await axios.get(`${apiUrl}/auth/user`);
      setUser(response.data);
      setIsAuthenticated(true);
      return response.data;
    } catch (err) {
      console.error('Error refreshing user:', err);
      setError('Failed to refresh user data');
      setIsAuthenticated(false);
      throw err;
    }
  };
  
  // Connect a wallet
  const connectWallet = async () => {
    try {
      const response = await axios.post(`${apiUrl}/bridge/wallet/connect`);
      
      // Update the user's wallet connection state
      if (user) {
        setUser({
          ...user,
          walletConnected: true
        });
      }
      
      // Refresh user data to ensure we have the latest state
      await refreshUser();
      
      return response.data;
    } catch (err) {
      console.error('Error connecting wallet:', err);
      setError('Failed to connect wallet');
      throw err;
    }
  };
  
  // Issue a credential
  const issueCredential = async (credentialType: string, claims?: any) => {
    try {
      const response = await axios.post(`${apiUrl}/bridge/credentials/issue`, {
        credentialType,
        claims
      });
      return response.data;
    } catch (err) {
      console.error('Error issuing credential:', err);
      setError('Failed to issue credential');
      throw err;
    }
  };
  
  // Convert identity to credentials
  const convertIdentityToCredentials = async () => {
    try {
      const response = await axios.post(`${apiUrl}/bridge/convert/identity-to-credentials`);
      return response.data;
    } catch (err) {
      console.error('Error converting identity to credentials:', err);
      setError('Failed to convert identity to credentials');
      throw err;
    }
  };
  
  // Check connection status
  const checkConnectionStatus = async (connectionId: string) => {
    try {
      const response = await axios.get(`${apiUrl}/bridge/wallet/connection/${connectionId}`);
      return response.data;
    } catch (err) {
      console.error('Error checking connection status:', err);
      throw err;
    }
  };
  
  // Check credential offer status
  const checkCredentialOfferStatus = async (credentialOfferId: string) => {
    try {
      const response = await axios.get(`${apiUrl}/bridge/credentials/offer/${credentialOfferId}`);
      return response.data;
    } catch (err) {
      console.error('Error checking credential offer status:', err);
      throw err;
    }
  };
  
  // Get identity mapping
  const getIdentityMapping = async () => {
    try {
      const response = await axios.get(`${apiUrl}/identity/mapping`);
      return response.data;
    } catch (err) {
      console.error('Error getting identity mapping:', err);
      throw err;
    }
  };
  
  // Create a DID
  const createDid = async (method: string) => {
    try {
      const response = await axios.post(`${apiUrl}/did`, { method });
      
      // Store the new token if it's in the response
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        setToken(response.data.token);
      }
      
      await refreshUser();
      return response.data;
    } catch (err) {
      console.error('Error creating DID:', err);
      setError('Failed to create DID');
      throw err;
    }
  };
  
  // Get migration statistics
  const getMigrationStats = async () => {
    try {
      const response = await axios.get(`${apiUrl}/bridge/stats`);
      return response.data;
    } catch (err) {
      console.error('Error getting migration stats:', err);
      throw err;
    }
  };
  
  const value = {
    user,
    token,
    isAuthenticated,
    loading,
    error,
    login,
    loginWithVC,
    logout,
    refreshUser,
    connectWallet,
    issueCredential,
    convertIdentityToCredentials,
    checkConnectionStatus,
    checkCredentialOfferStatus,
    getIdentityMapping,
    createDid,
    getMigrationStats
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook for using the auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 