import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  ChevronRight,
  Cloud,
  CloudOff,
  Edit3,
  Eye,
  EyeOff,
  FolderTree,
  LogOut,
  Monitor,
  Moon,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sun,
  Target,
  Trash2,
  User,
  Wallet,
  X,
} from 'lucide-react';
import { useWallet } from '../../core/state/WalletContext';
import { Category, CategoryType, ThemeMode } from '../../core/types/models';

interface MoreViewProps {
  onOpenPeriodsModal: () => void;
  onOpenBudgetsModal: () => void;
}

export const MoreView: React.FC<MoreViewProps> = ({
  onOpenPeriodsModal,
  onOpenBudgetsModal,
}) => {
  const {
    currentUser,
    logout,
    themeMode,
    setThemeMode,
    resolvedTheme,
    settings,
    updateSettings,
    toggleHideBalances,
    categories,
    createCategory,
    deleteCategory,
    updateCategoryName,
    updateSubcategoryName,
    addSubcategory,
    removeSubcategory,
    transactions,
    budgets,
    pendingSyncCount,
    syncPendingOperations,
  } = useWallet();

  const isDark = resolvedTheme === 'dark';

  // Category Manager modal
  const [isCatManagerOpen, setIsCatManagerOpen] = useState(false);
  const [catManagerType, setCatManagerType] = useState<CategoryType>('expense');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isNewCatModalOpen, setIsNewCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#10B981');
  const [newSubName, setNewSubName] = useState('');
  const [targetCatForSub, setTargetCatForSub] = useState<Category | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryNameDraft, setCategoryNameDraft] = useState('');
  const [editingSubcategory, setEditingSubcategory] = useState<{ categoryId: string; subcategoryId: string } | null>(null);
  const [subcategoryNameDraft, setSubcategoryNameDraft] = useState('');
  const [categoryManagerNotice, setCategoryManagerNotice] = useState<string | null>(null);

  const filteredCategories = useMemo(() => {
    return categories.filter((c) => c.type === catManagerType);
  }, [categories, catManagerType]);

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const result = createCategory({
      name: newCatName.trim(),
      type: catManagerType,
      color: newCatColor,
      icon: '🏷️',
    });
    if (!result.ok) {
      setCategoryManagerNotice(result.error || 'No se pudo crear la categoría.');
      return;
    }
    setNewCatName('');
    setIsNewCatModalOpen(false);
    setCategoryManagerNotice(null);
  };

  const handleAddSubcategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCatForSub || !newSubName.trim()) return;
    const result = addSubcategory(targetCatForSub.id, newSubName.trim(), '🏷️');
    if (!result.ok) {
      setCategoryManagerNotice(result.error || 'No se pudo agregar la subcategoría.');
      return;
    }
    setNewSubName('');
    setTargetCatForSub(null);
    setCategoryManagerNotice(null);
  };

  const deleteSubcategory = (cat: Category, subId: string) => {
    const result = removeSubcategory(cat.id, subId);
    setCategoryManagerNotice(result.error || 'Subcategoría eliminada.');
  };

  const saveCategoryName = (categoryId: string) => {
    const result = updateCategoryName(categoryId, categoryNameDraft);
    if (!result.ok) {
      setCategoryManagerNotice(result.error || 'No se pudo cambiar el nombre.');
      return;
    }
    setEditingCategoryId(null);
    setCategoryManagerNotice(null);
  };

  const saveSubcategoryName = (categoryId: string, subcategoryId: string) => {
    const result = updateSubcategoryName(categoryId, subcategoryId, subcategoryNameDraft);
    if (!result.ok) {
      setCategoryManagerNotice(result.error || 'No se pudo cambiar el nombre.');
      return;
    }
    setEditingSubcategory(null);
    setCategoryManagerNotice(null);
  };

  const categoryHasRecords = (category: Category) => {
    const subcategoryIds = new Set(category.subcategories.map((item) => item.id));
    return transactions.some((item) => item.categoryId === category.id || (!!item.subcategoryId && subcategoryIds.has(item.subcategoryId))) ||
      budgets.some((item) => item.categoryId === category.id || (!!item.subcategoryId && subcategoryIds.has(item.subcategoryId)));
  };

  const subcategoryHasRecords = (subcategoryId: string) =>
    transactions.some((item) => item.subcategoryId === subcategoryId) ||
    budgets.some((item) => item.subcategoryId === subcategoryId);

  return (
    <div className="space-y-4">
      {/* 1. PROFILE CARD */}
      <div
        className={`p-4 rounded-3xl border transition-all ${
          isDark ? 'bg-[#131927] border-white/10' : 'bg-white border-slate-200 shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#10B981] to-[#34D399] flex items-center justify-center font-display font-extrabold text-lg text-[#002113] shadow-md">
              {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <h2 className="font-bold text-sm text-white">
                {currentUser?.name || 'Usuario'}
              </h2>
              <p className="text-xs text-slate-400">
                {currentUser?.email || 'usuario@wallet.app'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            title="Cerrar sesión"
            className="p-2.5 rounded-xl border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </div>

      {/* 2. VISUAL APPEARANCE (THEME) */}
      <div
        className={`p-4 rounded-3xl border transition-all ${
          isDark ? 'bg-[#131927] border-white/10' : 'bg-white border-slate-200 shadow-xs'
        }`}
      >
        <span className="text-xs font-bold block mb-3">Apariencia</span>
        <div
          className={`grid grid-cols-3 p-1 rounded-2xl border ${
            isDark ? 'bg-black/30 border-white/5' : 'bg-slate-100 border-slate-200'
          }`}
        >
          <button
            type="button"
            onClick={() => setThemeMode('light')}
            className={`py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              themeMode === 'light'
                ? 'bg-white text-slate-900 shadow-sm font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sun className="w-3.5 h-3.5 text-amber-500" />
            <span>Claro</span>
          </button>
          <button
            type="button"
            onClick={() => setThemeMode('dark')}
            className={`py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              themeMode === 'dark'
                ? 'bg-white/10 text-emerald-400 shadow-sm font-bold border border-white/10'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Moon className="w-3.5 h-3.5" />
            <span>Oscuro</span>
          </button>
          <button
            type="button"
            onClick={() => setThemeMode('system')}
            className={`py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              themeMode === 'system'
                ? 'bg-white/10 text-sky-400 shadow-sm font-bold border border-white/10'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Sistema</span>
          </button>
        </div>
      </div>

      {/* 3. FINANCE CONFIGURATION OPTIONS */}
      <div
        className={`p-4 rounded-3xl border transition-all ${
          isDark ? 'bg-[#131927] border-white/10' : 'bg-white border-slate-200 shadow-xs'
        }`}
      >
        <span className="text-xs font-bold block mb-3">Configuración Financiera</span>
        <div className="space-y-2">
          {/* Categorías y Subcategorías */}
          <button
            type="button"
            onClick={() => setIsCatManagerOpen(true)}
            className="w-full p-3 rounded-2xl border border-white/5 hover:bg-white/5 flex items-center justify-between text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                <FolderTree className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-xs text-white block">
                  Categorías y Subcategorías
                </span>
                <span className="text-[11px] text-slate-400">
                  {categories.length} categorías configuradas
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          {/* Períodos Financieros */}
          <button
            type="button"
            onClick={onOpenPeriodsModal}
            className="w-full p-3 rounded-2xl border border-white/5 hover:bg-white/5 flex items-center justify-between text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-xs text-white block">
                  Períodos Financieros
                </span>
                <span className="text-[11px] text-slate-400">
                  Configurar fechas de corte, quincenas o meses
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          {/* Presupuestos */}
          <button
            type="button"
            onClick={onOpenBudgetsModal}
            className="w-full p-3 rounded-2xl border border-white/5 hover:bg-white/5 flex items-center justify-between text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-xs text-white block">
                  Límites y Presupuestos
                </span>
                <span className="text-[11px] text-slate-400">
                  Asignar metas de gasto por categoría
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* 4. PREFERENCES (PRIVACY & CURRENCY) */}
      <div
        className={`p-4 rounded-3xl border transition-all ${
          isDark ? 'bg-[#131927] border-white/10' : 'bg-white border-slate-200 shadow-xs'
        }`}
      >
        <span className="text-xs font-bold block mb-3">Preferencias</span>
        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between p-2.5 rounded-2xl bg-black/20 border border-white/5">
            <div>
              <span className="font-bold text-white block">Moneda principal</span>
              <span className="text-[11px] text-slate-400">Quetzal Guatemalteco (GTQ · Q)</span>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 font-mono font-bold text-xs">
              GTQ
            </span>
          </div>

          <label className="flex items-center justify-between p-2.5 rounded-2xl bg-black/20 border border-white/5 cursor-pointer">
            <div className="flex items-center gap-2.5">
              {settings.hideBalances ? (
                <EyeOff className="w-4 h-4 text-slate-400" />
              ) : (
                <Eye className="w-4 h-4 text-emerald-400" />
              )}
              <div>
                <span className="font-bold text-white block">Modo de privacidad</span>
                <span className="text-[11px] text-slate-400">
                  Ocultar saldos numéricos con asteriscos
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.hideBalances}
              onChange={(e) =>
                updateSettings({ hideBalances: e.target.checked })
              }
              className="rounded text-emerald-500 focus:ring-emerald-500"
            />
          </label>
        </div>
      </div>

      {/* 5. BACKUP & OFFLINE SYNC */}
      <div
        className={`p-4 rounded-3xl border transition-all ${
          isDark ? 'bg-[#131927] border-white/10' : 'bg-white border-slate-200 shadow-xs'
        }`}
      >
        <span className="text-xs font-bold block mb-3">Sincronización y Respaldo</span>
        <div className="space-y-3 text-xs">
          <label className="flex items-center justify-between p-2.5 rounded-2xl bg-black/20 border border-white/5 cursor-pointer">
            <div className="flex items-center gap-2.5">
              {settings.offlineSimulation ? (
                <CloudOff className="w-4 h-4 text-amber-400" />
              ) : (
                <Cloud className="w-4 h-4 text-emerald-400" />
              )}
              <div>
                <span className="font-bold text-white block">
                  Simulación sin conexión
                </span>
                <span className="text-[11px] text-slate-400">
                  Guardar en persistencia local antes de la nube
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.offlineSimulation}
              onChange={(e) =>
                updateSettings({ offlineSimulation: e.target.checked })
              }
              className="rounded text-emerald-500 focus:ring-emerald-500"
            />
          </label>

          {pendingSyncCount > 0 && (
            <div className="flex items-center justify-between p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
              <span className="text-amber-400 font-medium">
                {pendingSyncCount} operaciones pendientes
              </span>
              <button
                type="button"
                onClick={syncPendingOperations}
                className="px-3 py-1 rounded-xl bg-amber-400 text-slate-950 font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sincronizar ahora</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 6. ABOUT WALLET */}
      <div className="text-center py-4 space-y-1">
        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-400">
          <Wallet className="w-3.5 h-3.5 text-emerald-500" />
          <span>Wallet v1.0</span>
        </div>
        <p className="text-[11px] text-slate-500">
          Administración financiera personal inteligente
        </p>
      </div>

      {/* MODAL: CATEGORY & SUBCATEGORY MANAGER */}
      {isCatManagerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs">
          <div
            className={`w-full max-w-lg max-h-[90vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden ${
              isDark
                ? 'bg-[#131927] border-white/10 text-white'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">Administrador de Categorías</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCatManagerOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Type selector tabs */}
            <div className="p-4 pb-2">
              <div className="grid grid-cols-2 p-1 rounded-xl bg-black/20 border border-white/5 text-xs">
                <button
                  type="button"
                  onClick={() => setCatManagerType('expense')}
                  className={`py-1.5 rounded-lg font-bold cursor-pointer transition-all ${
                    catManagerType === 'expense'
                      ? 'bg-rose-500/20 text-rose-400'
                      : 'text-slate-400'
                  }`}
                >
                  Gastos ({categories.filter((c) => c.type === 'expense').length})
                </button>
                <button
                  type="button"
                  onClick={() => setCatManagerType('income')}
                  className={`py-1.5 rounded-lg font-bold cursor-pointer transition-all ${
                    catManagerType === 'income'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'text-slate-400'
                  }`}
                >
                  Ingresos ({categories.filter((c) => c.type === 'income').length})
                </button>
              </div>
            </div>

            {/* Category list */}
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
              {categoryManagerNotice && (
                <div role="status" className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                  {categoryManagerNotice}
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400 font-medium">
                  Categorías registradas
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryManagerNotice(null);
                    setIsNewCatModalOpen(true);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nueva categoría</span>
                </button>
              </div>

              {filteredCategories.map((cat) => (
                <div
                  key={cat.id}
                  className="p-3 rounded-2xl bg-black/20 border border-white/5 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      {editingCategoryId === cat.id ? (
                        <>
                          <input
                            autoFocus
                            value={categoryNameDraft}
                            onChange={(e) => setCategoryNameDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveCategoryName(cat.id);
                              if (e.key === 'Escape') setEditingCategoryId(null);
                            }}
                            aria-label="Nombre de la categoría"
                            className="min-w-0 w-32 px-2 py-1 rounded-lg bg-black/30 border border-white/10 text-xs text-white"
                          />
                          <button type="button" onClick={() => saveCategoryName(cat.id)} aria-label="Guardar nombre de categoría" className="text-emerald-400 hover:text-emerald-300"><Check className="w-3.5 h-3.5" /></button>
                          <button type="button" onClick={() => setEditingCategoryId(null)} aria-label="Cancelar edición de categoría" className="text-slate-400 hover:text-white"><X className="w-3.5 h-3.5" /></button>
                        </>
                      ) : (
                        <>
                          <span className="font-bold text-white">{cat.name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCategoryId(cat.id);
                              setCategoryNameDraft(cat.name);
                              setCategoryManagerNotice(null);
                            }}
                            aria-label={`Editar categoría ${cat.name}`}
                            className="text-slate-400 hover:text-emerald-400"
                          ><Edit3 className="w-3 h-3" /></button>
                        </>
                      )}
                      <span className="text-[10px] text-slate-400">
                        ({cat.subcategories.length} subcategorías)
                      </span>
                      {categoryHasRecords(cat) && <span className="text-[9px] text-amber-400">En uso</span>}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setCategoryManagerNotice(null);
                          setTargetCatForSub(cat);
                        }}
                        className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Subcategoría</span>
                      </button>
                      <button
                        type="button"
                        disabled={categoryHasRecords(cat)}
                        title={categoryHasRecords(cat) ? 'Tiene transacciones o presupuestos asociados; puedes cambiarle el nombre.' : 'Eliminar categoría'}
                        onClick={() => {
                          const result = deleteCategory(cat.id);
                          setCategoryManagerNotice(result.error || 'Categoría eliminada.');
                        }}
                        className="p-1 rounded text-rose-400 hover:bg-rose-500/10 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Subcategories list */}
                  {cat.subcategories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1 border-t border-white/5">
                      {cat.subcategories.map((sub) => {
                        const isEditing = editingSubcategory?.categoryId === cat.id && editingSubcategory.subcategoryId === sub.id;
                        const hasRecords = subcategoryHasRecords(sub.id);
                        return (
                          <div key={sub.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-slate-300">
                            {isEditing ? (
                              <>
                                <input
                                  autoFocus
                                  value={subcategoryNameDraft}
                                  onChange={(e) => setSubcategoryNameDraft(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveSubcategoryName(cat.id, sub.id);
                                    if (e.key === 'Escape') setEditingSubcategory(null);
                                  }}
                                  aria-label="Nombre de la subcategoría"
                                  className="w-28 px-1 py-0.5 rounded bg-black/30 border border-white/10 text-[11px] text-white"
                                />
                                <button type="button" onClick={() => saveSubcategoryName(cat.id, sub.id)} aria-label="Guardar nombre de subcategoría" className="text-emerald-400"><Check className="w-3 h-3" /></button>
                                <button type="button" onClick={() => setEditingSubcategory(null)} aria-label="Cancelar edición de subcategoría" className="text-slate-400"><X className="w-3 h-3" /></button>
                              </>
                            ) : (
                              <>
                                <span>{sub.name}</span>
                                {hasRecords && <span className="text-[9px] text-amber-400">En uso</span>}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingSubcategory({ categoryId: cat.id, subcategoryId: sub.id });
                                    setSubcategoryNameDraft(sub.name);
                                    setCategoryManagerNotice(null);
                                  }}
                                  aria-label={`Editar subcategoría ${sub.name}`}
                                  className="text-slate-400 hover:text-emerald-400"
                                ><Edit3 className="w-3 h-3" /></button>
                                <button
                                  type="button"
                                  disabled={hasRecords || cat.subcategories.length <= 1}
                                  title={hasRecords ? 'Tiene transacciones o presupuestos asociados; puedes cambiarle el nombre.' : cat.subcategories.length <= 1 ? 'La categoría debe conservar al menos una subcategoría.' : 'Eliminar subcategoría'}
                                  onClick={() => deleteSubcategory(cat, sub.id)}
                                  aria-label={`Eliminar subcategoría ${sub.name}`}
                                  className="text-slate-500 hover:text-rose-400 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                ><X className="w-3 h-3" /></button>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-white/5 flex justify-end">
              <button
                type="button"
                onClick={() => setIsCatManagerOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE CATEGORY */}
      {isNewCatModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <form
            onSubmit={handleCreateCategory}
            className={`w-full max-w-sm rounded-3xl border p-5 space-y-3 ${
              isDark ? 'bg-[#131927] border-white/10 text-white' : 'bg-white text-slate-900'
            }`}
          >
            <h4 className="font-bold text-xs">
              Nueva categoría ({catManagerType === 'expense' ? 'Gasto' : 'Ingreso'})
            </h4>
            <input
              type="text"
              required
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="Nombre de la categoría"
              className="w-full p-2.5 rounded-xl border border-white/10 bg-black/30 text-xs text-white"
            />
            {categoryManagerNotice && <p role="alert" className="text-xs text-rose-400">{categoryManagerNotice}</p>}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Color:</span>
              <input
                type="color"
                value={newCatColor}
                onChange={(e) => setNewCatColor(e.target.value)}
                className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsNewCatModalOpen(false)}
                className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl bg-[#10B981] text-[#002113] font-bold text-xs cursor-pointer"
              >
                Crear
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: ADD SUBCATEGORY */}
      {targetCatForSub && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <form
            onSubmit={handleAddSubcategory}
            className={`w-full max-w-sm rounded-3xl border p-5 space-y-3 ${
              isDark ? 'bg-[#131927] border-white/10 text-white' : 'bg-white text-slate-900'
            }`}
          >
            <h4 className="font-bold text-xs">
              Agregar subcategoría a &ldquo;{targetCatForSub.name}&rdquo;
            </h4>
            <input
              type="text"
              required
              value={newSubName}
              onChange={(e) => setNewSubName(e.target.value)}
              placeholder="Nombre de la subcategoría"
              className="w-full p-2.5 rounded-xl border border-white/10 bg-black/30 text-xs text-white"
            />
            {categoryManagerNotice && <p role="alert" className="text-xs text-rose-400">{categoryManagerNotice}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTargetCatForSub(null)}
                className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl bg-[#10B981] text-[#002113] font-bold text-xs cursor-pointer"
              >
                Agregar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
