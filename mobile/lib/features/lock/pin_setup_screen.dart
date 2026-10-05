import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/security/lock_controller.dart';
import '../../core/security/pin_service.dart';
import 'pin_pad.dart';

/// Crea el PIN (si el bloqueo esta apagado) o lo cambia (si ya esta activo).
class PinSetupScreen extends ConsumerStatefulWidget {
  const PinSetupScreen({super.key});
  @override
  ConsumerState<PinSetupScreen> createState() => _PinSetupScreenState();
}

class _PinSetupScreenState extends ConsumerState<PinSetupScreen> {
  String _pin = '';
  String? _first;
  String? _error;

  Future<void> _onDigit(String d) async {
    if (_pin.length >= kPinLength) return;
    setState(() {
      _pin += d;
      _error = null;
    });
    if (_pin.length < kPinLength) return;

    if (_first == null) {
      setState(() {
        _first = _pin;
        _pin = '';
      });
      return;
    }
    if (_first != _pin) {
      setState(() {
        _first = null;
        _pin = '';
        _error = 'Los PIN no coinciden. Empieza de nuevo.';
      });
      return;
    }
    final lock = ref.read(lockControllerProvider.notifier);
    if (ref.read(lockControllerProvider).config.enabled) {
      await lock.changePin(_pin);
    } else {
      await lock.enable(pin: _pin);
    }
    if (mounted) context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('PIN de seguridad')),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(_first == null ? 'Crea un PIN de $kPinLength dígitos' : 'Confirma tu PIN',
                    style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 24),
                PinPad(
                  digits: _pin,
                  onDigit: _onDigit,
                  onBackspace: () {
                    if (_pin.isNotEmpty) setState(() => _pin = _pin.substring(0, _pin.length - 1));
                  },
                ),
                SizedBox(
                  height: 40,
                  child: Center(
                    child: _error == null ? null : Text(_error!, style: TextStyle(color: cs.error)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
