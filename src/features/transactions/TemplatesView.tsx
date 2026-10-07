import React, { useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { Bell, CalendarClock, Check, Clock3, Pencil, Play, Plus, ReceiptText, Trash2, X } from 'lucide-react';
import { db } from '../../core/firebase/firebase';
import { deleteTransactionTemplate, saveTransactionTemplate } from '../../core/firebase/firestoreSync';
import { TransactionTemplate } from '../../core/types/models';
import { useWallet } from '../../core/state/WalletContext';
import { toISODate } from '../../core/utils/formatters';
import { TemplateRecurrence } from './templateRecurrence';

interface Props { onUse: (template: TransactionTemplate) => void; visible?: boolean; }

function getFrequency(template: TransactionTemplate): TemplateRecurrence | '' {
  return template.recurrenceFrequency || template.reminderFrequency || '';
}

function getDueDate(template: TransactionTemplate): string {
  return (template.nextReminderAt || template.recurrenceStartDate || '').slice(0, 10);
}

export const TemplatesView: React.FC<Props> = ({ onUse, visible = true }) => {
  const { accounts, categories, currentUser, resolvedTheme } = useWallet();
  const uid = currentUser?.id;
  const dark = resolvedTheme === 'dark';
  const [templates, setTemplates] = useState<TransactionTemplate[]>([]);
  const [editing, setEditing] = useState<TransactionTemplate | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const notifiedIds = useRef(new Set<string>());
  const [clock, setClock] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(collection(db, 'users', uid, 'templates'), (snapshot) => {
      setLoadError('');
      const records = snapshot.docs.map((item) => ({ ...item.data(), id: item.id } as TransactionTemplate));
      const today = toISODate(new Date());
      records.forEach((item) => { if (getDueDate(item) > today) notifiedIds.current.delete(item.id); });
      setTemplates(records);
    }, (snapshotError) => setLoadError((snapshotError as { code?: string })?.code || 'unknown'));
  }, [uid]);

  const dueTemplates = useMemo(() => {
    const today = toISODate(new Date(clock));
    return templates.filter((item) => getFrequency(item) && getDueDate(item) && getDueDate(item) <= today);
  }, [clock, templates]);

  useEffect(() => {
    const due = dueTemplates.filter((item) => !notifiedIds.current.has(item.id));
    if (!due.length) return;
    due.forEach((item) => notifiedIds.current.add(item.id));
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification('Recordatorio de Wallet', {
        body: due.length === 1 ? `Es momento de registrar: ${categories.find((c) => c.id === due[0].categoryId)?.name || 'un movimiento'}.` : `${due.length} movimientos programados están pendientes.`,
        tag: `wallet-template-${due[0].id}`,
      });
      notification.onclick = () => { window.focus(); onUse(due[0]); notification.close(); };
    }
  }, [categories, dueTemplates, onUse]);

  const beginEdit = (item?: TransactionTemplate) => {
    const initialCategoryId = item?.categoryId || categories.find((category) => category.type === 'expense' && category.isActive)?.id || '';
    setCategoryId(initialCategoryId);
    setSubcategoryId(item?.subcategoryId || '');
    setError('');
    setEditing(item || {
      id: `tpl_${Date.now()}`, userId: uid || '', categoryId: initialCategoryId,
      name: '',
      amount: 0, accountId: accounts.find((account) => account.status === 'active')?.id || '', note: '',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing || !uid) return;
    const data = new FormData(event.currentTarget);
    const frequency = String(data.get('frequency') || '') as '' | TemplateRecurrence;
    const startDate = String(data.get('startDate') || '');
    if (frequency && !startDate) {
      setError('Selecciona una fecha base para programar la plantilla.');
      return;
    }
    const now = new Date().toISOString();
    try {
      await saveTransactionTemplate(uid, {
        ...editing,
        userId: uid,
        name: String(data.get('name') || '').trim(),
        categoryId: String(data.get('categoryId')),
        transactionType: categories.find((item) => item.id === String(data.get('categoryId')))?.type || 'expense',
        subcategoryId: String(data.get('subcategoryId') || '') || undefined,
        amount: Number(data.get('amount')),
        accountId: String(data.get('accountId')),
        note: String(data.get('note') || ''),
        recurrenceStartDate: frequency ? startDate : undefined,
        recurrenceFrequency: frequency || undefined,
        reminderFrequency: undefined,
        nextReminderAt: frequency ? (editing.recurrenceStartDate === startDate && getFrequency(editing) === frequency
          ? editing.nextReminderAt || startDate
          : startDate) : undefined,
        updatedAt: now,
      });
      setEditing(null);
    } catch (caught) {
      const code = (caught as { code?: string })?.code;
      setError(code === 'permission-denied'
        ? 'Firebase denegó el guardado. Confirma que las reglas de la colección templates estén desplegadas.'
        : code === 'unauthenticated'
          ? 'La sesión expiró. Vuelve a iniciar sesión para guardar la plantilla.'
          : 'No se pudo guardar la plantilla. Revisa la conexión e inténtalo de nuevo.');
    }
  };

  const deleteTemplate = async (template: TransactionTemplate) => {
    if (!uid || !window.confirm('¿Eliminar esta plantilla?')) return;
    try { await deleteTransactionTemplate(uid, template.id); }
    catch (caught) {
      const code = (caught as { code?: string })?.code;
      setError(code === 'permission-denied' ? 'Firebase denegó la eliminación. Confirma que las reglas de templates estén desplegadas.' : 'No se pudo eliminar la plantilla. Inténtalo de nuevo.');
    }
  };

  const surface = dark ? 'bg-[#131927] border-white/10 text-[#DFE2EE]' : 'bg-white border-slate-200 text-slate-900';
  const muted = dark ? 'text-slate-400' : 'text-slate-500';
  const field = `w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 ${dark ? 'bg-black/20 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`;

  return <section className={visible ? 'space-y-4' : 'hidden'}>
    <header className={`rounded-3xl border p-5 sm:p-6 ${surface}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-500"><ReceiptText size={21}/></div>
          <div><h1 className="font-display text-xl font-bold">Plantillas</h1><p className={`mt-1 text-xs ${muted}`}>Guarda movimientos frecuentes y programa cuándo volver a registrarlos.</p></div>
        </div>
        <button type="button" onClick={() => beginEdit()} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#10B981] px-3 py-2 text-xs font-bold text-[#002113] shadow-sm transition hover:brightness-105"><Plus size={15}/> <span className="hidden sm:inline">Nueva plantilla</span><span className="sm:hidden">Nueva</span></button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className={`rounded-2xl border p-3 ${dark ? 'border-white/5 bg-black/15' : 'border-slate-100 bg-slate-50'}`}><span className={`block text-[10px] font-semibold uppercase tracking-wide ${muted}`}>Guardadas</span><strong className="mt-1 block text-lg">{templates.length}</strong></div>
        <div className={`rounded-2xl border p-3 ${dark ? 'border-white/5 bg-black/15' : 'border-slate-100 bg-slate-50'}`}><span className={`block text-[10px] font-semibold uppercase tracking-wide ${muted}`}>Pendientes</span><strong className={`mt-1 block text-lg ${dueTemplates.length ? 'text-amber-500' : ''}`}>{dueTemplates.length}</strong></div>
        <div className={`col-span-2 rounded-2xl border p-3 sm:col-span-1 ${dark ? 'border-emerald-500/15 bg-emerald-500/5' : 'border-emerald-100 bg-emerald-50/60'}`}><span className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide ${dark ? 'text-emerald-400' : 'text-emerald-700'}`}><CalendarClock size={13}/> Programación</span><span className={`mt-1 block text-xs ${muted}`}>Semanal · Quincenal · Mensual</span></div>
      </div>
    </header>

    {loadError && <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-500">{loadError === 'permission-denied' ? 'Firebase denegó la lectura de plantillas. Despliega las reglas de Firestore que permiten el acceso del propietario a users/{uid}/templates.' : 'No se pudieron cargar las plantillas. Revisa la conexión e inténtalo de nuevo.'}</div>}
    {error && <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-500">{error}</div>}
    {dueTemplates.length > 0 && <div className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs ${dark ? 'border-amber-500/25 bg-amber-500/10 text-amber-300' : 'border-amber-200 bg-amber-50 text-amber-800'}`}><Bell size={16}/><span>{dueTemplates.length === 1 ? 'Tienes un movimiento programado pendiente.' : `Tienes ${dueTemplates.length} movimientos programados pendientes.`}</span></div>}

    {templates.length === 0 ? <div className={`rounded-3xl border border-dashed p-9 text-center ${dark ? 'border-white/10 text-slate-400' : 'border-slate-300 text-slate-500'}`}><ReceiptText size={32} className="mx-auto mb-3 opacity-60"/><h2 className={`text-sm font-bold ${dark ? 'text-slate-200' : 'text-slate-700'}`}>Aún no tienes plantillas</h2><p className="mx-auto mt-1 max-w-xs text-xs">Crea una plantilla para completar rápidamente tus movimientos frecuentes.</p><button type="button" onClick={() => beginEdit()} className="mt-4 rounded-xl bg-[#10B981] px-4 py-2 text-xs font-bold text-[#002113]">Crear plantilla</button></div> :
      <div className="space-y-2.5">{templates.map((item) => {
        const category = categories.find((entry) => entry.id === item.categoryId);
        const subcategory = category?.subcategories.find((entry) => entry.id === item.subcategoryId);
        const due = dueTemplates.some((entry) => entry.id === item.id);
        const frequency = getFrequency(item);
        const frequencyLabel = frequency === 'weekly' ? 'Cada 7 días' : frequency === 'biweekly' ? 'Cada 15 días' : frequency === 'monthly' ? 'Mensual' : '';
        return <article key={item.id} className={`rounded-2xl border p-4 transition ${surface} ${due ? dark ? 'border-amber-500/30' : 'border-amber-300' : ''}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${dark ? 'bg-white/5 text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>{category?.icon || '•'}</div>
              <div className="min-w-0"><h2 className="truncate text-sm font-bold">{item.name?.trim() || item.note?.trim() || category?.name || 'Plantilla'}</h2><p className={`mt-1 truncate text-xs ${muted}`}>{category?.name || 'Categoría'}{subcategory ? ` · ${subcategory.name}` : ''} · {accounts.find((account) => account.id === item.accountId)?.name || 'Cuenta'}{item.note ? ` · ${item.note}` : ''}</p>
                {frequency && <p className={`mt-2 flex items-center gap-1.5 text-[11px] ${due ? 'text-amber-500' : muted}`}><Clock3 size={13}/>{frequencyLabel} · Base {item.recurrenceStartDate || getDueDate(item)}{due ? ' · Pendiente' : ''}</p>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" title="Crear movimiento" aria-label="Crear movimiento con plantilla" onClick={() => onUse(item)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500 transition hover:bg-emerald-500/25"><Play size={16}/></button>
              <button type="button" title="Editar" aria-label="Editar plantilla" onClick={() => beginEdit(item)} className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${dark ? 'text-slate-400 hover:bg-white/10 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}><Pencil size={15}/></button>
              <button type="button" title="Eliminar" aria-label="Eliminar plantilla" onClick={() => void deleteTemplate(item)} className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${dark ? 'text-slate-400 hover:bg-rose-500/10 hover:text-rose-400' : 'text-slate-500 hover:bg-rose-50 hover:text-rose-600'}`}><Trash2 size={15}/></button>
            </div>
          </div>
          <div className={`mt-3 flex items-center justify-between border-t pt-3 ${dark ? 'border-white/5' : 'border-slate-100'}`}><span className={`text-[10px] font-semibold uppercase tracking-wide ${muted}`}>Monto habitual</span><span className="font-mono text-sm font-bold text-emerald-500">Q {item.amount.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
        </article>;
      })}</div>}

    {editing && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-xs sm:p-4">
      <form onSubmit={(event) => void save(event)} className={`flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border shadow-2xl ${surface}`}>
        <div className={`flex items-center justify-between border-b px-5 py-4 ${dark ? 'border-white/5' : 'border-slate-100'}`}><div className="flex items-center gap-2"><ReceiptText className="h-5 w-5 text-emerald-500"/><h2 className="font-display text-base font-bold">{templates.some((item) => item.id === editing.id) ? 'Editar plantilla' : 'Nueva plantilla'}</h2></div><button type="button" onClick={() => setEditing(null)} aria-label="Cerrar" className={`rounded-lg p-1.5 ${dark ? 'text-slate-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'}`}><X size={18}/></button></div>
        <div className="space-y-3 overflow-y-auto p-4 sm:p-5">
          {error && <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-500">{error}</div>}
          <label className={`block text-[10px] font-semibold uppercase tracking-wide ${muted}`}>Nombre de la plantilla<input name="name" required maxLength={60} defaultValue={editing.name || editing.note || categories.find((item) => item.id === categoryId)?.name || ''} placeholder="Ej. Suscripción Netflix" className={`${field} mt-1.5 normal-case tracking-normal`}/></label>
          <label className={`block text-[10px] font-semibold uppercase tracking-wide ${muted}`}>Categoría<select name="categoryId" required value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setSubcategoryId(''); }} className={`${field} mt-1.5 normal-case tracking-normal`}>{categories.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.type === 'income' ? 'Ingreso' : 'Egreso'} · {item.name}</option>)}</select></label>
          <label className={`block text-[10px] font-semibold uppercase tracking-wide ${muted}`}>Subcategoría<select name="subcategoryId" value={subcategoryId} onChange={(event) => setSubcategoryId(event.target.value)} className={`${field} mt-1.5 normal-case tracking-normal`}><option value="">Sin subcategoría</option>{categories.find((item) => item.id === categoryId)?.subcategories.filter((item) => item.isActive !== false).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-3"><label className={`block text-[10px] font-semibold uppercase tracking-wide ${muted}`}>Monto<input name="amount" type="number" min="0.01" step="0.01" required defaultValue={editing.amount || ''} placeholder="0.00" className={`${field} mt-1.5 normal-case tracking-normal`}/></label><label className={`block text-[10px] font-semibold uppercase tracking-wide ${muted}`}>Cuenta<select name="accountId" required defaultValue={editing.accountId} className={`${field} mt-1.5 normal-case tracking-normal`}>{accounts.filter((item) => item.status === 'active').map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
          <label className={`block text-[10px] font-semibold uppercase tracking-wide ${muted}`}>Nota<input name="note" defaultValue={editing.note} placeholder="Ej. Pago de servicio" className={`${field} mt-1.5 normal-case tracking-normal`}/></label>
          <div className={`rounded-2xl border p-3.5 ${dark ? 'border-white/10 bg-black/15' : 'border-slate-200 bg-slate-50'}`}>
            <div className="mb-3 flex items-center gap-2"><CalendarClock size={16} className="text-emerald-500"/><span className={`text-[10px] font-bold uppercase tracking-wide ${dark ? 'text-slate-200' : 'text-slate-700'}`}>Programación recurrente</span></div>
            <div className="grid grid-cols-2 gap-3"><label className={`block text-[10px] font-semibold uppercase tracking-wide ${muted}`}>Fecha base<input name="startDate" type="date" defaultValue={editing.recurrenceStartDate || getDueDate(editing) || toISODate(new Date())} className={`${field} mt-1.5 normal-case tracking-normal`}/></label><label className={`block text-[10px] font-semibold uppercase tracking-wide ${muted}`}>Frecuencia<select name="frequency" defaultValue={getFrequency(editing)} className={`${field} mt-1.5 normal-case tracking-normal`}><option value="">Sin recurrencia</option><option value="weekly">Semanal · cada 7 días</option><option value="biweekly">Quincenal · cada 15 días</option><option value="monthly">Mensual · mismo día</option></select></label></div>
            <p className={`mt-2 text-[10px] ${muted}`}>La siguiente fecha se calcula desde la fecha base; los meses cortos usan su último día disponible.</p>
            {typeof Notification !== 'undefined' && Notification.permission === 'default' && <button type="button" onClick={() => void Notification.requestPermission()} className="mt-2 text-[11px] font-semibold text-emerald-500 hover:underline">Activar notificaciones del navegador</button>}
          </div>
        </div>
        <div className={`flex gap-2 border-t p-4 ${dark ? 'border-white/5' : 'border-slate-100'}`}><button type="button" onClick={() => setEditing(null)} className={`flex-1 rounded-xl border px-3 py-2.5 text-xs font-semibold ${dark ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}><span className="inline-flex items-center gap-1"><X size={14}/> Cancelar</span></button><button type="submit" className="flex-1 rounded-xl bg-[#10B981] px-3 py-2.5 text-xs font-bold text-[#002113] hover:brightness-105"><span className="inline-flex items-center gap-1"><Check size={14}/> Guardar plantilla</span></button></div>
      </form>
    </div>}
  </section>;
};
