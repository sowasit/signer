# @sowasit/signer

Official signing tool for SoWasIt blockchain - manage cryptographic keys and create signed blocks.

[![npm version](https://badge.fury.io/js/%40sowasit%2Fsigner.svg)](https://www.npmjs.com/package/@sowasit/signer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🔐 **ECDSA P-256 Key Generation** - Industry-standard elliptic curve cryptography
- ✍️ **Block Signing** - Cryptographically sign blockchain blocks for non-repudiation
- 🔑 **Key Management** - Secure key pair generation with optional passphrase encryption
- 📦 **CLI & Library** - Use as a command-line tool or integrate into your Node.js application
- 🎯 **Deterministic Serialization** - Consistent JSON serialization for reliable signatures
- 🛡️ **Secure by Default** - Warnings for unencrypted keys, secure file permissions

## Installation

### As a CLI tool (global)

```bash
npm install -g @sowasit/signer
```

### As a library (in your project)

```bash
npm install @sowasit/signer
```

## Quick Start

### 1. Generate and register a key pair

As a partner, first get an enrollment token from the chain owner, then:

```bash
signer add-key \
  --token YOUR_ENROLLMENT_TOKEN \
  --api-key YOUR_API_KEY \
  --passphrase your-secret-passphrase \
  --output ./keys \
  --client-name "Your Company Name" \
  --client-contact "admin@company.com"
```

This will:
1. Generate an ECDSA P-256 key pair
2. Register the public key with SoWasIt
3. Save the keys locally in `./keys/`
4. Generate a certification document to complete activation

### 2. Sign and create a block

```bash
signer create-block \
  --chain YOUR_CHAIN_ID \
  --key ./keys/sowasit.private.pem \
  --key-id YOUR_KEY_ID \
  --api-key YOUR_API_KEY \
  --content-file ./data.json \
  --passphrase your-secret-passphrase
```

## CLI Reference

### `signer add-key`

Generate a new key pair and register it with SoWasIt.

```bash
signer add-key [options]
```

**Options:**

| Option | Description | Required |
|--------|-------------|----------|
| `-t, --token <token>` | Enrollment token from SoWasIt | ✓ |
| `-k, --api-key <key>` | Your SoWasIt API key | ✓ |
| `-o, --output <dir>` | Output directory for keys (default: `./keys`) | |
| `-n, --name <name>` | Key pair name (default: `sowasit`) | |
| `-p, --passphrase <passphrase>` | Passphrase to encrypt private key | |
| `--base-url <url>` | SoWasIt API base URL | |
| `--client-name <name>` | Your company name for certification | |
| `--client-siret <siret>` | Your company SIRET number | |
| `--client-contact <contact>` | Contact email for certification | |

**Output:**

- `{name}.private.pem` - Private key (mode 0600, keep this SECRET!)
- `{name}.public.pem` - Public key
- `{name}.metadata.json` - Key metadata (keyId, fingerprint, algorithm)
- `{name}.certification.txt` - Certification document to print, sign, and upload

### `signer sign`

Sign content with your private key (without creating a block).

```bash
signer sign [options]
```

**Options:**

| Option | Description | Required |
|--------|-------------|----------|
| `-k, --key <path>` | Path to private key file | ✓ |
| `-d, --data <path>` | Path to JSON file containing content to sign | ✓ |
| `-p, --passphrase <passphrase>` | Passphrase for encrypted private key | |
| `-o, --output <path>` | Output file for signature (default: stdout) | |

**Example:**

```bash
signer sign --key ./keys/sowasit.private.pem --data ./content.json --passphrase secret
```

### `signer create-block`

Create a signed block on SoWasIt blockchain.

```bash
signer create-block [options]
```

**Options:**

| Option | Description | Required |
|--------|-------------|----------|
| `-c, --chain <chainId>` | Chain ID | ✓ |
| `-k, --key <path>` | Path to private key file | ✓ |
| `--api-key <key>` | SoWasIt API key | ✓ |
| `--key-id <keyId>` | Public key ID registered with SoWasIt | ✓ |
| `--content <json>` | Block content as JSON string | * |
| `--content-file <path>` | Path to JSON file containing block content | * |
| `-p, --passphrase <passphrase>` | Passphrase for encrypted private key | |
| `--base-url <url>` | SoWasIt API base URL | |

*One of `--content` or `--content-file` is required.

**Example:**

```bash
signer create-block \
  --chain ch_abc123 \
  --key ./keys/sowasit.private.pem \
  --key-id f1a2b3c4d5e6f7g8 \
  --api-key sk_your_api_key \
  --content '{"order_id": "ORD-12345", "status": "shipped"}' \
  --passphrase secret
```

## Library Usage

### TypeScript/JavaScript

#### Generate and save a key pair

```typescript
import { KeyManager } from '@sowasit/signer';

// Generate a key pair
const keyPair = await KeyManager.generateKeyPair({
  passphrase: 'your-secret-passphrase' // Optional but recommended
});

// Save to disk
await KeyManager.saveKeyPair(keyPair, './keys', 'my-company');

console.log('Key ID:', keyPair.keyId);
console.log('Fingerprint:', keyPair.fingerprint);
```

#### Sign content

```typescript
import { KeyManager } from '@sowasit/signer';

const content = {
  transaction_id: 'TXN-001',
  amount: 1500.00,
  timestamp: Date.now()
};

// Load private key
const privateKey = await KeyManager.loadPrivateKey(
  './keys/my-company.private.pem',
  'your-secret-passphrase'
);

// Sign the content
const { signature, algorithm } = KeyManager.signContent(
  content,
  privateKey
);

console.log('Signature:', signature);
console.log('Algorithm:', algorithm);
```

#### Verify a signature

```typescript
import { KeyManager } from '@sowasit/signer';
import fs from 'node:fs/promises';

const content = { data: 'test' };
const signature = 'MEUCIQ...';
const publicKey = await fs.readFile('./keys/my-company.public.pem', 'utf-8');

const isValid = KeyManager.verifySignature(content, signature, publicKey);

if (isValid) {
  console.log('✓ Signature is valid');
} else {
  console.log('✗ Signature is invalid');
}
```

#### Create a signed block programmatically

```typescript
import { SoWasItClient, KeyManager } from '@sowasit/signer';
import fs from 'node:fs/promises';

const client = new SoWasItClient({
  apiKey: 'sk_your_api_key',
  baseUrl: 'https://api.sowasit.io' // Optional
});

const content = {
  event: 'product_shipped',
  order_id: 'ORD-12345',
  timestamp: Date.now()
};

const privateKeyPem = await fs.readFile('./keys/my-company.private.pem', 'utf-8');

// Create signed block in one call
const response = await client.createSignedBlock(
  'ch_your_chain_id',
  content,
  privateKeyPem,
  'your_public_key_id',
  'your-passphrase' // Optional if key is not encrypted
);

console.log('Block created:', response.block);
```

#### Register a public key

```typescript
import { SoWasItClient, KeyManager } from '@sowasit/signer';

const client = new SoWasItClient({
  apiKey: 'sk_your_api_key'
});

// Generate key pair
const keyPair = await KeyManager.generateKeyPair({
  passphrase: 'secret'
});

// Register with SoWasIt
const response = await client.registerPublicKey({
  enrollmentToken: 'your_enrollment_token',
  publicKey: keyPair.publicKey,
  algorithm: 'ECDSA-P256',
  clientInfo: {
    name: 'Your Company',
    siret: '12345678901234',
    contact: 'admin@company.com'
  }
});

console.log('Key registered:', response.data.key_id);
console.log('Status:', response.data.status);
console.log('Certification document:', response.data.printable_certification);
```

## Security Best Practices

### 1. **Always use a passphrase**

```bash
# ✓ Good - encrypted private key
signer add-key --token xxx --api-key yyy --passphrase "strong-secret-passphrase"

# ✗ Bad - unencrypted private key
signer add-key --token xxx --api-key yyy
```

### 2. **Protect your private keys**

- Private keys are automatically saved with `mode 0600` (owner read/write only)
- Never commit private keys to version control
- Store them in a secure location (e.g., password manager, HSM, vault)
- Use environment variables for passphrases in production

### 3. **Verify key ownership**

- Complete the certification process (print, sign, stamp, upload)
- This proves you physically control the legal entity associated with the key

### 4. **Rotate keys regularly**

- Generate new keys periodically
- Use the replacement mechanism when rotating keys
- Revoke old keys after rotation

### 5. **Monitor key usage**

- Check your SoWasIt dashboard for unexpected key activity
- Revoke keys immediately if compromised

## Key Lifecycle

1. **Generation**: Partner creates a key pair with `signer add-key`
2. **Registration**: Partner's public key is registered with SoWasIt (status: `pending_certification`)
3. **Certification**: Partner downloads, prints, signs, and uploads the certification document (status: `certification_sent`)
4. **Verification**: Chain owner verifies the partner's document (status: `verified`)
5. **Activation**: Chain owner activates the key, partner can sign blocks (status: `active`)
6. **Revocation** *(if needed)*: Chain owner revokes the key if compromised or obsolete (status: `revoked`)

## API Reference

### `KeyManager`

#### `generateKeyPair(options?): Promise<KeyPair>`

Generate an ECDSA P-256 key pair.

**Parameters:**
- `options.passphrase` (string, optional): Passphrase to encrypt the private key
- `options.algorithm` (string, optional): Algorithm (default: `'ec'`)
- `options.namedCurve` (string, optional): Curve (default: `'prime256v1'`)

**Returns:** `Promise<KeyPair>` with `privateKey`, `publicKey`, `fingerprint`, `keyId`

#### `saveKeyPair(keyPair, outputDir?, name?): Promise<void>`

Save a key pair to disk.

**Parameters:**
- `keyPair`: The key pair to save
- `outputDir` (string, optional): Directory (default: `'./keys'`)
- `name` (string, optional): Base name (default: `'sowasit'`)

#### `loadPrivateKey(keyPath, passphrase?): Promise<KeyObject>`

Load a private key from a PEM file.

**Parameters:**
- `keyPath` (string): Path to the private key file
- `passphrase` (string, optional): Passphrase if key is encrypted

**Returns:** `Promise<crypto.KeyObject>`

#### `signContent(content, privateKey, passphrase?): SignatureResult`

Sign content with a private key.

**Parameters:**
- `content` (any): Content to sign (will be deterministically serialized)
- `privateKey` (string | KeyObject): Private key
- `passphrase` (string, optional): Passphrase if key is encrypted

**Returns:** `{ signature: string, algorithm: string }`

#### `verifySignature(content, signature, publicKey): boolean`

Verify a signature.

**Parameters:**
- `content` (any): Original content
- `signature` (string): Base64-encoded signature
- `publicKey` (string): Public key in PEM format

**Returns:** `boolean`

### `SoWasItClient`

#### `constructor(options)`

Create a new SoWasIt API client.

**Parameters:**
- `options.apiKey` (string): Your SoWasIt API key
- `options.baseUrl` (string, optional): API base URL (default: `'https://api.sowasit.io'`)

#### `registerPublicKey(request): Promise<RegisterKeyResponse>`

Register a public key with an enrollment token.

#### `createBlock(chainId, request): Promise<CreateBlockResponse>`

Create a block (with or without signature).

#### `createSignedBlock(chainId, content, privateKey, publicKeyId, passphrase?): Promise<CreateBlockResponse>`

Create a signed block in one call.

#### `getPublicKeys(): Promise<any>`

List all public keys for your tenant.

## Troubleshooting

### "Invalid passphrase for encrypted private key"

Your key is encrypted but you provided the wrong passphrase or no passphrase.

**Solution:** Provide the correct passphrase with `--passphrase` or `-p`.

### "Block signature is required: tenant has active public keys"

Your tenant has active public keys registered, so all blocks must be signed.

**Solution:** Use `signer create-block` or sign manually with `signer sign` and include the signature in your API call.

### "Invalid block signature"

The signature verification failed.

**Possible causes:**
- Content was modified after signing
- Wrong private key was used
- Signature format is invalid
- Public key ID doesn't match the key that signed

### "Public key is not active"

The key is not yet activated or has been revoked.

**Solution:** Check the key status in your dashboard. Complete the certification process if needed.

## License

MIT

## Support

- **Documentation**: https://docs.sowasit.io
- **Dashboard**: https://dashboard.sowasit.io
- **Issues**: https://github.com/sowasit/sowasit-signer/issues
- **Email**: support@sowasit.io

## Contributing

Contributions are welcome! Please see our [Contributing Guide](CONTRIBUTING.md).

---

**Made with ❤️ by the SoWasIt Team**
