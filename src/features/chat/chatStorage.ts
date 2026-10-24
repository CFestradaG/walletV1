import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../core/firebase/firebase';
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

const CHAT_CONSENT_PREFIX = 'wallet_chat_consent_v3_';
const CHAT_STORAGE_PREFIX = 'wallet_chat_history_v1_';
const CHAT_ENC_STORAGE_PREFIX = 'wallet_enc_chat_v1_';
const MAX_SAVED_MESSAGES = 50; // Mantiene el documento consolidado en < 30 KB en Firestore

export function hasUserConsentedChat(userId: string): boolean {
  if (!userId) return false;
  try {
    const timestamp = Number(localStorage.getItem(`${CHAT_CONSENT_PREFIX}${userId}`));
    return Number.isFinite(timestamp) && timestamp > 0;
  } catch {
    return false;
  }
}

export function getUserChatConsentTimestamp(userId: string): number | null {
  if (!userId) return null;
  try {
    const timestamp = Number(localStorage.getItem(`${CHAT_CONSENT_PREFIX}${userId}`));
    return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
  } catch {
    return null;
  }
}

export function setUserChatConsent(userId: string, consented: boolean, timestamp = Date.now()): void {
  if (!userId) return;
  try {
    if (consented) {
      localStorage.setItem(`${CHAT_CONSENT_PREFIX}${userId}`, String(timestamp));
    } else {
      localStorage.removeItem(`${CHAT_CONSENT_PREFIX}${userId}`);
    }
  } catch {
    // ignore
  }
}

/**
 * Carga el historial de conversación:
 * 1. Intenta leer primero la copia local (para respuesta instantánea offline).
 * 2. Si no hay copia local y hay conexión, consulta Firestore en `users/{userId}/settings/ai_chat_history`.
 */
export async function loadChatMessages(
  userId: string,
  aek?: CryptoKey | null
): Promise<ChatMessage[]> {
  if (!userId) return [];

  const isEncrypted = isLocalEncryptionActiveForUser(userId);

  // 1. Carga desde almacenamiento local si existe
  let localMessages: ChatMessage[] = [];
  if (isEncrypted) {
    if (aek) {
      try {
        const rawEnc = localStorage.getItem(`${CHAT_ENC_STORAGE_PREFIX}${userId}`);
        if (rawEnc) {
          const decrypted = await decryptString(aek, rawEnc);
          const parsed = JSON.parse(decrypted);
          if (Array.isArray(parsed) && parsed.length > 0) {
            localMessages = parsed;
          }
        }
      } catch (e) {
        console.warn('[ChatStorage] Error descifrando historial local:', e);
      }
    }
  } else {
    try {
      const raw = localStorage.getItem(`${CHAT_STORAGE_PREFIX}${userId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          localMessages = parsed;
        }
      }
    } catch {
      // ignore
    }
  }

  if (localMessages.length > 0) {
    return localMessages;
  }

  // 2. Si no hay en local, consultar Firestore
  try {
    const chatDocRef = doc(db, 'users', userId, 'settings', 'ai_chat_history');
    const snap = await getDoc(chatDocRef);
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data?.messages) && data.messages.length > 0) {
        const remoteMessages: ChatMessage[] = data.messages;
        // Guardar copia local en segundo plano
        void saveLocalCache(userId, remoteMessages, isEncrypted ? aek : null);
        return remoteMessages;
      }
    }
  } catch (err) {
    console.warn('[ChatStorage] No se pudo cargar historial desde Firestore:', err);
  }

  return [];
}

/**
 * Guarda el historial tanto localmente como en Firestore (1 solo documento por usuario).
 */
export async function saveChatMessages(
  userId: string,
  messages: ChatMessage[],
  aek?: CryptoKey | null
): Promise<void> {
  if (!userId) return;

  const isEncrypted = isLocalEncryptionActiveForUser(userId);
  const boundedMessages = messages.slice(-MAX_SAVED_MESSAGES);

  // 1. Guardar localmente
  await saveLocalCache(userId, boundedMessages, isEncrypted ? aek : null);

  // 2. Sincronizar en Firestore
  try {
    const cleanList = boundedMessages.map((m) => {
      const item: any = {
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      };
      if (m.suggestedTransaction) {
        item.suggestedTransaction = {
          type: m.suggestedTransaction.type,
          amount: m.suggestedTransaction.amount,
          concept: m.suggestedTransaction.concept,
          categoryName: m.suggestedTransaction.categoryName || '',
          accountName: m.suggestedTransaction.accountName || '',
          isExecuted: !!m.suggestedTransaction.isExecuted,
        };
      }
      return item;
    });

    const chatDocRef = doc(db, 'users', userId, 'settings', 'ai_chat_history');
    await setDoc(
      chatDocRef,
      {
        userId,
        updatedAt: new Date().toISOString(),
        messages: cleanList,
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('[ChatStorage] No se pudo guardar historial en Firestore:', err);
  }
}

async function saveLocalCache(
  userId: string,
  messages: ChatMessage[],
  aek?: CryptoKey | null
): Promise<void> {
  if (aek) {
    try {
      const payload = JSON.stringify(messages);
      const ct = await encryptString(aek, payload);
      localStorage.setItem(`${CHAT_ENC_STORAGE_PREFIX}${userId}`, ct);
      localStorage.removeItem(`${CHAT_STORAGE_PREFIX}${userId}`);
    } catch (e) {
      console.error('[ChatStorage] Error guardando copia local cifrada:', e);
    }
  } else {
    try {
      localStorage.setItem(`${CHAT_STORAGE_PREFIX}${userId}`, JSON.stringify(messages));
    } catch (e) {
      console.error('[ChatStorage] Error guardando copia local:', e);
    }
  }
}

/**
 * Limpia el historial tanto en almacenamiento local como en Firestore.
 */
export async function clearChatMessages(userId: string): Promise<void> {
  if (!userId) return;

  try {
    localStorage.removeItem(`${CHAT_STORAGE_PREFIX}${userId}`);
    localStorage.removeItem(`${CHAT_ENC_STORAGE_PREFIX}${userId}`);
  } catch {
    // ignore
  }

  try {
    const chatDocRef = doc(db, 'users', userId, 'settings', 'ai_chat_history');
    await deleteDoc(chatDocRef);
  } catch (err) {
    console.warn('[ChatStorage] No se pudo borrar historial en Firestore:', err);
  }
}
