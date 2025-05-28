# Protocol Bridge for SSI Migration

A production-ready implementation of a Protocol Bridge that enables migration from traditional identity systems (SAML/OIDC) to Self-Sovereign Identity (SSI).

## Overview

This project demonstrates a comprehensive Protocol Bridge pattern that facilitates the phased migration from centralized identity systems (like Keycloak) to decentralized, self-sovereign identity. It supports the following migration phases:

1. **Traditional Identity** - Authentication via SAML/OIDC
2. **Preparation Phase** - Creation of DIDs and infrastructure setup
3. **Hybrid Operation** - Protocol Bridge translates between traditional and SSI systems
4. **DID Claiming** - Users claim ownership of their DIDs
5. **Full SSI Implementation** - Complete user control over identity (optional)

## Architecture

The Protocol Bridge consists of:

- **Server Component**:
  - Express.js backend with RESTful APIs
  - SAML/OIDC authentication integration
  - Identity correlation between traditional IDs and DIDs
  - Protocol translation services
  - DID management and credential issuance

- **Client Component**:
  - React-based user interface
  - Authentication flows
  - Wallet connection management
  - Credential management
  - Migration status visualization

## Features

- **SAML Authentication**: Integration with Keycloak for SAML-based authentication
- **Protocol Translation**: Convert between SAML assertions, OIDC tokens, and Verifiable Credentials
- **Identity Correlation**: Map traditional identities to DIDs with database persistence
- **DID Management**: Create, update, and manage DIDs with the DID registry
- **Wallet Connection**: Connect with SSI wallets using DIDComm protocols
- **Credential Management**: Issue, verify, and revoke Verifiable Credentials
- **Presentation Handling**: Create and verify Verifiable Presentations
- **Migration Phase Management**: Track and manage user migration status

## Prerequisites

- Node.js 16+ and npm
- MongoDB 4.4+
- Keycloak server (for SAML/OIDC authentication)
- (Optional) Redis for production caching
- (Optional) DID registry/ledger integration

## Installation

### Setting up the server

1. Clone the repository
2. Install server dependencies:
   ```
   cd server
   npm install
   ```
3. Create a `.env` file (use `.env.example` as a template)
4. Generate SSL certificates for SAML:
   ```
   mkdir -p certs
   # Generate service provider key and certificate
   openssl req -x509 -newkey rsa:2048 -keyout certs/sp-key.pem -out certs/sp-cert.pem -days 365 -nodes
   ```
5. Start the server:
   ```
   npm run dev
   ```

### Setting up the client

1. Install client dependencies:
   ```
   cd client
   npm install
   ```
2. Create a `.env` file in the client directory:
   ```
   REACT_APP_API_URL=http://localhost:5001/api
   ```
3. Start the client:
   ```
   npm start
   ```

## Keycloak Configuration

1. Install and start Keycloak
2. Create a new realm (e.g., "ssi-migration")
3. Create a SAML client:
   - Client ID: `protocol-bridge-saml`
   - Client Protocol: SAML
   - Client SAML Endpoint: `http://localhost:5001/api/auth/saml/callback`
   - Enable "Sign Documents" and "Sign Assertions"
4. Create test users in Keycloak

For detailed Keycloak setup instructions, see [KEYCLOAK_SETUP.md](KEYCLOAK_SETUP.md)

## Usage

1. Start both the server and client applications
2. Navigate to `http://localhost:3000` in your browser
3. Click "Login with Keycloak" to authenticate
4. After login, you'll be in the "Traditional Identity" phase
5. Connect your DID and wallet to progress through migration phases
6. Issue and manage credentials through the interface

## API Documentation

The Protocol Bridge exposes several API endpoints:

- `/api/auth/*` - Authentication endpoints
- `/api/identity/*` - Identity correlation endpoints
- `/api/did/*` - DID management endpoints
- `/api/credentials/*` - Credential management endpoints
- `/api/wallet/*` - Wallet connection endpoints
- `/api/bridge/*` - Core Protocol Bridge endpoints

For complete API documentation, see [API_DOCUMENTATION.md](API_DOCUMENTATION.md)

## Integration with External Systems

### DID Registry Integration

By default, the implementation includes a simulated DID registry. To integrate with a real DID registry:

1. Update the `DID_REGISTRY_URL` and `DID_REGISTRY_API_KEY` in the `.env` file
2. Modify the `didService.js` implementation to use the appropriate API calls for your registry

### SSI Wallet Integration

The implementation includes a simulated wallet connector. To integrate with real SSI wallets:

1. Update the `SSI_WALLET_URL` and `SSI_WALLET_API_KEY` in the `.env` file
2. Modify the `walletService.js` implementation to use the appropriate protocol for your wallet (e.g., DIDComm, CHAPI)

## Migration Phases Explained

### Phase 1: Traditional Identity

- Users authenticate via SAML/OIDC with Keycloak
- No SSI components are used
- All identity data is controlled by the central provider

### Phase 2: Preparation

- Users still authenticate via SAML/OIDC
- DIDs are created for users (organization-controlled)
- SSI infrastructure is prepared

### Phase 3: Hybrid Operation

- Users can authenticate via either traditional methods or SSI
- Protocol Bridge translates between systems
- Users can connect their SSI wallets
- Traditional identity attributes can be converted to verifiable credentials

### Phase 4: DID Claiming

- Users claim control of their DIDs
- Verifiable credentials are issued to user wallets
- Users have more control over identity data

### Phase 5: Full SSI Implementation

- Direct verification against the DID registry
- Complete user control over identity data
- Optional retirement of traditional identity systems

## Security Considerations

This implementation includes several security features:

- JWT-based API authentication
- SAML assertion signature verification
- Role-based access control
- Credential revocation capabilities
- DID ownership verification

For production deployments, ensure:

1. Strong secrets for JWT and session management
2. Proper TLS/SSL configuration
3. Secure key management for credential issuance
4. Rate limiting and brute force protection
5. Regular security audits

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- W3C DID and Verifiable Credentials standards
- Keycloak Identity Provider
- DIF (Decentralized Identity Foundation) specifications