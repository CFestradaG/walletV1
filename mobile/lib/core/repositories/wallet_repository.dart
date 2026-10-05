import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../engines/period_engine.dart';
import '../engines/financial_engine.dart';
import '../firebase/firebase_providers.dart';
import '../models/models.dart';

class WalletRepository {
  WalletRepository(this._db);
  final FirebaseFirestore _db;

  DocumentReference<Map<String, dynamic>> userDoc(String uid) => _db.collection('users').doc(uid);
  CollectionReference<Map<String, dynamic>> _col(String uid, String name) => userDoc(uid).collection(name);
  String newAccountId(String uid) => _col(uid, 'accounts').doc().id;

  Stream<List<T>> _watch<T>(String uid, String col, T Function(Map<String, dynamic>, String) f) =>
      _col(uid, col).snapshots().map((s) => s.docs.map((d) => f(d.data(), d.id)).toList());

  Stream<List<Account>> watchAccounts(String uid) => _watch(uid, 'accounts', Account.fromMap);
  Stream<List<Category>> watchCategories(String uid) => _watch(uid, 'categories', Category.fromMap);
  Stream<List<FinancialPeriod>> watchPeriods(String uid) => _watch(uid, 'periods', FinancialPeriod.fromMap);
  Stream<List<WalletTransaction>> watchTransactions(String uid) => _watch(uid, 'transactions', WalletTransaction.fromMap);
  Stream<List<Budget>> watchBudgets(String uid) => _watch(uid, 'budgets', Budget.fromMap);

  Stream<UserSettings> watchSettings(String uid) => _col(uid, 'settings').doc('default').snapshots().map((s) =>
      s.exists ? UserSettings.fromMap(s.data()!) : UserSettings(userId: uid));

  Future<void> ensureUserProfile(UserProfile profile) async {
    await userDoc(profile.id).set(profile.toMap(), SetOptions(merge: true));
  }

  /// Crea categorías, período y ajustes iniciales sin duplicar lo que ya tenga la web.
  Future<void> seedUser(UserProfile profile) async {
    final uid = profile.id;
    final root = userDoc(uid);
    final categoryCol = _col(uid, 'categories');
    final periodCol = _col(uid, 'periods');
    final settingsRef = _col(uid, 'settings').doc('default');
    final profileSnap = await root.get();
    final categoriesSnap = await categoryCol.get();
    final periodsSnap = await periodCol.get();
    final settingsSnap = await settingsRef.get();
    final batch = _db.batch();
    var hasWrites = false;
    if (!profileSnap.exists) {
      batch.set(root, profile.toMap());
      hasWrites = true;
    }
    if (categoriesSnap.docs.isEmpty) {
      for (final category in _defaultCategories(uid)) {
        batch.set(categoryCol.doc(category.id), category.toMap());
        hasWrites = true;
      }
    }
    var activePeriodId = '';
    if (periodsSnap.docs.isEmpty) {
      final now = DateTime.now();
      final start = DateTime(now.year, now.month, 1);
      final end = DateTime(now.year, now.month + 1, 0);
      activePeriodId = 'per_${now.year}${now.month.toString().padLeft(2, '0')}_$uid';
      final startIso = isoDate(start), endIso = isoDate(end);
      final period = FinancialPeriod(
        id: activePeriodId, userId: uid, name: monthName(now.month), referenceMonth: now.month,
        startDate: startIso, endDate: endIso, subdivisionMode: SubdivisionMode.monthly,
        status: 'active', isActive: true,
        subperiods: generateSubperiods(activePeriodId, startIso, endIso, SubdivisionMode.monthly),
        createdAt: now.toIso8601String(), updatedAt: now.toIso8601String(),
      );
      batch.set(periodCol.doc(period.id), period.toMap());
      hasWrites = true;
    } else {
      final active = periodsSnap.docs.where((d) => d.data()['isActive'] == true).firstOrNull;
      activePeriodId = active?.id ?? periodsSnap.docs.first.id;
    }
    if (!settingsSnap.exists) {
      batch.set(settingsRef, UserSettings(userId: uid, activePeriodId: activePeriodId.isEmpty ? null : activePeriodId).toMap());
      hasWrites = true;
    }
    if (hasWrites) await batch.commit();
  }

  List<Category> _defaultCategories(String uid) {
    const definitions = <(String, String, CategoryType, String, String, List<(String, String)>)>[
      ('food', 'Alimentación', CategoryType.expense, '🍔', '#10B981', [('sub_rest', 'Restaurantes'), ('sub_super', 'Supermercado')]),
      ('trans', 'Transporte', CategoryType.expense, '🚗', '#0284C7', [('sub_fuel', 'Gasolina'), ('sub_taxi', 'Uber / Taxi')]),
      ('home', 'Vivienda', CategoryType.expense, '🏠', '#8B5CF6', [('sub_rent', 'Renta / Hipoteca')]),
      ('health', 'Salud', CategoryType.expense, '❤️', '#F43F5E', [('sub_meds', 'Farmacia')]),
      ('edu', 'Educación', CategoryType.expense, '📚', '#F59E0B', [('sub_books', 'Libros')]),
      ('other', 'Otros', CategoryType.expense, '📦', '#64748B', [('sub_unf', 'Imprevistos')]),
      ('salary', 'Salario', CategoryType.income, '💵', '#10B981', [('sub_sal_m', 'Nómina mensual')]),
      ('other_inc', 'Otros ingresos', CategoryType.income, '💰', '#0EA5E9', [('sub_inc_ref', 'Reembolsos')]),
    ];
    return definitions.map((d) {
      final id = 'cat_${d.$1}_$uid';
      return Category(
        id: id, userId: uid, name: d.$2, type: d.$3, icon: d.$4, color: d.$5,
        subcategories: d.$6.map((sub) => Subcategory(
          id: '${sub.$1}_$uid', categoryId: id, name: sub.$2, icon: '•',
        )).toList(),
      );
    }).toList();
  }

  Future<void> saveSettings(UserSettings settings) => _col(settings.userId, 'settings').doc('default').set(settings.toMap(), SetOptions(merge: true));
  Future<void> saveAccount(Account account) async {
    final ref = _col(account.userId, 'accounts').doc(account.id);
    await _db.runTransaction((transaction) async {
      final existing = await transaction.get(ref);
      final latestBalance = existing.exists
          ? Account.fromMap(existing.data()!, existing.id).currentBalance
          : account.currentBalance;
      transaction.set(ref, Account(
        id: account.id, userId: account.userId, name: account.name,
        subtitle: account.subtitle, type: account.type, currency: account.currency,
        initialBalance: account.initialBalance, currentBalance: latestBalance,
        creditLimit: account.creditLimit, status: account.status, icon: account.icon,
        color: account.color, cutoffDay: account.cutoffDay,
        paymentDueDay: account.paymentDueDay, createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      ).toMap());
    });
  }
  Future<void> saveCategory(Category category) => _col(category.userId, 'categories').doc(category.id).set(category.toMap());
  Future<void> saveBudget(Budget budget) => _col(budget.userId, 'budgets').doc(budget.id).set(budget.toMap());
  Future<void> deleteBudget(String userId, String id) => _col(userId, 'budgets').doc(id).delete();
  Future<void> savePeriod(FinancialPeriod period) => _col(period.userId, 'periods').doc(period.id).set(period.toMap());
  Future<void> deletePeriod(String userId, String id) => _col(userId, 'periods').doc(id).delete();

  Future<void> selectActivePeriod(String uid, List<FinancialPeriod> periods, String periodId, UserSettings settings) async {
    final batch = _db.batch();
    for (final period in periods) {
      final active = period.id == periodId;
      batch.set(_col(uid, 'periods').doc(period.id), _periodWithActive(period, active).toMap());
    }
    batch.set(_col(uid, 'settings').doc('default'), _settingsWithActive(settings, periodId).toMap(), SetOptions(merge: true));
    await batch.commit();
  }

  Future<void> savePeriodAndMaybeActivate(FinancialPeriod period, {required bool activate, required List<FinancialPeriod> existing, required UserSettings settings}) async {
    final batch = _db.batch();
    for (final old in existing) {
      if (activate && old.isActive) batch.set(_col(period.userId, 'periods').doc(old.id), _periodWithActive(old, false).toMap());
    }
    final next = _periodWithActive(period, activate || period.isActive);
    batch.set(_col(period.userId, 'periods').doc(next.id), next.toMap());
    if (activate) batch.set(_col(period.userId, 'settings').doc('default'), _settingsWithActive(settings, next.id).toMap(), SetOptions(merge: true));
    await batch.commit();
    await _syncTransactionPeriodRefs(period.userId, [
      ...existing.where((item) => item.id != period.id),
      next,
    ]);
  }

  Future<void> deletePeriodAndSelectNext(String uid, FinancialPeriod deleted, FinancialPeriod? next, List<FinancialPeriod> periods, UserSettings settings) async {
    final batch = _db.batch();
    batch.delete(_col(uid, 'periods').doc(deleted.id));
    final orphanedBudgets = await _col(uid, 'budgets').where('periodId', isEqualTo: deleted.id).get();
    for (final budget in orphanedBudgets.docs) {
      batch.delete(budget.reference);
    }
    if (next != null) {
      for (final period in periods) {
        if (period.id == deleted.id) continue;
        batch.set(_col(uid, 'periods').doc(period.id), _periodWithActive(period, period.id == next.id).toMap());
      }
      batch.set(_col(uid, 'settings').doc('default'), _settingsWithActive(settings, next.id).toMap(), SetOptions(merge: true));
    }
    await batch.commit();
    await _syncTransactionPeriodRefs(uid, periods.where((p) => p.id != deleted.id).toList());
  }

  Future<void> _syncTransactionPeriodRefs(String uid, List<FinancialPeriod> periods) async {
    final snapshot = await _col(uid, 'transactions').get();
    var batch = _db.batch();
    var writes = 0;
    for (final document in snapshot.docs) {
      final tx = WalletTransaction.fromMap(document.data(), document.id);
      final resolved = resolvePeriod(tx.date, periods);
      if (tx.periodId == resolved.period?.id && tx.subperiodId == resolved.subperiod?.id) continue;
      final updated = WalletTransaction(
        id: tx.id, userId: tx.userId, type: tx.type, amount: tx.amount,
        currency: tx.currency, accountId: tx.accountId, categoryId: tx.categoryId,
        subcategoryId: tx.subcategoryId, originAccountId: tx.originAccountId,
        destinationAccountId: tx.destinationAccountId, isCreditCardPayment: tx.isCreditCardPayment,
        date: tx.date, time: tx.time, note: tx.note, periodId: resolved.period?.id,
        subperiodId: resolved.subperiod?.id, createdAt: tx.createdAt, updatedAt: DateTime.now().toIso8601String(),
      );
      batch.set(document.reference, updated.toMap());
      writes++;
      if (writes == 450) {
        await batch.commit();
        batch = _db.batch();
        writes = 0;
      }
    }
    if (writes > 0) await batch.commit();
  }

  Future<void> resetFinancialData(UserProfile profile, UserSettings preferences) async {
    const names = ['settings', 'accounts', 'categories', 'periods', 'transactions', 'budgets'];
    final uid = profile.id;
    final snapshots = <QuerySnapshot<Map<String, dynamic>>>[];
    for (final name in names) {
      snapshots.add(await _col(uid, name).get());
    }
    var batch = _db.batch();
    var count = 0;
    for (final snapshot in snapshots) {
      for (final document in snapshot.docs) {
        batch.delete(document.reference);
        count++;
        if (count == 450) {
          await batch.commit();
          batch = _db.batch();
          count = 0;
        }
      }
    }
    if (count > 0) await batch.commit();
    await seedUser(profile);
    final periods = await _col(uid, 'periods').get();
    final active = periods.docs.where((d) => d.data()['isActive'] == true).firstOrNull;
    final restoredSettings = UserSettings(
      userId: uid, currency: preferences.currency,
      currencySymbolPosition: preferences.currencySymbolPosition,
      decimalPlaces: preferences.decimalPlaces, themeMode: preferences.themeMode,
      hideBalances: preferences.hideBalances, activePeriodId: active?.id,
    );
    await saveSettings(restoredSettings);
  }

  Future<void> deleteAccount(String userId, String id) async {
    await _col(userId, 'accounts').doc(id).delete();
  }

  Future<void> archiveAccount(Account account) => saveAccount(Account(
    id: account.id, userId: account.userId, name: account.name, subtitle: account.subtitle,
    type: account.type, currency: account.currency, initialBalance: account.initialBalance,
    currentBalance: account.currentBalance, creditLimit: account.creditLimit, status: 'archived',
    icon: account.icon, color: account.color, cutoffDay: account.cutoffDay,
    paymentDueDay: account.paymentDueDay, createdAt: account.createdAt,
    updatedAt: DateTime.now().toIso8601String(),
  ));

  /// La transacción y los saldos quedan en el mismo lote (máximo 500 escrituras).
  Future<void> saveTransaction({
    required WalletTransaction transaction,
  }) async {
    final uid = transaction.userId;
    final txRef = _col(uid, 'transactions').doc(transaction.id);
    final categoriesSnapshot = await _col(uid, 'categories').get();
    final categories = categoriesSnapshot.docs
        .map((item) => Category.fromMap(item.data(), item.id))
        .toList();
    await _db.runTransaction((firestoreTransaction) async {
      final previousSnapshot = await firestoreTransaction.get(txRef);
      final previous = previousSnapshot.exists
          ? WalletTransaction.fromMap(previousSnapshot.data()!, previousSnapshot.id)
          : null;
      final ids = <String>{};
      void collect(WalletTransaction? tx) {
        if (tx == null) return;
        if (tx.accountId != null) ids.add(tx.accountId!);
        if (tx.originAccountId != null) ids.add(tx.originAccountId!);
        if (tx.destinationAccountId != null) ids.add(tx.destinationAccountId!);
      }
      collect(previous);
      collect(transaction);
      final refs = ids.map((id) => _col(uid, 'accounts').doc(id)).toList();
      final snapshots = <DocumentSnapshot<Map<String, dynamic>>>[];
      for (final ref in refs) {
        snapshots.add(await firestoreTransaction.get(ref));
      }
      var accounts = <Account>[];
      for (final snapshot in snapshots) {
        if (snapshot.exists) accounts.add(Account.fromMap(snapshot.data()!, snapshot.id));
      }
      if (previous != null) accounts = applyTransactionToAccounts(previous, accounts, reverse: true);
      final error = validateTransaction(
        userId: uid, type: transaction.type, amount: transaction.amount,
        date: transaction.date, accounts: accounts, categories: categories,
        accountId: transaction.accountId, categoryId: transaction.categoryId,
        subcategoryId: transaction.subcategoryId,
        originAccountId: transaction.originAccountId,
        destinationAccountId: transaction.destinationAccountId,
      );
      if (error != null) throw StateError(error);
      accounts = applyTransactionToAccounts(transaction, accounts);
      firestoreTransaction.set(txRef, transaction.toMap());
      for (final account in accounts) {
        firestoreTransaction.set(_col(uid, 'accounts').doc(account.id), account.toMap());
      }
    });
  }

  Future<void> deleteTransaction({required WalletTransaction transaction}) async {
    final uid = transaction.userId;
    final txRef = _col(uid, 'transactions').doc(transaction.id);
    await _db.runTransaction((firestoreTransaction) async {
      final snapshot = await firestoreTransaction.get(txRef);
      if (!snapshot.exists) return;
      final current = WalletTransaction.fromMap(snapshot.data()!, snapshot.id);
      final ids = <String>{};
      if (current.accountId != null) ids.add(current.accountId!);
      if (current.originAccountId != null) ids.add(current.originAccountId!);
      if (current.destinationAccountId != null) ids.add(current.destinationAccountId!);
      final refs = ids.map((id) => _col(uid, 'accounts').doc(id)).toList();
      final snapshots = <DocumentSnapshot<Map<String, dynamic>>>[];
      for (final ref in refs) {
        snapshots.add(await firestoreTransaction.get(ref));
      }
      final accounts = <Account>[];
      for (final item in snapshots) {
        if (item.exists) accounts.add(Account.fromMap(item.data()!, item.id));
      }
      final reverted = applyTransactionToAccounts(current, accounts, reverse: true);
      firestoreTransaction.delete(txRef);
      for (final account in reverted) {
        firestoreTransaction.set(_col(uid, 'accounts').doc(account.id), account.toMap());
      }
    });
  }
}

FinancialPeriod _periodWithActive(FinancialPeriod p, bool active) => FinancialPeriod(
  id: p.id, userId: p.userId, name: p.name, referenceMonth: p.referenceMonth,
  startDate: p.startDate, endDate: p.endDate, subdivisionMode: p.subdivisionMode,
  status: active ? 'active' : (p.status == 'active' ? 'scheduled' : p.status), isActive: active,
  subperiods: p.subperiods, createdAt: p.createdAt, updatedAt: DateTime.now().toIso8601String(),
);

UserSettings _settingsWithActive(UserSettings s, String id) => UserSettings(
  userId: s.userId, currency: s.currency, currencySymbolPosition: s.currencySymbolPosition,
  decimalPlaces: s.decimalPlaces, themeMode: s.themeMode, hideBalances: s.hideBalances,
  activePeriodId: id, annualProjections: s.annualProjections,
);

final walletRepositoryProvider = Provider<WalletRepository>(
  (ref) => WalletRepository(ref.watch(firestoreProvider)),
);

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
