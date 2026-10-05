import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/security/lock_controller.dart';
import '../../core/security/pin_service.dart';

/// Pide el PIN actual para confirmar acciones sensibles (cambiar o desactivar).
Future<bool> confirmCurrentPin(BuildContext context, WidgetRef ref) async {
  final ctrl = TextEditingController();
  String? error;
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setState) => AlertDialog(
        title: const Text('Confirma tu PIN'),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          obscureText: true,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          maxLength: kPinLength,
          decoration: InputDecoration(errorText: error, labelText: 'PIN actual'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
          FilledButton(
            onPressed: () async {
              final r = await ref.read(lockControllerProvider.notifier).verifyPin(ctrl.text);
              if (r.ok) {
                if (ctx.mounted) Navigator.pop(ctx, true);
              } else {
                setState(() => error = r.lockedFor != null
                    ? 'Bloqueado. Espera ${r.lockedFor!.inSeconds + 1} s.'
                    : 'PIN incorrecto.');
              }
            },
            child: const Text('Confirmar'),
          ),
        ],
      ),
    ),
  );
  ctrl.dispose();
  return ok ?? false;
}
