import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/models.dart';
import '../repositories/wallet_repository.dart';
import 'firebase_providers.dart';

final signedInUserProvider = Provider<UserProfile?>((ref) {
  final user = ref.watch(authStateProvider).valueOrNull;
  if (user == null) return null;
  return UserProfile(
    id: user.uid,
    name: user.displayName ?? user.email?.split('@').first ?? 'Usuario',
    email: user.email ?? '',
    photoUrl: user.photoURL,
    provider: user.providerData.any((p) => p.providerId == 'google.com') ? 'google' : 'email',
    createdAt: user.metadata.creationTime?.toIso8601String() ?? DateTime.now().toIso8601String(),
  );
});

final accountsProvider = StreamProvider.family<List<Account>, String>(
  (ref, uid) => ref.watch(walletRepositoryProvider).watchAccounts(uid),
);
final categoriesProvider = StreamProvider.family<List<Category>, String>(
  (ref, uid) => ref.watch(walletRepositoryProvider).watchCategories(uid),
);
final periodsProvider = StreamProvider.family<List<FinancialPeriod>, String>(
  (ref, uid) => ref.watch(walletRepositoryProvider).watchPeriods(uid),
);
final transactionsProvider = StreamProvider.family<List<WalletTransaction>, String>(
  (ref, uid) => ref.watch(walletRepositoryProvider).watchTransactions(uid),
);
final budgetsProvider = StreamProvider.family<List<Budget>, String>(
  (ref, uid) => ref.watch(walletRepositoryProvider).watchBudgets(uid),
);
final settingsProvider = StreamProvider.family<UserSettings, String>(
  (ref, uid) => ref.watch(walletRepositoryProvider).watchSettings(uid),
);
