import { PseudonymizedFinancialContext } from './chatContextEngine';
import { SuggestedTransactionDraft } from './chatStorage';

export interface LocalAdvisorResponse {
  reply: string;
  suggestedTransaction?: SuggestedTransactionDraft;
}

/**
 * Motor heurístico financiero determinista local (Contingencia offline / alta resiliencia).
 * Permite que el Asistente Financiero responda al instante en Quetzales (GTQ) incluso si
 * la red está inactiva, la conexión falla o el servidor responde con un error no-JSON.
 */
export function generateLocalFinancialAssistantReply(
  userPrompt: string,
  ctx: PseudonymizedFinancialContext
): LocalAdvisorResponse {
  const promptLower = userPrompt.toLowerCase().trim();

  // 1. Detectar si el usuario quiere registrar una transacción
  const txDraft = tryParseTransactionIntent(userPrompt, ctx);
  if (txDraft) {
    const typeLabel = txDraft.type === 'income' ? 'ingreso' : 'gasto';
    return {
      reply: `He preparado el borrador de este **${typeLabel} de Q${txDraft.amount.toFixed(2)}** en concepto de *${txDraft.concept}*. Puedes confirmarlo con un toque en el botón de abajo o editarlo si deseas afinar detalles:`,
      suggestedTransaction: txDraft,
    };
  }

  // 2. Consulta sobre estado del presupuesto o progreso del mes
  if (
    promptLower.includes('presupuesto') ||
    promptLower.includes('cómo voy') ||
    promptLower.includes('como voy') ||
    promptLower.includes('mis gastos') ||
    promptLower.includes('resumen')
  ) {
    const pct = ctx.budgetProgressPct || 0;
    const net = ctx.netSavings || 0;
    const statusText =
      pct > 90
        ? '⚠️ **Alerta:** Has consumido más del 90% de tu presupuesto proyectado para este corte.'
        : pct > 70
        ? 'ℹ️ **Ritmo moderado:** Llevas un avance considerable de tu presupuesto.'
        : '✅ **Excelente:** Tus egresos se mantienen bajo control dentro de los límites planificados.';

    let topCatText = '';
    if (ctx.topExpenseCategories && ctx.topExpenseCategories.length > 0) {
      const top = ctx.topExpenseCategories[0];
      topCatText = `\n\nTu categoría con mayor consumo es **${top.categoryName}** con Q${top.spent.toFixed(2)} ejecutados.`;
    }

    return {
      reply: `En tu **${ctx.periodName}** (${ctx.periodDates}):\n\n` +
        `• **Ingresos registrados:** Q${ctx.totalIncome.toFixed(2)}\n` +
        `• **Gastos acumulados:** Q${ctx.totalExpenses.toFixed(2)}\n` +
        `• **Flujo neto / Ahorro:** Q${net.toFixed(2)}\n` +
        `• **Ejecución presupuestaria:** ${pct}%\n\n` +
        `${statusText}${topCatText}\n\n` +
        `*Consejo:* Si vas a realizar compras discrecionales, prioriza liquidar primero tarjetas de crédito antes de su fecha de corte.`,
    };
  }

  // 3. Consulta sobre tarjetas de crédito
  if (
    promptLower.includes('tarjeta') ||
    promptLower.includes('deuda') ||
    promptLower.includes('corte')
  ) {
    return {
      reply: `Sobre tus cuentas y tarjetas registradas:\n\n` +
        `• **Estado consolidado:** ${ctx.accountsSummary}.\n\n` +
        `*Táctica recomendada:* Para maximizar el financiamiento sin intereses, realiza compras fuertes los días inmediatamente posteriores a la fecha de corte de tu tarjeta, y siempre liquida el saldo de contado antes de la fecha de pago para evitar intereses por financiamiento.`,
    };
  }

  // 4. Consulta sobre categorías de gasto
  if (
    promptLower.includes('categoría') ||
    promptLower.includes('categoria') ||
    promptLower.includes('en qué gasté') ||
    promptLower.includes('en que gaste') ||
    promptLower.includes('más gasto')
  ) {
    if (!ctx.topExpenseCategories || ctx.topExpenseCategories.length === 0) {
      return {
        reply: `Actualmente no hay egresos clasificados en el período activo (${ctx.periodName}). Puedes pedirme que anote una compra (ejemplo: *"Anota Q50 de almuerzo"*) para comenzar a registrar tu actividad.`,
      };
    }

    const items = ctx.topExpenseCategories
      .slice(0, 4)
      .map((c) => `• **${c.categoryName}:** Q${c.spent.toFixed(2)} (Meta: Q${c.budget.toFixed(2)})`)
      .join('\n');

    return {
      reply: `Estas son las categorías con mayor volumen de gasto en **${ctx.periodName}**:\n\n` +
        `${items}\n\n` +
        `*Tip:* Revisa si los rubros flexibles pueden reducirse para aumentar tu tasa de ahorro antes del fin de mes.`,
    };
  }

  // 5. Saludo o respuesta general
  return {
    reply: `¡Hola! Con gusto te apoyo analizando tus finanzas en Quetzales.\n\n` +
      `En este momento tienes **${ctx.periodName}** en curso con **Q${ctx.netSavings.toFixed(2)}** de flujo neto y ${ctx.budgetProgressPct}% de presupuesto consumido.\n\n` +
      `Puedes preguntarme:\n` +
      `• *"¿Cómo voy con mi presupuesto este mes?"*\n` +
      `• *"¿En qué categoría he gastado más?"*\n` +
      `• *"Anota Q75 de almuerzo en efectivo"* para preparar un borrador al instante.`,
  };
}

/**
 * Analiza el texto para detectar montos y conceptos de transacciones
 */
function tryParseTransactionIntent(
  text: string,
  ctx: PseudonymizedFinancialContext
): SuggestedTransactionDraft | null {
  const t = text.toLowerCase();

  // Comprobar palabras clave de acción transaccional
  const hasActionKeyword =
    t.includes('gasta') ||
    t.includes('gasté') ||
    t.includes('gaste') ||
    t.includes('compr') ||
    t.includes('anota') ||
    t.includes('registra') ||
    t.includes('paga') ||
    t.includes('pagué') ||
    t.includes('ingres') ||
    t.includes('cobré') ||
    t.includes('cobre') ||
    t.includes('recibí');

  // Buscar monto numérico (ej. Q50, Q 100.50, 75 quetzales, 50.00)
  const amountMatch =
    text.match(/[qQ]\s*([0-9]+([.,][0-9]{1,2})?)/) ||
    text.match(/([0-9]+([.,][0-9]{1,2})?)\s*(quetzales|gtq)/i) ||
    (hasActionKeyword ? text.match(/\b([0-9]+([.,][0-9]{1,2})?)\b/) : null);

  if (!amountMatch) return null;

  const rawNum = amountMatch[1].replace(',', '.');
  const amount = parseFloat(rawNum);
  if (isNaN(amount) || amount <= 0) return null;

  const isIncome =
    t.includes('ingreso') ||
    t.includes('cobré') ||
    t.includes('cobre') ||
    t.includes('recibí') ||
    t.includes('nómina') ||
    t.includes('sueldo') ||
    t.includes('salario');

  // Inferir concepto
  let concept = 'Movimiento registrado';
  if (t.includes('almuerzo') || t.includes('comida') || t.includes('cena') || t.includes('desayuno')) {
    concept = 'Alimentación';
  } else if (t.includes('gasolina') || t.includes('combustible') || t.includes('uber') || t.includes('transporte')) {
    concept = 'Transporte / Combustible';
  } else if (t.includes('super') || t.includes('despensa') || t.includes('mercado')) {
    concept = 'Supermercado';
  } else if (t.includes('café') || t.includes('cafe')) {
    concept = 'Café';
  } else if (t.includes('farmacia') || t.includes('medicina')) {
    concept = 'Farmacia / Salud';
  } else if (isIncome) {
    concept = 'Ingreso recibido';
  }

  // Intentar asociar con categoría disponible
  let categoryName = isIncome ? 'Ingresos' : 'Varios';
  if (ctx.categoriesList && ctx.categoriesList.length > 0) {
    const matched = ctx.categoriesList.find((c) =>
      concept.toLowerCase().includes(c.toLowerCase()) ||
      t.includes(c.toLowerCase())
    );
    if (matched) categoryName = matched;
  }

  // Intentar asociar con cuenta disponible
  let accountName = 'Efectivo';
  if (ctx.liquidAccountsList && ctx.liquidAccountsList.length > 0) {
    const matchedAcc = ctx.liquidAccountsList.find((a) =>
      t.includes(a.name.toLowerCase())
    );
    accountName = matchedAcc ? matchedAcc.name : ctx.liquidAccountsList[0].name;
  }

  return {
    type: isIncome ? 'income' : 'expense',
    amount: Math.round(amount * 100) / 100,
    concept,
    categoryName,
    accountName,
  };
}
