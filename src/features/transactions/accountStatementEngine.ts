import { Account, Category, FinancialPeriod, Subperiod, Transaction } from '../../core/types/models';
import { formatDateSlash, formatGTQ } from '../../core/utils/formatters';
import { recalculateAccountBalances } from './financialEngine';

export interface AccountStatementItem {
  account: Account;
  currentBalance: number; // Saldo actual real en vivo de la cuenta (en Cuentas)
  startingBalance: number; // Saldo al inicio del período
  totalIncome: number; // Ingresos del período
  totalExpense: number; // Gastos del período
  totalTransfersIn: number; // Transferencias recibidas (+)
  totalTransfersOut: number; // Transferencias enviadas (-)
  netMovement: number; // Variación neta en la cuenta durante el período
  endingBalance: number; // Saldo al corte final del período
  transactionCount: number;
  // Tarjetas de crédito
  creditLimit?: number;
  availableCredit?: number; // Crédito disponible actual
  debt?: number; // Deuda actual de la tarjeta
  paymentsReceived?: number; // Total pagos recibidos en el período
}

export interface StatementTransactionRow {
  transaction: Transaction;
  date: string;
  time?: string;
  type: Transaction['type'] | string;
  accountName: string;
  destinationAccountName?: string;
  categoryName: string;
  subcategoryName?: string;
  note: string;
  debitAmount: number | null; // Dinero que sale de la cuenta (-)
  creditAmount: number | null; // Dinero que entra a la cuenta (+)
  amount: number;
  isCreditCardPayment?: boolean;
}

export interface PeriodAccountStatementData {
  period: FinancialPeriod;
  subperiod?: Subperiod;
  dateRangeStr: string;
  generatedAt: string;
  userDisplayName?: string;
  totalIncome: number;
  totalExpense: number;
  netResult: number;
  totalTransfers: number;
  accountSummaries: AccountStatementItem[];
  transactions: StatementTransactionRow[];
}

/**
 * Construye los datos completos del estado de cuenta de un período.
 * Anclado al saldo actual real de cada cuenta y cuadrado matemáticamente.
 */
export function buildAccountStatementData(params: {
  period: FinancialPeriod;
  subperiodId?: string;
  accountIdFilter?: string; // 'all' o ID específico
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  userDisplayName?: string;
}): PeriodAccountStatementData {
  const {
    period,
    subperiodId,
    accountIdFilter = 'all',
    accounts,
    transactions,
    categories,
    userDisplayName,
  } = params;

  const subperiod = subperiodId
    ? period.subperiods.find((s) => s.id === subperiodId)
    : undefined;

  const startDate = subperiod ? subperiod.startDate : period.startDate;
  const endDate = subperiod ? subperiod.endDate : period.endDate;

  const dateRangeStr = `${formatDateSlash(startDate)} al ${formatDateSlash(endDate)}`;
  const now = new Date();
  const generatedAt = `${formatDateSlash(now.toISOString().slice(0, 10))} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // 1. Filtrar transacciones del período según rango de fechas estricto o vínculo directo
  const periodTxs = transactions.filter((t) => {
    if (subperiod) {
      if (t.subperiodId === subperiod.id) return true;
      return t.date >= subperiod.startDate && t.date <= subperiod.endDate;
    }
    if (t.periodId === period.id) return true;
    return t.date >= period.startDate && t.date <= period.endDate;
  });

  // Mapa de categorías para resolución rápida
  const catMap = new Map<string, { catName: string; subName?: string }>();
  for (const c of categories) {
    catMap.set(c.id, { catName: c.name });
    for (const s of c.subcategories || []) {
      catMap.set(`${c.id}_${s.id}`, { catName: c.name, subName: s.name });
    }
  }

  // Mapa de cuentas
  const accMap = new Map<string, Account>();
  for (const acc of accounts) {
    accMap.set(acc.id, acc);
  }

  // 2. Resúmenes por cuenta anclados al Saldo Actual real en vivo
  const activeAccounts = accounts.filter(
    (a) => a.status === 'active' && (accountIdFilter === 'all' || a.id === accountIdFilter)
  );

  const accountSummaries: AccountStatementItem[] = [];

  for (const acc of activeAccounts) {
    let totalIncome = 0;
    let totalExpense = 0;
    let totalTransfersIn = 0;
    let totalTransfersOut = 0;
    let txCount = 0;

    for (const tx of periodTxs) {
      const isOrigin = tx.accountId === acc.id || tx.originAccountId === acc.id;
      const isDest = tx.destinationAccountId === acc.id;

      if (!isOrigin && !isDest) continue;

      txCount++;

      if (tx.type === 'income' && isOrigin) {
        totalIncome += tx.amount;
      } else if (tx.type === 'expense' && isOrigin) {
        totalExpense += tx.amount;
      } else if (tx.type === 'transfer') {
        if (isOrigin) {
          totalTransfersOut += tx.amount;
        }
        if (isDest) {
          totalTransfersIn += tx.amount;
        }
      }
    }

    const netMovement = Math.round((totalIncome + totalTransfersIn - totalExpense - totalTransfersOut) * 100) / 100;

    // Calcular transacciones posteriores al período para conciliar saldo al corte
    const txsAfterPeriod = transactions.filter((tx) => {
      const isRelated = tx.accountId === acc.id || tx.originAccountId === acc.id || tx.destinationAccountId === acc.id;
      return isRelated && tx.date > endDate;
    });

    let subsequentNetChange = 0;
    for (const tx of txsAfterPeriod) {
      const isOrigin = tx.accountId === acc.id || tx.originAccountId === acc.id;
      const isDest = tx.destinationAccountId === acc.id;
      if (tx.type === 'income' && isOrigin) {
        subsequentNetChange += tx.amount;
      } else if (tx.type === 'expense' && isOrigin) {
        subsequentNetChange -= tx.amount;
      } else if (tx.type === 'transfer') {
        if (isOrigin) subsequentNetChange -= tx.amount;
        if (isDest) subsequentNetChange += tx.amount;
      }
    }

    // Saldo al corte final del período = Saldo actual - movimientos posteriores
    const endingBalance = Math.round((acc.currentBalance - subsequentNetChange) * 100) / 100;
    // Saldo inicial del período = Saldo al corte - variación neta del período
    const startingBalance = Math.round((endingBalance - netMovement) * 100) / 100;

    const liveBalance = Math.round(acc.currentBalance * 100) / 100;

    const item: AccountStatementItem = {
      account: acc,
      currentBalance: liveBalance,
      startingBalance,
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpense: Math.round(totalExpense * 100) / 100,
      totalTransfersIn: Math.round(totalTransfersIn * 100) / 100,
      totalTransfersOut: Math.round(totalTransfersOut * 100) / 100,
      netMovement,
      endingBalance,
      transactionCount: txCount,
    };

    if (acc.type === 'credit_card') {
      const limit = acc.creditLimit || 0;
      item.creditLimit = limit;
      item.debt = liveBalance < 0 ? Math.abs(liveBalance) : 0;
      item.availableCredit = Math.max(0, limit + liveBalance);
      item.paymentsReceived = Math.round(totalTransfersIn * 100) / 100;
    }

    accountSummaries.push(item);
  }

  // 3. Totales consolidados del período (Sin doble conteo de transferencias)
  let grandTotalIncome = 0;
  let grandTotalExpense = 0;
  let grandTotalTransfers = 0;

  for (const tx of periodTxs) {
    if (tx.type === 'income') {
      grandTotalIncome += tx.amount;
    } else if (tx.type === 'expense') {
      grandTotalExpense += tx.amount;
    } else if (tx.type === 'transfer') {
      grandTotalTransfers += tx.amount;
    }
  }

  // 5. Filas de transacciones detalladas
  // Si hay filtro de cuenta, filtrar transacciones pertenecientes a esa cuenta
  const filteredTxs = periodTxs.filter((tx) => {
    if (accountIdFilter === 'all') return true;
    return (
      tx.accountId === accountIdFilter ||
      tx.originAccountId === accountIdFilter ||
      tx.destinationAccountId === accountIdFilter
    );
  });

  // Ordenar cronológicamente (más antiguo a más reciente para extracto bancario)
  const sortedTxs = [...filteredTxs].sort((a, b) => {
    const keyA = `${a.date}T${a.time || '00:00'}|${a.createdAt}`;
    const keyB = `${b.date}T${b.time || '00:00'}|${b.createdAt}`;
    return keyA.localeCompare(keyB);
  });

  const transactionRows: StatementTransactionRow[] = sortedTxs.map((tx) => {
    const originAcc = accMap.get(tx.originAccountId || tx.accountId || '');
    const destAcc = tx.destinationAccountId ? accMap.get(tx.destinationAccountId) : undefined;

    const catKey = tx.categoryId ? (tx.subcategoryId ? `${tx.categoryId}_${tx.subcategoryId}` : tx.categoryId) : '';
    const catInfo = catKey ? catMap.get(catKey) : undefined;
    const directCat = tx.categoryId ? catMap.get(tx.categoryId) : undefined;

    const categoryName = catInfo?.catName || directCat?.catName || (tx.type === 'transfer' ? 'Transferencia' : 'Sin categoría');
    const subcategoryName = catInfo?.subName;

    let debitAmount: number | null = null;
    let creditAmount: number | null = null;

    if (tx.type === 'expense') {
      debitAmount = tx.amount;
    } else if (tx.type === 'income') {
      creditAmount = tx.amount;
    } else if (tx.type === 'transfer') {
      if (accountIdFilter !== 'all') {
        // En vista de cuenta específica:
        if (tx.originAccountId === accountIdFilter || tx.accountId === accountIdFilter) {
          debitAmount = tx.amount;
        } else if (tx.destinationAccountId === accountIdFilter) {
          creditAmount = tx.amount;
        }
      } else {
        // En vista global, mostrar débito de origen y crédito a destino
        debitAmount = tx.amount;
        creditAmount = tx.amount;
      }
    }

    return {
      transaction: tx,
      date: tx.date,
      time: tx.time,
      type: tx.type,
      accountName: originAcc?.name || 'Cuenta',
      destinationAccountName: destAcc?.name,
      categoryName,
      subcategoryName,
      note: tx.note || '',
      debitAmount,
      creditAmount,
      amount: tx.amount,
      isCreditCardPayment: tx.isCreditCardPayment,
    };
  });

  return {
    period,
    subperiod,
    dateRangeStr,
    generatedAt,
    userDisplayName,
    totalIncome: Math.round(grandTotalIncome * 100) / 100,
    totalExpense: Math.round(grandTotalExpense * 100) / 100,
    netResult: Math.round((grandTotalIncome - grandTotalExpense) * 100) / 100,
    totalTransfers: Math.round(grandTotalTransfers * 100) / 100,
    accountSummaries,
    transactions: transactionRows,
  };
}

/**
 * Escapa valores para CSV compatible con Excel y RFC 4180
 */
function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes(';')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Exporta el estado de cuenta a un archivo CSV profesional multisección.
 */
export function exportStatementToCSV(data: PeriodAccountStatementData): void {
  const lines: string[] = [];

  // 1. ENCABEZADO
  lines.push('ESTADO DE CUENTA - WALLET');
  lines.push(`Período,${escapeCsv(data.period.name)}${data.subperiod ? ` - ${escapeCsv(data.subperiod.name)}` : ''}`);
  lines.push(`Rango de Fechas,${escapeCsv(data.dateRangeStr)}`);
  lines.push(`Fecha de Emisión,${escapeCsv(data.generatedAt)}`);
  if (data.userDisplayName) {
    lines.push(`Titular,${escapeCsv(data.userDisplayName)}`);
  }
  lines.push('Moneda,"Quetzales (GTQ)"');
  lines.push('');

  // 2. RESUMEN FINANCIERO DEL PERÍODO
  lines.push('RESUMEN FINANCIERO DEL PERÍODO');
  lines.push(`Total Ingresos,${escapeCsv(formatGTQ(data.totalIncome))}`);
  lines.push(`Total Gastos,${escapeCsv(formatGTQ(data.totalExpense))}`);
  lines.push(`Balance Neto,${escapeCsv(formatGTQ(data.netResult))}`);
  lines.push(`Total Transferencias,${escapeCsv(formatGTQ(data.totalTransfers))}`);
  lines.push(`Movimientos en Período,${escapeCsv(data.transactions.length)}`);
  lines.push('');

  // 3. RESUMEN CONSOLIDADO POR CUENTA
  lines.push('RESUMEN POR CUENTA');
  lines.push([
    escapeCsv('Cuenta'),
    escapeCsv('Tipo'),
    escapeCsv('Saldo Actual (en Vivo)'),
    escapeCsv('Saldo Inicial Período'),
    escapeCsv('Entradas (+)'),
    escapeCsv('Salidas (-)'),
    escapeCsv('Flujo Neto Período'),
    escapeCsv('Saldo Final Período'),
    escapeCsv('Límite Crédito'),
    escapeCsv('Deuda Tarjeta'),
    escapeCsv('Crédito Disponible'),
  ].join(','));

  for (const s of data.accountSummaries) {
    const typeLabel =
      s.account.type === 'credit_card'
        ? 'Tarjeta de Crédito'
        : s.account.type === 'bank'
        ? 'Banco'
        : s.account.type === 'cash'
        ? 'Efectivo'
        : 'Ahorro';

    const inflows = s.totalIncome + s.totalTransfersIn;
    const outflows = s.totalExpense + s.totalTransfersOut;

    lines.push([
      escapeCsv(s.account.name),
      escapeCsv(typeLabel),
      escapeCsv(formatGTQ(s.currentBalance)),
      escapeCsv(formatGTQ(s.startingBalance)),
      escapeCsv(formatGTQ(inflows)),
      escapeCsv(formatGTQ(outflows)),
      escapeCsv(formatGTQ(s.netMovement)),
      escapeCsv(formatGTQ(s.endingBalance)),
      escapeCsv(s.creditLimit !== undefined ? formatGTQ(s.creditLimit) : '-'),
      escapeCsv(s.debt !== undefined ? formatGTQ(s.debt) : '-'),
      escapeCsv(s.availableCredit !== undefined ? formatGTQ(s.availableCredit) : '-'),
    ].join(','));
  }
  lines.push('');

  // 4. DETALLE CRONOLÓGICO DE TRANSACCIONES
  lines.push('DETALLE CRONOLÓGICO DE TRANSACCIONES');
  lines.push([
    escapeCsv('Fecha'),
    escapeCsv('Hora'),
    escapeCsv('Tipo'),
    escapeCsv('Cuenta'),
    escapeCsv('Destino Transferencia'),
    escapeCsv('Categoría'),
    escapeCsv('Subcategoría'),
    escapeCsv('Descripción/Nota'),
    escapeCsv('Débito (-)'),
    escapeCsv('Crédito (+)'),
    escapeCsv('Monto Neto'),
  ].join(','));

  for (const row of data.transactions) {
    const typeLabel =
      row.type === 'expense'
        ? 'Gasto'
        : row.type === 'income'
        ? 'Ingreso'
        : row.isCreditCardPayment
        ? 'Pago de Tarjeta'
        : 'Transferencia';

    const debitStr = row.debitAmount !== null ? formatGTQ(row.debitAmount) : '';
    const creditStr = row.creditAmount !== null ? formatGTQ(row.creditAmount) : '';
    const netSign = row.type === 'expense' ? `-${formatGTQ(row.amount)}` : row.type === 'income' ? `+${formatGTQ(row.amount)}` : formatGTQ(row.amount);

    lines.push([
      escapeCsv(formatDateSlash(row.date)),
      escapeCsv(row.time || ''),
      escapeCsv(typeLabel),
      escapeCsv(row.accountName),
      escapeCsv(row.destinationAccountName || '-'),
      escapeCsv(row.categoryName),
      escapeCsv(row.subcategoryName || '-'),
      escapeCsv(row.note || '-'),
      escapeCsv(debitStr),
      escapeCsv(creditStr),
      escapeCsv(netSign),
    ].join(','));
  }

  // Descarga con UTF-8 BOM (\uFEFF) para compatibilidad completa con Microsoft Excel
  const csvBlob = new Blob(['\uFEFF' + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });

  const url = URL.createObjectURL(csvBlob);
  const link = document.createElement('a');
  link.setAttribute('href', url);

  const cleanPeriodName = data.period.name.replace(/[^\w\d-_]/g, '_');
  const cleanSubName = data.subperiod ? `_${data.subperiod.name.replace(/[^\w\d-_]/g, '_')}` : '';
  link.setAttribute('download', `Estado_de_Cuenta_${cleanPeriodName}${cleanSubName}.csv`);

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
