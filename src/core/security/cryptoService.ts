/**
 * Primitivas criptográficas para el cifrado local de datos financieros.
 *
 * Algoritmo: AES-256-GCM para datos, PBKDF2-SHA256 (310 000 iteraciones) para envolver claves.
 * Todo usa Web Crypto API (SubtleCrypto), disponible en todos los navegadores modernos y PWA.
 *
 * Esta capa no protege contra código malicioso que se ejecute en la misma página,
 * ni contra el acceso autenticado de Firebase. Su alcance es proteger las copias
 * locales en localStorage frente a acceso físico al dispositivo sin autenticación.
 */

const AES_ALGO = { name: 'AES-GCM', length: 256 } as const;
const PBKDF2_HASH = 'SHA-256';
const PBKDF2_ITERATIONS = 310_000;
const IV_BYTES = 12; // 96-bit IV recomendado para AES-GCM
const SALT_BYTES = 16;

// ─── Helpers de encoding ───────────────────────────────────────────────────

function u8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToU8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ─── Generación y serialización de claves ─────────────────────────────────

/** Genera una clave AES-256-GCM aleatoria para cifrar datos locales. */
export async function generateDataKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(AES_ALGO, true, ['encrypt', 'decrypt']);
}

// ─── Cifrado / descifrado de strings ──────────────────────────────────────

/**
 * Cifra un string con AES-256-GCM.
 * El IV aleatorio (12 bytes) se antepone al ciphertext; todo se codifica en base64.
 */
export async function encryptString(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  const combined = new Uint8Array(IV_BYTES + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), IV_BYTES);
  return u8ToBase64(combined);
}

/**
 * Descifra un string cifrado con encryptString.
 * Lanza un error si la clave es incorrecta o el ciphertext está corrupto (AES-GCM tag mismatch).
 */
export async function decryptString(key: CryptoKey, b64: string): Promise<string> {
  const combined = base64ToU8(b64);
  const iv = combined.slice(0, IV_BYTES);
  const ciphertext = combined.slice(IV_BYTES);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

// ─── Envolvimiento (wrapping) de claves ───────────────────────────────────

/**
 * Envuelve (cifra) una CryptoKey con una clave derivada de una contraseña (PBKDF2).
 * Formato del resultado: base64(salt[16] + iv[12] + wrappedKey[...])
 *
 * @param dataKey  La clave AES a proteger.
 * @param passphrase  La contraseña (por ejemplo, el PIN del usuario).
 */
export async function wrapDataKey(dataKey: CryptoKey, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  const wrappingKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: PBKDF2_HASH, salt, iterations: PBKDF2_ITERATIONS },
    keyMaterial,
    AES_ALGO,
    false,
    ['wrapKey']
  );

  const wrappedKey = await crypto.subtle.wrapKey('raw', dataKey, wrappingKey, { name: 'AES-GCM', iv });

  const combined = new Uint8Array(SALT_BYTES + IV_BYTES + wrappedKey.byteLength);
  combined.set(salt, 0);
  combined.set(iv, SALT_BYTES);
  combined.set(new Uint8Array(wrappedKey), SALT_BYTES + IV_BYTES);
  return u8ToBase64(combined);
}

/**
 * Desenvuelve (descifra) una CryptoKey a partir del envelope generado por wrapDataKey.
 * Lanza un error si la contraseña es incorrecta o el envelope está corrupto.
 */
export async function unwrapDataKey(envelope: string, passphrase: string): Promise<CryptoKey> {
  const combined = base64ToU8(envelope);
  const salt = combined.slice(0, SALT_BYTES);
  const iv = combined.slice(SALT_BYTES, SALT_BYTES + IV_BYTES);
  const wrappedKey = combined.slice(SALT_BYTES + IV_BYTES);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  const wrappingKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: PBKDF2_HASH, salt, iterations: PBKDF2_ITERATIONS },
    keyMaterial,
    AES_ALGO,
    false,
    ['unwrapKey']
  );

  return crypto.subtle.unwrapKey(
    'raw',
    wrappedKey,
    wrappingKey,
    { name: 'AES-GCM', iv },
    AES_ALGO,
    true,
    ['encrypt', 'decrypt']
  );
}

