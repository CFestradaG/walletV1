import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';

import 'secure_kv.dart';

const kPinLength = 6;

class PinVerifyResult {
  const PinVerifyResult({required this.ok, this.attemptsLeft, this.lockedFor});
  final bool ok;
  final int? attemptsLeft;
  final Duration? lockedFor;
}

/// PIN con sal + hash iterado, guardado en almacen seguro, con bloqueo progresivo.
class PinService {
  PinService(this._kv, {DateTime Function()? now}) : _now = now ?? DateTime.now;
  final SecureKv _kv;
  final DateTime Function() _now;

  static const _kHash = 'pin_hash';
  static const _kSalt = 'pin_salt';
  static const _kFails = 'pin_fails';
  static const _kLockUntil = 'pin_lock_until';
  static const maxFreeAttempts = 5;
  static const _rounds = 20000;

  Future<bool> hasPin() async => (await _kv.read(_kHash)) != null;

  Future<void> setPin(String pin) async {
    final rnd = Random.secure();
    final salt = List<int>.generate(16, (_) => rnd.nextInt(256));
    await _kv.write(_kSalt, base64Encode(salt));
    await _kv.write(_kHash, base64Encode(_derive(pin, salt)));
    await _resetFails();
  }

  Future<PinVerifyResult> verify(String pin) async {
    final until = int.tryParse(await _kv.read(_kLockUntil) ?? '') ?? 0;
    final nowMs = _now().millisecondsSinceEpoch;
    if (until > nowMs) {
      return PinVerifyResult(ok: false, lockedFor: Duration(milliseconds: until - nowMs));
    }

    final hashB64 = await _kv.read(_kHash);
    final saltB64 = await _kv.read(_kSalt);
    if (hashB64 == null || saltB64 == null) return const PinVerifyResult(ok: false);

    final candidate = _derive(pin, base64Decode(saltB64));
    if (_constantTimeEquals(candidate, base64Decode(hashB64))) {
      await _resetFails();
      return const PinVerifyResult(ok: true);
    }

    final fails = (int.tryParse(await _kv.read(_kFails) ?? '') ?? 0) + 1;
    await _kv.write(_kFails, '$fails');
    if (fails >= maxFreeAttempts) {
      final seconds = min(30 * pow(2, fails - maxFreeAttempts).toInt(), 15 * 60);
      await _kv.write(_kLockUntil, '${nowMs + seconds * 1000}');
      return PinVerifyResult(ok: false, lockedFor: Duration(seconds: seconds));
    }
    return PinVerifyResult(ok: false, attemptsLeft: maxFreeAttempts - fails);
  }

  Future<void> clear() async {
    await _kv.delete(_kHash);
    await _kv.delete(_kSalt);
    await _resetFails();
  }

  Future<void> _resetFails() async {
    await _kv.delete(_kFails);
    await _kv.delete(_kLockUntil);
  }

  List<int> _derive(String pin, List<int> salt) {
    var d = <int>[...salt, ...utf8.encode(pin)];
    for (var i = 0; i < _rounds; i++) {
      d = sha256.convert([...d, ...salt]).bytes;
    }
    return d;
  }

  bool _constantTimeEquals(List<int> a, List<int> b) {
    if (a.length != b.length) return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) {
      diff |= a[i] ^ b[i];
    }
    return diff == 0;
  }
}
