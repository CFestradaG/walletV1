import 'secure_kv.dart';

class SecurityConfig {
  const SecurityConfig({
    required this.enabled,
    required this.biometricEnabled,
    required this.timeoutSeconds,
  });

  final bool enabled;
  final bool biometricEnabled;

  /// Segundos en segundo plano antes de bloquear. 0 = inmediato.
  final int timeoutSeconds;

  static const off = SecurityConfig(enabled: false, biometricEnabled: false, timeoutSeconds: 30);

  SecurityConfig copyWith({bool? enabled, bool? biometricEnabled, int? timeoutSeconds}) =>
      SecurityConfig(
        enabled: enabled ?? this.enabled,
        biometricEnabled: biometricEnabled ?? this.biometricEnabled,
        timeoutSeconds: timeoutSeconds ?? this.timeoutSeconds,
      );
}

class SecurityConfigStore {
  SecurityConfigStore(this._kv);
  final SecureKv _kv;

  static const _kEnabled = 'sec_enabled';
  static const _kBio = 'sec_biometric';
  static const _kTimeout = 'sec_timeout';

  Future<SecurityConfig> load() async => SecurityConfig(
        enabled: (await _kv.read(_kEnabled)) == '1',
        biometricEnabled: (await _kv.read(_kBio)) == '1',
        timeoutSeconds: int.tryParse(await _kv.read(_kTimeout) ?? '') ?? 30,
      );

  Future<void> save(SecurityConfig c) async {
    await _kv.write(_kEnabled, c.enabled ? '1' : '0');
    await _kv.write(_kBio, c.biometricEnabled ? '1' : '0');
    await _kv.write(_kTimeout, '${c.timeoutSeconds}');
  }
}
