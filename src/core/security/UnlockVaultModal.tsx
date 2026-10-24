import React, { useState } from 'react';
import {
  Shield,
  KeyRound,
  Fingerprint,
  Lock,
  AlertTriangle,
  ArrowRight,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import {
  EncryptionMetadata,
  getPrfSecret,
  unwrapWithPrfSecret,
  unwrapWithRecoveryKey,
  verifyAekWithMetadata,
  isValidRecoveryKeyFormat,
} from './cryptoService';

interface UnlockVaultModalProps {
  metadata: EncryptionMetadata;
  userEmail: string;
  onUnlock: (dataKey: CryptoKey) => void;
  onLogout: () => void;
  isDark?: boolean;
}

export const UnlockVaultModal: React.FC<UnlockVaultModalProps> = ({
  metadata,
  userEmail,
  onUnlock,
  onLogout,
  isDark = true,
}) => {
  const [tab, setTab] = useState<'prf' | 'recovery'>(metadata.hasPrf ? 'prf' : 'recovery');
  const [recoveryInput, setRecoveryInput] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePrfUnlock = async () => {
    if (!metadata.hasPrf || !metadata.prfCredentialId || !metadata.prfSalt || !metadata.envelopeA_prf) {
      setTab('recovery');
      return;
    }

    setIsUnlocking(true);
    setErrorMsg(null);

    try {
      const prfSecret = await getPrfSecret(metadata.prfCredentialId, metadata.prfSalt);
      if (!prfSecret) {
        throw new Error('No se recibió la respuesta del sensor biométrico o fue cancelada.');
      }

      const aek = await unwrapWithPrfSecret(metadata.envelopeA_prf, prfSecret);
      const ok = await verifyAekWithMetadata(aek, metadata);
      if (!ok) {
        throw new Error('La clave derivada no pudo validar la integridad de la bóveda.');
      }

      onUnlock(aek);
    } catch (err: any) {
      console.warn('[UnlockVault] Falló desbloqueo PRF:', err);
      setErrorMsg(
        err?.message || 'Error al autenticar con el sensor biométrico. Puedes usar tu Clave de Recuperación.'
      );
      setTab('recovery');
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleRecoveryUnlock = async () => {
    if (!recoveryInput.trim()) return;
    setIsUnlocking(true);
    setErrorMsg(null);

    try {
      const aek = await unwrapWithRecoveryKey(metadata.envelopeB_recovery, recoveryInput);
      const ok = await verifyAekWithMetadata(aek, metadata);
      if (!ok) {
        throw new Error('La Clave de Recuperación es incorrecta o no coincide con esta bóveda.');
      }

      onUnlock(aek);
    } catch (err: any) {
      console.warn('[UnlockVault] Falló desbloqueo con Clave de Recuperación:', err);
      setErrorMsg(err?.message || 'Clave de Recuperación incorrecta o sobre dañado.');
    } finally {
      setIsUnlocking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden flex flex-col ${
          isDark ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className="p-6 text-center border-b border-inherit space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
            <Lock className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Bóveda Local Bloqueada</h2>
            <p className="text-xs text-slate-400">
              Tus datos financieros están cifrados en reposo para <span className="text-slate-200 font-medium">{userEmail}</span>
            </p>
          </div>
        </div>

        {/* Tabs if PRF is configured */}
        {metadata.hasPrf && (
          <div className="flex border-b border-inherit bg-black/20 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setTab('prf');
                setErrorMsg(null);
              }}
              className={`flex-1 py-3 text-center transition-colors flex items-center justify-center gap-1.5 cursor-pointer border-b-2 ${
                tab === 'prf'
                  ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Fingerprint className="w-4 h-4" />
              <span>Biometría / PRF</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('recovery');
                setErrorMsg(null);
              }}
              className={`flex-1 py-3 text-center transition-colors flex items-center justify-center gap-1.5 cursor-pointer border-b-2 ${
                tab === 'recovery'
                  ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              <span>Clave de Recuperación</span>
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {tab === 'prf' && metadata.hasPrf && (
            <div className="space-y-4 py-2">
              <p className="text-xs text-center text-slate-400">
                Usa tu huella dactilar, Face ID o llave de seguridad física para descifrar la clave de tu bóveda local.
              </p>

              <button
                type="button"
                disabled={isUnlocking}
                onClick={handlePrfUnlock}
                className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg shadow-emerald-500/20"
              >
                {isUnlocking ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Autenticando sensor...</span>
                  </>
                ) : (
                  <>
                    <Fingerprint className="w-4 h-4" />
                    <span>Desbloquear Bóveda con Biometría</span>
                  </>
                )}
              </button>
            </div>
          )}

          {tab === 'recovery' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold block text-slate-300">
                  Ingresa tu Clave de Recuperación (256 bits):
                </label>
                <textarea
                  rows={2}
                  value={recoveryInput}
                  onChange={(e) => setRecoveryInput(e.target.value)}
                  placeholder="WLT-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                  className={`w-full font-mono text-xs p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                    isDark ? 'bg-black/40 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                  autoFocus
                />
              </div>

              <button
                type="button"
                disabled={!recoveryInput.trim() || isUnlocking}
                onClick={handleRecoveryUnlock}
                className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg shadow-emerald-500/20"
              >
                {isUnlocking ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Descifrando claves...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>Desbloquear con Clave</span>
                  </>
                )}
              </button>
            </div>
          )}

          <div className="pt-2 border-t border-inherit flex items-center justify-between text-xs">
            <span className="text-slate-400">¿No puedes desbloquear ahora?</span>
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
