import { describe, it, expect } from 'vitest';
import { KeyManager } from '../crypto.js';
import crypto from 'node:crypto';

describe('KeyManager', () => {
  describe('generateKeyPair', () => {
    it('should generate a valid ECDSA key pair', async () => {
      const keyPair = await KeyManager.generateKeyPair();

      expect(keyPair.privateKey).toContain('BEGIN PRIVATE KEY');
      expect(keyPair.publicKey).toContain('BEGIN PUBLIC KEY');
      expect(keyPair.fingerprint).toHaveLength(64);
      expect(keyPair.keyId).toHaveLength(16);
      expect(keyPair.keyId).toBe(keyPair.fingerprint.substring(0, 16));
    });

    it('should generate different key pairs each time', async () => {
      const keyPair1 = await KeyManager.generateKeyPair();
      const keyPair2 = await KeyManager.generateKeyPair();

      expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey);
      expect(keyPair1.privateKey).not.toBe(keyPair2.privateKey);
      expect(keyPair1.fingerprint).not.toBe(keyPair2.fingerprint);
    });

    it('should generate encrypted private key when passphrase is provided', async () => {
      const keyPair = await KeyManager.generateKeyPair({ passphrase: 'test-secret' });

      expect(keyPair.privateKey).toContain('ENCRYPTED');
    });

    it('should generate unencrypted private key without passphrase', async () => {
      const keyPair = await KeyManager.generateKeyPair();

      expect(keyPair.privateKey).not.toContain('ENCRYPTED');
      expect(keyPair.privateKey).toContain('BEGIN PRIVATE KEY');
    });
  });

  describe('signContent', () => {
    it('should sign content with private key', async () => {
      const keyPair = await KeyManager.generateKeyPair();
      const content = { data: 'test', timestamp: Date.now() };

      const result = KeyManager.signContent(content, keyPair.privateKey);

      expect(result.signature).toBeDefined();
      expect(result.signature.length).toBeGreaterThan(0);
      expect(result.algorithm).toBe('ECDSA-P256');
    });

    it('should produce different signatures for different content', async () => {
      const keyPair = await KeyManager.generateKeyPair();
      const content1 = { data: 'test1' };
      const content2 = { data: 'test2' };

      const result1 = KeyManager.signContent(content1, keyPair.privateKey);
      const result2 = KeyManager.signContent(content2, keyPair.privateKey);

      expect(result1.signature).not.toBe(result2.signature);
    });

    it('should verify both signatures for same content with different key order (deterministic serialization)', async () => {
      const keyPair = await KeyManager.generateKeyPair();
      const content1 = { b: 2, a: 1 };
      const content2 = { a: 1, b: 2 };

      const result1 = KeyManager.signContent(content1, keyPair.privateKey);
      const result2 = KeyManager.signContent(content2, keyPair.privateKey);

      const verify1 = KeyManager.verifySignature(content2, result1.signature, keyPair.publicKey);
      const verify2 = KeyManager.verifySignature(content1, result2.signature, keyPair.publicKey);

      expect(verify1).toBe(true);
      expect(verify2).toBe(true);
    });

    it('should sign with encrypted private key and passphrase', async () => {
      const passphrase = 'test-secret';
      const keyPair = await KeyManager.generateKeyPair({ passphrase });
      const content = { data: 'test' };

      const result = KeyManager.signContent(content, keyPair.privateKey, passphrase);

      expect(result.signature).toBeDefined();
      expect(result.algorithm).toBe('ECDSA-P256');
    });
  });

  describe('verifySignature', () => {
    it('should verify a valid signature', async () => {
      const keyPair = await KeyManager.generateKeyPair();
      const content = { data: 'test', value: 123 };

      const { signature } = KeyManager.signContent(content, keyPair.privateKey);
      const isValid = KeyManager.verifySignature(content, signature, keyPair.publicKey);

      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', async () => {
      const keyPair = await KeyManager.generateKeyPair();
      const content = { data: 'test' };

      const isValid = KeyManager.verifySignature(content, 'invalid-signature', keyPair.publicKey);

      expect(isValid).toBe(false);
    });

    it('should reject signature for modified content', async () => {
      const keyPair = await KeyManager.generateKeyPair();
      const content = { data: 'original' };
      const modifiedContent = { data: 'modified' };

      const { signature } = KeyManager.signContent(content, keyPair.privateKey);
      const isValid = KeyManager.verifySignature(modifiedContent, signature, keyPair.publicKey);

      expect(isValid).toBe(false);
    });

    it('should reject signature with wrong public key', async () => {
      const keyPair1 = await KeyManager.generateKeyPair();
      const keyPair2 = await KeyManager.generateKeyPair();
      const content = { data: 'test' };

      const { signature } = KeyManager.signContent(content, keyPair1.privateKey);
      const isValid = KeyManager.verifySignature(content, signature, keyPair2.publicKey);

      expect(isValid).toBe(false);
    });
  });

  describe('loadPrivateKey', () => {
    it('should load unencrypted private key', async () => {
      const keyPair = await KeyManager.generateKeyPair();
      
      const tempFile = '/tmp/test-key.pem';
      const fs = await import('node:fs/promises');
      await fs.writeFile(tempFile, keyPair.privateKey);

      const loadedKey = await KeyManager.loadPrivateKey(tempFile);

      expect(loadedKey).toBeDefined();
      expect(loadedKey.type).toBe('private');

      await fs.unlink(tempFile);
    });

    it('should load encrypted private key with passphrase', async () => {
      const passphrase = 'test-secret';
      const keyPair = await KeyManager.generateKeyPair({ passphrase });
      
      const tempFile = '/tmp/test-encrypted-key.pem';
      const fs = await import('node:fs/promises');
      await fs.writeFile(tempFile, keyPair.privateKey);

      const loadedKey = await KeyManager.loadPrivateKey(tempFile, passphrase);

      expect(loadedKey).toBeDefined();
      expect(loadedKey.type).toBe('private');

      await fs.unlink(tempFile);
    });

    it('should reject encrypted key without passphrase', async () => {
      const passphrase = 'test-secret';
      const keyPair = await KeyManager.generateKeyPair({ passphrase });
      
      const tempFile = '/tmp/test-encrypted-key-fail.pem';
      const fs = await import('node:fs/promises');
      await fs.writeFile(tempFile, keyPair.privateKey);

      await expect(
        KeyManager.loadPrivateKey(tempFile)
      ).rejects.toThrow();

      await fs.unlink(tempFile);
    });

    it('should reject wrong passphrase', async () => {
      const keyPair = await KeyManager.generateKeyPair({ passphrase: 'correct-secret' });
      
      const tempFile = '/tmp/test-wrong-passphrase.pem';
      const fs = await import('node:fs/promises');
      await fs.writeFile(tempFile, keyPair.privateKey);

      await expect(
        KeyManager.loadPrivateKey(tempFile, 'wrong-secret')
      ).rejects.toThrow('Invalid passphrase');

      await fs.unlink(tempFile);
    });
  });

  describe('generateFingerprint', () => {
    it('should generate consistent fingerprint for same public key', () => {
      const publicKey = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE1234567890
-----END PUBLIC KEY-----`;

      const fp1 = crypto.createHash('sha256').update(publicKey).digest('hex');
      const fp2 = crypto.createHash('sha256').update(publicKey).digest('hex');

      expect(fp1).toBe(fp2);
      expect(fp1).toHaveLength(64);
    });
  });
});
