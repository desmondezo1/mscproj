import React from 'react';
import { Navbar, Nav, Container, Button } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ConnectButton } from '@suiet/wallet-kit';

const Header: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();
  
  return (
    <Navbar bg="dark" variant="dark" expand="lg" className="mb-4">
      <Container>
        <Navbar.Brand as={Link} to="/">Protocol Bridge</Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          {isAuthenticated ? (
            <>
              <Nav className="me-auto">
                <Nav.Link 
                  as={Link} 
                  to="/dashboard"
                  active={location.pathname === '/dashboard'}
                >
                  Dashboard
                </Nav.Link>
                {user?.migrationPhase === 'hybrid' && (
                  <Nav.Link 
                    as={Link} 
                    to="/credentials"
                    active={location.pathname === '/credentials'}
                  >
                    Credentials
                  </Nav.Link>
                )}
              </Nav>
              <Nav>
                {user && (
                  <Navbar.Text className="me-3">
                    {user.email}
                  </Navbar.Text>
                )}
                <div className="me-2 d-inline-block align-middle">
                  <ConnectButton />
                </div>
                <Button 
                  variant="outline-light" 
                  size="sm"
                  onClick={logout}
                >
                  Logout
                </Button>
              </Nav>
            </>
          ) : (
            <Nav className="ms-auto">
              <Nav.Link 
                as={Link} 
                to="/login"
                active={location.pathname === '/login'}
              >
                Login
              </Nav.Link>
            </Nav>
          )}
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default Header; 