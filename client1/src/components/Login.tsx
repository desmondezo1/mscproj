import React, { useEffect, useState } from 'react';
import { Card, Button, Container, Row, Col, Form, Modal, Nav, Tab, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import VCLogin from './VCLogin';

const Login: React.FC = () => {
  const { login, isAuthenticated } = useAuth();
  const [showVCLogin, setShowVCLogin] = useState(false);
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [keycloakLoading, setKeycloakLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const navigate = useNavigate();
  
  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  // Check for error query parameter on mount (for SAML redirect errors)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get('error');
    
    if (errorParam) {
      const decodedError = decodeURIComponent(errorParam);
      setAuthError(decodedError);
      
      // Remove the error from the URL to prevent it persisting on refresh
      const url = new URL(window.location.href);
      url.searchParams.delete('error');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  const handleVCLoginClick = () => {
    setShowVCLogin(true);
  };

  const handleEmailLoginClick = () => {
    setShowEmailLogin(true);
    setActiveTab('login');
  };

  const handleKeycloakLogin = () => {
    setKeycloakLoading(true);
    setAuthError(null);
    
    try {
      // Use the login function from AuthContext
      login();
      
      // No need to handle success as we will be redirected
    } catch (err) {
      console.error('Error initiating Keycloak login:', err);
      setAuthError('Failed to initiate Keycloak login. Please try again later.');
      setKeycloakLoading(false);
    }
  };

  const handleEmailLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Store token and update auth state
      localStorage.setItem('token', data.token);
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/email/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email, 
          password,
          firstName,
          lastName
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Switch to login tab after successful registration
      setActiveTab('login');
      setError('Registration successful! Please login with your credentials.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Container className="mt-5">
      <Row className="justify-content-center">
        <Col md={8} lg={6}>
          {/* Show authentication errors from redirect */}
          {authError && (
            <Alert variant="danger" className="mb-4" onClose={() => setAuthError(null)} dismissible>
              <Alert.Heading>Authentication Error</Alert.Heading>
              <p>{authError}</p>
              <hr />
              <p className="mb-0">
                Please try again or use a different authentication method. If the problem persists, 
                contact your administrator.
              </p>
            </Alert>
          )}

          <Card className="shadow-lg border-0">
            <Card.Body className="p-5">
              <div className="text-center mb-4">
                <h1 className="fw-bold mb-2">Protocol Bridge</h1>
                <p className="text-muted">
                  Self-Sovereign Identity Migration
                </p>
              </div>
              
              <Card className="mb-4 bg-light border-0">
                <Card.Body>
                  <h5 className="mb-3">What is the Protocol Bridge?</h5>
                  <p>
                    The Protocol Bridge helps organizations seamlessly transition from traditional 
                    identity systems (like SAML and OpenID Connect) to Self-Sovereign Identity.
                  </p>
                  <p className="mb-0">
                    It provides a gradual, phased approach to identity migration while maintaining 
                    compatibility with existing systems.
                  </p>
                </Card.Body>
              </Card>
              
              <div className="d-grid gap-2">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleKeycloakLogin}
                  className="py-3"
                  disabled={keycloakLoading}
                >
                  {keycloakLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Redirecting to Keycloak...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-box-arrow-in-right me-2"></i>
                      Login with Keycloak
                    </>
                  )}
                </Button>
                
                <Button
                  variant="outline-primary"
                  size="lg"
                  onClick={handleEmailLoginClick}
                  className="py-3 mt-2"
                  disabled={keycloakLoading}
                >
                  <i className="bi bi-envelope me-2"></i>
                  Login with Email
                </Button>
                
                <Button
                  variant="outline-primary"
                  size="lg"
                  onClick={handleVCLoginClick}
                  className="py-3 mt-2"
                  disabled={keycloakLoading}
                >
                  <i className="bi bi-card-heading me-2"></i>
                  Login with Credential
                </Button>
                
                <div className="text-center mt-3">
                  <small className="text-muted">
                    You will be redirected to authenticate with your organization's 
                    identity provider or use your Verifiable Credential.
                  </small>
                </div>
              </div>
            </Card.Body>
          </Card>

          {/* Login method information */}
          <Card className="shadow-sm border-0 mt-4">
            <Card.Body className="p-4">
              <h5 className="mb-3">Authentication Methods</h5>
              <ul className="list-unstyled">
                <li className="mb-3">
                  <strong><i className="bi bi-box-arrow-in-right me-2"></i>Keycloak Login:</strong> Use your organizational 
                  credentials through Keycloak identity provider.
                </li>
                <li className="mb-3">
                  <strong><i className="bi bi-envelope me-2"></i>Email Login:</strong> Use a registered email 
                  and password combination.
                </li>
                <li>
                  <strong><i className="bi bi-card-heading me-2"></i>Credential Login:</strong> Use a verifiable 
                  credential stored in your digital wallet.
                </li>
              </ul>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      
      {/* VC Login Modal */}
      <VCLogin 
        show={showVCLogin} 
        onHide={() => setShowVCLogin(false)} 
      />

      {/* Email Login/Signup Modal */}
      <Modal show={showEmailLogin} onHide={() => setShowEmailLogin(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Email Authentication</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && (
            <div className={`alert ${error.includes('successful') ? 'alert-success' : 'alert-danger'}`} role="alert">
              {error}
            </div>
          )}
          
          <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k || 'login')}>
            <Nav variant="tabs" className="mb-3">
              <Nav.Item>
                <Nav.Link eventKey="login">Login</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="signup">Sign Up</Nav.Link>
              </Nav.Item>
            </Nav>

            <Tab.Content>
              <Tab.Pane eventKey="login">
                <Form onSubmit={handleEmailLoginSubmit}>
                  <Form.Group className="mb-3">
                    <Form.Label>Email address</Form.Label>
                    <Form.Control
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Password</Form.Label>
                    <Form.Control
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </Form.Group>

                  <div className="d-grid">
                    <Button 
                      variant="primary" 
                      type="submit"
                      disabled={loading}
                    >
                      {loading ? 'Logging in...' : 'Login'}
                    </Button>
                  </div>
                </Form>
              </Tab.Pane>

              <Tab.Pane eventKey="signup">
                <Form onSubmit={handleSignupSubmit}>
                  <Form.Group className="mb-3">
                    <Form.Label>First Name</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Enter your first name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Last Name</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Enter your last name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Email address</Form.Label>
                    <Form.Control
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Password</Form.Label>
                    <Form.Control
                      type="password"
                      placeholder="Choose a password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </Form.Group>

                  <div className="d-grid">
                    <Button 
                      variant="primary" 
                      type="submit"
                      disabled={loading}
                    >
                      {loading ? 'Signing up...' : 'Sign Up'}
                    </Button>
                  </div>
                </Form>
              </Tab.Pane>
            </Tab.Content>
          </Tab.Container>
        </Modal.Body>
      </Modal>
    </Container>
  );
};

export default Login;