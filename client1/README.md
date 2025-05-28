# Protocol Bridge Client

A React TypeScript application for interacting with the Protocol Bridge, enabling a gradual transition from traditional identity systems to Self-Sovereign Identity (SSI).

## Features

- User authentication via traditional identity providers
- Creation and management of Decentralized Identifiers (DIDs)
- Support for various DID methods including SUI blockchain
- Wallet connection for blockchain-based DIDs
- Credential issuance and verification
- Migration between identity phases

## SUI DID Integration

This application supports creating and managing Decentralized Identifiers (DIDs) on the SUI blockchain. The integration allows users to:

1. Connect their SUI wallet (such as SUI Wallet, Ethos, or Suiet)
2. Create a SUI DID (did:sui) using their wallet's account
3. Sign transactions to register the DID on the SUI blockchain
4. Manage their identity and credentials using the SUI DID

### Wallet Connection Flow

When a user selects "SUI" as their DID method, the application:

1. Prompts the user to connect a SUI wallet
2. Requests permission to access the wallet's public information
3. Uses the wallet's address and public key for DID creation
4. The user's wallet will be used for signing transactions in the DID creation process

### Technical Implementation

- `SuiWalletContext` provides wallet connection state and functionality
- `SuiWalletConnect` component renders the wallet connection UI
- `OnboardingDid` component integrates wallet connection with DID creation
- `suiBlockchainService` handles SUI blockchain API interactions

## Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn
- Protocol Bridge Server running

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file based on `.env.example`
4. Run the development server:
   ```
   npm run dev
   ```

## Development

The application uses Vite for fast development and building. Key commands:

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Architecture

The application follows a component-based architecture:

- **contexts/** - React contexts for global state management
- **components/** - UI components
- **services/** - API service interfaces
- **utils/** - Utility functions

## Environmental Variables

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | URL of the Protocol Bridge API |
| `VITE_KEYCLOAK_URL` | URL of the Keycloak authentication server |
| `VITE_KEYCLOAK_REALM` | Keycloak realm name |

## License

[MIT License](LICENSE)
