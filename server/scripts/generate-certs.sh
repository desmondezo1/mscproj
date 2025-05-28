#!/bin/bash

# Create certs directory if it doesn't exist
mkdir -p certs

# Generate self-signed certificate and private key
openssl req -x509 -newkey rsa:4096 \
  -keyout certs/sp-key.pem \
  -out certs/sp-cert.pem \
  -days 365 \
  -nodes \
  -subj "/CN=protocol-bridge-saml/O=Protocol Bridge/C=US"

# Set appropriate permissions
chmod 600 certs/sp-key.pem
chmod 644 certs/sp-cert.pem

# Copy the SP certificate as the IdP certificate for development
cp certs/sp-cert.pem certs/idp-cert.pem
chmod 644 certs/idp-cert.pem

echo "SAML certificates generated successfully in certs directory" 