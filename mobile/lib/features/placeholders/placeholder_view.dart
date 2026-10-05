import 'package:flutter/material.dart';

/// Marcador para modulos que se implementan en las siguientes fases.
class PlaceholderView extends StatelessWidget {
  const PlaceholderView({super.key, required this.title, required this.phase, required this.icon});
  final String title, phase;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 56, color: Theme.of(context).colorScheme.outline),
            const SizedBox(height: 12),
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 4),
            Text('Se implementa en la $phase'),
          ],
        ),
      ),
    );
  }
}
