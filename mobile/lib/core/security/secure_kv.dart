import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Abstraccion minima del almacen seguro (Keystore / Keychain) para poder probar sin plugins.
abstract class SecureKv {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

class FlutterSecureKv implements SecureKv {
  FlutterSecureKv([FlutterSecureStorage? s])
      : _s = s ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
              iOptions: IOSOptions(accessibility: KeychainAccessibility.passcode),
            );
  final FlutterSecureStorage _s;
  final MemorySecureKv _memory = MemorySecureKv();

  @override
  Future<String?> read(String key) async {
    try {
      return await _s.read(key: key);
    } catch (_) {
      return _memory.read(key);
    }
  }

  @override
  Future<void> write(String key, String value) async {
    try {
      await _s.write(key: key, value: value);
    } catch (_) {
      await _memory.write(key, value);
    }
  }

  @override
  Future<void> delete(String key) async {
    try {
      await _s.delete(key: key);
    } catch (_) {
      await _memory.delete(key);
    }
  }
}

class MemorySecureKv implements SecureKv {
  final Map<String, String> data = {};
  @override
  Future<String?> read(String key) async => data[key];
  @override
  Future<void> write(String key, String value) async => data[key] = value;
  @override
  Future<void> delete(String key) async => data.remove(key);
}
