import React, { useState, useEffect } from 'react';
import {
  Shield,
  KeyRound,
  Fingerprint,
  Lock,
  CheckCircle2,
  AlertTriangle,
  X,
  Copy,
  Download,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import {
  generateRecoveryKey,
  isValidRecoveryKeyFormat,
  normalizeRecoveryKey,
  isWebAuthnPrfSupported,
  prepareLocalEncryption,
  verifyMigration,
  activateMigration,
  cleanupPlaintextStorage,
  PrepareMigrationResult,
} from './cryptoService';
import { useWallet } from '../state/WalletContext';

interface EnableEncryptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userEmail: string;
  onEncryptionEnabled: (dataKey: CryptoKey) => void;
}

type Step = 'intro' | 'key' | 'verify' | 'activating' | 'success';

export const EnableEncryptionModal: React.FC<EnableEncryptionModalProps> = ({
  isOpen,
  onClose,
  userId,
  userEmail,
  onEncryptionEnabled,
}) => {
  const { resolvedTheme } = useWallet();
  const isDark = resolvedTheme === 'dark';

  const [step, setStep] = useState<Step>('intro');
  const [prfSupported, setPrfSupported] = useState<boolean>(false);
  const [usePrf, setUsePrf] = useState<boolean>(true);
  const [recoveryKey, setRecoveryKey] = useState<string>('');
  const [confirmKeyInput, setConfirmKeyInput] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [prepResult, setPrepResult] = useState<PrepareMigrationResult | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep('intro');
      setErrorMsg(null);
      setConfirmKeyInput('');
      setCopied(false);
      void isWebAuthnPrfSupported().then((supported) => {
        setPrfSupported(supported);
        setUsePrf(supported);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStart = async () => {
    setErrorMsg(null);
    try {
      const generated = generateRecoveryKey();
      setRecoveryKey(generated);
      setStep('key');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error inicializando claves criptográficas.');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(recoveryKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadBackup = () => {
    const content = `WALLET PWA - CLAVE DE RECUPERACIÓN DE BÓVEDA LOCAL
=====================================================
Usuario: ${userEmail}
Fecha de emisión: ${new Date().toLocaleString()}
Clave: ${recoveryKey}

AVISO DE SEGURIDAD:
Esta clave de 256 bits es indispensable para descifrar y recuperar tus
datos locales en reposo (localStorage) si limpias la caché del navegador
o si el sensor biométrico no está disponible.
Guárdala en un gestor de contraseñas o en un lugar seguro fuera de este dispositivo.
`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wallet-clave-recuperacion-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleProceedToVerify = () => {
    setConfirmKeyInput('');
    setErrorMsg(null);
    setStep('verify');
  };

  const handleExecuteActivation = async () => {
    setErrorMsg(null);
    const normalizedInput = normalizeRecoveryKey(confirmKeyInput);
    const normalizedTarget = normalizeRecoveryKey(recoveryKey);

    if (normalizedInput !== normalizedTarget) {
      setErrorMsg('La clave ingresada no coincide exactamente con la generada. Por favor verifica.');
      return;
    }

    setStep('activating');

    try {
      // 1. Preparar migración (Crea AEK, sobres y token)
      const prep = await prepareLocalEncryption(userId, userEmail, usePrf && prfSupported);
      setPrepResult(prep);

      // 2. Verificar roundtrip
      await verifyMigration(prep.dataKey, recoveryKey, prep.metadata);

      // 3. Obtener snapshot de texto plano actual
      const rawStore = localStorage.getItem('wallet_app_v4_store') || '{}';
      const rawQueue = localStorage.getItem(`wallet_offline_queue_v1_${userId}`) || '';

      // Proyecciones anuales
      const currentYear = new Date().getFullYear();
      const projYears = [currentYear - 1, currentYear, currentYear + 1];
      const projEntries: Array<{ year: number; json: string }> = [];
      for (const y of projYears) {
        const rawP = localStorage.getItem(`wallet_projections_${userId}_${y}`);
        if (rawP) projEntries.push({ year: y, json: rawP });
      }

      // 4. Activar migración en claves cifradas
      await activateMigration(userId, prep.dataKey, prep.metadata, rawStore, rawQueue, projEntries);

      // 5. Limpieza segura de texto plano
      cleanupPlaintextStorage(userId, undefined, projYears);

      // 6. Notificar estado
      onEncryptionEnabled(prep.dataKey);
      setStep('success');
    } catch (err: any) {
      console.error('Error activando cifrado:', err);
      setErrorMsg(err?.message || 'Ocurrió un error al activar el cifrado local.');
      setStep('verify');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
          isDark ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-inherit">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Cifrado Local de Datos</h2>
              <p className="text-xs text-slate-400">Bóveda AES-256 en reposo (localStorage)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={step === 'activating'}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {step === 'intro' && (
            <div className="space-y-4">
              <p className={isDark ? 'text-slate-300' : 'text-slate-600'}>
                El cifrado local protege tus datos financieros almacenados en este navegador mediante una clave maestra
                aleatoria de 256 bits (AES-GCM).
              </p>

              <div className={`p-4 rounded-2xl border space-y-2.5 ${isDark ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center gap-2 font-semibold text-xs text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Alcance y Límites del Cifrado</span>
                </div>
                <ul className="text-xs space-y-1.5 list-disc pl-4 text-slate-400">
                  <li>
                    <strong className="text-slate-200">En reposo local:</strong> Tu store, cola offline y proyecciones no podrán leerse desde el almacenamiento local sin la clave.
                  </li>
                  <li>
                    <strong className="text-slate-200">Independencia del PIN:</strong> El PIN de 4 dígitos solo bloquea la pantalla; no se usa para envolver la clave maestra.
                  </li>
                  <li>
                    <strong className="text-slate-200">Nube en Firestore:</strong> Tus datos en Firestore viajan con TLS y se protegen por autenticación de Firebase, pero este cifrado es local al navegador.
                  </li>
                </ul>
              </div>

              {prfSupported ? (
                <div className={`p-4 rounded-2xl border flex items-center justify-between ${isDark ? 'bg-black/30 border-white/10' : 'bg-slate-100 border-slate-200'}`}>
                  <div className="flex items-center gap-3">
                    <Fingerprint className="w-5 h-5 text-emerald-400" />
                    <div>
                      <span className="font-semibold text-xs block">Desbloqueo Biométrico Hardware (WebAuthn PRF)</span>
                      <span className="text-[11px] text-slate-400">Tu navegador soporta derivar claves criptográficas con tu huella/Face ID.</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={usePrf}
                    onChange={(e) => setUsePrf(e.target.checked)}
                    className="rounded text-emerald-500 focus:ring-emerald-500 w-4 h-4"
                  />
                </div>
              ) : (
                <div className={`p-3.5 rounded-2xl border text-xs ${isDark ? 'bg-black/20 border-white/5 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                  WebAuthn PRF no está disponible en este navegador. Desbloquearás la bóveda mediante tu Clave de Recuperación y tu PIN durante la sesión.
                </div>
              )}

              <button
                type="button"
                onClick={handleStart}
                className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg shadow-emerald-500/20"
              >
                <span>Generar Clave de Recuperación</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === 'key' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">Paso 1 de 2: Respaldar Clave</span>
                <p className="text-xs text-slate-400">
                  Esta es tu Clave de Recuperación criptográfica de 256 bits. Si limpias el navegador o cambias de equipo, esta es la única llave para abrir tus datos locales.
                </p>
              </div>

              {/* Clave formateada */}
              <div className={`p-4 rounded-2xl border font-mono text-center text-sm tracking-wider break-all select-all ${
                isDark ? 'bg-black/60 border-emerald-500/40 text-emerald-300' : 'bg-slate-100 border-emerald-500 text-emerald-800'
              }`}>
                {recoveryKey}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`flex-1 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                    isDark ? 'bg-white/5 hover:bg-white/10 border-white/10 text-white' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                  }`}
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied ? '¡Copiada!' : 'Copiar al portapapeles'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className={`flex-1 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                    isDark ? 'bg-white/5 hover:bg-white/10 border-white/10 text-white' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                  }`}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar respaldo (.txt)</span>
                </button>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>En el siguiente paso deberás comprobar que respaldaste la clave antes de que el cifrado sea activado.</span>
              </div>

              <button
                type="button"
                onClick={handleProceedToVerify}
                className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md"
              >
                <span>Ya respaldé mi clave, continuar</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === 'verify' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Paso 2 de 2: Confirmar Respaldo</span>
                <p className="text-xs text-slate-400">
                  Ingresa o pega tu Clave de Recuperación para verificar que la conservas y validar la integridad del proceso.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1.5 text-slate-300">Pegar Clave de Recuperación:</label>
                <textarea
                  rows={2}
                  value={confirmKeyInput}
                  onChange={(e) => setConfirmKeyInput(e.target.value)}
                  placeholder="WLT-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                  className={`w-full font-mono text-xs p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                    isDark ? 'bg-black/40 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep('key')}
                  className={`px-4 py-3 rounded-2xl border text-xs font-semibold cursor-pointer ${
                    isDark ? 'bg-white/5 hover:bg-white/10 border-white/10' : 'bg-slate-100 hover:bg-slate-200 border-slate-300'
                  }`}
                >
                  Volver a ver
                </button>
                <button
                  type="button"
                  disabled={!confirmKeyInput.trim()}
                  onClick={handleExecuteActivation}
                  className="flex-1 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg shadow-emerald-500/20"
                >
                  <Lock className="w-4 h-4" />
                  <span>Verificar y Activar Cifrado</span>
                </button>
              </div>
            </div>
          )}

          {step === 'activating' && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
              <div className="space-y-1">
                <h3 className="font-bold text-sm">Cifrando Bóveda Local...</h3>
                <p className="text-xs text-slate-400 max-w-xs">
                  Cifrando el almacén local, protegiendo la cola offline y verificando la integridad de los sobres.
                </p>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-bold text-base">¡Bóveda Local Cifrada con Éxito!</h3>
                <p className="text-xs text-slate-400 max-w-sm">
                  Tus datos en localStorage ahora están protegidos con AES-256-GCM. Los datos en texto plano anteriores han sido purgados de forma segura.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer shadow-md"
              >
                Entendido
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
