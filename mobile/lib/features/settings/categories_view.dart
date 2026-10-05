import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/firebase/wallet_providers.dart';
import '../../core/models/models.dart';
import '../../core/repositories/wallet_repository.dart';

class CategoriesView extends ConsumerWidget {
  const CategoriesView({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(signedInUserProvider);
    if (user == null) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    final data = ref.watch(categoriesProvider(user.id));
    return Scaffold(
      appBar: AppBar(title: const Text('Categorías')),
      floatingActionButton: FloatingActionButton.extended(onPressed: () => _create(context, ref, user.id), icon: const Icon(Icons.add), label: const Text('Nueva categoría')),
      body: data.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('No se pudieron cargar las categorías: $e')),
        data: (categories) => ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 96), children: [
          for (final type in CategoryType.values) ...[
            Padding(padding: const EdgeInsets.fromLTRB(4, 12, 4, 6), child: Text(type == CategoryType.expense ? 'EGRESOS' : 'INGRESOS', style: Theme.of(context).textTheme.labelLarge)),
            for (final category in categories.where((c) => c.type == type)) Card(child: ListTile(
              leading: CircleAvatar(child: Text(category.icon.isEmpty ? '•' : category.icon)),
              title: Text(category.name), subtitle: Text('${category.subcategories.length} subcategorías${category.isActive ? '' : ' · Inactiva'}'),
              trailing: Switch(value: category.isActive, onChanged: (v) async {
                final updated = Category(id: category.id, userId: category.userId, name: category.name, type: category.type, icon: category.icon, color: category.color, isActive: v, subcategories: category.subcategories);
                try { await ref.read(walletRepositoryProvider).saveCategory(updated); }
                catch (e) { if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('No se pudo actualizar: $e'))); }
              }),
            )),
          ],
        ]),
      ),
    );
  }
}

Future<void> _create(BuildContext context, WidgetRef ref, String uid) async {
  final name = TextEditingController();
  var type = CategoryType.expense;
  var icon = '🏷️';
  await showModalBottomSheet<void>(context: context, isScrollControlled: true, useSafeArea: true,
    builder: (ctx) => StatefulBuilder(builder: (context, setState) => Padding(
      padding: EdgeInsets.fromLTRB(20, 16, 20, MediaQuery.viewInsetsOf(context).bottom + 18),
      child: ListView(shrinkWrap: true, children: [
        Text('Nueva categoría', style: Theme.of(context).textTheme.titleLarge),
        TextField(controller: name, decoration: const InputDecoration(labelText: 'Nombre')),
        const SizedBox(height: 12),
        SegmentedButton<CategoryType>(segments: const [ButtonSegment(value: CategoryType.expense, label: Text('Egreso')), ButtonSegment(value: CategoryType.income, label: Text('Ingreso'))], selected: {type}, onSelectionChanged: (v) => setState(() => type = v.first)),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(value: icon, decoration: const InputDecoration(labelText: 'Icono'), items: [for (final e in ['🏷️','🍔','🚗','🏠','💊','💵','💰','🎁','📚','💳']) DropdownMenuItem(value: e, child: Text(e))], onChanged: (v) => setState(() => icon = v ?? icon)),
        const SizedBox(height: 14),
        FilledButton(onPressed: () async {
          if (name.text.trim().isEmpty) return;
          final category = Category(id: 'cat_${DateTime.now().microsecondsSinceEpoch}', userId: uid, name: name.text.trim(), type: type, icon: icon, color: '#10B981');
          try { await ref.read(walletRepositoryProvider).saveCategory(category); if (context.mounted) Navigator.pop(context); }
          catch (e) { if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('No se pudo guardar: $e'))); }
        }, child: const Text('Guardar')),
      ]),
    )),
  );
  name.dispose();
}
