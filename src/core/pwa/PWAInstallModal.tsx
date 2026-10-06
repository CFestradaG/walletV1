import React from 'react';
import { Download, Share2, PlusSquare, X, CheckCircle2, Shield, WifiOff } from 'lucide-react';
import { useWallet } from '../state/WalletContext';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInstallNative?: () => void;
  isInstallable: boolean;
  isIOS: boolean;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  isOpen,
  onClose,
  onInstallNative,
  isInstallable,
  isIOS,
}) => {
  const { resolvedTheme } = useWallet();
  const isDark = resolvedTheme === 'dark';
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full max-w-sm rounded-3xl border p-6 shadow-2xl relative transition-colors ${
          isDark
            ? 'bg-[#0F172A] border-white/10 text-white'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          className={`absolute top-4 right-4 p-2 rounded-xl transition-colors cursor-pointer ${
            isDark
              ? 'text-slate-400 hover:text-white hover:bg-white/5'
              : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-emerald-500/20">
            <span className="text-xl font-extrabold">Q</span>
          </div>
          <div>
            <h3 className={`font-bold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Instalar Wallet PWA
            </h3>
            <p
              className={`text-xs font-semibold ${
                isDark ? 'text-emerald-400' : 'text-emerald-600'
              }`}
            >
              Finanzas GTQ · Modo Nativo
            </p>
          </div>
        </div>

        <div className="space-y-3 mb-5 text-xs">
          <div
            className={`flex items-start gap-2.5 p-3 rounded-2xl border ${
              isDark
                ? 'bg-black/30 border-white/5 text-slate-300'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            <WifiOff
              className={`w-4 h-4 shrink-0 mt-0.5 ${
                isDark ? 'text-emerald-400' : 'text-emerald-600'
              }`}
            />
            <div>
              <span
                className={`font-semibold block ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                100% Funcional Offline
              </span>
              <span
                className={`text-[11px] ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                Registra transacciones y consulta saldos aún sin internet ni señal telefónica.
              </span>
            </div>
          </div>

          <div
            className={`flex items-start gap-2.5 p-3 rounded-2xl border ${
              isDark
                ? 'bg-black/30 border-white/5 text-slate-300'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            <Shield
              className={`w-4 h-4 shrink-0 mt-0.5 ${
                isDark ? 'text-sky-400' : 'text-sky-600'
              }`}
            />
            <div>
              <span
                className={`font-semibold block ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                Seguridad con PIN y Biometría
              </span>
              <span
                className={`text-[11px] ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                Bloqueo con huella dactilar o Face ID directamente en tu pantalla de inicio.
              </span>
            </div>
          </div>
        </div>

        {isIOS ? (
          <div className="space-y-3">
            <p
              className={`text-xs font-semibold ${
                isDark ? 'text-slate-200' : 'text-slate-700'
              }`}
            >
              Pasos para instalar en iPhone o iPad:
            </p>
            <div
              className={`space-y-2 text-xs p-3 rounded-2xl border ${
                isDark
                  ? 'bg-black/40 border-white/5 text-slate-300'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-5 h-5 rounded-full font-bold flex items-center justify-center text-[10px] ${
                    isDark
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  1
                </span>
                <span>
                  Toca el botón{' '}
                  <Share2
                    className={`w-3.5 h-3.5 inline mx-1 ${
                      isDark ? 'text-sky-400' : 'text-sky-600'
                    }`}
                  />{' '}
                  <strong>Compartir</strong> en Safari.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`w-5 h-5 rounded-full font-bold flex items-center justify-center text-[10px] ${
                    isDark
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  2
                </span>
                <span>
                  Baja y selecciona{' '}
                  <PlusSquare
                    className={`w-3.5 h-3.5 inline mx-1 ${
                      isDark ? 'text-emerald-400' : 'text-emerald-600'
                    }`}
                  />{' '}
                  <strong>Agregar a pantalla de inicio</strong>.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`w-5 h-5 rounded-full font-bold flex items-center justify-center text-[10px] ${
                    isDark
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  3
                </span>
                <span>
                  Toca <strong>Agregar</strong> arriba a la derecha. ¡Listo!
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={`w-full py-2.5 rounded-xl font-semibold text-xs transition-colors cursor-pointer border ${
                isDark
                  ? 'bg-white/10 hover:bg-white/15 text-white border-white/5'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
              }`}
            >
              Entendido
            </button>
          </div>
        ) : isInstallable ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                if (onInstallNative) onInstallNative();
                onClose();
              }}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              Instalar en este dispositivo
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`w-full py-2 text-center text-xs transition-colors cursor-pointer ${
                isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Más tarde
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div
              className={`p-3 rounded-2xl border text-xs flex items-center gap-2 ${
                isDark
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                La aplicación ya está instalada o tu navegador soporta agregarla desde el menú principal.
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={`w-full py-2.5 rounded-xl font-semibold text-xs transition-colors cursor-pointer border ${
                isDark
                  ? 'bg-white/10 hover:bg-white/15 text-white border-white/5'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
              }`}
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
