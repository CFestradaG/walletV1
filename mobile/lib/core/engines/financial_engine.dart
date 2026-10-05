import '../models/models.dart';

double roundMoney(num value) => (value * 100).roundToDouble() / 100;

class PortfolioTotals {
  const PortfolioTotals({required this.available, required this.debt, required this.net});
  final double available;
  final double debt;
  final double net;
}

PortfolioTotals calculatePortfolioTotals(List<Account> accounts) {
  var available = 0.0;
  var debt = 0.0;
  for (final account in accounts.where((item) => !item.isArchived)) {
    if (account.isCreditCard) {
      if (account.currentBalance < 0) debt += account.currentBalance.abs();
    } else {
      available += account.currentBalance;
    }
  }
  available = roundMoney(available);
  debt = roundMoney(debt);
  return PortfolioTotals(available: available, debt: debt, net: roundMoney(available - debt));
}

List<Account> applyTransactionToAccounts(WalletTransaction tx, List<Account> accounts,
    {bool reverse = false}) {
  final direction = reverse ? -1.0 : 1.0;
  return accounts.map((account) {
    var delta = 0.0;
    if (tx.type == TransactionType.expense && account.id == tx.accountId) {
      delta = -tx.amount;
    } else if (tx.type == TransactionType.income && account.id == tx.accountId) {
      delta = tx.amount;
    } else if (tx.type == TransactionType.transfer) {
      if (account.id == (tx.originAccountId ?? tx.accountId)) delta = -tx.amount;
      if (account.id == tx.destinationAccountId) delta = tx.amount;
    }
    if (delta == 0) return account;
    return Account(
      id: account.id, userId: account.userId, name: account.name, subtitle: account.subtitle,
      type: account.type, currency: account.currency, initialBalance: account.initialBalance,
      currentBalance: roundMoney(account.currentBalance + delta * direction),
      creditLimit: account.creditLimit, status: account.status, icon: account.icon,
      color: account.color, cutoffDay: account.cutoffDay, paymentDueDay: account.paymentDueDay,
      createdAt: account.createdAt, updatedAt: DateTime.now().toIso8601String(),
    );
  }).toList();
}

String? validateTransaction({
  required String userId,
  required TransactionType type,
  required double amount,
  required String date,
  required List<Account> accounts,
  required List<Category> categories,
  required String? accountId,
  required String? categoryId,
  required String? originAccountId,
  required String? destinationAccountId,
}) {
  if (amount <= 0 || !amount.isFinite) return 'El monto debe ser mayor que cero.';
  final parsed = DateTime.tryParse(date);
  if (parsed == null || parsed.toIso8601String().substring(0, 10) != date) {
    return 'La fecha no es válida.';
  }
  Account? active(String? id) => accounts.where((a) => a.id == id && a.userId == userId && !a.isArchived).firstOrNull;
  if (type == TransactionType.transfer) {
    final from = originAccountId ?? accountId;
    if (from == null || destinationAccountId == null) return 'Selecciona las cuentas de origen y destino.';
    if (from == destinationAccountId) return 'Las cuentas deben ser distintas.';
    if (active(from) == null || active(destinationAccountId) == null) return 'Selecciona cuentas activas.';
    return null;
  }
  final account = active(accountId);
  if (account == null) return 'Selecciona una cuenta activa.';
  if (categoryId == null || !categories.any((c) => c.id == categoryId && c.userId == userId && c.type.name == type.name && c.isActive)) {
    return 'Selecciona una categoría válida.';
  }
  if (type == TransactionType.expense && account.isCreditCard && account.creditLimit != null && account.creditLimit! > 0) {
    if (account.currentBalance.abs() + amount > account.creditLimit!) {
      return 'El gasto supera el crédito disponible de ${account.name}.';
    }
  }
  return null;
}

class PeriodSummary {
  const PeriodSummary({required this.income, required this.expense, required this.transfers, required this.count});
  final double income, expense, transfers;
  final int count;
  double get net => roundMoney(income - expense);
}

PeriodSummary summarizeTransactions(List<WalletTransaction> transactions, {FinancialPeriod? period}) {
  final rows = period == null ? transactions : transactions.where((tx) => tx.date.compareTo(period.startDate) >= 0 && tx.date.compareTo(period.endDate) <= 0).toList();
  var income = 0.0, expense = 0.0, transfers = 0.0;
  for (final tx in rows) {
    if (tx.type == TransactionType.income) {
      income += tx.amount;
    } else if (tx.type == TransactionType.expense) {
      expense += tx.amount;
    } else {
      transfers += tx.amount;
    }
  }
  return PeriodSummary(income: roundMoney(income), expense: roundMoney(expense), transfers: roundMoney(transfers), count: rows.length);
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
