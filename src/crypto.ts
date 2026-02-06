import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import stringify from 'json-stringify-deterministic';

export interface KeyPairOptions {
  passphrase?: string;
  algorithm?: 'ec';
  namedCurve?: 'prime256v1';
}

export interface KeyPair {
  privateKey: string;
  publicKey: string;
  fingerprint: string;
  keyId: string;
}

export interface SignatureResult {
  signature: string;
  algorithm: string;
}

export class KeyManager {
  static async generateKeyPair(options: KeyPairOptions = {}): Promise<KeyPair> {
    const {
      passphrase,
      algorithm = 'ec',
      namedCurve = 'prime256v1'
    } = options;

    const { privateKey, publicKey } = crypto.generateKeyPairSync(algorithm, {
      namedCurve,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
        ...(passphrase ? {
          cipher: 'aes-256-cbc',
          passphrase
        } : {})
      }
    });

    const fingerprint = crypto
      .createHash('sha256')
      .update(publicKey)
      .digest('hex');
    
    const keyId = fingerprint.substring(0, 16);

    if (!passphrase) {
      console.warn('⚠️  Warning: Private key is not encrypted. Consider using --passphrase for better security.');
    }

    return {
      privateKey,
      publicKey,
      fingerprint,
      keyId
    };
  }

  static async saveKeyPair(
    keyPair: KeyPair,
    outputDir: string = './keys',
    name: string = 'sowasit'
  ): Promise<void> {
    await fs.mkdir(outputDir, { recursive: true });

    const privateKeyPath = path.join(outputDir, `${name}.private.pem`);
    const publicKeyPath = path.join(outputDir, `${name}.public.pem`);
    const metadataPath = path.join(outputDir, `${name}.metadata.json`);

    await fs.writeFile(privateKeyPath, keyPair.privateKey, { mode: 0o600 });
    await fs.writeFile(publicKeyPath, keyPair.publicKey);
    await fs.writeFile(
      metadataPath,
      JSON.stringify({
        keyId: keyPair.keyId,
        fingerprint: keyPair.fingerprint,
        algorithm: 'ECDSA-P256',
        createdAt: new Date().toISOString()
      }, null, 2)
    );

    console.log(`✓ Keys saved to ${outputDir}/`);
    console.log(`  - Private key: ${name}.private.pem (keep this SECRET!)`);
    console.log(`  - Public key:  ${name}.public.pem`);
    console.log(`  - Metadata:    ${name}.metadata.json`);
    console.log(`  - Key ID:      ${keyPair.keyId}`);
  }

  static async loadPrivateKey(
    keyPath: string,
    passphrase?: string
  ): Promise<crypto.KeyObject> {
    const privateKeyPem = await fs.readFile(keyPath, 'utf-8');
    
    try {
      return crypto.createPrivateKey({
        key: privateKeyPem,
        format: 'pem',
        type: 'pkcs8',
        ...(passphrase ? { passphrase } : {})
      });
    } catch (error: any) {
      if (error.message.includes('bad decrypt')) {
        throw new Error('Invalid passphrase for encrypted private key');
      }
      throw error;
    }
  }

  static signContent(
    content: any,
    privateKey: crypto.KeyObject | string,
    passphrase?: string
  ): SignatureResult {
    let keyObject: crypto.KeyObject;

    if (typeof privateKey === 'string') {
      keyObject = crypto.createPrivateKey({
        key: privateKey,
        format: 'pem',
        type: 'pkcs8',
        ...(passphrase ? { passphrase } : {})
      });
    } else {
      keyObject = privateKey;
    }

    const dataString = stringify(content);
    const sign = crypto.createSign('SHA256');
    sign.update(dataString);
    sign.end();

    const signature = sign.sign(keyObject, 'base64');

    return {
      signature,
      algorithm: 'ECDSA-P256'
    };
  }

  static verifySignature(
    content: any,
    signature: string,
    publicKey: string
  ): boolean {
    try {
      const dataString = stringify(content);
      const verify = crypto.createVerify('SHA256');
      verify.update(dataString);
      verify.end();

      const publicKeyObj = crypto.createPublicKey({
        key: publicKey,
        format: 'pem',
        type: 'spki'
      });

      return verify.verify(publicKeyObj, signature, 'base64');
    } catch (error) {
      return false;
    }
  }

  static generateFingerprint(publicKey: string): string {
    return crypto.createHash('sha256').update(publicKey).digest('hex');
  }
}
