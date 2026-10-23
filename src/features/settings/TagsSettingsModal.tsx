import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  Edit2,
  Plus,
  Search,
  Tag as TagIcon,
  Trash2,
  X,
} from 'lucide-react';
import { useWallet } from '../../core/state/WalletContext';
import { Tag } from '../../core/types/models';

interface TagsSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_COLORS = [
  '#0284C7', // Sky
  '#10B981', // Emerald
  '#8B5CF6', // Purple
  '#F43F5E', // Rose
  '#F59E0B', // Amber
  '#06B6D4', // Cyan
  '#EC4899', // Pink
  '#6366F1', // Indigo
  '#14B8A6', // Teal
  '#F97316', // Orange
  '#84CC16', // Lime
  '#64748B', // Slate
];

export const TagsSettingsModal: React.FC<TagsSettingsModalProps> = ({ isOpen, onClose }) => {
  const { tags, createTag, updateTag, deleteTag, transactions, resolvedTheme } = useWallet();
  const isDark = resolvedTheme === 'dark';

  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);

  // Form inputs
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState(PRESET_COLORS[0]);
  const [formError, setFormError] = useState<string | null>(null);

  // Blocking delete alert state
  const [deleteBlockedNotice, setDeleteBlockedNotice] = useState<{
    tagName: string;
    count: number;
  } | null>(null);

  // Count of transactions per tag
  const usageCountByTagId = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of transactions) {
      if (Array.isArray(tx.tagIds)) {
        for (const tid of tx.tagIds) {
          map.set(tid, (map.get(tid) || 0) + 1);
        }
      }
    }
    return map;
  }, [transactions]);

  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return tags;
    const q = searchQuery.toLowerCase();
    return tags.filter((t) => t.name.toLowerCase().includes(q));
  }, [tags, searchQuery]);

  if (!isOpen) return null;

  const handleOpenCreate = () => {
    setEditingTag(null);
    setTagName('');
    setTagColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
    setFormError(null);
    setDeleteBlockedNotice(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (tag: Tag) => {
    setEditingTag(tag);
    setTagName(tag.name);
    setTagColor(tag.color);
    setFormError(null);
    setDeleteBlockedNotice(null);
    setIsFormOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const trimmed = tagName.trim();
    if (!trimmed) {
      setFormError('El nombre de la etiqueta no puede estar vacío.');
      return;
    }

    if (editingTag) {
      const res = updateTag(editingTag.id, {
        name: trimmed,
        color: tagColor,
      });
      if (!res.ok) {
        setFormError(res.error || 'Error al actualizar la etiqueta.');
        return;
      }
    } else {
      const res = createTag({
        name: trimmed,
        color: tagColor,
      });
      if (!res.ok) {
        setFormError(res.error || 'Error al crear la etiqueta.');
        return;
      }
    }

    setIsFormOpen(false);
    setEditingTag(null);
    setTagName('');
  };

  const handleDeleteTag = (tag: Tag) => {
    setDeleteBlockedNotice(null);
    setFormError(null);
    const count = usageCountByTagId.get(tag.id) || 0;
    if (count > 0) {
      setDeleteBlockedNotice({
        tagName: tag.name,
        count,
      });
      return;
    }

    const res = deleteTag(tag.id);
    if (!res.ok) {
      setDeleteBlockedNotice({
        tagName: tag.name,
        count: res.count || 1,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs">
      <div
        className={`w-full max-w-lg rounded-3xl border shadow-2xl flex flex-col max-h-[90vh] overflow-hidden ${
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
              <h2 className="text-base font-bold">Administrador de Etiquetas</h2>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {tags.length} etiqueta{tags.length === 1 ? '' : 's'} configurada{tags.length === 1 ? '' : 's'}
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

        {/* NOTICES */}
        {deleteBlockedNotice && (
          <div className="mx-4 mt-4 p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-start gap-3 text-amber-600 dark:text-amber-400">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-xs flex-1">
              <p className="font-bold mb-0.5">Acción bloqueada</p>
              <p>
                No se puede eliminar la etiqueta <strong>«{deleteBlockedNotice.tagName}»</strong> porque está asociada a{' '}
                <strong>{deleteBlockedNotice.count}</strong> registro{deleteBlockedNotice.count === 1 ? '' : 's'}. Desvincula la etiqueta de los registros antes de eliminarla.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDeleteBlockedNotice(null)}
              className="text-amber-600 dark:text-amber-400 hover:opacity-75 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ACTIONS & SEARCH BAR */}
        <div className="p-4 border-b border-inherit flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar etiquetas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border transition-colors ${
                isDark
                  ? 'bg-white/5 border-white/10 text-white placeholder-slate-500 focus:border-sky-500'
                  : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-sky-500'
              } outline-hidden`}
            />
          </div>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-sky-600 text-white hover:bg-sky-500 transition-colors shadow-xs cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Etiqueta</span>
          </button>
        </div>

        {/* CREATE / EDIT FORM EXPANDER */}
        {isFormOpen && (
          <form onSubmit={handleSaveForm} className="p-4 border-b border-inherit bg-sky-500/5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-sky-500">
                {editingTag ? 'Editar Etiqueta' : 'Crear Nueva Etiqueta'}
              </span>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className={`text-xs ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'} cursor-pointer`}
              >
                Cancelar
              </button>
            </div>

            {formError && (
              <div className="mb-3 p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/25 text-rose-500 text-xs">
                {formError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold mb-1 text-slate-400">
                  Nombre de la etiqueta
                </label>
                <input
                  type="text"
                  maxLength={50}
                  placeholder="Ej. Supermercado, Facturas, Vacaciones..."
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-xl border transition-colors ${
                    isDark
                      ? 'bg-black/30 border-white/15 text-white placeholder-slate-500 focus:border-sky-500'
                      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-sky-500'
                  } outline-hidden`}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold mb-1.5 text-slate-400">
                  Color distintivo
                </label>
                <div className="flex flex-wrap gap-2 items-center">
                  {PRESET_COLORS.map((color) => {
                    const isSelected = tagColor.toLowerCase() === color.toLowerCase();
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setTagColor(color)}
                        className={`w-7 h-7 rounded-full transition-transform cursor-pointer flex items-center justify-center ${
                          isSelected ? 'scale-115 ring-2 ring-offset-2 ring-sky-500' : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                        aria-label={`Seleccionar color ${color}`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-3" />}
                      </button>
                    );
                  })}
                  <div className="flex items-center gap-1.5 pl-2 border-l border-white/10">
                    <input
                      type="color"
                      value={tagColor}
                      onChange={(e) => setTagColor(e.target.value)}
                      className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0"
                      title="Color personalizado"
                    />
                    <span className="text-[10px] font-mono uppercase text-slate-400">{tagColor}</span>
                  </div>
                </div>
              </div>

              {/* LIVE PREVIEW BADGE */}
              <div className="pt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">Vista previa:</span>
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-all"
                    style={{
                      backgroundColor: `${tagColor}20`,
                      color: tagColor,
                      borderColor: `${tagColor}40`,
                    }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tagColor }} />
                    {tagName.trim() || 'Nombre de etiqueta'}
                  </span>
                </div>

                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-sky-600 text-white hover:bg-sky-500 transition-colors shadow-xs cursor-pointer"
                >
                  {editingTag ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* TAGS LIST */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredTags.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 rounded-2xl mx-auto mb-3 bg-slate-500/10 flex items-center justify-center text-slate-400">
                <TagIcon className="w-6 h-6" />
              </div>
              <p className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                {searchQuery ? 'No se encontraron etiquetas' : 'No tienes etiquetas creadas'}
              </p>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {searchQuery
                  ? 'Intenta con otro término de búsqueda'
                  : 'Crea etiquetas para clasificar y filtrar tus transacciones'}
              </p>
              {!searchQuery && (
                <button
                  type="button"
                  onClick={handleOpenCreate}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-sky-600 text-white hover:bg-sky-500 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Crear mi primera etiqueta</span>
                </button>
              )}
            </div>
          ) : (
            filteredTags.map((tag) => {
              const usageCount = usageCountByTagId.get(tag.id) || 0;
              return (
                <div
                  key={tag.id}
                  className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition-colors ${
                    isDark
                      ? 'bg-white/2 border-white/5 hover:border-white/10 hover:bg-white/4'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: tag.color }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs truncate block">{tag.name}</span>
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
                          style={{
                            backgroundColor: `${tag.color}18`,
                            color: tag.color,
                          }}
                        >
                          {tag.name}
                        </span>
                      </div>
                      <span className={`text-[11px] block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {usageCount} registro{usageCount === 1 ? '' : 's'} asociado{usageCount === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(tag)}
                      className={`p-2 rounded-xl transition-colors cursor-pointer ${
                        isDark ? 'hover:bg-white/10 text-slate-300' : 'hover:bg-slate-200 text-slate-600'
                      }`}
                      title="Editar etiqueta"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTag(tag)}
                      className={`p-2 rounded-xl transition-colors cursor-pointer ${
                        usageCount > 0
                          ? 'opacity-60 text-slate-400 hover:bg-amber-500/10 hover:text-amber-500'
                          : 'hover:bg-rose-500/15 text-rose-500'
                      }`}
                      title={
                        usageCount > 0
                          ? `Asociada a ${usageCount} registros (no se puede eliminar)`
                          : 'Eliminar etiqueta'
                      }
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-inherit flex items-center justify-between text-xs">
          <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Protección de integridad: no se eliminan etiquetas en uso.
          </span>
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 rounded-xl font-semibold border transition-colors cursor-pointer ${
              isDark
                ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white'
                : 'border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-800'
            }`}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
