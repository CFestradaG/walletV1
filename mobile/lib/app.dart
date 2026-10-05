import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/router/router.dart';
import 'core/theme/app_theme.dart';
import 'core/firebase/wallet_providers.dart';
import 'core/firebase/firebase_providers.dart';
import 'core/repositories/wallet_repository.dart';
import 'features/lock/privacy_gate.dart';

class WalletApp extends ConsumerWidget {
  const WalletApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.listen(authStateProvider, (previous, next) {
      final firebaseUser = next.valueOrNull;
      if (firebaseUser == null) return;
      final profile = ref.read(signedInUserProvider);
      if (profile != null) {
        unawaited(ref.read(walletRepositoryProvider).seedUser(profile).catchError((Object error) {
          debugPrint('No se pudieron preparar los datos iniciales de Wallet: $error');
        }));
      }
    });
    final router = ref.watch(routerProvider);
    final localThemeMode = ref.watch(themeModeProvider);
    final user = ref.watch(signedInUserProvider);
    final settings = user == null ? null : ref.watch(settingsProvider(user.id)).valueOrNull;
    final themeMode = switch (settings?.themeMode) {
      'light' => ThemeMode.light,
      'dark' => ThemeMode.dark,
      'system' => ThemeMode.system,
      _ => localThemeMode,
    };
    return MaterialApp.router(
      title: 'Wallet',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: themeMode,
      routerConfig: router,
      builder: (context, child) => PrivacyGate(child: child ?? const SizedBox()),
    );
  }
}
