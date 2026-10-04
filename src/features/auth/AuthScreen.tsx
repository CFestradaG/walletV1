import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  User,
  Wallet,
} from 'lucide-react';
import { useWallet } from '../../core/state/WalletContext';

type AuthStep = 'welcome' | 'login' | 'register' | 'recovery';

export const AuthScreen: React.FC = () => {
  const {
    loginWithEmail,
    registerUser,
    loginWithGoogle,
    resetPassword,
    resolvedTheme,
  } = useWallet();

  const isDark = resolvedTheme === 'dark';
  const [step, setStep] = useState<AuthStep>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await loginWithEmail(email, password);
      if (!result.ok) setError(result.error || 'Error al iniciar sesión');
    } catch (err: any) {
      setError(err?.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await registerUser(name, email, password);
      if (!result.ok) setError(result.error || 'Error al registrarse');
    } catch (err: any) {
      setError(err?.message || 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setError(err?.message || 'Error con Google');
    } finally {
      setLoading(false);
    }
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await resetPassword(email);
      if (result.ok) setSuccessMsg(result.message);
      else setError(result.message);
    } catch (err: any) {
      setError(err?.message || 'Error al enviar recuperación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen w-full flex flex-col justify-center items-center px-4 py-8 ${
        isDark ? 'bg-[#0B0F17] text-white' : 'bg-[#F8FAFC] text-slate-900'
      }`}
    >
      <div
        className={`w-full max-w-md rounded-3xl border p-6 sm:p-8 backdrop-blur-md shadow-2xl transition-all ${
          isDark
            ? 'bg-[#131927]/90 border-white/10'
            : 'bg-white/95 border-slate-200'
        }`}
      >
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#10B981] to-[#34D399] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20 text-[#002113]">
            <Wallet className="w-7 h-7" />
          </div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">
            Wallet
          </h1>
          <p
            className={`text-xs mt-1 ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Control total de tus finanzas y períodos
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mb-5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* STEP 1: WELCOME SCREEN */}
        {step === 'welcome' && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep('login');
              }}
              className="w-full py-3 px-4 rounded-xl bg-[#10B981] hover:bg-[#059669] text-[#002113] font-display text-sm font-bold transition-all shadow-md cursor-pointer active:scale-98"
            >
              Iniciar sesión
            </button>

            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep('register');
              }}
              className={`w-full py-3 px-4 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                isDark
                  ? 'border-white/10 hover:bg-white/5 text-white'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-800'
              }`}
            >
              Crear cuenta nueva
            </button>

            <div className="relative my-6 text-center">
              <div
                className={`absolute inset-0 flex items-center ${
                  isDark ? 'text-white/10' : 'text-slate-200'
                }`}
              >
                <div className="w-full border-t border-current" />
              </div>
              <span
                className={`relative px-3 text-xs uppercase tracking-wider font-semibold ${
                  isDark ? 'bg-[#131927] text-slate-400' : 'bg-white text-slate-400'
                }`}
              >
                o continúa con
              </span>
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading}
              className={`w-full py-3 px-4 rounded-xl border flex items-center justify-center gap-3 text-sm font-medium transition-all cursor-pointer ${
                isDark
                  ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800 shadow-sm'
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Acceder con Google</span>
            </button>
          </div>
        )}

        {/* STEP 2: LOGIN */}
        {step === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => setStep('welcome')}
                className="p-1 rounded-lg hover:bg-white/5 text-slate-400 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h2 className="text-lg font-bold">Iniciar sesión</h2>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  className={`w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isDark
                      ? 'bg-black/20 border-white/10 text-white placeholder-slate-500'
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-medium text-slate-400">
                  Contraseña
                </label>
                <button
                  type="button"
                  onClick={() => setStep('recovery')}
                  className="text-xs text-emerald-500 hover:underline cursor-pointer"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isDark
                      ? 'bg-black/20 border-white/10 text-white placeholder-slate-500'
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-[#10B981] hover:bg-[#059669] text-[#002113] font-display text-sm font-bold transition-all shadow-md cursor-pointer active:scale-98 disabled:opacity-50"
            >
              {loading ? 'Accediendo...' : 'Entrar'}
            </button>
          </form>
        )}

        {/* STEP 3: REGISTER */}
        {step === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => setStep('welcome')}
                className="p-1 rounded-lg hover:bg-white/5 text-slate-400 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h2 className="text-lg font-bold">Crear cuenta</h2>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Nombre completo
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Carlos Méndez"
                  className={`w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isDark
                      ? 'bg-black/20 border-white/10 text-white placeholder-slate-500'
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  className={`w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isDark
                      ? 'bg-black/20 border-white/10 text-white placeholder-slate-500'
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className={`w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isDark
                      ? 'bg-black/20 border-white/10 text-white placeholder-slate-500'
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-[#10B981] hover:bg-[#059669] text-[#002113] font-display text-sm font-bold transition-all shadow-md cursor-pointer active:scale-98 disabled:opacity-50"
            >
              {loading ? 'Creando cuenta...' : 'Registrarme'}
            </button>
          </form>
        )}

        {/* STEP 4: RECOVERY */}
        {step === 'recovery' && (
          <form onSubmit={handleRecovery} className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => setStep('login')}
                className="p-1 rounded-lg hover:bg-white/5 text-slate-400 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h2 className="text-lg font-bold">Recuperar contraseña</h2>
            </div>

            <p
              className={`text-xs ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              Ingresa el correo asociado a tu cuenta para restablecer tu contraseña.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  className={`w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isDark
                      ? 'bg-black/20 border-white/10 text-white placeholder-slate-500'
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-[#10B981] hover:bg-[#059669] text-[#002113] font-display text-sm font-bold transition-all shadow-md cursor-pointer active:scale-98 disabled:opacity-50"
            >
              {loading ? 'Enviando...' : 'Enviar correo de recuperación'}
            </button>
          </form>
        )}

        <div className="mt-6 pt-4 border-t border-white/5 text-center">
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Datos seguros y cifrados</span>
          </div>
        </div>
      </div>
    </div>
  );
};
