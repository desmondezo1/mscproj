# Protocol Bridge - Local Development Setup Guide

This guide will walk you through setting up the Protocol Bridge project locally for development.

## Prerequisites

Before starting, ensure you have the following installed:
- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **Docker** - [Download here](https://www.docker.com/products/docker-desktop/)
- **Git** - [Download here](https://git-scm.com/downloads)
- **Google Chrome** browser (for Suiet wallet extension)

## Step 1: Clone the Repository

```bash
git clone https://github.com/desmondezo1/mscproj.git
cd mscproj
```

## Step 2: Set Up Keycloak (Identity Provider)

### 2.1 Start Keycloak Container
Run the following command to start Keycloak using Docker:

```bash
docker run -p 8080:8080 -e KC_BOOTSTRAP_ADMIN_USERNAME=admin -e KC_BOOTSTRAP_ADMIN_PASSWORD=admin quay.io/keycloak/keycloak:26.2.5 start-dev
```

**Note**: Keep this terminal window open. Keycloak will run in the foreground.

### 2.2 Access Keycloak Admin Console
1. Open your browser and go to: http://localhost:8080
2. Click on "Administration Console"
3. Login with:
   - **Username**: `admin`
   - **Password**: `admin`

### 2.3 Create a New Realm
1. In the Keycloak admin console, click the dropdown next to "Master" (top-left)
2. Click "Create Realm"
3. Set **Realm name** to: `test_proj`
4. Click "Create"

### 2.4 Create a SAML Client
1. In the `test_proj` realm, go to **Clients** (left sidebar)
2. Click "Create client"
3. Fill in the following:
   - **Client type**: `SAML`
   - **Client ID**: `protocol-bridge-saml`
   - Click "Next"
4. Configure the client settings:
   - **Valid redirect URIs**: `http://localhost:5001/api/auth/saml/callback`
   - **Master SAML Processing URL**: `http://localhost:5001/api/auth/saml/callback`
   - Click "Save"

### 2.5 Create a Test User
1. Go to **Users** (left sidebar)
2. Click "Create new user"
3. Fill in:
   - **Username**: `testuser`
   - **Email**: `test@example.com`
   - **First name**: `Test`
   - **Last name**: `User`
4. Click "Create"
5. Go to the **Credentials** tab
6. Click "Set password"
7. Set password to: `password123`
8. Turn off "Temporary" toggle
9. Click "Save"

## Step 3: Set Up the Server

### 3.1 Navigate to Server Directory
```bash
cd server
```

### 3.2 Install Server Dependencies
```bash
npm install
```

### 3.3 Verify Environment Configuration
Make sure the `server/.env` file exists with the correct configuration. The file should contain:

```env
# protocol-bridge/server/.env
# Server Configuration
NODE_ENV=development
PORT=5001
SERVER_BASE_URL=http://localhost:5001

# MongoDB Connection
# MONGODB_URI=mongodb://localhost:27017/protocol-bridge
MONGODB_URI=mongodb+srv://desezo:password123!@cluster0.gpnrbeu.mongodb.net/protocol-bridge

# Redis Connection (for production use)
REDIS_URI=redis://localhost:6379

# JWT Configuration
JWT_SECRET=your-secret-key-for-development-only-change-in-production
JWT_EXPIRES_IN=1d

# Keycloak Configuration
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=test_proj
KEYCLOAK_CLIENT_ID=protocol-bridge-saml
KEYCLOAK_CLIENT_SECRET=

# SAML Configuration
SAML_ENTRY_POINT=http://localhost:8080/realms/test_proj/protocol/saml
SAML_ISSUER=protocol-bridge-saml
SAML_CALLBACK_URL=http://localhost:5001/api/auth/saml/callback

SAML_CERT="-----BEGIN CERTIFICATE-----\nMIICtzCCAZ8CBgGW4x5k3jANBgkqhkiG9w0BAQsFADAfMR0wGwYDVQQDDBRwcm90b2NvbC1icmlkZ2Utc2FtbDAeFw0yNTA1MTgxMTE3MjJaFw0zNTA1MTgxMTE5MDJaMB8xHTAbBgNVBAMMFHByb3RvY29sLWJyaWRnZS1zYW1sMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAh6YTNVQzrocJ3lvdL/abpQfnDCpyigObaduyKn/fVcztaZ5HVb9PaOksNeRnAO5iFmAvq+Rv/qltXWqbNh6deVCaQcfvqQrZV56DaJHaNZOaAL4rdE8slY80uGone4XEwHfgESkYYuD65Z4BUHnkhU2z6nPj5BKRZ3Kwo8H8VnefsIPIMgcvU29A9cDEdE4YcE47AMc32LYOWHcBLgFcf8SWOPDHqelYtVLU1SUNAxRALNRWAJqV3xQ8Td9xelTzZ5zPgQrbHxVqKv9N5VkTdBy4gj34VII0hitU/R183xY9XiGJV3/czKfphyYzZHVg6AlRRMfH5Y9ddgJlkITfhQIDAQABMA0GCSqGSIb3DQEBCwUAA4IBAQBCVcbu2ZfBHzSmwnNt6SEr7DF26c4R/3Gy5W8BdukcMdUEsr/eKDUn1e96ObdR03kEvNAk6Rza/nJTDMB2RvYJFwPAoj7EM/y8IrzGJnI8eBqjpOxn77K5uWA31XmBGbo49mkjxcNS62o2EVL5XEnyqReWXo86Ns8uA/gZOXc5x2u1Fk5XH4oeyN9/TiwVcQDM/On5bF6Ssb9ZlpgzNOi9RDlUz4MOCts2iQBtWsEKMzhzXktlDGrdTh5jbI5AQydqKry3Tudj3VWGxoryWPfnrwSwDBUh1tOLMdLHzUnnihYCUx2D/TlDsWNX+x7E/xzznnuKsaKUgoC35EL85US/\n-----END CERTIFICATE-----"
SAML_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEogIBAAKCAQEAh6YTNVQzrocJ3lvdL/abpQfnDCpyigObaduyKn/fVcztaZ5HVb9PaOksNeRnAO5iFmAvq+Rv/qltXWqbNh6deVCaQcfvqQrZV56DaJHaNZOaAL4rdE8slY80uGone4XEwHfgESkYYuD65Z4BUHnkhU2z6nPj5BKRZ3Kwo8H8VnefsIPIMgcvU29A9cDEdE4YcE47AMc32LYOWHcBLgFcf8SWOPDHqelYtVLU1SUNAxRALNRWAJqV3xQ8Td9xelTzZ5zPgQrbHxVqKv9N5VkTdBy4gj34VII0hitU/R183xY9XiGJV3/czKfphyYzZHVg6AlRRMfH5Y9ddgJlkITfhQIDAQABAoIBADmhKfn3KvnT7zJj7uXIrLmBUPzPL9hIzgc8SkZaC0VFifvcPcxFOfSFU74Vqlkv7cY52Sb7J0WXL5qHhyeH/DklMFQQIFa+ADaEZqnPhVhLvBrisE16saNcsvZCS0HkRAHNLAm+XtjrYkyZQ0+waZDkwTIzSDeGV/YOONNpv83v6DQ33DD+WUEIfDyu0bq2w/8wItrgWz7YTOI7aILryzSuIUDZ1iRseNafjfeVDZ4wWHagQUFMZMgYCMy012MrAmke6/fVZ9rLG0QIsOfokWwPg+IIvcBc2fr6JXZV3xisZSKplDiOvpZTnbRQUQ2Hd6mZ3HGIQO7HQ9NxSrx5TAUCgYEAvAd4uJN3F7Q354pdsHEx9uSAZA0haHCEX++7IB3Dh6PoptvnLEBVPakDmUpej65nEwewtG1haSruylPie0olI2yt1jhwYCLxup17yLDx8mcYU3L5mx7BfSgccL8U9kUrANrZb+aUaRP1bbrQQXsMiFVxVAFcJibUywO9a3afmNcCgYEAuK86/zVt0opyzEGSAK47UjZqEhlqmNhz65oraOOzdFTfdQN5VBRsZtrp29hsBh98tORBvnMcSPjW458v+wiZ5sNEeMaLiH1bps6/nZUwJLtmIcK8eQDz9B3Qzo62EPs4BUpoWr0Rc4JkpLbGTnbQmA4IdtGt3TR61LHduNm+8wMCgYA6Zwe0LPmcvzluDag0GbSvPyIx8XIjAm/bbJbuzs/g3aRxz3PqZsETOeAISPU+I6mYW5cjM6ZCCDfLWGrMaKdIbYVBOJ6O/cufbzL3jx5XcHY51Uh6Sf9HZKIQ0wkrxSgqR8+p1jDawnxE7PWqoRGvdvqQYSvCHeWSeULokhvYWQKBgDuvheWMot10GP2iA0ltBYbgRw9qX2TeLzhpLrZLQGfMNhte8AsYPqBPB10haGfiLS9YxVaDZRTANtKBU8RRV0uYt7xAjj+iI8iY8JxA5ro4Rh2LDdYdVLoEGMNoo7aBOe2bynXovIcUEOqalyQsieVaQ6oCwanHmBq9EOb4mBl5AoGANerKqsQ/Gi8TqezCjbeN06YEGWVU3lcutN7issDnU/nhFitnFg//2K1vct6/l13d/FoiV+8ez0JUwdIQz0NG9rXVoCz7ghQofVvwl16o9JJDYS+hMcgG85WyuocP8OFLeIvHpbHwYH1EZ7yO06p5bOTfXs6Jy8aojQK7plecuzU=\n-----END PRIVATE KEY-----"

# DID Registry Configuration
DID_REGISTRY_URL=http://localhost:5002/api
DID_REGISTRY_API_KEY=
DID_REGISTRY_ISSUER_DID=did:example:ffaefc41-841c-4c61-b5c3-81d8c930f5f4

# SSI Wallet Configuration
SSI_WALLET_URL=http://localhost:5003/api
SSI_WALLET_API_KEY=

# CORS Configuration
# CORS_ORIGIN=http://localhost:3000
CORS_ORIGIN=http://localhost:5173

# Session Configuration
SESSION_SECRET=session-secret-for-development-only-change-in-production
ISSUER_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIEcmRIjg5lCLgnctGd0Gzl6FMHZUM9xKJvu2+O1GG3Pp\n-----END PRIVATE KEY-----\n"

```

### 3.4 Start the Server
```bash
npm start
```

**Expected output**: You should see logs indicating:
- Logger initialized successfully
- MongoDB connected successfully
- Server running on port 5001

**Note**: Keep this terminal window open. The server will run in the foreground.

## Step 4: Set Up the Client

### 4.1 Open New Terminal and Navigate to Client Directory
```bash
cd client1
```

### 4.2 Install Client Dependencies
```bash
npm install
```

### 4.3 Verify Client Environment Configuration
Make sure the `client1/.env` file exists with:

```env
VITE_API_URL=http://localhost:5001/api
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=test_proj
VITE_SUI_PACKAGE_ID=0xc756f24a9781dc5845a5d86b9d15b851fa3e4f746f243d8b8599aa4b321e6a00
VITE_SUI_REGISTRY_ID=0x9867149fac916bdbb9683e6bc9e2e202e948a48e363ebc78303e2cb45c9c43fa
VITE_SUI_RPC_URL=https://fullnode.testnet.sui.io:443 
```

### 4.4 Start the Client Development Server
```bash
npm run dev
```

**Expected output**: You should see:
```
  VITE v6.3.1  ready in XXXms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

**Note**: Keep this terminal window open. The client dev server will run in the foreground.

## Step 5: Install and Configure Suiet Wallet

### 5.1 Install Suiet Wallet Extension
1. Open Google Chrome
2. Go to the [Chrome Web Store](https://chromewebstore.google.com/detail/suiet-sui-wallet/khpkpbbcccdmmclmpigdgddabeilkdpd)
3. Click "Add to Chrome" to install the Suiet wallet extension
4. Pin the extension to your browser toolbar for easy access

### 5.2 Set Up Suiet Wallet
1. Click on the Suiet wallet extension icon
2. Choose "Create a new wallet" or "Import existing wallet"
3. If creating new:
   - Set a strong password
   - **IMPORTANT**: Write down your seed phrase and store it safely
   - Confirm your seed phrase
4. Complete the wallet setup

### 5.3 Switch to Sui Testnet
1. Open the Suiet wallet extension
2. Look for the network selector (usually at the top)
3. Click on it and select "Testnet"
4. Confirm the network switch

### 5.4 Get Testnet SUI Tokens
1. Copy your wallet address from the Suiet extension
2. Go to the [Sui Testnet Faucet](https://faucet.sui.io)
3. Paste your wallet address / connect wallet
4. Complete any required verification (captcha, etc.)
5. Click "Request SUI"
6. Wait for the transaction to complete (usually takes 30-60 seconds)
7. Check your Suiet wallet to confirm you received testnet SUI tokens

**Note**: You can also use the Discord faucet:
1. Join the [Sui Discord server](https://discord.gg/sui)
2. Go to the `#testnet-faucet` channel
3. Type: `!faucet [your-wallet-address]`

## Step 6: Access the Application

### 6.1 Open the Application
1. Open your browser and go to: http://localhost:5173
2. You should see the Protocol Bridge application interface

### 6.2 Test the Setup
1. Try connecting your Suiet wallet to the application
2. Test the SAML authentication by logging in with:
   - **Username**: `testuser`
   - **Password**: `password123`

## Troubleshooting

### Common Issues and Solutions

#### 1. Port Already in Use
If you get port conflicts:
```bash
# Kill processes on specific ports
# For port 5001 (server)
lsof -ti:5001 | xargs kill -9

# For port 5173 (client)
lsof -ti:5173 | xargs kill -9

# For port 8080 (Keycloak)
docker ps
docker stop [keycloak-container-id]
```

#### 2. Keycloak Connection Issues
- Ensure Keycloak is running: http://localhost:8080 should be accessible
- Check that the realm `test_proj` exists
- Verify the SAML client configuration

#### 3. MongoDB Connection Issues
- The project uses a cloud MongoDB instance
- If connection fails, check your internet connection
- Contact the project maintainer for database access issues

#### 4. Suiet Wallet Issues
- Make sure you're on the Testnet network
- Ensure you have testnet SUI tokens
- Try refreshing the browser page
- Check browser console for errors (F12 → Console tab)

#### 5. Client Build Errors
If you encounter build errors with the client:
```bash
cd client1
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
npm run dev
```

## Development Workflow

Once everything is set up, your typical development workflow will be:

1. **Start Keycloak** (if not already running):
   ```bash
   docker run -p 8080:8080 -e KC_BOOTSTRAP_ADMIN_USERNAME=admin -e KC_BOOTSTRAP_ADMIN_PASSWORD=admin quay.io/keycloak/keycloak:26.2.5 start-dev
   ```

2. **Start the Server**:
   ```bash
   cd server && npm start
   ```

3. **Start the Client**:
   ```bash
   cd client1 && npm run dev
   ```

4. **Access the application**: http://localhost:5173

## Service URLs Summary

- **Client Application**: http://localhost:5173
- **Server API**: http://localhost:5001/api
- **Keycloak Admin**: http://localhost:8080
- **Health Check**: http://localhost:5001/health

## Support

If you encounter any issues during setup:
1. Check the troubleshooting section above
2. Ensure all prerequisites are installed correctly
3. Verify that all ports are available and not blocked by firewalls
4. Check the browser console and terminal outputs for error messages

For additional support, please contact desmondezoojile@gmail.com / s5652903@bournemouth.ac.uk 