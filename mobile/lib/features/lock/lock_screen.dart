import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/security/lock_controller.dart';
import '../../core/security/pin_service.dart';
import '../auth/auth_repository.dart';
import 'pin_pad.dart';

class LockScreen extends ConsumerStatefulWidget {
  const LockScreen({super.key});
  @override
  ConsumerState<LockScreen> createState() => _LockScreenState();
}

class _LockScreenState extends ConsumerState<LockScreen> {
  String _pin = '';
  String? _message;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _tryBiometric());
  }

  Future<void> _tryBiometric() async {
    if (!mounted || !ref.read(lockControllerProvider).config.biometricEnabled) return;
    await ref.read(lockControllerProvider.notifier).unlockWithBiometric();
  }

  void _onDigit(String d) {
    if (_busy || _pin.length >= kPinLength) return;
    setState(() {
      _pin += d;
      _message = null;
    });
    if (_pin.length == kPinLength) _verify();
  }

  Future<void> _verify() async {
    setState(() => _busy = true);
    final r = await ref.read(lockControllerProvider.notifier).unlockWithPin(_pin);
    if (!mounted || r.ok) return; // si ok, el router navega solo
    HapticFeedback.heavyImpact();
    setState(() {
      _busy = false;
      _pin = '';
      if (r.lockedFor != null) {
        _message = 'Demasiados intentos. Espera ${r.lockedFor!.inSeconds + 1} s.';
      } else if (r.attemptsLeft != null) {
        _message = 'PIN incorrecto. Intentos restantes: ${r.attemptsLeft}.';
      } else {
        _message = 'PIN incorrecto.';
      }
    });
  }

  Future<void> _forgot() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('¿Olvidaste tu PIN?'),
        content: const Text(
            'Cerraremos tu sesión y borraremos el PIN de este dispositivo. '
            'Tus datos siguen guardados en tu cuenta; vuelve a iniciar sesión para recuperarlos.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Cerrar sesión')),
        ],
      ),
    );
    if (confirm != true) return;
    await ref.read(lockControllerProvider.notifier).disable();
    await ref.read(authRepositoryProvider).signOut();
  }

  @override
  Widget build(BuildContext context) {
    final cfg = ref.watch(lockControllerProvider).config;
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.lock_rounded, size: 48, color: cs.primary),
                const SizedBox(height: 12),
                Text('Wallet bloqueada', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 4),
                const Text('Ingresa tu PIN'),
                const SizedBox(height: 24),
                PinPad(
                  digits: _pin,
                  enabled: !_busy,
                  onDigit: _onDigit,
                  onBackspace: () {
                    if (_pin.isNotEmpty) setState(() => _pin = _pin.substring(0, _pin.length - 1));
                  },
                  leading: cfg.biometricEnabled
                      ? IconButton(
                          iconSize: 32,
                          icon: const Icon(Icons.fingerprint),
                          onPressed: _tryBiometric,
                          tooltip: 'Usar biometría',
                        )
                      : null,
                ),
                SizedBox(
                  height: 40,
                  child: Center(
                    child: _message == null
                        ? null
                        : Text(_message!, style: TextStyle(color: cs.error)),
                  ),
                ),
                TextButton(onPressed: _forgot, child: const Text('Olvidé mi PIN')),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
