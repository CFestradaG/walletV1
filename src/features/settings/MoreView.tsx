import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  ChevronRight,
  Download,
  Edit3,
  Eye,
  EyeOff,
  Fingerprint,
  FolderTree,
  LogOut,
  Monitor,
  Moon,
  Plus,
  RotateCcw,
  Shield,
  ShieldCheck,
  Smartphone,
  Sun,
  Target,
  Trash2,
  User,
  Wallet,
  Wifi,
  X,
} from 'lucide-react';
import { useWallet } from '../../core/state/WalletContext';
import { Category, CategoryType, ThemeMode } from '../../core/types/models';
import { getSecurityConfig } from '../../core/security/securityService';
import { usePWAInstall } from '../../core/pwa/usePWAInstall';

interface MoreViewProps {
  onOpenPeriodsModal: () => void;
  onOpenBudgetsModal: () => void;
  onOpenSecurityModal?: () => void;
  onOpenInstallModal?: () => void;
}

export const MoreView: React.FC<MoreViewProps> = ({
  onOpenPeriodsModal,
  onOpenBudgetsModal,
  onOpenSecurityModal,
  onOpenInstallModal,
}) => {
  const {
    currentUser,
    logout,
    resetAccountData,
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
  const [isResettingAccount, setIsResettingAccount] = useState(false);
  const [accountResetNotice, setAccountResetNotice] = useState<string | null>(null);

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

  const handleResetAccount = async () => {
    const confirmed = window.confirm(
      'Esto eliminará permanentemente tus cuentas financieras, transacciones, presupuestos y períodos, y restaurará las categorías iniciales. Se conservarán tu acceso, perfil y preferencias. ¿Deseas continuar?'
    );
    if (!confirmed) return;
    setIsResettingAccount(true);
    setAccountResetNotice(null);
    const result = await resetAccountData();
    setAccountResetNotice(result.ok ? 'La cuenta quedó restablecida.' : result.error || 'No se pudo restablecer la cuenta.');
    setIsResettingAccount(false);
  };

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
              <h2 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {currentUser?.name || 'Usuario'}
              </h2>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {currentUser?.email || 'usuario@wallet.app'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            title="Cerrar sesión"
            className="p-2.5 rounded-xl border border-rose-500/20 text-rose-500 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
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
                ? 'bg-white text-slate-900 shadow-sm font-bold border border-slate-200/80'
                : isDark
                ? 'text-slate-400 hover:text-white'
                : 'text-slate-600 hover:text-slate-900'
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
                : isDark
                ? 'text-slate-400 hover:text-white'
                : 'text-slate-600 hover:text-slate-900'
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
                : isDark
                ? 'text-slate-400 hover:text-white'
                : 'text-slate-600 hover:text-slate-900'
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
            className={`w-full p-3 rounded-2xl border flex items-center justify-between text-left transition-colors cursor-pointer ${
              isDark
                ? 'border-white/5 hover:bg-white/5'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <FolderTree className="w-4 h-4" />
              </div>
              <div>
                <span className={`font-bold text-xs block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Categorías y Subcategorías
                </span>
                <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {categories.length} categorías configuradas
                </span>
              </div>
            </div>
            <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-400'}`} />
          </button>

          {/* Períodos Financieros */}
          <button
            type="button"
            onClick={onOpenPeriodsModal}
            className={`w-full p-3 rounded-2xl border flex items-center justify-between text-left transition-colors cursor-pointer ${
              isDark
                ? 'border-white/5 hover:bg-white/5'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <span className={`font-bold text-xs block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Períodos Financieros
                </span>
                <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Configurar fechas de corte, quincenas o meses
                </span>
              </div>
            </div>
            <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-400'}`} />
          </button>

          {/* Presupuesto y Panorama Anual */}
          <button
            type="button"
            onClick={onOpenBudgetsModal}
            className={`w-full p-3 rounded-2xl border flex items-center justify-between text-left transition-colors cursor-pointer ${
              isDark
                ? 'border-white/5 hover:bg-white/5'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <span className={`font-bold text-xs block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Presupuesto & Panorama Anual
                </span>
                <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Proyecciones y metas de gasto por categoría
                </span>
              </div>
            </div>
            <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-400'}`} />
          </button>
        </div>
      </div>

      {/* PWA & SEGURIDAD AVANZADA */}
      {(() => {
        const secConfig = currentUser ? getSecurityConfig(currentUser.id) : { enabled: false };
        return (
          <div
            className={`p-4 rounded-3xl border transition-all ${
              isDark ? 'bg-[#131927] border-white/10' : 'bg-white border-slate-200 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold block">PWA & Seguridad Local</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                100% Offline
              </span>
            </div>

            <div className="space-y-2">
              {/* Seguridad & Bloqueo */}
              <button
                type="button"
                onClick={onOpenSecurityModal}
                className={`w-full p-3 rounded-2xl border flex items-center justify-between text-left transition-colors cursor-pointer ${
                  isDark
                    ? 'border-white/5 hover:bg-white/5'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    secConfig.enabled
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                  }`}>
                    {secConfig.enabled ? <Shield className="w-4 h-4" /> : <Fingerprint className="w-4 h-4" />}
                  </div>
                  <div>
                    <span className={`font-bold text-xs block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Seguridad & Bloqueo
                    </span>
                    <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {secConfig.enabled
                        ? 'Protección activa con PIN y Biometría'
                        : 'Configurar PIN de 4 dígitos o Huella / Face ID'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    secConfig.enabled
                      ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                      : isDark
                      ? 'bg-slate-700/60 text-slate-300'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}>
                    {secConfig.enabled ? 'Activo' : 'Configurar'}
                  </span>
                  <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-400'}`} />
                </div>
              </button>

              {/* Instalar PWA */}
              <button
                type="button"
                onClick={onOpenInstallModal}
                className={`w-full p-3 rounded-2xl border flex items-center justify-between text-left transition-colors cursor-pointer ${
                  isDark
                    ? 'border-white/5 hover:bg-white/5'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <span className={`font-bold text-xs block ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      Instalar en Teléfono / PC (PWA)
                    </span>
                    <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Acceso rápido de pantalla de inicio sin barra de navegación
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/30">
                    Instalar
                  </span>
                  <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-400'}`} />
                </div>
              </button>

              {/* Estado Offline Firestore */}
              <div className={`p-3 rounded-2xl border flex items-center gap-2.5 ${
                isDark ? 'bg-black/25 border-white/5' : 'bg-slate-50 border-slate-200'
              }`}>
                <Wifi className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div className="text-[11px]">
                  <span className={`font-semibold block ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    Persistencia sin conexión habilitada
                  </span>
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                    Tus registros se guardan localmente y se sincronizan al recuperar internet.
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 4. PREFERENCES (PRIVACY & CURRENCY) */}
      <div
        className={`p-4 rounded-3xl border transition-all ${
          isDark ? 'bg-[#131927] border-white/10' : 'bg-white border-slate-200 shadow-xs'
        }`}
      >
        <span className="text-xs font-bold block mb-3">Preferencias</span>
        <div className="space-y-3 text-xs">
          <div className={`flex items-center justify-between p-2.5 rounded-2xl border ${
            isDark ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-200'
          }`}>
            <div>
              <span className={`font-bold block ${isDark ? 'text-white' : 'text-slate-900'}`}>Moneda principal</span>
              <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Quetzal Guatemalteco (GTQ · Q)</span>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-xs">
              GTQ
            </span>
          </div>

          <label className={`flex items-center justify-between p-2.5 rounded-2xl border cursor-pointer ${
            isDark ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center gap-2.5">
              {settings.hideBalances ? (
                <EyeOff className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
              ) : (
                <Eye className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              )}
              <div>
                <span className={`font-bold block ${isDark ? 'text-white' : 'text-slate-900'}`}>Modo de privacidad</span>
                <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
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
              className="rounded text-emerald-500 focus:ring-emerald-500 cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* 5. ACCOUNT RESET */}
      <div
        className={`p-4 rounded-3xl border transition-all ${
          isDark ? 'bg-[#131927] border-rose-500/20' : 'bg-white border-rose-200 shadow-xs'
        }`}
      >
        <span className="text-xs font-bold block mb-2">Restablecer cuenta</span>
        <p className={`text-[11px] mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Borra los datos financieros y restaura las categorías iniciales. Conserva tu acceso y preferencias.
        </p>
        <button
          type="button"
          onClick={handleResetAccount}
          disabled={isResettingAccount}
          className="w-full p-3 rounded-2xl border border-rose-500/30 text-rose-500 dark:text-rose-400 hover:bg-rose-500/10 disabled:opacity-50 flex items-center justify-center gap-2 text-xs font-bold transition-colors cursor-pointer"
        >
          <RotateCcw className={`w-4 h-4 ${isResettingAccount ? 'animate-spin' : ''}`} />
          {isResettingAccount ? 'Restableciendo…' : 'Restablecer cuenta'}
        </button>
        {accountResetNotice && (
          <p role="status" className={`text-[11px] mt-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{accountResetNotice}</p>
        )}
      </div>

      {/* 6. ABOUT WALLET */}
      <div className="text-center py-4 space-y-1">
        <div className={`flex items-center justify-center gap-1.5 text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          <Wallet className="w-3.5 h-3.5 text-emerald-500" />
          <span>Wallet v1.0</span>
        </div>
        <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
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
            <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-bold text-sm">Administrador de Categorías</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCatManagerOpen(false)}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Type selector tabs */}
            <div className="p-4 pb-2">
              <div
                className={`grid grid-cols-2 p-1 rounded-xl text-xs border ${
                  isDark ? 'bg-black/20 border-white/5' : 'bg-slate-100 border-slate-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setCatManagerType('expense')}
                  className={`py-1.5 rounded-lg font-bold cursor-pointer transition-all ${
                    catManagerType === 'expense'
                      ? isDark
                        ? 'bg-rose-500/20 text-rose-400'
                        : 'bg-white text-rose-600 shadow-xs border border-rose-200'
                      : isDark
                      ? 'text-slate-400 hover:text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Gastos ({categories.filter((c) => c.type === 'expense').length})
                </button>
                <button
                  type="button"
                  onClick={() => setCatManagerType('income')}
                  className={`py-1.5 rounded-lg font-bold cursor-pointer transition-all ${
                    catManagerType === 'income'
                      ? isDark
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-white text-emerald-600 shadow-xs border border-emerald-200'
                      : isDark
                      ? 'text-slate-400 hover:text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Ingresos ({categories.filter((c) => c.type === 'income').length})
                </button>
              </div>
            </div>

            {/* Category list */}
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
              {categoryManagerNotice && (
                <div role="status" className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-500 text-xs">
                  {categoryManagerNotice}
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  Categorías registradas
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryManagerNotice(null);
                    setIsNewCatModalOpen(true);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1 cursor-pointer hover:bg-emerald-500/25 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nueva categoría</span>
                </button>
              </div>

              {filteredCategories.map((cat) => (
                <div
                  key={cat.id}
                  className={`p-3.5 rounded-2xl border space-y-2 text-xs transition-all ${
                    isDark ? 'bg-black/20 border-white/5' : 'bg-white border-slate-200 shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
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
                            className={`min-w-0 w-32 px-2 py-1 rounded-lg text-xs border ${
                              isDark ? 'bg-black/30 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                            }`}
                          />
                          <button type="button" onClick={() => saveCategoryName(cat.id)} aria-label="Guardar nombre de categoría" className="text-emerald-500 hover:text-emerald-400 cursor-pointer"><Check className="w-3.5 h-3.5" /></button>
                          <button type="button" onClick={() => setEditingCategoryId(null)} aria-label="Cancelar edición de categoría" className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                        </>
                      ) : (
                        <>
                          <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{cat.name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCategoryId(cat.id);
                              setCategoryNameDraft(cat.name);
                              setCategoryManagerNotice(null);
                            }}
                            aria-label={`Editar categoría ${cat.name}`}
                            className="text-slate-400 hover:text-emerald-500 cursor-pointer"
                          ><Edit3 className="w-3 h-3" /></button>
                        </>
                      )}
                      <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        ({cat.subcategories.length} subcategorías)
                      </span>
                      {categoryHasRecords(cat) && <span className="text-[9px] font-bold text-amber-500">En uso</span>}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setCategoryManagerNotice(null);
                          setTargetCatForSub(cat);
                        }}
                        className={`px-2 py-0.5 rounded-lg text-[11px] flex items-center gap-1 cursor-pointer transition-colors ${
                          isDark ? 'bg-white/5 hover:bg-white/10 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
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
                    <div className={`flex flex-wrap gap-1.5 pt-1.5 border-t ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                      {cat.subcategories.map((sub) => {
                        const isEditing = editingSubcategory?.categoryId === cat.id && editingSubcategory.subcategoryId === sub.id;
                        const hasRecords = subcategoryHasRecords(sub.id);
                        return (
                          <div
                            key={sub.id}
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] border transition-colors ${
                              isDark ? 'bg-white/5 border-white/10 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-800'
                            }`}
                          >
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
                                  className={`w-28 px-1 py-0.5 rounded text-[11px] border ${
                                    isDark ? 'bg-black/30 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'
                                  }`}
                                />
                                <button type="button" onClick={() => saveSubcategoryName(cat.id, sub.id)} aria-label="Guardar nombre de subcategoría" className="text-emerald-500 cursor-pointer"><Check className="w-3 h-3" /></button>
                                <button type="button" onClick={() => setEditingSubcategory(null)} aria-label="Cancelar edición de subcategoría" className="text-slate-400 cursor-pointer"><X className="w-3 h-3" /></button>
                              </>
                            ) : (
                              <>
                                <span className={isDark ? 'text-slate-300' : 'text-slate-800 font-medium'}>{sub.name}</span>
                                {hasRecords && <span className="text-[9px] font-bold text-amber-500">En uso</span>}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingSubcategory({ categoryId: cat.id, subcategoryId: sub.id });
                                    setSubcategoryNameDraft(sub.name);
                                    setCategoryManagerNotice(null);
                                  }}
                                  aria-label={`Editar subcategoría ${sub.name}`}
                                  className="text-slate-400 hover:text-emerald-500 cursor-pointer"
                                ><Edit3 className="w-3 h-3" /></button>
                                <button
                                  type="button"
                                  disabled={hasRecords || cat.subcategories.length <= 1}
                                  title={hasRecords ? 'Tiene transacciones o presupuestos asociados; puedes cambiarle el nombre.' : cat.subcategories.length <= 1 ? 'La categoría debe conservar al menos una subcategoría.' : 'Eliminar subcategoría'}
                                  onClick={() => deleteSubcategory(cat, sub.id)}
                                  className="text-slate-400 hover:text-rose-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
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

            <div className={`p-4 border-t ${isDark ? 'border-white/5' : 'border-slate-200'} flex justify-end`}>
              <button
                type="button"
                onClick={() => setIsCatManagerOpen(false)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                  isDark ? 'bg-white/10 hover:bg-white/15 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                }`}
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
              isDark ? 'bg-[#131927] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-xl'
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
              className={`w-full p-2.5 rounded-xl border text-xs ${
                isDark ? 'border-white/10 bg-black/30 text-white placeholder-slate-500' : 'border-slate-300 bg-slate-50 text-slate-900 placeholder-slate-400'
              }`}
            />
            {categoryManagerNotice && <p role="alert" className="text-xs text-rose-500">{categoryManagerNotice}</p>}
            <div className="flex items-center gap-2">
              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Color:</span>
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
                className={`px-3 py-1.5 rounded-xl text-xs cursor-pointer transition-colors ${
                  isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-[#002113] font-bold text-xs cursor-pointer"
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
              isDark ? 'bg-[#131927] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-xl'
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
              className={`w-full p-2.5 rounded-xl border text-xs ${
                isDark ? 'border-white/10 bg-black/30 text-white placeholder-slate-500' : 'border-slate-300 bg-slate-50 text-slate-900 placeholder-slate-400'
              }`}
            />
            {categoryManagerNotice && <p role="alert" className="text-xs text-rose-500">{categoryManagerNotice}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTargetCatForSub(null)}
                className={`px-3 py-1.5 rounded-xl text-xs cursor-pointer transition-colors ${
                  isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-[#002113] font-bold text-xs cursor-pointer"
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
