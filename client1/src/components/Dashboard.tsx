import React, { useEffect, useState } from 'react';
import { Card, Button, ProgressBar } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  
  // Get phase display name
  const getPhaseDisplayName = (phase: string): string => {
    const phaseMap: { [key: string]: string } = {
      'traditional': 'Traditional Identity',
      'preparation': 'Preparation Phase',
      'hybrid': 'Hybrid Operation',
      'claiming': 'DID Claiming',
      'full_ssi': 'Full SSI'
    };
    
    return phaseMap[phase] || phase;
  };
  
  // Get phase description
  const getPhaseDescription = (phase: string): string => {
    const descriptionMap: { [key: string]: string } = {
      'traditional': 'Authentication via SAML/OIDC. No SSI components in use.',
      'preparation': 'DIDs created but under organizational control. Authentication still via SAML/OIDC.',
      'hybrid': 'Bridge translates between traditional and SSI systems. Verifiable credentials available.',
      'claiming': 'Users claim control of their DIDs. Enhanced control over identity data.',
      'full_ssi': 'Complete user control of identity data. Optional retirement of traditional identity.'
    };
    
    return descriptionMap[phase] || '';
  };
  
  // Get current phase index
  const getCurrentPhaseIndex = (): number => {
    const phases = ['traditional', 'preparation', 'hybrid', 'claiming', 'full_ssi'];
    return phases.indexOf(user?.migrationPhase || 'traditional');
  };
  
  // Progress percentage
  const progressPercentage = (): number => {
    const currentIndex = getCurrentPhaseIndex();
    return ((currentIndex + 1) / 5) * 100;
  };
  
  // Get next step for current phase
  const getNextStep = (): React.ReactNode => {
    if (!user) return <></>;
    
    switch (user.migrationPhase) {
      case 'traditional':
        return (
          <Button
            to="/onboarding/did"
            variant="primary"
            as={Link as any}
          >
            Create Your DID
          </Button>
        );
        
      case 'preparation':
        return (
          <Button
            to="/wallet/connect"
            variant="primary"
            as={Link as any}
          >
            Connect Your Wallet
          </Button>
        );
        
      case 'hybrid':
        return (
          <Button
            to="/credentials"
            variant="primary"
            as={Link as any}
          >
            Manage Credentials
          </Button>
        );
        
      case 'claiming':
        return (
          <Button
            to="/profile"
            variant="primary"
            as={Link as any}
          >
            Claim Your DID
          </Button>
        );
        
      default:
        return <></>;
    }
  };
  
  return (
    <div>
      <h1 className="mb-4">Dashboard</h1>
      
      {user && (
        <Card className="mb-4 shadow-sm">
          <Card.Body>
            <h2 className="h4 mb-4">Your Migration Progress</h2>
            
            <ProgressBar 
              now={progressPercentage()} 
              className="mb-3 progress-lg"
              variant="success"
              label={`${Math.round(progressPercentage())}%`}
            />
            
            <div className="mb-4">
              <h3 className="h5">Current Phase: {getPhaseDisplayName(user.migrationPhase)}</h3>
              <p className="text-muted">{getPhaseDescription(user.migrationPhase)}</p>
            </div>
            
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <strong>Your DID:</strong> {user.did || 'Not created yet'}
                <br />
                <strong>Wallet Connected:</strong> {user.walletConnected ? 'Yes' : 'No'}
              </div>
              
              <div>
                {getNextStep()}
              </div>
            </div>
          </Card.Body>
        </Card>
      )}
    </div>
  );
};

export default Dashboard; 