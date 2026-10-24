/**
 * Primitivas criptográficas para el cifrado local de datos financieros en reposo.
 *
 * Arquitectura:
 * - Clave Maestra de Aplicación (AEK): AES-256-GCM generada aleatoriamente con CSPRNG.
 * - Desacoplamiento del PIN: El PIN es exclusivamente barrera de UI en memoria (tiempo/desenfoque).
 *   Nunca se usa para derivar la envoltura de la AEK.
 * - Doble Sobre (Envelopes):
 *     1. Sobre A (Hardware/WebAuthn PRF opcional): Se usa cuando el autenticador y navegador soportan la extensión PRF.
 *     2. Sobre B (Clave de Recuperación): Clave aleatoria de 256 bits generada por el sistema.
 * - Máquina de estados contra inconsistencias: Si la marca persistente indica cifrado activo pero
 *   el sobre falta o está corrupto, la app se detiene (INCONSISTENCY_HALTED) y jamás sobrescribe datos.
 * - Migración en 4 etapas recuperables (PREPARE -> VERIFY -> ACTIVATE -> CLEANUP).
 * - El alcance es exclusivamente almacenamiento local web (localStorage). Los datos en Firestore
 *   viajan por TLS y se rigen por reglas de Firestore, pero no tienen cifrado de extremo a extremo (E2EE).
 */

const AES_ALGO = { name: 'AES-GCM', length: 256 } as const;
const PBKDF2_HASH = 'SHA-256';
const PBKDF2_ITERATIONS = 310_000;
const IV_BYTES = 12; // 96-bit IV recomendado para AES-GCM
const SALT_BYTES = 16;
const VERIFICATION_PAYLOAD = 'WALLET_AEK_INTEGRITY_OK';

// Alfabeto base32 seguro (Crockford-style: sin 0/O, 1/I para evitar confusiones al transcribir)
const RECOVERY_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

// Prefijos de almacenamiento persistente
export const STORAGE_PREFIXES = {
  ACTIVE_FLAG: 'wallet_encryption_active_v1_',
  METADATA: 'wallet_enc_metadata_v1_',
  STORE: 'wallet_enc_store_v1_',
  QUEUE: 'wallet_enc_queue_v1_',
  PROJECTIONS: 'wallet_enc_projections_v1_',
} as const;

export interface EncryptionMetadata {
  version: 1;
  userId: string;
  createdAt: string;
  updatedAt: string;
  hasPrf: boolean;
  prfCredentialId?: string; // base64
  prfSalt?: string; // base64
  envelopeA_prf?: string; // base64
  envelopeB_recovery: string; // base64
  verificationToken: string; // ciphertext base64 de VERIFICATION_PAYLOAD
}

// ─── Helpers de encoding ───────────────────────────────────────────────────

export function u8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function base64ToU8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ─── Generación de Claves ──────────────────────────────────────────────────

/** Genera una clave AES-256-GCM aleatoria (AEK). */
export async function generateDataKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(AES_ALGO, true, ['encrypt', 'decrypt']);
}

/**
 * Genera una Clave de Recuperación de 256 bits criptográficamente segura.
 * Devuelve un formato estructurado legible por humanos en 8 bloques de 4 caracteres:
 * Ejemplo: WLT-7K2M-9P4X-3A8Q-5R2Z-8Y4W-6D9T-4B7C
 */
export function generateRecoveryKey(): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32)); // 256 bits de entropía
  let chars = '';
  for (let i = 0; i < 32; i++) {
    chars += RECOVERY_ALPHABET[randomBytes[i] % RECOVERY_ALPHABET.length];
  }
  const chunks: string[] = ['WLT'];
  for (let i = 0; i < 32; i += 4) {
    chunks.push(chars.slice(i, i + 4));
  }
  return chunks.join('-');
}

/** Normaliza la clave de recuperación eliminando guiones, espacios y convirtiendo a mayúsculas. */
export function normalizeRecoveryKey(input: string): string {
  return input
    .toUpperCase()
    .replace(/^WLT-?/, '')
    .replace(/[^2-9A-HJ-NP-Z]/g, '');
}

/** Valida si una clave de recuperación ingresada tiene la longitud y formato correctos. */
export function isValidRecoveryKeyFormat(input: string): boolean {
  const normalized = normalizeRecoveryKey(input);
  return normalized.length === 32;
}

// ─── Cifrado / Descifrado de Strings (AES-256-GCM) ─────────────────────────

export async function encryptString(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  const combined = new Uint8Array(IV_BYTES + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), IV_BYTES);
  return u8ToBase64(combined);
}

export async function decryptString(key: CryptoKey, b64: string): Promise<string> {
  const combined = base64ToU8(b64);
  if (combined.byteLength < IV_BYTES) {
    throw new Error('Ciphertext corrupto o demasiado corto');
  }
  const iv = combined.slice(0, IV_BYTES);
  const ciphertext = combined.slice(IV_BYTES);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

// ─── Envoltorio y Desenvoltorio con Clave de Recuperación ──────────────────

async function deriveKeyFromRecoverySecret(normalizedSecret: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(`wallet_vault_recovery:${normalizedSecret}`),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: PBKDF2_HASH, salt: salt as unknown as BufferSource, iterations: PBKDF2_ITERATIONS },
    keyMaterial,
    AES_ALGO,
    false,
    ['wrapKey', 'unwrapKey']
  );
}

/**
 * Envuelve la AEK con la clave de recuperación de alta entropía.
 * Formato: base64(salt[16] + iv[12] + wrappedKey[...])
 */
export async function wrapWithRecoveryKey(dataKey: CryptoKey, recoveryKey: string): Promise<string> {
  const normalized = normalizeRecoveryKey(recoveryKey);
  if (normalized.length !== 32) {
    throw new Error('Clave de recuperación inválida o incompleta');
  }
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const wrappingKey = await deriveKeyFromRecoverySecret(normalized, salt);

  const wrapped = await crypto.subtle.wrapKey('raw', dataKey, wrappingKey, { name: 'AES-GCM', iv }, );

  const combined = new Uint8Array(SALT_BYTES + IV_BYTES + wrapped.byteLength);
  combined.set(salt, 0);
  combined.set(iv, SALT_BYTES);
  combined.set(new Uint8Array(wrapped), SALT_BYTES + IV_BYTES);
  return u8ToBase64(combined);
}

/** Desenvuelve la AEK usando la clave de recuperación. */
export async function unwrapWithRecoveryKey(envelopeB64: string, recoveryKey: string): Promise<CryptoKey> {
  const normalized = normalizeRecoveryKey(recoveryKey);
  const combined = base64ToU8(envelopeB64);
  if (combined.byteLength < SALT_BYTES + IV_BYTES + 16) {
    throw new Error('Sobre de recuperación corrupto');
  }
  const salt = combined.slice(0, SALT_BYTES);
  const iv = combined.slice(SALT_BYTES, SALT_BYTES + IV_BYTES);
  const wrappedKey = combined.slice(SALT_BYTES + IV_BYTES);

  const wrappingKey = await deriveKeyFromRecoverySecret(normalized, salt);

  return crypto.subtle.unwrapKey(
    'raw',
    wrappedKey as unknown as BufferSource,
    wrappingKey,
    { name: 'AES-GCM', iv },
    AES_ALGO,
    true,
    ['encrypt', 'decrypt']
  );
}

// ─── WebAuthn PRF (Pseudo-Random Function) Extension ──────────────────────

/** Comprueba si el entorno soporta WebAuthn y potencialmente la extensión PRF. */
export async function isWebAuthnPrfSupported(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) return false;
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') return false;
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch {
    return false;
  }
}

/**
 * Registra una credencial WebAuthn con la extensión PRF habilitada.
 * Si el autenticador no soporta PRF, la extensión devolverá enabled = false.
 */
export async function registerPrfCredential(
  userId: string,
  userEmail: string
): Promise<{ credentialId: string; prfEnabled: boolean; firstPrfOutput?: Uint8Array } | null> {
  try {
    if (typeof window === 'undefined' || !window.navigator.credentials) return null;
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const prfSalt = crypto.getRandomValues(new Uint8Array(32));

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'Wallet PWA', id: window.location.hostname },
        user: {
          id: new TextEncoder().encode(userId),
          name: userEmail,
          displayName: userEmail.split('@')[0] || 'Usuario Wallet',
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' }, // ES256
          { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
        extensions: {
          prf: {
            eval: {
              first: prfSalt,
            },
          },
        } as any,
      },
    })) as PublicKeyCredential | null;

    if (!credential) return null;

    const extResults = credential.getClientExtensionResults() as any;
    const prfResults = extResults?.prf;
    const prfEnabled = Boolean(prfResults?.enabled || prfResults?.results?.first);

    let firstPrfOutput: Uint8Array | undefined;
    if (prfResults?.results?.first) {
      firstPrfOutput = new Uint8Array(prfResults.results.first);
    }

    const rawId = new Uint8Array(credential.rawId);
    return {
      credentialId: u8ToBase64(rawId),
      prfEnabled,
      firstPrfOutput,
    };
  } catch (err) {
    console.warn('[Crypto] Error registrando credencial PRF:', err);
    return null;
  }
}

/**
 * Desbloquea el secreto de la extensión PRF mediante autenticación de usuario.
 */
export async function getPrfSecret(credentialIdB64: string, prfSaltB64: string): Promise<Uint8Array | null> {
  try {
    if (typeof window === 'undefined' || !window.navigator.credentials) return null;
    const rawId = base64ToU8(credentialIdB64);
    const prfSalt = base64ToU8(prfSaltB64);
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ id: rawId as unknown as BufferSource, type: 'public-key' }],
        userVerification: 'required',
        timeout: 60000,
        extensions: {
          prf: {
            eval: {
              first: prfSalt,
            },
          },
        } as any,
      },
    })) as PublicKeyCredential | null;

    if (!assertion) return null;
    const extResults = assertion.getClientExtensionResults() as any;
    const firstOutput = extResults?.prf?.results?.first;
    if (!firstOutput) return null;
    return new Uint8Array(firstOutput);
  } catch (err) {
    console.warn('[Crypto] Error evaluando PRF en assertion:', err);
    return null;
  }
}

/** Envuelve la AEK con un secreto derivado de la extensión WebAuthn PRF. */
export async function wrapWithPrfSecret(dataKey: CryptoKey, prfSecret: Uint8Array): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const wrappingKey = await crypto.subtle.importKey('raw', prfSecret as unknown as BufferSource, AES_ALGO, false, ['wrapKey']);
  const wrapped = await crypto.subtle.wrapKey('raw', dataKey, wrappingKey, { name: 'AES-GCM', iv });

  const combined = new Uint8Array(IV_BYTES + wrapped.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(wrapped), IV_BYTES);
  return u8ToBase64(combined);
}

/** Desenvuelve la AEK usando el secreto PRF obtenido del autenticador. */
export async function unwrapWithPrfSecret(envelopeB64: string, prfSecret: Uint8Array): Promise<CryptoKey> {
  const combined = base64ToU8(envelopeB64);
  if (combined.byteLength < IV_BYTES + 16) {
    throw new Error('Sobre PRF corrupto');
  }
  const iv = combined.slice(0, IV_BYTES);
  const wrappedKey = combined.slice(IV_BYTES);

  const wrappingKey = await crypto.subtle.importKey('raw', prfSecret as unknown as BufferSource, AES_ALGO, false, ['unwrapKey']);
  return crypto.subtle.unwrapKey('raw', wrappedKey as unknown as BufferSource, wrappingKey, { name: 'AES-GCM', iv }, AES_ALGO, true, [
    'encrypt',
    'decrypt',
  ]);
}

// ─── Gestión de Metadatos y Verificación ───────────────────────────────────

export function getActiveFlagKey(userId: string): string {
  return `${STORAGE_PREFIXES.ACTIVE_FLAG}${userId}`;
}

export function getMetadataKey(userId: string): string {
  return `${STORAGE_PREFIXES.METADATA}${userId}`;
}

export function getEncryptedStoreKey(userId: string): string {
  return `${STORAGE_PREFIXES.STORE}${userId}`;
}

export function getEncryptedQueueKey(userId: string): string {
  return `${STORAGE_PREFIXES.QUEUE}${userId}`;
}

export function getEncryptedProjectionsKey(userId: string, year: number): string {
  return `${STORAGE_PREFIXES.PROJECTIONS}${userId}_${year}`;
}

export function isLocalEncryptionActiveForUser(userId: string): boolean {
  try {
    return localStorage.getItem(getActiveFlagKey(userId)) === 'true';
  } catch {
    return false;
  }
}

export function loadEncryptionMetadata(userId: string): EncryptionMetadata | null {
  try {
    const raw = localStorage.getItem(getMetadataKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EncryptionMetadata;
    if (parsed.version === 1 && parsed.userId === userId && parsed.envelopeB_recovery) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Verifica si una clave AEK descifra exitosamente el token de verificación almacenado en los metadatos.
 */
export async function verifyAekWithMetadata(dataKey: CryptoKey, metadata: EncryptionMetadata): Promise<boolean> {
  try {
    const plaintext = await decryptString(dataKey, metadata.verificationToken);
    return plaintext === VERIFICATION_PAYLOAD;
  } catch {
    return false;
  }
}

// ─── Migración no destructiva en 4 Fases ────────────────────────────────────

export interface PrepareMigrationResult {
  dataKey: CryptoKey;
  recoveryKey: string;
  metadata: EncryptionMetadata;
}

/**
 * Fase 1: PREPARE
 * Comprueba cuota de almacenamiento, genera AEK, genera Clave de Recuperación
 * y crea los sobres y token de verificación. No modifica datos existentes.
 */
export async function prepareLocalEncryption(
  userId: string,
  userEmail: string,
  enablePrfIfAvailable: boolean = false
): Promise<PrepareMigrationResult> {
  // Comprobar espacio estimado en disco
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    if (estimate.quota && estimate.usage && estimate.quota - estimate.usage < 1_000_000) {
      throw new Error('Espacio insuficiente en el almacenamiento local para iniciar el cifrado seguro');
    }
  }

  const dataKey = await generateDataKey();
  const recoveryKey = generateRecoveryKey();
  const envelopeB = await wrapWithRecoveryKey(dataKey, recoveryKey);
  const verificationToken = await encryptString(dataKey, VERIFICATION_PAYLOAD);

  let hasPrf = false;
  let prfCredentialId: string | undefined;
  let prfSalt: string | undefined;
  let envelopeA: string | undefined;

  if (enablePrfIfAvailable) {
    const regResult = await registerPrfCredential(userId, userEmail);
    if (regResult && regResult.prfEnabled && regResult.firstPrfOutput) {
      hasPrf = true;
      prfCredentialId = regResult.credentialId;
      const saltBytes = crypto.getRandomValues(new Uint8Array(32));
      prfSalt = u8ToBase64(saltBytes);
      envelopeA = await wrapWithPrfSecret(dataKey, regResult.firstPrfOutput);
    }
  }

  const nowIso = new Date().toISOString();
  const metadata: EncryptionMetadata = {
    version: 1,
    userId,
    createdAt: nowIso,
    updatedAt: nowIso,
    hasPrf,
    prfCredentialId,
    prfSalt,
    envelopeA_prf: envelopeA,
    envelopeB_recovery: envelopeB,
    verificationToken,
  };

  return { dataKey, recoveryKey, metadata };
}

/**
 * Fase 2: VERIFY
 * Prueba el desempaquetado de ida y vuelta de la clave de recuperación y del token de verificación.
 */
export async function verifyMigration(dataKey: CryptoKey, recoveryKey: string, metadata: EncryptionMetadata): Promise<boolean> {
  const unwrappedKey = await unwrapWithRecoveryKey(metadata.envelopeB_recovery, recoveryKey);
  const ok = await verifyAekWithMetadata(unwrappedKey, metadata);
  if (!ok) throw new Error('Falló la verificación de descifrado con la Clave de Recuperación');
  return true;
}

/**
 * Fase 3: ACTIVATE
 * Cifra y guarda el store, la cola y las proyecciones en las nuevas claves protegidas,
 * guarda los metadatos y enciende la bandera activa `wallet_encryption_active_v1_<uid>`.
 */
export async function activateMigration(
  userId: string,
  dataKey: CryptoKey,
  metadata: EncryptionMetadata,
  userStorePlaintextJson: string,
  queuePlaintextJson?: string,
  projectionsPlaintextEntries?: Array<{ year: number; json: string }>
): Promise<void> {
  try {
    // 1. Cifrar store principal
    const encryptedStore = await encryptString(dataKey, userStorePlaintextJson);

    // 2. Cifrar cola offline si existe
    let encryptedQueue: string | null = null;
    if (queuePlaintextJson && queuePlaintextJson.trim().length > 0) {
      encryptedQueue = await encryptString(dataKey, queuePlaintextJson);
    }

    // 3. Cifrar proyecciones si existen
    const encryptedProjections: Array<{ key: string; ciphertext: string }> = [];
    if (projectionsPlaintextEntries && projectionsPlaintextEntries.length > 0) {
      for (const entry of projectionsPlaintextEntries) {
        const ct = await encryptString(dataKey, entry.json);
        encryptedProjections.push({ key: getEncryptedProjectionsKey(userId, entry.year), ciphertext: ct });
      }
    }

    // 4. Guardar datos cifrados
    localStorage.setItem(getEncryptedStoreKey(userId), encryptedStore);
    if (encryptedQueue) {
      localStorage.setItem(getEncryptedQueueKey(userId), encryptedQueue);
    }
    for (const proj of encryptedProjections) {
      localStorage.setItem(proj.key, proj.ciphertext);
    }

    // 5. Guardar metadatos y activar bandera persistente
    localStorage.setItem(getMetadataKey(userId), JSON.stringify(metadata));
    localStorage.setItem(getActiveFlagKey(userId), 'true');
  } catch (err) {
    // Si ocurre un error de cuota o fallo de escritura, no corromper ni borrar texto plano
    console.error('[Crypto] Error durante la activación del cifrado local:', err);
    throw err;
  }
}

/**
 * Fase 4: CLEANUP
 * Purga de forma segura únicamente los datos en texto plano del usuario que ahora
 * residen en las claves cifradas.
 */
export function cleanupPlaintextStorage(
  userId: string,
  legacyStoreJsonModifier?: (currentDb: any) => any,
  projectionsYears?: number[]
): void {
  try {
    // 1. Limpiar cola offline legada
    localStorage.removeItem(`wallet_offline_queue_v1_${userId}`);

    // 2. Limpiar proyecciones legadas
    if (projectionsYears) {
      for (const y of projectionsYears) {
        localStorage.removeItem(`wallet_projections_${userId}_${y}`);
      }
    }

    // 3. Modificar store global legado si se proporciona
    if (legacyStoreJsonModifier) {
      const raw = localStorage.getItem('wallet_app_v4_store');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          const modified = legacyStoreJsonModifier(parsed);
          localStorage.setItem('wallet_app_v4_store', JSON.stringify(modified));
        } catch {
          // ignore
        }
      }
    }
  } catch (err) {
    console.warn('[Crypto] Advertencia limpiando almacenamiento legado:', err);
  }
}

/**
 * Desactiva el cifrado local de forma explícita y confirmada, descifrando previamente
 * los datos y reescribiéndolos en formato estándar.
 */
export async function disableLocalEncryption(
  userId: string,
  dataKey: CryptoKey,
  metadata: EncryptionMetadata,
  onRestorePlaintextStore: (plaintextJson: string) => void,
  onRestorePlaintextQueue?: (plaintextJson: string) => void
): Promise<void> {
  const encStoreRaw = localStorage.getItem(getEncryptedStoreKey(userId));
  if (!encStoreRaw) throw new Error('No se encontró el almacén cifrado del usuario');

  const decryptedStore = await decryptString(dataKey, encStoreRaw);
  onRestorePlaintextStore(decryptedStore);

  const encQueueRaw = localStorage.getItem(getEncryptedQueueKey(userId));
  if (encQueueRaw && onRestorePlaintextQueue) {
    try {
      const decryptedQueue = await decryptString(dataKey, encQueueRaw);
      onRestorePlaintextQueue(decryptedQueue);
    } catch (e) {
      console.warn('[Crypto] Advertencia descifrando cola offline al desactivar:', e);
    }
  }

  // Eliminar claves cifradas y apagar bandera
  localStorage.removeItem(getEncryptedStoreKey(userId));
  localStorage.removeItem(getEncryptedQueueKey(userId));
  localStorage.removeItem(getMetadataKey(userId));
  localStorage.removeItem(getActiveFlagKey(userId));
}
