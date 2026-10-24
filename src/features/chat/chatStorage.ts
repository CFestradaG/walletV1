import {
  decryptString,
  encryptString,
  isLocalEncryptionActiveForUser,
} from '../../core/security/cryptoService';

export interface SuggestedTransactionDraft {
  type: 'expense' | 'income';
  amount: number;
  concept: string;
  categoryName?: string;
  accountName?: string;
  isExecuted?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  suggestedTransaction?: SuggestedTransactionDraft;
}

const CHAT_CONSENT_PREFIX = 'wallet_chat_consent_v1_';
const CHAT_STORAGE_PREFIX = 'wallet_chat_history_v1_';
const CHAT_ENC_STORAGE_PREFIX = 'wallet_enc_chat_v1_';

export function hasUserConsentedChat(userId: string): boolean {
  if (!userId) return false;
  try {
    return localStorage.getItem(`${CHAT_CONSENT_PREFIX}${userId}`) === 'true';
  } catch {
    return false;
  }
}

export function setUserChatConsent(userId: string, consented: boolean): void {
  if (!userId) return;
  try {
    if (consented) {
      localStorage.setItem(`${CHAT_CONSENT_PREFIX}${userId}`, 'true');
    } else {
      localStorage.removeItem(`${CHAT_CONSENT_PREFIX}${userId}`);
    }
  } catch {
    // ignore
  }
}

export async function loadChatMessages(
  userId: string,
  aek?: CryptoKey | null
): Promise<ChatMessage[]> {
  if (!userId) return [];

  const isEncrypted = isLocalEncryptionActiveForUser(userId);

  if (isEncrypted) {
    if (!aek) return []; // Bóveda bloqueada
    try {
      const rawEnc = localStorage.getItem(`${CHAT_ENC_STORAGE_PREFIX}${userId}`);
      if (!rawEnc) return [];
      const decrypted = await decryptString(aek, rawEnc);
      const parsed = JSON.parse(decrypted);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('[ChatStorage] Error descifrando historial de chat:', e);
      return [];
    }
  }

  try {
    const raw = localStorage.getItem(`${CHAT_STORAGE_PREFIX}${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveChatMessages(
  userId: string,
  messages: ChatMessage[],
  aek?: CryptoKey | null
): Promise<void> {
  if (!userId) return;

  const isEncrypted = isLocalEncryptionActiveForUser(userId);

  if (isEncrypted) {
    if (!aek) return; // No guardar sin clave de bóveda
    try {
      const payload = JSON.stringify(messages);
      const ct = await encryptString(aek, payload);
      localStorage.setItem(`${CHAT_ENC_STORAGE_PREFIX}${userId}`, ct);
      localStorage.removeItem(`${CHAT_STORAGE_PREFIX}${userId}`);
    } catch (e) {
      console.error('[ChatStorage] Error guardando historial cifrado:', e);
    }
    return;
  }

  try {
    localStorage.setItem(`${CHAT_STORAGE_PREFIX}${userId}`, JSON.stringify(messages));
  } catch (e) {
    console.error('[ChatStorage] Error guardando historial:', e);
  }
}

export function clearChatMessages(userId: string): void {
  if (!userId) return;
  try {
    localStorage.removeItem(`${CHAT_STORAGE_PREFIX}${userId}`);
    localStorage.removeItem(`${CHAT_ENC_STORAGE_PREFIX}${userId}`);
  } catch {
    // ignore
  }
}
