import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';

class BiometricAvailability {
  const BiometricAvailability({required this.available, required this.label});
  final bool available;

  /// Texto para la UI segun lo que ofrezca el dispositivo.
  final String label;

  static const none = BiometricAvailability(available: false, label: 'biometría');
}

class BiometricService {
  final LocalAuthentication _auth = LocalAuthentication();

  Future<BiometricAvailability> availability() async {
    try {
      final canCheck = await _auth.canCheckBiometrics;
      final supported = await _auth.isDeviceSupported();
      if (!canCheck || !supported) return BiometricAvailability.none;

      final types = await _auth.getAvailableBiometrics();
      if (types.isEmpty) return BiometricAvailability.none;

      final face = types.contains(BiometricType.face);
      final finger = types.contains(BiometricType.fingerprint);
      final label = face && finger
          ? 'huella o rostro'
          : face
              ? 'reconocimiento facial'
              : finger
                  ? 'huella digital'
                  : 'biometría del dispositivo';
      return BiometricAvailability(available: true, label: label);
    } catch (_) {
      return BiometricAvailability.none;
    }
  }

  Future<bool> authenticate(String reason) async {
    try {
      return await _auth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(biometricOnly: true, stickyAuth: true),
      );
    } catch (_) {
      return false;
    }
  }
}
