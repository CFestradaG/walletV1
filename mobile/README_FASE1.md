# Wallet móvil — Flutter

Aplicación móvil que comparte Auth y Firestore con Wallet Web. La estructura de documentos y los campos de cuentas, categorías, transacciones, períodos y presupuestos siguen `users/{uid}` y sus subcolecciones existentes.

## Funciones implementadas

- Registro, inicio de sesión con correo/contraseña o Google y recuperación de contraseña.
- Bloqueo local por PIN de seis dígitos, biometría disponible, bloqueo por intentos y privacidad al pasar a segundo plano.
- Navegación móvil para Inicio, Cuentas, Transacciones, Análisis y Más.
- Cuentas de efectivo, banco, ahorro y tarjeta de crédito; saldos disponibles, deuda, edición y archivo.
- Ingresos, egresos y transferencias con validacion local y transacciones Firestore cliente que leen movimiento y saldos actuales y los actualizan atomicamente.
- Períodos sin traslape, mes de referencia para el Panorama, subdivisión semanal/quincenal/mensual, selección del período activo y asociación de transacciones por fecha.
- Panorama comparativo mensual, trimestral, semestral y anual. Las metas de período y proyecciones base/ajustes mensuales se guardan en Firestore; las metas directas de período tienen prioridad.
- Dashboard del período activo con saldos, resumen y alertas de categorías por presupuesto.
- Análisis anual por mes y categoría; tema y ocultamiento de saldos sincronizados mediante `settings/default`.
- Restablecimiento de datos financieros desde Más, con confirmación; conserva perfil y preferencias.
- No se incluye exportación CSV.

## Configuración necesaria para ejecutar

Flutter está instalado y las carpetas `android/` e `ios/` ya existen. `lib/firebase_options.dart` todavía es un placeholder y debe generarse para las apps Android/iOS registradas en Firebase.

Desde la raíz del repositorio, si necesitas recrear las plataformas:

```powershell
flutter create --org gt.hame --project-name wallet_mobile --platforms=android,ios mobile
```

Para configurar FlutterFire (si el comando no está en PATH, usa la ruta completa mostrada):

```powershell
dart pub global activate flutterfire_cli
cd mobile
& "$env:LOCALAPPDATA\Pub\Cache\bin\flutterfire.bat" configure --project=fintrack-gt
flutter pub get
flutter analyze
flutter run
```

Registra las aplicaciones Android/iOS en Firebase si aún no existen. Para Google Sign-In hacen falta las huellas SHA de Android y el URL scheme de iOS. Android necesita `minSdk = 23`, permiso `USE_BIOMETRIC` y `MainActivity` basada en `FlutterFragmentActivity`; iOS necesita `NSFaceIDUsageDescription`, iOS 13 o superior y `REVERSED_CLIENT_ID` como URL scheme.

Las cuentas y transacciones escriben directamente a Firestore mediante transacciones. Las reglas restringen los registros al usuario autenticado, validan estructura y verifican cuentas referenciadas. No se requiere Functions ni Blaze. Las transacciones requieren conexion; otras operaciones directas pueden usar persistencia offline.

### Ajustes nativos de biometría

**Android:** `minSdk = 23`, permiso `USE_BIOMETRIC`, `MainActivity` extiende `FlutterFragmentActivity` y los temas usan `Theme.AppCompat.DayNight`.

**iOS:** agrega `NSFaceIDUsageDescription`, usa iOS 13 o superior y configura el `REVERSED_CLIENT_ID` de Google Sign-In como URL scheme.

La aplicacion usa la base Firestore `ai-studio-walletv1-cde1c2b5-f2a2-489f-8062-58e6963a288b`, igual que la web. Las transacciones de movimientos requieren conexion.

## Seguridad PIN

El PIN no se sincroniza. Se almacena con sal y hash iterado en Keystore/Keychain. Los cinco primeros intentos fallidos activan bloqueos progresivos. La biometría es opcional y el PIN sigue como respaldo. El bloqueo es privacidad local y no reemplaza Firebase Auth.

## Archivos de dominio

- `lib/core/engines/financial_engine.dart`: validación de movimientos, balances y totales.
- `lib/core/engines/period_engine.dart`: validación y generación de subperíodos, asociación de fecha.
- `lib/core/repositories/wallet_repository.dart`: seed compatible con web, lecturas en tiempo real y transacciones Firestore cliente para cuentas/movimientos.
- `lib/core/firebase/wallet_providers.dart`: streams autenticados de datos.
- `lib/features/`: pantallas por función.

## Estado de comprobación

Las carpetas Android/iOS estan generadas y `cloud_functions` se quito de dependencias. `firebase_options.dart` sigue siendo placeholder; Flutter analyze/build y prueba funcional siguen pendientes. Las transacciones de movimientos requieren conexion; la cola offline movil para estas operaciones queda pendiente.
