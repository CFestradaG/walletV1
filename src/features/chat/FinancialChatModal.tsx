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
  RefreshCw,
  CreditCard,
  PieChart,
  HelpCircle,
} from 'lucide-react';
import { useWallet } from '../../core/state/WalletContext';
import { auth } from '../../core/firebase/firebase';
import {
  ChatMessage,
  SuggestedTransactionDraft,
  hasUserConsentedChat,
  setUserChatConsent,
  loadChatMessages,
  saveChatMessages,
  clearChatMessages,
} from './chatStorage';
import { buildPseudonymizedContext } from './chatContextEngine';
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
    activePeriod,
    accounts,
    categories,
    transactions,
    budgets,
    portfolioSummary,
    createTransaction,
  } = useWallet();

  const isDark = resolvedTheme === 'dark';
  const userId = currentUser?.id || '';

  const [hasConsented, setHasConsented] = useState<boolean>(false);
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
      setHasConsented(consented);
      if (consented) {
        void loadChatMessages(userId).then((loaded) => {
          if (loaded.length === 0) {
            // Mensaje de bienvenida inicial
            const welcomeMsg: ChatMessage = {
              id: 'msg_welcome',
              role: 'assistant',
              content:
                '¡Hola! Soy tu **Asistente Financiero de Wallet**. Puedo analizar tu período actual, revisar tu ritmo de gasto o preparar borradores de transacciones para registrar tus movimientos al instante en Quetzales (GTQ).\n\n¿En qué te puedo asesorar hoy?',
              timestamp: Date.now(),
            };
            setMessages([welcomeMsg]);
          } else {
            setMessages(loaded);
          }
        });
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

  const handleGrantConsent = () => {
    setUserChatConsent(userId, true);
    setHasConsented(true);
    const welcomeMsg: ChatMessage = {
      id: 'msg_welcome',
      role: 'assistant',
      content:
        '¡Bienvenido! He cargado el resumen seudonimizado de tu período financiero activo. Pregúntame sobre tus presupuestos, fechas de corte de tarjetas o pídeme registrar compras diarias.',
      timestamp: Date.now(),
    };
    setMessages([welcomeMsg]);
    void saveChatMessages(userId, [welcomeMsg]);
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
      // 1. Obtener token de autenticación
      let token: string | undefined;
      try {
        token = await auth.currentUser?.getIdToken();
      } catch {
        // En dev puede continuar
      }

      // 2. Extraer contexto financiero seudonimizado
      const financialContext = buildPseudonymizedContext({
        activePeriod,
        accounts,
        categories,
        transactions,
        budgets,
        portfolioSummary,
      });

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/financial-chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          financialContext,
        }),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error || `Error del servidor (${res.status})`);
      }

      const json = await res.json();
      if (!json.ok || !json.data) {
        throw new Error(json.error || 'Respuesta vacía del servidor.');
      }

      const assistantMsg: ChatMessage = {
        id: `msg_ast_${Date.now()}`,
        role: 'assistant',
        content: json.data.reply || 'He recibido tu mensaje.',
        timestamp: Date.now(),
        suggestedTransaction: json.data.suggestedTransaction || undefined,
      };

      const updatedHistory = [...newMessages, assistantMsg];
      setMessages(updatedHistory);
      void saveChatMessages(userId, updatedHistory);
    } catch (err: any) {
      console.error('[FinancialChat] Error:', err);
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
    '¿Cómo voy con mi presupuesto este mes?',
    '¿Qué tarjeta me conviene usar hoy?',
    '¿En qué categoría he gastado más?',
    'Anotar gasto de Q50 en combustible',
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
                <h2 className="text-sm font-bold">Asistente Financiero</h2>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Sin PII</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Consultas y borradores inteligentes en GTQ</p>
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
              <h3 className="text-lg font-bold">Privacidad de tu Asistente Financiero</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Wallet te permite consultar en lenguaje natural tu situación financiera con inteligencia artificial.
                Antes de comenzar, conoce cómo protegemos tu información:
              </p>
            </div>

            <div className={`w-full p-4 rounded-2xl border text-left space-y-3 text-xs ${
              isDark ? 'bg-black/30 border-white/5 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Cero datos personales (Sin PII):</strong> Nunca enviamos tu nombre, correo, números de cuenta, notas personales ni datos bancarios sensibles.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Métricas agregadas:</strong> Solo se analizan totales numéricos, categorías y límites del período activo.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Tú tienes el control:</strong> La IA nunca escribe directamente en tu base de datos; genera borradores para que tú los confirmes con un toque.
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
                      {msg.suggestedTransaction && (
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
                  placeholder="Pregunta sobre presupuestos, tarjetas o pide registrar un gasto..."
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
