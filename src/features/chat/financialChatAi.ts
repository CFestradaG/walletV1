import { getAI, getGenerativeModel, GoogleAIBackend, type Content } from 'firebase/ai';
import { appCheckReady, firebaseApp } from '../../core/firebase/firebase';
import type { ChatMessage } from './chatStorage';

const MAX_HISTORY_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 1500;

function toHistory(messages: ChatMessage[]): Content[] {
  const eligible = messages
    .filter((message) => message.id !== 'msg_welcome' && message.content.trim())
    .slice(-MAX_HISTORY_MESSAGES);

  const firstUserIndex = eligible.findIndex((message) => message.role === 'user');
  if (firstUserIndex < 0) return [];

  const history: Content[] = [];
  for (const message of eligible.slice(firstUserIndex)) {
    const role = message.role === 'user' ? 'user' : 'model';
    if (history.at(-1)?.role === role) continue;
    history.push({ role, parts: [{ text: message.content.slice(0, MAX_MESSAGE_LENGTH) }] });
  }

  // The new user message is sent separately, so omit an unfinished final user turn.
  if (history.at(-1)?.role === 'user') history.pop();
  return history;
}

export async function sendGenericChatMessage(
  messages: ChatMessage[],
  currentText: string
): Promise<string> {
  if (!appCheckReady) {
    throw new Error('Falta configurar App Check para habilitar el chat con IA.');
  }

  const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });
  const model = getGenerativeModel(ai, {
    model: 'gemini-3.8-flash',
    systemInstruction: `Eres un asistente general en español. Responde preguntas educativas y cotidianas de forma clara y breve.
No tienes acceso a la aplicación Wallet ni a datos financieros del usuario. No solicites información personal, financiera, confidencial ni identificable. Si el usuario comparte ese tipo de datos, no los repitas y recuérdale que no los incluya.
No propongas ni prepares borradores de transacciones, y nunca afirmes haber guardado información. Limita cada respuesta a un máximo de tres párrafos.`,
    generationConfig: { temperature: 0.5, maxOutputTokens: 700 },
  });

  const chat = model.startChat({ history: toHistory(messages) });
  const result = await chat.sendMessage(currentText.slice(0, MAX_MESSAGE_LENGTH));
  return result.response.text()?.trim() || 'No pude generar una respuesta en este momento.';
}
