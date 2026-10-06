import React, { useEffect, useState } from 'react';
import {
  Shield,
  KeyRound,
  Fingerprint,
  Lock,
  CheckCircle2,
  AlertTriangle,
  X,
  Wifi,
  Smartphone,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  getSecurityConfig,
  saveSecurityConfig,
  setupUserPin,
  verifyUserPin,
  registerBiometrics,
  isBiometricsAvailable,
  hasPinConfigured,
  hasBiometricsRegistered,
  removeSecurityLock,
} from './securityService';

interface SecuritySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userDisplayName?: string;
  onLockNow: () => void;
}

export const SecuritySettingsModal: React.FC<SecuritySettingsModalProps> = ({
  isOpen,
  onClose,
  userId,
  userDisplayName,
  onLockNow,
}) => {
  const [config, setConfig] = useState(getSecurityConfig(userId));
  const [hasPin, setHasPin] = useState(hasPinConfigured(userId));
  const [hasBio, setHasBio] = useState(hasBiometricsRegistered(userId));
  const [bioSupported, setBioSupported] = useState(false);

  // PIN Setup flow state
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [pinStep, setPinStep] = useState<'create' | 'confirm'>('create');
  const [pinDraft, setPinDraft] = useState('');
  const [pinConfirmDraft, setPinConfirmDraft] = useState('');
  const [showPinNumbers, setShowPinNumbers] = useState(false);

  // Status and feedback
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(
    null
  );
  const [isRegisteringBio, setIsRegisteringBio] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setConfig(getSecurityConfig(userId));
      setHasPin(hasPinConfigured(userId));
      setHasBio(hasBiometricsRegistered(userId));
      setNotice(null);
      setIsSettingPin(false);
      void isBiometricsAvailable().then(setBioSupported);
    }
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const handleStartPinSetup = () => {
    setPinDraft('');
    setPinConfirmDraft('');
    setPinStep('create');
    setIsSettingPin(true);
    setNotice(null);
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pinDraft.length !== 4) {
      setNotice({ type: 'error', text: 'El PIN debe ser exactamente de 4 dígitos numéricos.' });
      return;
    }

    if (pinStep === 'create') {
      setPinStep('confirm');
      setNotice({ type: 'info', text: 'Vuelve a escribir el PIN de 4 dígitos para confirmarlo.' });
      return;
    }

    if (pinDraft !== pinConfirmDraft) {
      setNotice({ type: 'error', text: 'Los PINs no coinciden. Intenta de nuevo.' });
      setPinStep('create');
      setPinDraft('');
      setPinConfirmDraft('');
      return;
    }

    // Save PIN
    const ok = await setupUserPin(userId, pinDraft);
    if (ok) {
      setHasPin(true);
      setConfig(getSecurityConfig(userId));
      setIsSettingPin(false);
      setNotice({ type: 'success', text: '¡PIN de seguridad configurado exitosamente!' });
    } else {
      setNotice({ type: 'error', text: 'Error al guardar el PIN.' });
    }
  };

  const handleRegisterBiometrics = async () => {
    setIsRegisteringBio(true);
    setNotice(null);
    try {
      const res = await registerBiometrics(userId, userDisplayName);
      if (res.ok) {
        setHasBio(true);
        setConfig(getSecurityConfig(userId));
        setNotice({
          type: 'success',
          text: '¡Huella dactilar / Face ID registrado exitosamente en este dispositivo!',
        });
      } else {
        setNotice({ type: 'error', text: res.error || 'No se pudo registrar la biometría.' });
      }
    } finally {
      setIsRegisteringBio(false);
    }
  };

  const handleToggleLockEnabled = (checked: boolean) => {
    if (checked && !hasPin) {
      setNotice({
        type: 'error',
        text: 'Primero debes crear un PIN de 4 dígitos para activar el bloqueo.',
      });
      handleStartPinSetup();
      return;
    }

    if (!checked) {
      // Disable lock
      const updated = saveSecurityConfig(userId, { enabled: false });
      setConfig(updated);
      setNotice({ type: 'info', text: 'Bloqueo de aplicación desactivado.' });
    } else {
      const updated = saveSecurityConfig(userId, { enabled: true });
      setConfig(updated);
      setNotice({ type: 'success', text: 'Bloqueo de aplicación activado.' });
    }
  };

  const handleToggleBioEnabled = (checked: boolean) => {
    if (checked && !hasBio) {
      void handleRegisterBiometrics();
      return;
    }
    const updated = saveSecurityConfig(userId, { biometricsEnabled: checked });
    setConfig(updated);
  };

  const handleTimeoutChange = (minutes: number) => {
    const updated = saveSecurityConfig(userId, { lockTimeoutMinutes: minutes });
    setConfig(updated);
  };

  const handleToggleAppSwitch = (checked: boolean) => {
    const updated = saveSecurityConfig(userId, { lockOnAppSwitch: checked });
    setConfig(updated);
  };

  const handleDisableAll = () => {
    if (confirm('¿Deseas eliminar el PIN y la biometría registrada en este dispositivo?')) {
      removeSecurityLock(userId);
      setConfig(getSecurityConfig(userId));
      setHasPin(false);
      setHasBio(false);
      setNotice({ type: 'info', text: 'PIN y biometría eliminados del dispositivo.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-3xl bg-[#0F172A] border border-white/10 p-6 shadow-2xl relative text-white max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <Shield className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Seguridad & Bloqueo PWA</h3>
              <p className="text-[11px] text-slate-400">Protección con PIN y Biometría Local</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto py-4 space-y-4 pr-1">
          {/* Feedback notice */}
          {notice && (
            <div
              className={`p-3 rounded-2xl text-xs flex items-center gap-2 ${
                notice.type === 'success'
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                  : notice.type === 'error'
                  ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                  : 'bg-sky-500/15 border border-sky-500/30 text-sky-300'
              }`}
            >
              {notice.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : notice.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              ) : (
                <Shield className="w-4 h-4 shrink-0" />
              )}
              <span>{notice.text}</span>
            </div>
          )}

          {/* Master Lock Toggle */}
          <div className="p-3.5 rounded-2xl bg-black/30 border border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-xs text-white block">
                  Bloqueo de aplicación
                </span>
                <span className="text-[11px] text-slate-400">
                  Exigir PIN o huella para entrar a Wallet
                </span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => handleToggleLockEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          {/* PIN Configuration Box */}
          <div className="p-4 rounded-2xl bg-black/30 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-xs text-white">PIN Maestro (4 dígitos)</span>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  hasPin
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {hasPin ? 'Configurado' : 'Sin configurar'}
              </span>
            </div>

            {isSettingPin ? (
              <form onSubmit={handleSavePin} className="space-y-3 pt-2">
                <p className="text-xs text-slate-300">
                  {pinStep === 'create'
                    ? 'Ingresa tu nuevo PIN de 4 dígitos:'
                    : 'Confirma nuevamente tu PIN de 4 dígitos:'}
                </p>

                <div className="relative">
                  <input
                    type={showPinNumbers ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={pinStep === 'create' ? pinDraft : pinConfirmDraft}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                      if (pinStep === 'create') setPinDraft(val);
                      else setPinConfirmDraft(val);
                    }}
                    placeholder="••••"
                    className="w-full text-center tracking-[1em] font-mono text-xl py-2 px-3 rounded-xl bg-black/40 border border-emerald-500/50 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPinNumbers(!showPinNumbers)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                  >
                    {showPinNumbers ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={
                      pinStep === 'create'
                        ? pinDraft.length !== 4
                        : pinConfirmDraft.length !== 4
                    }
                    className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
                  >
                    {pinStep === 'create' ? 'Continuar' : 'Confirmar y Guardar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSettingPin(false)}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-slate-300 font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-between pt-1">
                <p className="text-[11px] text-slate-400">
                  El PIN cifra y protege el acceso aún si el teléfono no tiene biometría o falla.
                </p>
                <button
                  type="button"
                  onClick={handleStartPinSetup}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white whitespace-nowrap cursor-pointer transition-colors"
                >
                  {hasPin ? 'Cambiar PIN' : 'Crear PIN'}
                </button>
              </div>
            )}
          </div>

          {/* Biometrics Box */}
          <div className="p-4 rounded-2xl bg-black/30 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Fingerprint className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-xs text-white">Huella Dactilar / Face ID</span>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  hasBio
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-slate-700 text-slate-300'
                }`}
              >
                {hasBio ? 'Registrado' : bioSupported ? 'Disponible' : 'No soportado'}
              </span>
            </div>

            <p className="text-[11px] text-slate-400">
              Desbloqueo rápido mediante el sensor biométrico nativo de tu teléfono (Touch ID,
              Face ID o lector de huellas de Android).
            </p>

            {bioSupported ? (
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.biometricsEnabled && hasBio}
                    onChange={(e) => handleToggleBioEnabled(e.target.checked)}
                    disabled={!hasBio}
                    className="rounded text-emerald-500 focus:ring-emerald-500 disabled:opacity-40"
                  />
                  <span className="text-xs text-slate-300 font-medium">Usar biometría para entrar</span>
                </label>

                <button
                  type="button"
                  onClick={handleRegisterBiometrics}
                  disabled={isRegisteringBio}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-semibold text-emerald-400 cursor-pointer transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Fingerprint className={`w-3.5 h-3.5 ${isRegisteringBio ? 'animate-pulse' : ''}`} />
                  {isRegisteringBio ? 'Registrando…' : hasBio ? 'Volver a registrar' : 'Registrar sensor'}
                </button>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 text-[11px] text-slate-400">
                Tu navegador o dispositivo actual no tiene sensor biométrico WebAuthn disponible. Puedes usar el PIN numérico de 4 dígitos con total seguridad.
              </div>
            )}
          </div>

          {/* Timing & Auto-Lock Options */}
          {config.enabled && (
            <div className="p-4 rounded-2xl bg-black/30 border border-white/10 space-y-3">
              <span className="font-bold text-xs text-white block">Tiempo de autobloqueo</span>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { val: 0, label: 'Inmediato' },
                  { val: 1, label: '1 min' },
                  { val: 5, label: '5 min' },
                  { val: 15, label: '15 min' },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => handleTimeoutChange(opt.val)}
                    className={`py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      config.lockTimeoutMinutes === opt.val
                        ? 'bg-emerald-500 text-slate-950 shadow-sm'
                        : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <label className="flex items-center justify-between pt-1 cursor-pointer">
                <span className="text-xs text-slate-300">
                  Bloquear al cambiar de aplicación o pestaña
                </span>
                <input
                  type="checkbox"
                  checked={config.lockOnAppSwitch}
                  onChange={(e) => handleToggleAppSwitch(e.target.checked)}
                  className="rounded text-emerald-500 focus:ring-emerald-500"
                />
              </label>
            </div>
          )}

          {/* Offline & Security Guarantee */}
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 space-y-1.5">
            <div className="flex items-center gap-2 font-bold">
              <Wifi className="w-4 h-4 text-emerald-400" />
              <span>Seguridad 100% Offline Garantizada</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              La verificación de PIN y biometría se ejecuta en el enclave seguro de tu propio dispositivo utilizando la API nativa Web Crypto y WebAuthn. No viaja por internet ni depende de servidores externos.
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="pt-4 border-t border-white/10 shrink-0 flex items-center justify-between gap-3">
          {config.enabled && hasPin ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onLockNow();
              }}
              className="px-3.5 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              Bloquear ahora
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            {(hasPin || hasBio) && (
              <button
                type="button"
                onClick={handleDisableAll}
                className="px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition-colors cursor-pointer"
              >
                Eliminar seguridad
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
