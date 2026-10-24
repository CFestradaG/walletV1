import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Shield,
  ShieldCheck,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  PlusCircle,
  Edit3,
  Bot,
  User,
} from 'lucide-react';
import { useWallet } from '../../core/state/WalletContext';
import {
  ChatMessage,
  SuggestedTransactionDraft,
  hasUserConsentedChat,
  getUserChatConsentTimestamp,
  setUserChatConsent,
  loadChatMessages,
  saveChatMessages,
  clearChatMessages,
} from './chatStorage';
import { sendGenericChatMessage } from './financialChatAi';
import { TransactionType } from '../../core/types/models';

interface FinancialChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTransactionModal?: (prefill: {
    type: TransactionType;
    amount: number;
    concept: string;
    categoryId?: string;
    accountId?: string;
  }) => void;
}

export const FinancialChatModal: React.FC<FinancialChatModalProps> = ({
  isOpen,
  onClose,
  onOpenTransactionModal,
}) => {
  const {
    currentUser,
    resolvedTheme,
    accounts,
    categories,
    createTransaction,
  } = useWallet();

  const isDark = resolvedTheme === 'dark';
  const userId = currentUser?.id || '';

  const [hasConsented, setHasConsented] = useState<boolean>(false);
  const [chatSessionStartedAt, setChatSessionStartedAt] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Cargar estado de consentimiento e historial al abrir
  useEffect(() => {
    if (isOpen && userId) {
      const consented = hasUserConsentedChat(userId);
      setChatSessionStartedAt(getUserChatConsentTimestamp(userId));
      setHasConsented(consented);
      if (consented) {
        void loadChatMessages(userId).then((loaded) => {
          if (loaded.length === 0) {
            // Mensaje de bienvenida inicial
            const welcomeMsg: ChatMessage = {
              id: 'msg_welcome',
              role: 'assistant',
              content:
                '¡Hola! Soy el asistente general de Wallet. Puedo explicar conceptos y responder preguntas generales, pero no tengo acceso a tus cuentas ni a tus movimientos.\n\n¿En qué te puedo ayudar?',
              timestamp: Date.now(),
            };
            setMessages([welcomeMsg]);
          } else {
            setMessages(loaded);
          }
        });
      } else {
        setMessages([]);
      }
    }
  }, [isOpen, userId]);

  // Auto-scroll al final de mensajes
  useEffect(() => {
    if (isOpen && hasConsented) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, hasConsented]);

  if (!isOpen) return null;

  const handleGrantConsent = async () => {
    setIsLoading(true);
    const startedAt = Date.now();
    setUserChatConsent(userId, true, startedAt);
    setChatSessionStartedAt(startedAt);
    setHasConsented(true);
    const previousHistory = await loadChatMessages(userId);
    const welcomeMsg: ChatMessage = {
      id: `msg_general_welcome_${startedAt}`,
      role: 'assistant',
      content:
        '¡Bienvenido! Este asistente responde preguntas generales y no recibe datos de tu Wallet. ¿Qué te gustaría consultar?',
      timestamp: Date.now(),
    };
    const preservedHistory = [...previousHistory, welcomeMsg];
    setMessages(preservedHistory);
    void saveChatMessages(userId, preservedHistory);
    setIsLoading(false);
  };

  const handleClearHistory = () => {
    if (!window.confirm('¿Deseas vaciar el historial de esta conversación?')) return;
    clearChatMessages(userId);
    const resetMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content: 'Historial vaciado. ¿Qué te gustaría consultar ahora?',
      timestamp: Date.now(),
    };
    setMessages([resetMsg]);
    void saveChatMessages(userId, [resetMsg]);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isLoading) return;

    setErrorMessage(null);
    setInputText('');

    const userMsg: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      // No enviamos datos de Wallet ni conversaciones anteriores al consentimiento
      // de este modo general, que pueden contener preguntas financieras.
      const currentSessionMessages = chatSessionStartedAt
        ? messages.filter((message) => message.timestamp >= chatSessionStartedAt)
        : [];
      const assistantReply = await sendGenericChatMessage(currentSessionMessages, text);

      const assistantMsg: ChatMessage = {
        id: `msg_ast_${Date.now()}`,
        role: 'assistant',
        content: assistantReply,
        timestamp: Date.now(),
      };

      const updatedHistory = [...newMessages, assistantMsg];
      setMessages(updatedHistory);
      void saveChatMessages(userId, updatedHistory);
    } catch (err: any) {
      setMessages(messages);
      setErrorMessage(err?.message || 'No se pudo enviar el mensaje.');
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  // Confirmar y registrar transacción sugerida directamente
  const handleExecuteDraft = (draft: SuggestedTransactionDraft, msgId: string) => {
    // Buscar categoría por nombre o coincidencia
    const matchedCategory = categories.find(
      (c) => c.name.toLowerCase() === (draft.categoryName || '').toLowerCase()
    ) || categories.find((c) => c.type === draft.type) || categories[0];

    // Buscar cuenta por nombre o primera líquida disponible
    const matchedAccount = accounts.find(
      (a) => a.name.toLowerCase() === (draft.accountName || '').toLowerCase()
    ) || accounts.find((a) => a.status === 'active' && a.type !== 'credit_card') || accounts[0];

    if (!matchedAccount || !matchedCategory) {
      setErrorMessage('No se encontró una cuenta o categoría válida para registrar el borrador.');
      return;
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const result = createTransaction({
      type: draft.type,
      amount: Math.abs(draft.amount),
      note: draft.concept || 'Movimiento asistente IA',
      date: todayIso,
      accountId: matchedAccount.id,
      categoryId: matchedCategory.id,
    });

    if (result.valid) {
      // Marcar borrador como ejecutado
      const updated = messages.map((m) => {
        if (m.id === msgId && m.suggestedTransaction) {
          return {
            ...m,
            suggestedTransaction: { ...m.suggestedTransaction, isExecuted: true },
          };
        }
        return m;
      });
      setMessages(updated);
      void saveChatMessages(userId, updated);
    } else {
      setErrorMessage(result.error || 'No se pudo guardar la transacción.');
    }
  };

  // Abrir formulario completo para editar antes de guardar
  const handleEditDraftInModal = (draft: SuggestedTransactionDraft) => {
    const matchedCategory = categories.find(
      (c) => c.name.toLowerCase() === (draft.categoryName || '').toLowerCase()
    );
    const matchedAccount = accounts.find(
      (a) => a.name.toLowerCase() === (draft.accountName || '').toLowerCase()
    );

    onClose();
    if (onOpenTransactionModal) {
      onOpenTransactionModal({
        type: draft.type,
        amount: draft.amount,
        concept: draft.concept,
        categoryId: matchedCategory?.id,
        accountId: matchedAccount?.id,
      });
    }
  };

  const quickPrompts = [
    '¿Qué es un fondo de emergencia?',
    '¿Cómo funciona el interés compuesto?',
    '¿Qué diferencia hay entre ahorro e inversión?',
    'Explícame cómo se calcula una tasa de interés',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className={`w-full max-w-2xl h-[92vh] max-h-[850px] rounded-3xl border shadow-2xl overflow-hidden flex flex-col ${
          isDark ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-inherit bg-slate-500/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold">Asistente general</h2>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Sin datos de Wallet</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Preguntas generales · no accede a tus finanzas</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {hasConsented && (
              <button
                type="button"
                onClick={handleClearHistory}
                title="Limpiar conversación"
                className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {!hasConsented ? (
          /* Pantalla de Consentimiento Informado */
          <div className="flex-1 overflow-y-auto p-6 flex flex-col justify-center items-center text-center space-y-6 max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <Shield className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold">Privacidad del asistente general</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Este chat usa Gemini mediante Firebase AI Logic. Lee qué se transmite antes de continuar:
              </p>
            </div>

            <div className={`w-full p-4 rounded-2xl border text-left space-y-3 text-xs ${
              isDark ? 'bg-black/30 border-white/5 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Tu mensaje se envía a Google Gemini:</strong> Wallet no adjunta información de tus cuentas, movimientos, categorías, saldos ni presupuestos. No escribas datos personales, financieros, confidenciales o que te identifiquen.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Tratamiento del nivel gratuito:</strong> Google puede usar consultas y respuestas para mejorar sus productos; revisores humanos podrían procesarlas. Por eso este asistente es general y no debe recibir información sensible.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Sin acceso a Wallet:</strong> La IA solo recibe los mensajes de esta conversación; no puede leer ni modificar tu información financiera.
                </span>
              </div>
            </div>

            <div className="w-full flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className={`flex-1 py-3 rounded-2xl border text-xs font-semibold cursor-pointer ${
                  isDark ? 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                }`}
              >
                Ahora no
              </button>
              <button
                type="button"
                onClick={handleGrantConsent}
                className="flex-1 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 transition-all"
              >
                <span>Activar Asistente</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Pantalla Interactiva de Chat */
          <>
            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs sm:text-sm">
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isUser && (
                      <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-3.5 space-y-2.5 ${
                        isUser
                          ? 'bg-emerald-600 text-white rounded-tr-none'
                          : isDark
                          ? 'bg-slate-800/90 border border-white/10 text-slate-200 rounded-tl-none'
                          : 'bg-slate-100 border border-slate-200 text-slate-800 rounded-tl-none'
                      }`}
                    >
                      <div className="leading-relaxed whitespace-pre-wrap font-sans">
                        {msg.content}
                      </div>

                      {/* Tarjeta de Borrador Interactivo de Transacción */}
                      {msg.suggestedTransaction && !chatSessionStartedAt && (
                        <div
                          className={`mt-2 p-3 rounded-xl border space-y-2 ${
                            isDark
                              ? 'bg-black/40 border-emerald-500/30 text-white'
                              : 'bg-white border-emerald-400/50 text-slate-900 shadow-sm'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                              <PlusCircle className="w-3.5 h-3.5" />
                              Borrador de Transacción Sugerida
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold uppercase">
                              {msg.suggestedTransaction.type === 'expense' ? 'Gasto' : 'Ingreso'}
                            </span>
                          </div>

                          <div className="flex items-baseline justify-between pt-1">
                            <div className="font-bold text-sm">
                              {msg.suggestedTransaction.concept}
                            </div>
                            <div className="font-mono font-bold text-base text-emerald-400">
                              Q{Number(msg.suggestedTransaction.amount).toFixed(2)}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            {msg.suggestedTransaction.categoryName && (
                              <span className="px-2 py-0.5 rounded-md bg-white/5 border border-inherit">
                                {msg.suggestedTransaction.categoryName}
                              </span>
                            )}
                            {msg.suggestedTransaction.accountName && (
                              <span className="px-2 py-0.5 rounded-md bg-white/5 border border-inherit">
                                {msg.suggestedTransaction.accountName}
                              </span>
                            )}
                          </div>

                          {msg.suggestedTransaction.isExecuted ? (
                            <div className="pt-2 flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Registrado en tus finanzas</span>
                            </div>
                          ) : (
                            <div className="flex gap-2 pt-1.5">
                              <button
                                type="button"
                                onClick={() => handleExecuteDraft(msg.suggestedTransaction!, msg.id)}
                                className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Confirmar y Registrar</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditDraftInModal(msg.suggestedTransaction!)}
                                className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                                  isDark ? 'bg-white/5 hover:bg-white/10 border-white/10' : 'bg-slate-100 hover:bg-slate-200 border-slate-300'
                                }`}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Editar</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="text-[10px] text-right opacity-60">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    {isUser && (
                      <div className="w-7 h-7 rounded-xl bg-slate-700 text-white flex items-center justify-center shrink-0 mt-0.5">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex items-center gap-3 text-slate-400 text-xs">
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 animate-pulse" />
                  </div>
                  <div className="flex items-center gap-1.5 py-2 px-3 rounded-2xl bg-slate-500/10">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Starter Chips */}
            {messages.length <= 2 && (
              <div className="px-4 py-2 border-t border-inherit flex gap-2 overflow-x-auto no-scrollbar">
                {quickPrompts.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSendMessage(p)}
                    className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap border shrink-0 transition-colors cursor-pointer ${
                      isDark
                        ? 'bg-slate-800/80 hover:bg-slate-700 border-white/10 text-slate-300'
                        : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            {/* Input Bar */}
            <div className="p-3 sm:p-4 border-t border-inherit bg-slate-500/5">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Haz una pregunta general; no incluyas datos personales o financieros..."
                  className={`flex-1 max-h-32 p-3 text-xs sm:text-sm rounded-2xl border resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                    isDark ? 'bg-black/40 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900 shadow-xs'
                  }`}
                />

                <button
                  type="button"
                  disabled={!inputText.trim() || isLoading}
                  onClick={() => handleSendMessage()}
                  className="p-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold transition-all cursor-pointer shadow-md shadow-emerald-500/20 shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-center text-slate-400 pt-1.5">
                La IA analiza métricas cuantitativas agregadas en GTQ. Revisa y confirma cualquier movimiento antes de guardarlo.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
