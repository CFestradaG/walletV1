import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/auth_screen.dart';
import '../../features/lock/lock_screen.dart';
import '../../features/lock/pin_setup_screen.dart';
import '../../features/accounts/accounts_view.dart';
import '../../features/analytics/analytics_view.dart';
import '../../features/annual_budget/annual_budget_view.dart';
import '../../features/dashboard/dashboard_view.dart';
import '../../features/periods/periods_view.dart';
import '../../features/settings/categories_view.dart';
import '../../features/settings/more_view.dart';
import '../../features/settings/security_settings_screen.dart';
import '../../features/shell/main_shell.dart';
import '../../features/transactions/transactions_view.dart';
import '../firebase/firebase_providers.dart';
import '../security/lock_controller.dart';

/// Orden de redireccion: cargando -> sin sesion -> bloqueado -> app.
final routerProvider = Provider<GoRouter>((ref) {
  final refresh = ValueNotifier<int>(0);
  ref.listen(authStateProvider, (_, __) => refresh.value++);
  ref.listen(lockControllerProvider, (_, __) => refresh.value++);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: refresh,
    redirect: (context, state) {
      final loc = state.matchedLocation;
      final auth = ref.read(authStateProvider);
      final lock = ref.read(lockControllerProvider);

      if (auth.isLoading) return loc == '/splash' ? null : '/splash';
      if (auth.valueOrNull == null) return loc == '/auth' ? null : '/auth';
      if (!lock.loaded) return loc == '/splash' ? null : '/splash';
      if (lock.locked) return loc == '/lock' ? null : '/lock';
      if (loc == '/splash' || loc == '/auth' || loc == '/lock') return '/home';
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, __) => const Scaffold(body: Center(child: CircularProgressIndicator()))),
      GoRoute(path: '/auth', builder: (_, __) => const AuthScreen()),
      GoRoute(path: '/lock', builder: (_, __) => const LockScreen()),
      GoRoute(path: '/security', builder: (_, __) => const SecuritySettingsScreen()),
      GoRoute(path: '/security/pin', builder: (_, __) => const PinSetupScreen()),
      GoRoute(path: '/periods', builder: (_, __) => const PeriodsView()),
      GoRoute(path: '/categories', builder: (_, __) => const CategoriesView()),
      GoRoute(path: '/budget', builder: (_, __) => const AnnualBudgetView()),
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => MainShell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/home',
              builder: (_, __) => const DashboardView(),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/accounts',
              builder: (_, __) => const AccountsView(),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/transactions',
              builder: (_, __) => const TransactionsView(),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/analytics',
              builder: (_, __) => const AnalyticsView(),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/more', builder: (_, __) => const MoreView()),
          ]),
        ],
      ),
    ],
  );
});
