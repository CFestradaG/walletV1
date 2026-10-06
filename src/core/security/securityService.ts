/**
 * Security Service for PWA:
 * - Local PIN encryption & verification using Web Crypto API (SHA-256 + salt)
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

// Convert string to SHA-256 hash
async function hashPin(pin: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${salt}:${pin}:wallet_pwa_gtq`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Generate random salt
function generateSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
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
  const salt = generateSalt();
  const hash = await hashPin(pin, salt);
  localStorage.setItem(getPinKey(userId), JSON.stringify({ salt, hash }));
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
    const { salt, hash } = JSON.parse(raw);
    const computed = await hashPin(pin, salt);
    return computed === hash;
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
          authenticatorAttachment: 'platform', // Built-in platform biometric sensor
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
