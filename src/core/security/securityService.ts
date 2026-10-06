/**
 * Security Service for PWA:
 * - PIN verification using Web Crypto API (PBKDF2-SHA256 + salt)
 * - Platform Biometrics (Huella dactilar / Face ID / Touch ID) via WebAuthn API
 * - Auto-lock timing, app visibility detection, and offline lock state
 */

export interface SecurityConfig {
  enabled: boolean;
  pinEnabled: boolean;
  biometricsEnabled: boolean;
  lockTimeoutMinutes: number; // 0 = Inmediato al salir, 1, 5, 15 min
  lockOnAppSwitch: boolean; // Bloquear al minimizar / cambiar de app
}

export interface SecurityStatus {
  isConfigured: boolean;
  isBiometricsSupported: boolean;
  isBiometricsRegistered: boolean;
  config: SecurityConfig;
}

export interface SyncedSecurityPreferences {
  config: Pick<SecurityConfig, 'enabled' | 'pinEnabled' | 'lockTimeoutMinutes' | 'lockOnAppSwitch'>;
  pinCredential: { salt: string; hash: string; algorithm?: 'PBKDF2-SHA256'; iterations?: number } | null;
}

const DEFAULT_CONFIG: SecurityConfig = {
  enabled: false,
  pinEnabled: false,
  biometricsEnabled: false,
  lockTimeoutMinutes: 0,
  lockOnAppSwitch: true,
};

function getConfigKey(userId: string): string {
  return `wallet_security_config_${userId}`;
}

function getPinKey(userId: string): string {
  return `wallet_security_pin_${userId}`;
}

function getBiometricKey(userId: string): string {
  return `wallet_security_bio_${userId}`;
}

const PIN_HASH_ITERATIONS = 310_000;

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashLegacyPin(pin: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${salt}:${pin}:wallet_pwa_gtq`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return hex(new Uint8Array(hashBuffer));
}

// Generate random salt
function generateSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return hex(array);
}

async function createPinCredential(pin: string): Promise<NonNullable<SyncedSecurityPreferences['pinCredential']>> {
  const salt = generateSalt();
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: PIN_HASH_ITERATIONS },
    key,
    256
  );
  return { salt, hash: hex(new Uint8Array(bits)), algorithm: 'PBKDF2-SHA256', iterations: PIN_HASH_ITERATIONS };
}

function readPinCredential(userId: string): SyncedSecurityPreferences['pinCredential'] {
  try {
    const raw = localStorage.getItem(getPinKey(userId));
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (typeof value?.salt !== 'string' || typeof value?.hash !== 'string') return null;
    return value;
  } catch {
    return null;
  }
}

export function getSyncedSecurityPreferences(userId: string): SyncedSecurityPreferences {
  const config = getSecurityConfig(userId);
  return {
    config: {
      enabled: config.enabled && config.pinEnabled,
      pinEnabled: config.pinEnabled,
      lockTimeoutMinutes: config.lockTimeoutMinutes,
      lockOnAppSwitch: config.lockOnAppSwitch,
    },
    pinCredential: config.pinEnabled ? readPinCredential(userId) : null,
  };
}

export function applySyncedSecurityPreferences(userId: string, preferences: SyncedSecurityPreferences): void {
  const localConfig = getSecurityConfig(userId);
  const localBiometricsAvailable = localConfig.biometricsEnabled && hasBiometricsRegistered(userId);
  const hasSyncedPin = Boolean(preferences.config.pinEnabled && preferences.pinCredential);
  const nextEnabled = preferences.config.enabled && hasSyncedPin;
  const lockStateChanged = localConfig.enabled !== nextEnabled;
  saveSecurityConfig(userId, {
    ...preferences.config,
    enabled: nextEnabled,
    pinEnabled: hasSyncedPin,
    biometricsEnabled: localBiometricsAvailable,
  });
  if (preferences.config.pinEnabled && preferences.pinCredential) {
    localStorage.setItem(getPinKey(userId), JSON.stringify(preferences.pinCredential));
  } else if (!preferences.config.pinEnabled) {
    localStorage.removeItem(getPinKey(userId));
  }
  if (lockStateChanged && typeof window !== 'undefined') {
    window.dispatchEvent(new Event('wallet-security-preferences-changed'));
  }
}

/**
 * Check if platform authenticator (TouchID, FaceID, Fingerprint, Windows Hello) is available.
 */
export async function isBiometricsAvailable(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return false;
  }
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Get stored security configuration for user.
 */
export function getSecurityConfig(userId: string): SecurityConfig {
  try {
    const raw = localStorage.getItem(getConfigKey(userId));
    if (!raw) return { ...DEFAULT_CONFIG };
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Save security configuration.
 */
export function saveSecurityConfig(userId: string, config: Partial<SecurityConfig>): SecurityConfig {
  const current = getSecurityConfig(userId);
  const updated = { ...current, ...config };
  localStorage.setItem(getConfigKey(userId), JSON.stringify(updated));
  return updated;
}

/**
 * Configure or update user PIN.
 */
export async function setupUserPin(userId: string, pin: string): Promise<boolean> {
  if (!pin || pin.length < 4) return false;
  const credential = await createPinCredential(pin);
  localStorage.setItem(getPinKey(userId), JSON.stringify(credential));
  saveSecurityConfig(userId, { enabled: true, pinEnabled: true });
  return true;
}

/**
 * Verify user PIN.
 */
export async function verifyUserPin(userId: string, pin: string): Promise<boolean> {
  try {
    const raw = localStorage.getItem(getPinKey(userId));
    if (!raw) return false;
    const credential = JSON.parse(raw) as NonNullable<SyncedSecurityPreferences['pinCredential']>;
    const isLegacy = credential.algorithm !== 'PBKDF2-SHA256';
    let computed: string;
    if (isLegacy) {
      computed = await hashLegacyPin(pin, credential.salt);
    } else {
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          hash: 'SHA-256',
          salt: new TextEncoder().encode(credential.salt),
          iterations: credential.iterations || PIN_HASH_ITERATIONS,
        },
        key,
        256
      );
      computed = hex(new Uint8Array(bits));
    }
    if (computed !== credential.hash) return false;
    if (isLegacy) {
      localStorage.setItem(getPinKey(userId), JSON.stringify(await createPinCredential(pin)));
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Register Biometrics using WebAuthn (Touch ID, Face ID, Android Fingerprint).
 */
export async function registerBiometrics(userId: string, userDisplayName = 'Usuario Wallet'): Promise<{ ok: boolean; error?: string }> {
  const supported = await isBiometricsAvailable();
  if (!supported) {
    return { ok: false, error: 'Este dispositivo no cuenta con sensor biométrico compatible.' };
  }

  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const userBuffer = new TextEncoder().encode(userId);

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'Wallet GTQ',
          id: window.location.hostname,
        },
        user: {
          id: userBuffer,
          name: userId,
          displayName: userDisplayName,
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' }, // ES256
          { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: {
          // No forzamos 'platform' para máxima compatibilidad con Android (Redmi, MediaTek).
          // El navegador seleccionará el autenticador integrado disponible (huella, FaceID, PIN).
          residentKey: 'discouraged',
          userVerification: 'required',
          requireResidentKey: false,
        },
        timeout: 60000,
        attestation: 'none',
      },
    })) as PublicKeyCredential | null;

    if (!credential) {
      return { ok: false, error: 'No se completó el registro biométrico.' };
    }

    // Save registered credential ID
    const credIdBase64 = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
    localStorage.setItem(getBiometricKey(userId), credIdBase64);
    saveSecurityConfig(userId, { enabled: true, biometricsEnabled: true });

    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al registrar biometría.';
    // Cancelled by user is standard
    if (msg.includes('NotAllowedError') || msg.includes('cancel')) {
      return { ok: false, error: 'Operación cancelada o rechazada en el sensor.' };
    }
    return { ok: false, error: msg };
  }
}

/**
 * Authenticate with Biometrics using WebAuthn.
 */
export async function verifyBiometrics(userId: string): Promise<{ ok: boolean; error?: string }> {
  const supported = await isBiometricsAvailable();
  if (!supported) {
    return { ok: false, error: 'Biometría no disponible en este dispositivo.' };
  }

  const storedCredId = localStorage.getItem(getBiometricKey(userId));
  if (!storedCredId) {
    return { ok: false, error: 'No hay huella o rostro registrado en este dispositivo.' };
  }

  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    // Convert base64 back to Uint8Array
    const binaryString = atob(storedCredId);
    const rawId = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      rawId[i] = binaryString.charCodeAt(i);
    }

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [
          {
            id: rawId,
            type: 'public-key',
            transports: ['internal'],
          },
        ],
        userVerification: 'required',
        timeout: 60000,
      },
    });

    if (assertion) {
      return { ok: true };
    }
    return { ok: false, error: 'No se pudo verificar la identidad.' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error en la verificación.';
    if (msg.includes('NotAllowedError') || msg.includes('cancel')) {
      return { ok: false, error: 'Verificación biométrica cancelada.' };
    }
    return { ok: false, error: msg };
  }
}

/**
 * Disable all security locking for the user.
 */
export function removeSecurityLock(userId: string): void {
  localStorage.removeItem(getPinKey(userId));
  localStorage.removeItem(getBiometricKey(userId));
  localStorage.setItem(getConfigKey(userId), JSON.stringify({ ...DEFAULT_CONFIG, enabled: false }));
}

/**
 * Check if the user has a PIN configured.
 */
export function hasPinConfigured(userId: string): boolean {
  return !!localStorage.getItem(getPinKey(userId));
}

/**
 * Check if user has biometrics registered.
 */
export function hasBiometricsRegistered(userId: string): boolean {
  return !!localStorage.getItem(getBiometricKey(userId));
}
