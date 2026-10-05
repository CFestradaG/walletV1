# Wallet móvil — Flutter

Aplicación móvil que comparte Auth y Firestore con Wallet Web. La estructura de documentos y los campos de cuentas, categorías, transacciones, períodos y presupuestos siguen `users/{uid}` y sus subcolecciones existentes.

## Funciones implementadas

- Registro, inicio de sesión con correo/contraseña o Google y recuperación de contraseña.
- Bloqueo local por PIN de seis dígitos, biometría disponible, bloqueo por intentos y privacidad al pasar a segundo plano.
- Navegación móvil para Inicio, Cuentas, Transacciones, Análisis y Más.
- Cuentas de efectivo, banco, ahorro y tarjeta de crédito; saldos disponibles, deuda, edición y archivo.
- Ingresos, egresos y transferencias; validación de cuentas/categorías/límite de crédito; edición y eliminación con actualización atómica del movimiento y saldos en Firestore.
- Períodos sin traslape, mes de referencia para el Panorama, subdivisión semanal/quincenal/mensual, selección del período activo y asociación de transacciones por fecha.
- Panorama comparativo mensual, trimestral, semestral y anual. Las metas de período y proyecciones base/ajustes mensuales se guardan en Firestore; las metas directas de período tienen prioridad.
- Dashboard del período activo con saldos, resumen y alertas de categorías por presupuesto.
- Análisis anual por mes y categoría; tema y ocultamiento de saldos sincronizados mediante `settings/default`.
- Restablecimiento de datos financieros desde Más, con confirmación; conserva perfil y preferencias.
- No se incluye exportación CSV.

## Configuración necesaria para ejecutar

El entorno donde se generó el código no tiene Flutter ni Dart instalados. Esta carpeta contiene el código Dart, pero aún requiere los proyectos nativos y las opciones reales de Firebase antes de poder ejecutarse:

```bash
flutter create --org gt.hame --project-name wallet_mobile --platforms=android,ios mobile
```

Conserva los archivos existentes de `mobile/lib/` al generar las carpetas nativas. Luego configura FlutterFire:

```bash
dart pub global activate flutterfire_cli
flutterfire configure --project=fintrack-gt
cd mobile
flutter pub get
flutter analyze
flutter test
flutter run
```

`lib/firebase_options.dart` es todavía un placeholder. FlutterFire debe reemplazarlo con las opciones de las aplicaciones Android/iOS registradas en Firebase. Para Google Sign-In también hacen falta las huellas SHA de Android y el URL scheme de iOS.

### Ajustes nativos de biometría

**Android:** `minSdk = 23`, permiso `USE_BIOMETRIC`, `MainActivity` extiende `FlutterFragmentActivity` y los temas usan `Theme.AppCompat.DayNight`.

**iOS:** agrega `NSFaceIDUsageDescription`, usa iOS 13 o superior y configura el `REVERSED_CLIENT_ID` de Google Sign-In como URL scheme.

La aplicación usa la base Firestore con ID `ai-studio-walletv1-cde1c2b5-f2a2-489f-8062-58e6963a288b`, igual que la web. Firestore mantiene persistencia offline nativa.

## Seguridad PIN

El PIN no se sincroniza. Se almacena con sal y hash iterado en Keystore/Keychain. Los cinco primeros intentos fallidos activan bloqueos progresivos. La biometría es opcional y el PIN sigue como respaldo. El bloqueo es privacidad local y no reemplaza Firebase Auth.

## Archivos de dominio

- `lib/core/engines/financial_engine.dart`: validación de movimientos, balances y totales.
- `lib/core/engines/period_engine.dart`: validación y generación de subperíodos, asociación de fecha.
- `lib/core/repositories/wallet_repository.dart`: seed compatible con web, lecturas en tiempo real y operaciones Firestore.
- `lib/core/firebase/wallet_providers.dart`: streams autenticados de datos.
- `lib/features/`: pantallas por función.

## Estado de comprobación

No fue posible ejecutar `flutter analyze` ni `flutter run` en el entorno de trabajo: no hay comandos `flutter` o `dart`, no se han generado las carpetas `android/` e `ios/` y las opciones Firebase son placeholder. Antes de usar la app se debe completar la configuración anterior y corregir cualquier error que reporte el SDK. No se agregó ni ejecutó una suite de pruebas.
