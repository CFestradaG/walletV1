import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'biometric_service.dart';
import 'pin_service.dart';
import 'secure_kv.dart';
import 'security_config.dart';

final secureKvProvider = Provider<SecureKv>((ref) => FlutterSecureKv());
final pinServiceProvider = Provider<PinService>((ref) => PinService(ref.watch(secureKvProvider)));
final biometricServiceProvider = Provider<BiometricService>((ref) => BiometricService());
final securityConfigStoreProvider =
    Provider<SecurityConfigStore>((ref) => SecurityConfigStore(ref.watch(secureKvProvider)));

final biometricAvailabilityProvider = FutureProvider<BiometricAvailability>(
  (ref) => ref.watch(biometricServiceProvider).availability(),
);

class LockState {
  const LockState({required this.loaded, required this.config, required this.locked});
  final bool loaded;
  final SecurityConfig config;
  final bool locked;

  LockState copyWith({bool? loaded, SecurityConfig? config, bool? locked}) => LockState(
        loaded: loaded ?? this.loaded,
        config: config ?? this.config,
        locked: locked ?? this.locked,
      );
}

final lockControllerProvider = NotifierProvider<LockController, LockState>(LockController.new);

class LockController extends Notifier<LockState> {
  DateTime? _pausedAt;
  bool _authInProgress = false;

  PinService get _pin => ref.read(pinServiceProvider);
  SecurityConfigStore get _store => ref.read(securityConfigStoreProvider);

  @override
  LockState build() {
    Future.microtask(_load);
    return const LockState(loaded: false, config: SecurityConfig.off, locked: false);
  }

  Future<void> _load() async {
    final cfg = await _store.load();
    final hasPin = await _pin.hasPin();
    // Si el PIN ya no existe (p. ej. datos borrados), se considera sin bloqueo.
    final effective = (cfg.enabled && hasPin) ? cfg : SecurityConfig.off;
    state = LockState(loaded: true, config: effective, locked: effective.enabled);
  }

  // ---------- Desbloqueo ----------
  Future<PinVerifyResult> unlockWithPin(String pin) async {
    final r = await _pin.verify(pin);
    if (r.ok) state = state.copyWith(locked: false);
    return r;
  }

  Future<bool> unlockWithBiometric() async {
    if (!state.config.biometricEnabled) return false;
    final ok = await _runBiometric('Desbloquea Wallet');
    if (ok) state = state.copyWith(locked: false);
    return ok;
  }

  /// Verifica el PIN sin desbloquear (para confirmar cambios sensibles en Ajustes).
  Future<PinVerifyResult> verifyPin(String pin) => _pin.verify(pin);

  // ---------- Ciclo de vida ----------
  void onPaused() {
    if (_authInProgress || !state.config.enabled || state.locked) return;
    _pausedAt = DateTime.now();
  }

  void onResumed() {
    if (_authInProgress) return;
    final t = _pausedAt;
    _pausedAt = null;
    if (t == null || !state.config.enabled || state.locked) return;
    if (DateTime.now().difference(t).inSeconds >= state.config.timeoutSeconds) {
      state = state.copyWith(locked: true);
    }
  }

  void lockNow() {
    if (state.config.enabled) state = state.copyWith(locked: true);
  }

  // ---------- Configuracion ----------
  Future<void> enable({required String pin, bool biometric = false}) async {
    await _pin.setPin(pin);
    final cfg = SecurityConfig(
      enabled: true,
      biometricEnabled: biometric,
      timeoutSeconds: state.config.timeoutSeconds,
    );
    await _store.save(cfg);
    state = state.copyWith(config: cfg, locked: false);
  }

  Future<void> changePin(String pin) => _pin.setPin(pin);

  /// Activa biometria solo si el usuario la supera ahora mismo; desactivar es directo.
  Future<bool> setBiometric(bool value) async {
    if (value) {
      final ok = await _runBiometric('Confirma para activar el desbloqueo biométrico');
      if (!ok) return false;
    }
    final cfg = state.config.copyWith(biometricEnabled: value);
    await _store.save(cfg);
    state = state.copyWith(config: cfg);
    return true;
  }

  Future<void> setTimeout(int seconds) async {
    final cfg = state.config.copyWith(timeoutSeconds: seconds);
    await _store.save(cfg);
    state = state.copyWith(config: cfg);
  }

  /// Desactiva el bloqueo y borra el PIN. Tambien se usa al cerrar sesion.
  Future<void> disable() async {
    await _pin.clear();
    await _store.save(SecurityConfig.off);
    _pausedAt = null;
    state = state.copyWith(config: SecurityConfig.off, locked: false);
  }

  Future<bool> _runBiometric(String reason) async {
    _authInProgress = true;
    try {
      return await ref.read(biometricServiceProvider).authenticate(reason);
    } finally {
      _authInProgress = false;
    }
  }
}
