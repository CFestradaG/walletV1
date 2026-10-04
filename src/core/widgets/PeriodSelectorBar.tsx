import React from 'react';
import { Calendar, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { useWallet } from '../state/WalletContext';
import { formatPeriodRangeES } from '../utils/formatters';

interface PeriodSelectorBarProps {
  onOpenPeriodsModal: () => void;
  className?: string;
  compact?: boolean;
}

export const PeriodSelectorBar: React.FC<PeriodSelectorBarProps> = ({
  onOpenPeriodsModal,
  className = '',
  compact = false,
}) => {
  const {
    activePeriod,
    periods,
    selectActivePeriod,
    resolvedTheme,
  } = useWallet();

  const isDark = resolvedTheme === 'dark';

  if (!activePeriod) {
    return (
      <div
        className={`w-full rounded-2xl p-3 border flex items-center justify-between transition-colors ${
          isDark
            ? 'bg-[#131927] border-white/10 text-white'
            : 'bg-white border-slate-200 text-slate-900 shadow-sm'
        } ${className}`}
      >
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-500" />
          <span className="text-xs font-medium text-slate-400">
            Sin período configurado
          </span>
        </div>
        <button
          type="button"
          onClick={onOpenPeriodsModal}
          className="text-xs font-semibold text-emerald-500 hover:underline cursor-pointer"
        >
          Configurar
        </button>
      </div>
    );
  }

  // Sorted periods chronological
  const sortedPeriods = [...periods].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );
  const currentIndex = sortedPeriods.findIndex((p) => p.id === activePeriod.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex !== -1 && currentIndex < sortedPeriods.length - 1;

  const handlePrev = () => {
    if (hasPrev) {
      selectActivePeriod(sortedPeriods[currentIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (hasNext) {
      selectActivePeriod(sortedPeriods[currentIndex + 1].id);
    }
  };

  return (
    <div
      className={`w-full rounded-2xl border transition-all ${
        compact ? 'p-2.5' : 'p-3.5'
      } ${
        isDark
          ? 'bg-[#131927] border-white/10 text-white'
          : 'bg-white border-slate-200/90 text-slate-900 shadow-sm'
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrev}
            disabled={!hasPrev}
            aria-label="Período anterior"
            className={`p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
              isDark ? 'hover:bg-white/5 active:bg-white/10' : 'hover:bg-slate-100 active:bg-slate-200'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={!hasNext}
            aria-label="Período siguiente"
            className={`p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
              isDark ? 'hover:bg-white/5 active:bg-white/10' : 'hover:bg-slate-100 active:bg-slate-200'
            }`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenPeriodsModal}
          className="flex-1 text-center group cursor-pointer"
        >
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-xs font-semibold tracking-wide uppercase text-emerald-500">
              {activePeriod.name}
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                activePeriod.status === 'in_progress'
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : activePeriod.status === 'closed'
                  ? 'bg-slate-500/15 text-slate-400'
                  : 'bg-sky-500/15 text-sky-400'
              }`}
            >
              {activePeriod.status === 'in_progress'
                ? 'En curso'
                : activePeriod.status === 'closed'
                ? 'Cerrado'
                : 'Futuro'}
            </span>
          </div>
          <p
            className={`text-xs mt-0.5 font-medium ${
              isDark ? 'text-slate-300' : 'text-slate-600'
            }`}
          >
            {formatPeriodRangeES(activePeriod.startDate, activePeriod.endDate)}
          </p>
        </button>

        <button
          type="button"
          onClick={onOpenPeriodsModal}
          title="Administrar períodos"
          aria-label="Administrar períodos"
          className={`p-2 rounded-xl border transition-colors cursor-pointer ${
            isDark
              ? 'border-white/10 hover:bg-white/5 text-slate-300'
              : 'border-slate-200 hover:bg-slate-100 text-slate-600'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
