import { KeyManager } from './crypto.js';

export interface SoWasItClientOptions {
  apiKey: string;
  baseUrl?: string;
}

export interface RegisterKeyRequest {
  enrollmentToken: string;
  publicKey: string;
  algorithm?: string;
  clientInfo?: {
    name?: string;
    siret?: string;
    contact?: string;
  };
}

export interface RegisterKeyResponse {
  success: boolean;
  message?: string;
  data?: {
    key_id: string;
    fingerprint: string;
    status: string;
    certification_document: any;
    printable_certification: string;
  };
  error?: string;
}

export interface CreateBlockRequest {
  content: any;
  signature?: string;
  public_key_id?: string;
  block_type?: string;
}

export interface CreateBlockResponse {
  success: boolean;
  message?: string;
  block?: any;
  error?: string;
}

export class SoWasItClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(options: SoWasItClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl || 'https://api.sowasit.io';
  }

  async registerPublicKey(request: RegisterKeyRequest): Promise<RegisterKeyResponse> {
    const response = await fetch(`${this.baseUrl}/keys/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        enrollment_token: request.enrollmentToken,
        public_key: request.publicKey,
        algorithm: request.algorithm || 'ECDSA-P256',
        client_info: request.clientInfo
      })
    });

    if (!response.ok) {
      const error: any = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return (await response.json()) as RegisterKeyResponse;
  }

  async createBlock(
    chainId: string,
    request: CreateBlockRequest
  ): Promise<CreateBlockResponse> {
    const response = await fetch(`${this.baseUrl}/chains/${chainId}/blocks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        content: request.content,
        signature: request.signature,
        public_key_id: request.public_key_id,
        block_type: request.block_type || 'data'
      })
    });

    if (!response.ok) {
      const error: any = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return (await response.json()) as CreateBlockResponse;
  }

  async createSignedBlock(
    chainId: string,
    content: any,
    privateKey: string,
    publicKeyId: string,
    passphrase?: string
  ): Promise<CreateBlockResponse> {
    const { signature } = KeyManager.signContent(content, privateKey, passphrase);

    return this.createBlock(chainId, {
      content,
      signature,
      public_key_id: publicKeyId
    });
  }

  async getPublicKeys(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/keys`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    if (!response.ok) {
      const error: any = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return await response.json();
  }
}
