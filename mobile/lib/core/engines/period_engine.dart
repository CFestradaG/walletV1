import '../models/models.dart';

String isoDate(DateTime date) => '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

int _days(String start, String end) => DateTime.parse(end).difference(DateTime.parse(start)).inDays + 1;

List<Subperiod> generateSubperiods(String periodId, String start, String end, SubdivisionMode mode) {
  if (mode == SubdivisionMode.none) return [];
  final from = DateTime.parse(start);
  final to = DateTime.parse(end);
  final totalDays = to.difference(from).inDays + 1;
  final out = <Subperiod>[];
  var cursor = from;
  var index = 1;
  while (!cursor.isAfter(to)) {
    DateTime stop;
    String label;
    String name;
    if (mode == SubdivisionMode.weekly) {
      stop = cursor.add(const Duration(days: 6));
      label = 'S$index';
      name = 'Semana $index';
    } else if (mode == SubdivisionMode.biweekly) {
      final remaining = to.difference(cursor).inDays + 1;
      final chunk = totalDays <= 15
          ? remaining
          : totalDays <= 35
              ? (index == 1 ? (totalDays >= 28 ? 15 : totalDays ~/ 2) : remaining)
              : 15;
      stop = cursor.add(Duration(days: chunk - 1));
      label = 'Q$index';
      name = 'Quincena $index';
    } else {
      final nextMonth = DateTime(cursor.year, cursor.month + 1, cursor.day);
      stop = nextMonth.subtract(const Duration(days: 1));
      label = 'M$index';
      name = 'Mes $index';
    }
    if (stop.isAfter(to)) stop = to;
    final a = isoDate(cursor), b = isoDate(stop);
    out.add(Subperiod(
      id: '${periodId}_sub_${mode == SubdivisionMode.weekly ? 'w' : mode == SubdivisionMode.biweekly ? 'q' : 'm'}$index',
      periodId: periodId, index: index, label: label, name: name,
      startDate: a, endDate: b, daysCount: _days(a, b),
    ));
    cursor = stop.add(const Duration(days: 1));
    index++;
  }
  return out;
}

String? validatePeriod({required String name, required String start, required String end, required List<FinancialPeriod> periods, String? editingId}) {
  if (name.trim().isEmpty) return 'El nombre del período es obligatorio.';
  final a = DateTime.tryParse(start), b = DateTime.tryParse(end);
  if (a == null || b == null || isoDate(a) != start || isoDate(b) != end) return 'Las fechas del período no son válidas.';
  if (end.compareTo(start) < 0) return 'La fecha final no puede ser anterior a la inicial.';
  for (final period in periods) {
    if (period.id == editingId) continue;
    if (start.compareTo(period.endDate) <= 0 && end.compareTo(period.startDate) >= 0) {
      return 'Las fechas se superponen con el período ${period.name}.';
    }
  }
  return null;
}

({FinancialPeriod? period, Subperiod? subperiod}) resolvePeriod(String date, List<FinancialPeriod> periods) {
  for (final period in periods) {
    if (date.compareTo(period.startDate) >= 0 && date.compareTo(period.endDate) <= 0) {
      Subperiod? sub;
      for (final candidate in period.subperiods) {
        if (date.compareTo(candidate.startDate) >= 0 && date.compareTo(candidate.endDate) <= 0) {
          sub = candidate;
          break;
        }
      }
      return (period: period, subperiod: sub);
    }
  }
  return (period: null, subperiod: null);
}

String monthName(int month) => const ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][month - 1];
