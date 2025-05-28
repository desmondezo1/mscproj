import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import './App.css';

// Import components
import Header from './components/Header';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import WalletConnect from './components/WalletConnect';
import OnboardingDid from './components/OnboardingDid';
import CredentialManagement from './components/CredentialManagement';
import PublicCredentialView from './components/PublicCredentialView';
import OnboardingWallet from './components/OnboardingWallet';

// Protected route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <div className="loading-container">Loading...</div>;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  return <>{children}</>;
};

// Phase-specific route component
const PhaseRoute = ({ phase, children }: { phase: string, children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="loading-container">Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  const phases = ['traditional', 'preparation', 'hybrid', 'claiming', 'full_ssi'];
  const userPhaseIndex = phases.indexOf(user.migrationPhase);
  const requiredPhaseIndex = phases.indexOf(phase);
  
  if (userPhaseIndex < requiredPhaseIndex) {
    if (phase === 'preparation' && !user.hasDid) {
      return <Navigate to="/onboarding/did" />;
    }
    if (phase === 'hybrid' && !user.walletConnected) {
      return <Navigate to="/onboarding/wallet" />;
    }
    return <Navigate to="/dashboard" />;
  }
  
  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Header />
        <Container className="mt-4 mb-5">
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/credentials" element={
              <ProtectedRoute>
                <PhaseRoute phase="hybrid">
                  <CredentialManagement />
                </PhaseRoute>
              </ProtectedRoute>
            } />
            
            <Route path="/wallet/connect" element={
              <ProtectedRoute>
                <PhaseRoute phase="preparation">
                  <WalletConnect />
                </PhaseRoute>
              </ProtectedRoute>
            } />
            
            <Route path="/onboarding/did" element={
              <ProtectedRoute>
                <OnboardingDid />
              </ProtectedRoute>
            } />
            
            <Route path="/onboarding/wallet" element={
              <ProtectedRoute>
                <OnboardingWallet />
              </ProtectedRoute>
            } />
            
            {/* Public route for credential sharing - no authentication required */}
            <Route path="/public-credential/:credentialId" element={<PublicCredentialView />} />
            
            <Route path="/" element={<Navigate to="/dashboard" />} />
          </Routes>
        </Container>
      </Router>
    </AuthProvider>
  );
}

export default App;
