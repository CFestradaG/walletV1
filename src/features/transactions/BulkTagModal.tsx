import React, { useState } from 'react';
import { Check, Tag as TagIcon, X } from 'lucide-react';
import { useWallet } from '../../core/state/WalletContext';

interface BulkTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTransactionIds: string[];
  onSuccess: (count: number) => void;
}

export const BulkTagModal: React.FC<BulkTagModalProps> = ({
  isOpen,
  onClose,
  selectedTransactionIds,
  onSuccess,
}) => {
  const { tags, bulkAssignTags, resolvedTheme } = useWallet();
  const isDark = resolvedTheme === 'dark';

  const [selectedTagIdsToAdd, setSelectedTagIdsToAdd] = useState<string[]>([]);
  const [selectedTagIdsToRemove, setSelectedTagIdsToRemove] = useState<string[]>([]);
  const [actionTab, setActionTab] = useState<'add' | 'remove'>('add');
  const [isApplying, setIsApplying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const count = selectedTransactionIds.length;

  const toggleTagToAdd = (tagId: string) => {
    setSelectedTagIdsToAdd((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const toggleTagToRemove = (tagId: string) => {
    setSelectedTagIdsToRemove((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleApply = async () => {
    if (selectedTagIdsToAdd.length === 0 && selectedTagIdsToRemove.length === 0) {
      setErrorMessage('Selecciona al menos una etiqueta para agregar o remover.');
      return;
    }

    setIsApplying(true);
    setErrorMessage(null);
    try {
      const res = await bulkAssignTags(
        selectedTransactionIds,
        selectedTagIdsToAdd,
        selectedTagIdsToRemove
      );
      if (res.ok) {
        onSuccess(count);
        onClose();
      } else {
        setErrorMessage(res.error || 'Ocurrió un error al actualizar los registros.');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error inesperado.');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs">
      <div
        className={`w-full max-w-md rounded-3xl border shadow-2xl flex flex-col max-h-[90vh] overflow-hidden ${
          isDark ? 'bg-[#111726] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-inherit">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/15 text-sky-500 flex items-center justify-center">
              <TagIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Asignación Masiva</h2>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {count} registro{count === 1 ? '' : 's'} seleccionado{count === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors cursor-pointer ${
              isDark ? 'hover:bg-white/5 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TABS: AGREGAR VS REMOVER */}
        <div className="p-3 border-b border-inherit">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-black/10 dark:bg-white/5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActionTab('add')}
              className={`py-2 rounded-xl transition-all cursor-pointer ${
                actionTab === 'add'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Agregar Etiquetas ({selectedTagIdsToAdd.length})
            </button>
            <button
              type="button"
              onClick={() => setActionTab('remove')}
              className={`py-2 rounded-xl transition-all cursor-pointer ${
                actionTab === 'remove'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Quitar Etiquetas ({selectedTagIdsToRemove.length})
            </button>
          </div>
        </div>

        {/* ERROR NOTICE */}
        {errorMessage && (
          <div className="mx-4 mt-3 p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-500 text-xs">
            {errorMessage}
          </div>
        )}

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {tags.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              No tienes etiquetas creadas. Ve a Configuración &gt; Etiquetas para crearlas.
            </div>
          ) : actionTab === 'add' ? (
            <div>
              <p className={`text-xs mb-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Selecciona las etiquetas que deseas <strong>vincular</strong> a los {count} registros seleccionados:
              </p>
              <div className="space-y-1.5">
                {tags.map((tag) => {
                  const isChecked = selectedTagIdsToAdd.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTagToAdd(tag.id)}
                      className={`w-full p-2.5 rounded-2xl border flex items-center justify-between text-left transition-all cursor-pointer ${
                        isChecked
                          ? isDark
                            ? 'bg-sky-500/15 border-sky-500/40 text-white'
                            : 'bg-sky-50 border-sky-300 text-sky-950 font-semibold'
                          : isDark
                          ? 'bg-white/2 border-white/5 hover:bg-white/4'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="text-xs font-semibold">{tag.name}</span>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors ${
                          isChecked
                            ? 'bg-sky-600 border-sky-600 text-white'
                            : isDark
                            ? 'border-white/20'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5 stroke-3" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div>
              <p className={`text-xs mb-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Selecciona las etiquetas que deseas <strong>desvincular</strong> de los {count} registros seleccionados:
              </p>
              <div className="space-y-1.5">
                {tags.map((tag) => {
                  const isChecked = selectedTagIdsToRemove.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTagToRemove(tag.id)}
                      className={`w-full p-2.5 rounded-2xl border flex items-center justify-between text-left transition-all cursor-pointer ${
                        isChecked
                          ? isDark
                            ? 'bg-rose-500/15 border-rose-500/40 text-white'
                            : 'bg-rose-50 border-rose-300 text-rose-950 font-semibold'
                          : isDark
                          ? 'bg-white/2 border-white/5 hover:bg-white/4'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="text-xs font-semibold">{tag.name}</span>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors ${
                          isChecked
                            ? 'bg-rose-600 border-rose-600 text-white'
                            : isDark
                            ? 'border-white/20'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5 stroke-3" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-inherit flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={
              isApplying ||
              (selectedTagIdsToAdd.length === 0 && selectedTagIdsToRemove.length === 0)
            }
            onClick={handleApply}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-50 transition-all shadow-xs cursor-pointer"
          >
            {isApplying ? 'Aplicando...' : `Aplicar a ${count} registro${count === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );
};
