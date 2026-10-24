import React, { useState } from 'react';
import {
  AlertOctagon,
  KeyRound,
  LogOut,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import {
  unwrapWithRecoveryKey,
  verifyAekWithMetadata,
  loadEncryptionMetadata,
} from './cryptoService';

interface InconsistencyHaltedModalProps {
  userId: string;
  onRecover: (dataKey: CryptoKey) => void;
  onLogout: () => void;
  isDark?: boolean;
}

export const InconsistencyHaltedModal: React.FC<InconsistencyHaltedModalProps> = ({
  userId,
  onRecover,
  onLogout,
  isDark = true,
}) => {
  const [recoveryInput, setRecoveryInput] = useState('');
  const [isAttempting, setIsAttempting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAttemptRestore = async () => {
    if (!recoveryInput.trim()) return;
    setIsAttempting(true);
    setErrorMsg(null);

    try {
      const metadata = loadEncryptionMetadata(userId);
      if (!metadata) {
        throw new Error(
          'El archivo de metadatos de la bóveda local no fue encontrado. Si borraste el almacenamiento del navegador, tus datos están a salvo en la nube de Firestore: puedes cerrar sesión e iniciarla nuevamente.'
        );
      }

      const aek = await unwrapWithRecoveryKey(metadata.envelopeB_recovery, recoveryInput);
      const ok = await verifyAekWithMetadata(aek, metadata);
      if (!ok) {
        throw new Error('La clave ingresada no es válida para la bóveda registrada en este equipo.');
      }

      onRecover(aek);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error intentando validar la clave de recuperación.');
    } finally {
      setIsAttempting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden flex flex-col ${
          isDark ? 'bg-slate-900 border-amber-500/30 text-white' : 'bg-white border-amber-400 text-slate-900'
        }`}
      >
        <div className="p-6 text-center border-b border-inherit space-y-2 bg-amber-500/10">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
            <AlertOctagon className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-amber-300">Protección Activa de Integridad</h2>
            <p className="text-xs text-slate-300">
              Cifrado local activo pero la bóveda local requiere verificación
            </p>
          </div>
        </div>

        <div className="p-6 space-y-4 text-xs">
          <p className="text-slate-300 leading-relaxed">
            La aplicación detectó que esta cuenta tiene activado el <strong>Cifrado Local de Datos</strong>, pero el sobre criptográfico local no pudo cargarse o fue modificado en el navegador.
          </p>

          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <div>
              <strong className="block font-semibold">Escrituras detenidas preventivamente:</strong>
              Para proteger tus finanzas, Wallet no creará una base vacía ni reemplazará datos locales hasta resolver esta comprobación.
            </div>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300">
              {errorMsg}
            </div>
          )}

          <div className="space-y-1.5 pt-2">
            <label className="font-semibold block text-slate-200">
              Restaura ingresando tu Clave de Recuperación:
            </label>
            <textarea
              rows={2}
              value={recoveryInput}
              onChange={(e) => setRecoveryInput(e.target.value)}
              placeholder="WLT-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
              className={`w-full font-mono text-xs p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                isDark ? 'bg-black/40 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              disabled={!recoveryInput.trim() || isAttempting}
              onClick={handleAttemptRestore}
              className="flex-1 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md"
            >
              {isAttempting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Validando...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Validar Clave de Recuperación</span>
                </>
              )}
            </button>
          </div>

          <div className="pt-3 border-t border-inherit flex items-center justify-between text-slate-400">
            <span>Si inicias en otro dispositivo o perdiste el acceso local:</span>
            <button
              type="button"
              onClick={onLogout}
              className="text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1.5 cursor-pointer py-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
