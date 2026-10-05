import 'package:flutter/material.dart';

import '../../core/security/pin_service.dart';

/// Teclado numerico reutilizable (pantalla de bloqueo y alta de PIN).
class PinPad extends StatelessWidget {
  const PinPad({
    super.key,
    required this.digits,
    required this.onDigit,
    required this.onBackspace,
    this.leading,
    this.enabled = true,
  });

  final String digits;
  final ValueChanged<String> onDigit;
  final VoidCallback onBackspace;
  final Widget? leading;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(kPinLength, (i) {
            final filled = i < digits.length;
            return Container(
              margin: const EdgeInsets.symmetric(horizontal: 8),
              width: 14,
              height: 14,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: filled ? cs.primary : Colors.transparent,
                border: Border.all(color: cs.primary, width: 1.5),
              ),
            );
          }),
        ),
        const SizedBox(height: 32),
        for (final row in const [
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
        ])
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [for (final d in row) _key(context, child: Text(d), onTap: () => onDigit(d))],
          ),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _key(context, child: leading ?? const SizedBox(), onTap: null),
            _key(context, child: const Text('0'), onTap: () => onDigit('0')),
            _key(context, child: const Icon(Icons.backspace_outlined), onTap: onBackspace),
          ],
        ),
      ],
    );
  }

  Widget _key(BuildContext context, {required Widget child, required VoidCallback? onTap}) {
    return Padding(
      padding: const EdgeInsets.all(6),
      child: SizedBox(
        width: 72,
        height: 72,
        child: InkResponse(
          onTap: enabled ? onTap : null,
          radius: 40,
          child: Center(
            child: DefaultTextStyle(
              style: Theme.of(context).textTheme.headlineSmall!,
              child: child,
            ),
          ),
        ),
      ),
    );
  }
}
