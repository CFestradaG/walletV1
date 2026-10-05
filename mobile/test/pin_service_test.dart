import 'package:flutter_test/flutter_test.dart';
import 'package:wallet_mobile/core/security/pin_service.dart';
import 'package:wallet_mobile/core/security/secure_kv.dart';

void main() {
  late MemorySecureKv kv;
  late DateTime now;
  late PinService pin;

  setUp(() {
    kv = MemorySecureKv();
    now = DateTime(2026, 10, 5, 12);
    pin = PinService(kv, now: () => now);
  });

  test('guarda hash y no el PIN en claro', () async {
    await pin.setPin('123456');
    expect(await pin.hasPin(), isTrue);
    expect(kv.data.values.any((v) => v.contains('123456')), isFalse);
  });

  test('PIN correcto verifica y PIN incorrecto no', () async {
    await pin.setPin('123456');
    expect((await pin.verify('123456')).ok, isTrue);
    final bad = await pin.verify('000000');
    expect(bad.ok, isFalse);
    expect(bad.attemptsLeft, 4);
  });

  test('bloquea tras 5 intentos fallidos y se libera con el tiempo', () async {
    await pin.setPin('123456');
    PinVerifyResult r = const PinVerifyResult(ok: false);
    for (var i = 0; i < 5; i++) {
      r = await pin.verify('000000');
    }
    expect(r.lockedFor, isNotNull);
    expect((await pin.verify('123456')).ok, isFalse); // aun bloqueado

    now = now.add(const Duration(seconds: 31));
    expect((await pin.verify('123456')).ok, isTrue);
  });

  test('clear elimina el PIN', () async {
    await pin.setPin('123456');
    await pin.clear();
    expect(await pin.hasPin(), isFalse);
  });
}
