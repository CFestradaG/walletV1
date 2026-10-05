import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../../core/firebase/firebase_providers.dart';
import '../../core/models/models.dart';
import '../../core/repositories/wallet_repository.dart';

class AuthRepository {
  AuthRepository(this._auth, this._wallet);
  final FirebaseAuth _auth;
  final WalletRepository _wallet;

  Future<void> signInEmail(String email, String password) async {
    final cred = await _auth.signInWithEmailAndPassword(email: email.trim(), password: password);
    await _ensureProfile(cred.user, 'email');
  }

  Future<void> register(String name, String email, String password) async {
    final cred =
        await _auth.createUserWithEmailAndPassword(email: email.trim(), password: password);
    await cred.user?.updateDisplayName(name.trim());
    await _ensureProfile(cred.user, 'email', name: name.trim());
  }

  Future<void> signInGoogle() async {
    if (kIsWeb) {
      final googleProvider = GoogleAuthProvider();
      googleProvider.setCustomParameters({'prompt': 'select_account'});
      final cred = await _auth.signInWithPopup(googleProvider);
      await _ensureProfile(cred.user, 'google');
      return;
    }
    final account = await GoogleSignIn().signIn();
    if (account == null) return; // cancelado por el usuario
    final auth = await account.authentication;
    final credential =
        GoogleAuthProvider.credential(accessToken: auth.accessToken, idToken: auth.idToken);
    final cred = await _auth.signInWithCredential(credential);
    await _ensureProfile(cred.user, 'google');
  }

  Future<void> resetPassword(String email) => _auth.sendPasswordResetEmail(email: email.trim());

  Future<void> signOut() async {
    try {
      await GoogleSignIn().signOut();
    } catch (_) {}
    await _auth.signOut();
  }

  Future<void> _ensureProfile(User? u, String provider, {String? name}) async {
    if (u == null) return;
    await _wallet.ensureUserProfile(UserProfile(
      id: u.uid,
      name: name ?? u.displayName ?? (u.email ?? 'Usuario').split('@').first,
      email: u.email ?? '',
      photoUrl: u.photoURL,
      provider: provider,
      createdAt: DateTime.now().toIso8601String(),
    ));
    await _wallet.seedUser(UserProfile(
      id: u.uid,
      name: name ?? u.displayName ?? (u.email ?? 'Usuario').split('@').first,
      email: u.email ?? '',
      photoUrl: u.photoURL,
      provider: provider,
      createdAt: u.metadata.creationTime?.toIso8601String() ?? DateTime.now().toIso8601String(),
    ));
  }
}

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(ref.watch(firebaseAuthProvider), ref.watch(walletRepositoryProvider)),
);

String authErrorMessage(Object e) {
  if (e is FirebaseAuthException) {
    switch (e.code) {
      case 'invalid-email':
        return 'El correo no es válido.';
      case 'user-not-found':
      case 'wrong-password':
      case 'invalid-credential':
        return 'Correo o contraseña incorrectos.';
      case 'email-already-in-use':
        return 'Ese correo ya está registrado.';
      case 'weak-password':
        return 'La contraseña es muy débil (mínimo 6 caracteres).';
      case 'network-request-failed':
        return 'Sin conexión. Revisa tu internet.';
      case 'too-many-requests':
        return 'Demasiados intentos. Intenta más tarde.';
    }
    return 'Error de autenticación (${e.code}).';
  }
  return 'Ocurrió un error inesperado.';
}
