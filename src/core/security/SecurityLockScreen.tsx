import React, { useEffect, useState } from 'react';
import { Fingerprint, Lock, Delete, AlertCircle, LogOut } from 'lucide-react';
import {
  verifyUserPin,
  verifyBiometrics,
  getSecurityConfig,
  hasBiometricsRegistered,
} from './securityService';

interface SecurityLockScreenProps {
  userId: string;
  onUnlocked: () => void;
  onLogout?: () => void;
}

export const SecurityLockScreen: React.FC<SecurityLockScreenProps> = ({
  userId,
  onUnlocked,
  onLogout,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isCheckingBio, setIsCheckingBio] = useState(false);
  const [shake, setShake] = useState(false);

  const config = getSecurityConfig(userId);
  const canUseBiometrics = config.biometricsEnabled && hasBiometricsRegistered(userId);

  // Attempt biometric authentication
  const handleBiometricAuth = async () => {
    if (!canUseBiometrics || isCheckingBio) return;
    setIsCheckingBio(true);
    setErrorMsg(null);
    try {
      const res = await verifyBiometrics(userId);
      if (res.ok) {
        if ('vibrate' in navigator) navigator.vibrate?.([40]);
        onUnlocked();
      } else {
        if (res.error && !res.error.includes('cancel')) {
          setErrorMsg(res.error);
        }
      }
    } catch {
      setErrorMsg('No se pudo verificar la huella.');
    } finally {
      setIsCheckingBio(false);
    }
  };

  // Attempt biometric check automatically on initial load
  useEffect(() => {
    if (canUseBiometrics) {
      const timer = setTimeout(() => {
        void handleBiometricAuth();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [userId, canUseBiometrics]);

  // Handle number press
  const handleDigit = (digit: string) => {
    if (pinInput.length >= 4) return;
    setErrorMsg(null);
    const nextPin = pinInput + digit;
    setPinInput(nextPin);

    if (nextPin.length === 4) {
      void validatePin(nextPin);
    }
  };

  const handleDelete = () => {
    setErrorMsg(null);
    setPinInput((prev) => prev.slice(0, -1));
  };

  const validatePin = async (candidate: string) => {
    const valid = await verifyUserPin(userId, candidate);
    if (valid) {
      if ('vibrate' in navigator) navigator.vibrate?.([40]);
      onUnlocked();
    } else {
      if ('vibrate' in navigator) navigator.vibrate?.([80, 50, 80]);
      setErrorMsg('PIN incorrecto');
      setShake(true);
      setTimeout(() => {
        setShake(false);
        setPinInput('');
      }, 500);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#070B12] text-white flex flex-col justify-between items-center px-6 py-10 select-none overflow-y-auto">
      {/* Top branding & status */}
      <div className="w-full max-w-xs flex flex-col items-center pt-4">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-500/20 to-teal-400/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 shadow-lg shadow-emerald-500/10">
          <Lock className="w-8 h-8 stroke-[2.2]" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-white">Wallet Bloqueado</h2>
        <p className="text-xs text-slate-400 mt-1 text-center">
          Ingresa tu PIN de seguridad o utiliza tu huella dactilar
        </p>

        {/* PIN Indicators (4 Dots) */}
        <div
          className={`flex items-center justify-center gap-4 mt-8 mb-3 transition-transform ${
            shake ? 'translate-x-[-8px] animate-pulse' : ''
          }`}
        >
          {[0, 1, 2, 3].map((idx) => {
            const isFilled = pinInput.length > idx;
            return (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  isFilled
                    ? 'bg-emerald-400 scale-125 shadow-md shadow-emerald-400/50'
                    : 'bg-white/15 border border-white/20'
                }`}
              />
            );
          })}
        </div>

        {/* Error message */}
        <div className="h-6 flex items-center justify-center">
          {errorMsg && (
            <div className="flex items-center gap-1.5 text-xs text-rose-400 animate-in fade-in">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>
      </div>

      {/* Keypad */}
      <div className="w-full max-w-xs grid grid-cols-3 gap-3 my-4">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => handleDigit(num)}
            className="h-16 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-emerald-500/20 active:scale-95 border border-white/5 flex items-center justify-center text-xl font-bold text-white transition-all cursor-pointer shadow-xs"
          >
            {num}
          </button>
        ))}

        {/* Biometrics button (if available) or blank */}
        {canUseBiometrics ? (
          <button
            type="button"
            onClick={handleBiometricAuth}
            disabled={isCheckingBio}
            title="Desbloquear con Huella o Face ID"
            className="h-16 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 active:scale-95 border border-emerald-500/30 flex items-center justify-center text-emerald-400 transition-all cursor-pointer disabled:opacity-50"
          >
            <Fingerprint className={`w-7 h-7 ${isCheckingBio ? 'animate-pulse' : ''}`} />
          </button>
        ) : (
          <div className="h-16" />
        )}

        {/* Zero */}
        <button
          type="button"
          onClick={() => handleDigit('0')}
          className="h-16 rounded-2xl bg-white/5 hover:bg-white/10 active:bg-emerald-500/20 active:scale-95 border border-white/5 flex items-center justify-center text-xl font-bold text-white transition-all cursor-pointer shadow-xs"
        >
          0
        </button>

        {/* Backspace */}
        <button
          type="button"
          onClick={handleDelete}
          title="Borrar dígito"
          className="h-16 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/5 flex items-center justify-center text-slate-300 transition-all cursor-pointer shadow-xs"
        >
          <Delete className="w-6 h-6" />
        </button>
      </div>

      {/* Bottom options */}
      <div className="w-full max-w-xs flex flex-col items-center gap-2">
        {canUseBiometrics && (
          <button
            type="button"
            onClick={handleBiometricAuth}
            disabled={isCheckingBio}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1.5 py-1 transition-colors cursor-pointer"
          >
            <Fingerprint className="w-4 h-4" />
            <span>{isCheckingBio ? 'Escaneando biometría…' : 'Usar Huella Dactilar / Face ID'}</span>
          </button>
        )}

        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="text-xs text-slate-500 hover:text-rose-400 flex items-center gap-1.5 py-2 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar sesión en este dispositivo</span>
          </button>
        )}
      </div>
    </div>
  );
};
