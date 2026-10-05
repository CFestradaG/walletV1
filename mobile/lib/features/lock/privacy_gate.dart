import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/security/lock_controller.dart';

/// Observa el ciclo de vida: registra cuando la app pasa a segundo plano,
/// bloquea al volver si pasó el tiempo configurado y tapa el contenido
/// en el selector de apps para no exponer saldos.
class PrivacyGate extends ConsumerStatefulWidget {
  const PrivacyGate({super.key, required this.child});
  final Widget child;
  @override
  ConsumerState<PrivacyGate> createState() => _PrivacyGateState();
}

class _PrivacyGateState extends ConsumerState<PrivacyGate> with WidgetsBindingObserver {
  bool _cover = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final lock = ref.read(lockControllerProvider.notifier);
    switch (state) {
      case AppLifecycleState.inactive:
        setState(() => _cover = true);
        break;
      case AppLifecycleState.paused:
      case AppLifecycleState.hidden:
        lock.onPaused();
        setState(() => _cover = true);
        break;
      case AppLifecycleState.resumed:
        lock.onResumed();
        setState(() => _cover = false);
        break;
      case AppLifecycleState.detached:
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final enabled = ref.watch(lockControllerProvider.select((s) => s.config.enabled));
    return Stack(
      children: [
        widget.child,
        if (_cover && enabled)
          Positioned.fill(
            child: ColoredBox(
              color: Theme.of(context).colorScheme.surface,
              child: Center(
                child: Icon(Icons.lock_rounded,
                    size: 64, color: Theme.of(context).colorScheme.primary),
              ),
            ),
          ),
      ],
    );
  }
}
