import 'package:intl/intl.dart';

final _gtq = NumberFormat.currency(locale: 'es_GT', symbol: 'Q', decimalDigits: 2);

/// Equivalente a formatGTQ de la web. Si [hide] es true oculta el monto.
String formatGTQ(num value, {bool hide = false}) => hide ? '••••' : _gtq.format(value);

/// Fechas de dominio: cadenas ISO YYYY-MM-DD (igual que la web).
String toIsoDate(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

DateTime parseIsoDate(String s) => DateTime.parse(s);
