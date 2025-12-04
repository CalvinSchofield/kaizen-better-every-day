// Native Web Push implementation for Deno Edge Functions
// Implements RFC 8291 (Message Encryption for Web Push) with Web Crypto API

// Base64url encode/decode utilities
export function base64urlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const decoded = atob(base64 + padding);
  return Uint8Array.from(decoded, c => c.charCodeAt(0));
}

// Concatenate Uint8Arrays
function concat(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// HKDF implementation using Web Crypto
async function hkdf(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    ikm.buffer as ArrayBuffer,
    'HKDF',
    false,
    ['deriveBits']
  );

  const derived = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt.buffer as ArrayBuffer,
      info: info.buffer as ArrayBuffer,
    },
    key,
    length * 8
  );

  return new Uint8Array(derived);
}

// Generate VAPID JWT for authorization
async function generateVapidJwt(
  audience: string,
  subject: string,
  privateKeyBase64url: string,
  publicKeyBase64url: string
): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' };
  const headerB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(header)));

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60,
    sub: subject,
  };
  const payloadB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));

  const publicKeyRaw = base64urlDecode(publicKeyBase64url);
  const x = publicKeyRaw.slice(1, 33);
  const y = publicKeyRaw.slice(33, 65);

  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: base64urlEncode(x),
    y: base64urlEncode(y),
    d: privateKeyBase64url,
  };

  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const unsignedToken = `${headerB64}.${payloadB64}`;
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureB64 = base64urlEncode(new Uint8Array(signature));
  return `${unsignedToken}.${signatureB64}`;
}

// Encrypt payload according to RFC 8291
async function encryptPayload(
  payload: Uint8Array,
  p256dhKey: Uint8Array,
  authSecret: Uint8Array
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; publicKey: Uint8Array }> {
  // Generate ephemeral ECDH key pair
  const ephemeralKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );

  // Export ephemeral public key
  const ephemeralPublicKeyRaw = await crypto.subtle.exportKey('raw', ephemeralKeyPair.publicKey);
  const ephemeralPublicKey = new Uint8Array(ephemeralPublicKeyRaw);

  // Import subscriber's public key
  const subscriberKey = await crypto.subtle.importKey(
    'raw',
    p256dhKey.buffer as ArrayBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // Derive shared secret via ECDH
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: subscriberKey },
    ephemeralKeyPair.privateKey,
    256
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);

  // Generate random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Build info for HKDF
  const webPushInfoPrefix = new TextEncoder().encode('WebPush: info\0');
  const keyInfo = concat(webPushInfoPrefix, p256dhKey, ephemeralPublicKey);

  // Derive IKM: HKDF(auth_secret, shared_secret, "Content-Encoding: auth\0", 32)
  const authInfo = new TextEncoder().encode('Content-Encoding: auth\0');
  const ikm = await hkdf(sharedSecret, authSecret, authInfo, 32);

  // Derive CEK and nonce
  const cekInfo = concat(new TextEncoder().encode('Content-Encoding: aes128gcm\0'), keyInfo);
  const nonceInfo = concat(new TextEncoder().encode('Content-Encoding: nonce\0'), keyInfo);

  const prk = await hkdf(ikm, salt, new Uint8Array(0), 32);
  const cek = await hkdf(prk, new Uint8Array(0), cekInfo, 16);
  const nonce = await hkdf(prk, new Uint8Array(0), nonceInfo, 12);

  // Add padding: delimiter byte (0x02) + padding zeros
  const paddingLength = 0;
  const paddedPayload = concat(payload, new Uint8Array([2]), new Uint8Array(paddingLength));

  // Encrypt with AES-128-GCM
  const aesKey = await crypto.subtle.importKey(
    'raw',
    cek.buffer as ArrayBuffer,
    'AES-GCM',
    false,
    ['encrypt']
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce.buffer as ArrayBuffer },
    aesKey,
    paddedPayload.buffer as ArrayBuffer
  );

  return {
    ciphertext: new Uint8Array(encrypted),
    salt,
    publicKey: ephemeralPublicKey,
  };
}

// Build aes128gcm encrypted content encoding body
function buildEncryptedBody(
  salt: Uint8Array,
  publicKey: Uint8Array,
  ciphertext: Uint8Array
): Uint8Array {
  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096, false);
  const keyIdLen = new Uint8Array([65]);

  return concat(salt, recordSize, keyIdLen, publicKey, ciphertext);
}

export interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  type?: string;
}

/**
 * Send a web push notification using native Deno/Web Crypto
 * Implements RFC 8291 Message Encryption for Web Push
 */
export async function sendWebPush(
  subscription: PushSubscription,
  payload: PushPayload,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  subject: string = 'mailto:support@kaizen-app.com'
): Promise<{ success: boolean; status?: number; error?: string }> {
  try {
    const endpointUrl = new URL(subscription.endpoint);
    const audience = endpointUrl.origin;

    // Generate VAPID JWT
    const jwt = await generateVapidJwt(
      audience,
      subject,
      vapidPrivateKey,
      vapidPublicKey
    );

    // Decode subscriber keys
    const p256dhKey = base64urlDecode(subscription.p256dh);
    const authSecret = base64urlDecode(subscription.auth);

    // Encrypt payload
    const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
    const { ciphertext, salt, publicKey } = await encryptPayload(
      payloadBytes,
      p256dhKey,
      authSecret
    );

    // Build encrypted body
    const body = buildEncryptedBody(salt, publicKey, ciphertext);

    // Send request
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `vapid t=${jwt}, k=${vapidPublicKey}`,
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'TTL': '86400',
        'Urgency': 'normal',
      },
      body: body.buffer as ArrayBuffer,
    });

    if (response.status === 201 || response.status === 200) {
      return { success: true, status: response.status };
    } else {
      const errorText = await response.text();
      return {
        success: false,
        status: response.status,
        error: `${response.status}: ${errorText}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
