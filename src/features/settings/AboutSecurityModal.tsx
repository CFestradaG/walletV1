import React from 'react';
import {
  CheckCircle2,
  Cpu,
  Database,
  EyeOff,
  Fingerprint,
  Lock,
  RotateCcw,
  Shield,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { useWallet } from '../../core/state/WalletContext';

interface AboutSecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutSecurityModal: React.FC<AboutSecurityModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { resolvedTheme } = useWallet();
  const isDark = resolvedTheme === 'dark';

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-security-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in"
    >
      <div
        className={`w-full max-w-lg rounded-3xl border shadow-2xl flex flex-col max-h-[90vh] overflow-hidden ${
          isDark
            ? 'bg-[#0F1420] border-white/10 text-white'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* MODAL HEADER */}
        <div className={`p-5 border-b flex items-center justify-between ${
          isDark ? 'border-white/10 bg-white/5' : 'border-slate-100 bg-slate-50/80'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 id="about-security-title" className="font-display font-bold text-base leading-tight">
                Seguridad & Confidencialidad
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Cómo protegemos tus finanzas y cómo funcionan los análisis
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className={`p-2 rounded-xl transition-colors cursor-pointer ${
              isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-200 text-slate-600'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL CONTENT */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs leading-relaxed">
          {/* BANNER PRINCIPAL */}
          <div className={`p-4 rounded-2xl border ${
            isDark
              ? 'bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
          }`}>
            <span className="font-bold text-xs block mb-1">
              Compromiso de Privacidad Absoluta
            </span>
            <p className="text-[11px] leading-relaxed">
              Tus finanzas son exclusivamente tuyas. Tu información no se vende, no se comparte con entidades financieras, no se utiliza con fines publicitarios y no está expuesta a miradas externas.
            </p>
          </div>

          {/* PILAR 1: BASE DE DATOS Y AISLAMIENTO */}
          <div className={`p-4 rounded-2xl border ${
            isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-7 h-7 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center">
                <Database className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-xs">Base de Datos Segura con Aislamiento Exclusivo</h4>
            </div>
            <p className={`text-[11px] pl-9.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Tus cuentas, tarjetas y transacciones residen en una base de datos en la nube con reglas de aislamiento estricto. Cada registro está vinculado únicamente a tu identificador autenticado, garantizando que nadie más pueda leer o escribir en tu espacio.
            </p>
          </div>

          {/* PILAR 2: CIFRADO BANCARIO */}
          <div className={`p-4 rounded-2xl border ${
            isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-7 h-7 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                <Lock className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-xs">Cifrado en Tránsito y en Reposo</h4>
            </div>
            <p className={`text-[11px] pl-9.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Toda comunicación entre tu navegador o teléfono y el servidor se transmite cifrada mediante protocolos de seguridad estándar de la industria (TLS/HTTPS). En el servidor, los datos se almacenan con cifrado en reposo para resguardar la integridad de tu patrimonio.
            </p>
          </div>

          {/* PILAR 3: ANÁLISIS INFERENCIAL CON IA Y PRIVACIDAD */}
          <div className={`p-4 rounded-2xl border ${
            isDark ? 'bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-transparent border-indigo-500/20' : 'bg-indigo-50/60 border-indigo-200'
          }`}>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-7 h-7 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-purple-300 dark:text-purple-300">
                  Inteligencia Artificial Generativa & Privacidad de Datos
                </h4>
                <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Análisis inferencial semanal dinámico y 100% anonimizado
                </span>
              </div>
            </div>

            <div className={`text-[11px] pl-9.5 space-y-2.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              <p>
                Para que las recomendaciones no sean mecánicas, rígidas o repetitivas, la aplicación utiliza <strong>Inteligencia Artificial Generativa (Gemini)</strong> para inferir patrones de comportamiento semana a semana. Esto permite ofrecer observaciones frescas y adaptadas a tu realidad sin comprometer jamás tu privacidad.
              </p>

              {/* COMPARATIVA DE PRIVACIDAD */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {/* LO QUE NUNCA SE COMPARTE */}
                <div className={`p-2.5 rounded-xl border ${
                  isDark ? 'bg-rose-500/10 border-rose-500/20 text-rose-200' : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}>
                  <span className="font-bold text-[10px] uppercase tracking-wider block mb-1 text-rose-400">
                    🛡️ Lo que NUNCA viaja
                  </span>
                  <ul className="space-y-0.5 text-[10px] leading-tight">
                    <li>• Cero nombres, correos o IDs de usuario.</li>
                    <li>• Cero números de cuenta o tarjetas.</li>
                    <li>• Cero nombres de bancos o comercios.</li>
                    <li>• Cero notas o descripciones privadas.</li>
                  </ul>
                </div>

                {/* LO QUE SÍ SE ANALIZA */}
                <div className={`p-2.5 rounded-xl border ${
                  isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}>
                  <span className="font-bold text-[10px] uppercase tracking-wider block mb-1 text-emerald-400">
                    📊 Solo métricas agregadas
                  </span>
                  <ul className="space-y-0.5 text-[10px] leading-tight">
                    <li>• Totales numéricos de ingresos y egresos de la semana.</li>
                    <li>• Ritmo porcentual vs presupuesto esperado.</li>
                    <li>• Días restantes a fechas de corte/pago.</li>
                    <li>• Tasa de ahorro y cobertura líquida.</li>
                  </ul>
                </div>
              </div>

              <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-black/20 border-white/5' : 'bg-white border-slate-200'}`}>
                <span className="font-bold text-[10px] block mb-0.5 text-indigo-400">
                  🗓️ Cadencia Semanal y Bitácora de 52 Semanas
                </span>
                <p className="text-[10px] leading-relaxed">
                  Las inferencias se estructuran por semanas del año (1 a 52) y del mes (1 a 4). Al generarse, la observación se guarda en tu bitácora segura en la base de datos para esa semana específica, evitando cambios volátiles diarios y llamadas repetitivas.
                </p>
              </div>
            </div>
          </div>

          {/* PILAR 4: DE DÓNDE SALEN LOS ANÁLISIS MATEMÁTICOS */}
          <div className={`p-4 rounded-2xl border ${
            isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-7 h-7 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
                <Cpu className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-xs">Modelos Matemáticos y Reglas Determinísticas</h4>
            </div>
            <div className={`text-[11px] pl-9.5 space-y-1.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              <p>
                Los puntajes (0 a 100) y los cálculos de liquidez se sustentan en modelos matemáticos de finanzas personales calculados en tu propio dispositivo:
              </p>
              <ul className="list-disc pl-4 space-y-1">
                <li><strong>Regla del 30%:</strong> Evalúa la utilización de líneas de crédito frente a tu límite disponible.</li>
                <li><strong>Fondo de reserva:</strong> Mide cuántos meses de tus gastos reales promedio puedes cubrir con liquidez inmediata.</li>
                <li><strong>Ventanas de corte:</strong> Calcula matemáticamente los días restantes hasta el corte y pago de tus tarjetas para maximizar los días de financiamiento al 0% de interés.</li>
              </ul>
            </div>
          </div>

          {/* PILAR 5: PROTECCIÓN LOCAL Y SOBERANÍA */}
          <div className={`p-4 rounded-2xl border ${
            isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-7 h-7 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center">
                <Fingerprint className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-xs">Protección Local y Control del Usuario</h4>
            </div>
            <ul className={`text-[11px] pl-9.5 space-y-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span><strong>Bloqueo por PIN y Biometría:</strong> Protege la app ante miradas no autorizadas en tu teléfono o computadora.</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span><strong>Modo de privacidad:</strong> Oculta los montos con un toque cuando estás en público o compartiendo pantalla.</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span><strong>Consentimiento de diagnósticos:</strong> Puedes activar o pausar la generación de análisis en Preferencias en cualquier momento.</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span><strong>Derecho al olvido:</strong> Puedes restablecer y eliminar la totalidad de tus datos financieros cuando lo decidas.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className={`p-4 border-t flex items-center justify-between ${
          isDark ? 'border-white/10 bg-black/20' : 'border-slate-100 bg-slate-50'
        }`}>
          <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Tus datos financieros son privados e intransferibles.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-colors cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
