// Modelos de dominio. Mismos campos y nombres que src/core/types/models.ts
// para que web y movil lean/escriban los mismos documentos de Firestore.

double _n(dynamic v, [double d = 0]) => v is num ? v.toDouble() : d;
String _s(dynamic v, [String d = '']) => v is String ? v : d;
int _i(dynamic v, [int d = 0]) => v is num ? v.toInt() : d;
bool _b(dynamic v, [bool d = false]) => v is bool ? v : d;

T _enum<T extends Enum>(List<T> values, dynamic raw, T fallback) {
  for (final v in values) {
    if (v.name == raw) return v;
  }
  return fallback;
}

Map<String, dynamic> _clean(Map<String, dynamic> m) =>
    Map.fromEntries(m.entries.where((e) => e.value != null));

// ---------- Cuentas ----------
enum AccountType { cash, bank, savings, credit_card }

class Account {
  const Account({
    required this.id,
    required this.userId,
    required this.name,
    this.subtitle,
    required this.type,
    required this.currency,
    required this.initialBalance,
    required this.currentBalance,
    this.creditLimit,
    this.status = 'active',
    required this.icon,
    required this.color,
    this.cutoffDay,
    this.paymentDueDay,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id, userId, name, currency, status, icon, color, createdAt, updatedAt;
  final String? subtitle;
  final AccountType type;
  final double initialBalance, currentBalance;
  final double? creditLimit;
  final int? cutoffDay, paymentDueDay;

  bool get isArchived => status == 'archived';
  bool get isCreditCard => type == AccountType.credit_card;

  factory Account.fromMap(Map<String, dynamic> m, String id) => Account(
        id: id,
        userId: _s(m['userId']),
        name: _s(m['name']),
        subtitle: m['subtitle'] as String?,
        type: _enum(AccountType.values, m['type'], AccountType.cash),
        currency: _s(m['currency'], 'GTQ'),
        initialBalance: _n(m['initialBalance']),
        currentBalance: _n(m['currentBalance'] ?? m['balance']),
        creditLimit: m['creditLimit'] == null ? null : _n(m['creditLimit']),
        status: _s(m['status'], 'active'),
        icon: _s(m['icon']),
        color: _s(m['color']),
        cutoffDay: m['cutoffDay'] == null ? null : _i(m['cutoffDay']),
        paymentDueDay: m['paymentDueDay'] == null ? null : _i(m['paymentDueDay']),
        createdAt: _s(m['createdAt']),
        updatedAt: _s(m['updatedAt']),
      );

  Map<String, dynamic> toMap() => _clean({
        'id': id,
        'userId': userId,
        'name': name,
        'subtitle': subtitle,
        'type': type.name,
        'currency': currency,
        'initialBalance': initialBalance,
        'currentBalance': currentBalance,
        'creditLimit': creditLimit,
        'status': status,
        'icon': icon,
        'color': color,
        'cutoffDay': cutoffDay,
        'paymentDueDay': paymentDueDay,
        'createdAt': createdAt,
        'updatedAt': updatedAt,
      });
}

// ---------- Categorias ----------
enum CategoryType { expense, income }

class Subcategory {
  const Subcategory({
    required this.id,
    required this.categoryId,
    required this.name,
    required this.icon,
    this.isActive = true,
  });
  final String id, categoryId, name, icon;
  final bool isActive;

  factory Subcategory.fromMap(Map<String, dynamic> m) => Subcategory(
        id: _s(m['id']),
        categoryId: _s(m['categoryId']),
        name: _s(m['name']),
        icon: _s(m['icon']),
        isActive: _b(m['isActive'], true),
      );

  Map<String, dynamic> toMap() => {
        'id': id,
        'categoryId': categoryId,
        'name': name,
        'icon': icon,
        'isActive': isActive,
      };
}

class Category {
  const Category({
    required this.id,
    required this.userId,
    required this.name,
    required this.type,
    required this.icon,
    required this.color,
    this.isActive = true,
    this.subcategories = const [],
  });
  final String id, userId, name, icon, color;
  final CategoryType type;
  final bool isActive;
  final List<Subcategory> subcategories;

  factory Category.fromMap(Map<String, dynamic> m, String id) => Category(
        id: id,
        userId: _s(m['userId']),
        name: _s(m['name']),
        type: _enum(CategoryType.values, m['type'], CategoryType.expense),
        icon: _s(m['icon']),
        color: _s(m['color']),
        isActive: _b(m['isActive'], true),
        subcategories: ((m['subcategories'] as List?) ?? const [])
            .whereType<Map>()
            .map((e) => Subcategory.fromMap(Map<String, dynamic>.from(e)))
            .toList(),
      );

  Map<String, dynamic> toMap() => {
        'id': id,
        'userId': userId,
        'name': name,
        'type': type.name,
        'icon': icon,
        'color': color,
        'isActive': isActive,
        'subcategories': subcategories.map((e) => e.toMap()).toList(),
      };
}

// ---------- Transacciones ----------
enum TransactionType { expense, income, transfer }

/// Se llama WalletTransaction para no chocar con Transaction de Firestore.
class WalletTransaction {
  const WalletTransaction({
    required this.id,
    required this.userId,
    required this.type,
    required this.amount,
    required this.currency,
    this.accountId,
    this.categoryId,
    this.subcategoryId,
    this.originAccountId,
    this.destinationAccountId,
    this.isCreditCardPayment = false,
    required this.date,
    this.time,
    this.note = '',
    this.periodId,
    this.subperiodId,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id, userId, currency, date, note, createdAt, updatedAt;
  final TransactionType type;
  final double amount;
  final String? accountId, categoryId, subcategoryId, originAccountId, destinationAccountId;
  final String? time, periodId, subperiodId;
  final bool isCreditCardPayment;

  factory WalletTransaction.fromMap(Map<String, dynamic> m, String id) => WalletTransaction(
        id: id,
        userId: _s(m['userId']),
        type: _enum(TransactionType.values, m['type'], TransactionType.expense),
        amount: _n(m['amount']),
        currency: _s(m['currency'], 'GTQ'),
        accountId: m['accountId'] as String?,
        categoryId: m['categoryId'] as String?,
        subcategoryId: m['subcategoryId'] as String?,
        originAccountId: m['originAccountId'] as String?,
        destinationAccountId: m['destinationAccountId'] as String?,
        isCreditCardPayment: _b(m['isCreditCardPayment']),
        date: _s(m['date']),
        time: m['time'] as String?,
        note: _s(m['note']),
        periodId: m['periodId'] as String?,
        subperiodId: m['subperiodId'] as String?,
        createdAt: _s(m['createdAt']),
        updatedAt: _s(m['updatedAt']),
      );

  Map<String, dynamic> toMap() => _clean({
        'id': id,
        'userId': userId,
        'type': type.name,
        'amount': amount,
        'currency': currency,
        'accountId': accountId,
        'categoryId': categoryId,
        'subcategoryId': subcategoryId,
        'originAccountId': originAccountId,
        'destinationAccountId': destinationAccountId,
        'isCreditCardPayment': isCreditCardPayment,
        'date': date,
        'time': time,
        'note': note,
        'periodId': periodId,
        'subperiodId': subperiodId,
        'createdAt': createdAt,
        'updatedAt': updatedAt,
      });
}

// ---------- Periodos ----------
enum SubdivisionMode { weekly, biweekly, monthly, none }

class Subperiod {
  const Subperiod({
    required this.id,
    required this.periodId,
    required this.index,
    required this.label,
    required this.name,
    required this.startDate,
    required this.endDate,
    required this.daysCount,
  });
  final String id, periodId, label, name, startDate, endDate;
  final int index, daysCount;

  factory Subperiod.fromMap(Map<String, dynamic> m) => Subperiod(
        id: _s(m['id']),
        periodId: _s(m['periodId']),
        index: _i(m['index']),
        label: _s(m['label']),
        name: _s(m['name']),
        startDate: _s(m['startDate']),
        endDate: _s(m['endDate']),
        daysCount: _i(m['daysCount']),
      );

  Map<String, dynamic> toMap() => {
        'id': id,
        'periodId': periodId,
        'index': index,
        'label': label,
        'name': name,
        'startDate': startDate,
        'endDate': endDate,
        'daysCount': daysCount,
      };
}

class FinancialPeriod {
  const FinancialPeriod({
    required this.id,
    required this.userId,
    required this.name,
    this.referenceMonth,
    required this.startDate,
    required this.endDate,
    required this.subdivisionMode,
    required this.status,
    required this.isActive,
    this.subperiods = const [],
    required this.createdAt,
    required this.updatedAt,
  });

  final String id, userId, name, startDate, endDate, status, createdAt, updatedAt;
  final int? referenceMonth;
  final SubdivisionMode subdivisionMode;
  final bool isActive;
  final List<Subperiod> subperiods;

  factory FinancialPeriod.fromMap(Map<String, dynamic> m, String id) => FinancialPeriod(
        id: id,
        userId: _s(m['userId']),
        name: _s(m['name']),
        referenceMonth: m['referenceMonth'] == null ? null : _i(m['referenceMonth']),
        startDate: _s(m['startDate']),
        endDate: _s(m['endDate']),
        subdivisionMode: _enum(SubdivisionMode.values, m['subdivisionMode'], SubdivisionMode.none),
        status: _s(m['status'], 'inactive'),
        isActive: _b(m['isActive']),
        subperiods: ((m['subperiods'] as List?) ?? const [])
            .whereType<Map>()
            .map((e) => Subperiod.fromMap(Map<String, dynamic>.from(e)))
            .toList(),
        createdAt: _s(m['createdAt']),
        updatedAt: _s(m['updatedAt']),
      );

  Map<String, dynamic> toMap() => _clean({
        'id': id,
        'userId': userId,
        'name': name,
        'referenceMonth': referenceMonth,
        'startDate': startDate,
        'endDate': endDate,
        'subdivisionMode': subdivisionMode.name,
        'status': status,
        'isActive': isActive,
        'subperiods': subperiods.map((e) => e.toMap()).toList(),
        'createdAt': createdAt,
        'updatedAt': updatedAt,
      });
}

// ---------- Presupuestos ----------
class Budget {
  const Budget({
    required this.id,
    required this.userId,
    required this.periodId,
    required this.categoryId,
    this.subcategoryId,
    required this.targetAmount,
    required this.currency,
    this.alertThreshold80 = true,
    this.alertThreshold100 = true,
    this.distributeBySubperiod = false,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id, userId, periodId, categoryId, currency, createdAt, updatedAt;
  final String? subcategoryId;
  final double targetAmount;
  final bool alertThreshold80, alertThreshold100, distributeBySubperiod;

  factory Budget.fromMap(Map<String, dynamic> m, String id) => Budget(
        id: id,
        userId: _s(m['userId']),
        periodId: _s(m['periodId']),
        categoryId: _s(m['categoryId']),
        subcategoryId: m['subcategoryId'] as String?,
        targetAmount: _n(m['targetAmount'] ?? m['amount']),
        currency: _s(m['currency'], 'GTQ'),
        alertThreshold80: _b(m['alertThreshold80'], true),
        alertThreshold100: _b(m['alertThreshold100'], true),
        distributeBySubperiod: _b(m['distributeBySubperiod']),
        createdAt: _s(m['createdAt']),
        updatedAt: _s(m['updatedAt']),
      );

  Map<String, dynamic> toMap() => _clean({
        'id': id,
        'userId': userId,
        'periodId': periodId,
        'categoryId': categoryId,
        'subcategoryId': subcategoryId,
        'targetAmount': targetAmount,
        'currency': currency,
        'alertThreshold80': alertThreshold80,
        'alertThreshold100': alertThreshold100,
        'distributeBySubperiod': distributeBySubperiod,
        'createdAt': createdAt,
        'updatedAt': updatedAt,
      });
}

// ---------- Perfil y ajustes ----------
class UserProfile {
  const UserProfile({
    required this.id,
    required this.name,
    required this.email,
    this.photoUrl,
    required this.provider,
    required this.createdAt,
  });
  final String id, name, email, provider, createdAt;
  final String? photoUrl;

  factory UserProfile.fromMap(Map<String, dynamic> m) => UserProfile(
        id: _s(m['id']),
        name: _s(m['name']),
        email: _s(m['email']),
        photoUrl: m['photoUrl'] as String?,
        provider: _s(m['provider'], 'email'),
        createdAt: _s(m['createdAt']),
      );

  Map<String, dynamic> toMap() => _clean({
        'id': id,
        'name': name,
        'email': email,
        'photoUrl': photoUrl,
        'provider': provider,
        'createdAt': createdAt,
      });
}

class UserSettings {
  const UserSettings({
    required this.userId,
    this.currency = 'GTQ',
    this.currencySymbolPosition = 'prefix',
    this.decimalPlaces = 2,
    this.themeMode = 'system',
    this.hideBalances = false,
    this.activePeriodId,
    this.annualProjections = const {},
  });
  final String userId, currency, currencySymbolPosition, themeMode;
  final int decimalPlaces;
  final bool hideBalances;
  final String? activePeriodId;
  /// Proyecciones base mensuales y overrides anuales por categoría.
  final Map<String, dynamic> annualProjections;

  factory UserSettings.fromMap(Map<String, dynamic> m) => UserSettings(
        userId: _s(m['userId']),
        currency: _s(m['currency'], 'GTQ'),
        currencySymbolPosition: _s(m['currencySymbolPosition'], 'prefix'),
        decimalPlaces: _i(m['decimalPlaces'], 2),
        themeMode: _s(m['themeMode'], 'system'),
        hideBalances: _b(m['hideBalances']),
        activePeriodId: m['activePeriodId'] as String?,
        annualProjections: m['annualProjections'] is Map
            ? Map<String, dynamic>.from(m['annualProjections'] as Map)
            : const {},
      );

  Map<String, dynamic> toMap() => _clean({
        'userId': userId,
        'currency': currency,
        'currencySymbolPosition': currencySymbolPosition,
        'decimalPlaces': decimalPlaces,
        'themeMode': themeMode,
        'hideBalances': hideBalances,
        'activePeriodId': activePeriodId,
        'annualProjections': annualProjections,
      });
}
