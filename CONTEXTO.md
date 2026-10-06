# Contexto del proyecto Wallet

Documento de orientación basado en el código y la configuración presentes en el repositorio al momento de su creación. No sustituye una auditoría funcional o de seguridad.

## 1. Qué hace y stack

Wallet es una aplicación web de finanzas personales en español, enfocada en GTQ (quetzales). Permite registrar cuentas y tarjetas, ingresos, gastos y transferencias; organizar transacciones por períodos financieros; planificar y monitorear proyecciones y presupuestos a través de un único sistema unificado de **Presupuesto & Panorama Anual** (con vistas Anual, Semestral, Trimestral y Mensual) y consultar resúmenes acumulativos y análisis en tiempo real.

| Área | Tecnología / evidencia |
|---|---|
| Interfaz | React 19, TypeScript, Vite 8, Tailwind CSS 4 |
| Componentes | Lucide React; Motion está declarado como dependencia |
| Backend de datos y autenticación | Firebase Auth y Cloud Firestore, SDK web |
| Progressive Web App (PWA) | `vite-plugin-pwa`, Workbox, manifest standalone, iconos conformes, precache offline y soporte WebAuthn |
| Hosting configurado | Firebase Hosting, publica `dist/` y redirige rutas a `index.html` |
| Idioma y moneda de interfaz | Español; formateo de moneda fijado a GTQ en `formatGTQ` |

Se retiraron `@google/genai`, Express, `dotenv` y `@types/express`. También se eliminó la carpeta `/mobile` (Flutter) a solicitud del usuario para concentrar la experiencia en Progressive Web App (PWA) instalable, con biometría y modo sin conexión.

## 2. Estructura y responsabilidades

| Ruta | Responsabilidad |
|---|---|
| `src/main.tsx` | Monta React y carga estilos globales. |
| `src/App.tsx` | Shell autenticado, barra superior con botón de acción estilizado, navegación principal, tema, apertura de vistas/modales, botón de bloqueo rápido, botón de instalación PWA y overlay de bloqueo `SecurityLockScreen`. |
| `src/index.css` | Estilos globales y reglas de alto contraste. |
| `src/core/types/models.ts` | Tipos de dominio y modelos de datos (incluyendo `activePeriodId` en `UserSettings` y `monthIndex` en `FinancialPeriod`). |
| `src/core/data/initialData.ts` | Categorías por defecto, tienda inicial vacía y datos de demostración. |
| `src/core/state/WalletContext.tsx` | Estado central, autenticación, persistencia local, operaciones de dominio, reconciliación de snapshots y orquestación con la cola offline. |
| `src/core/sync/offlineQueue.ts` | Gestor de cola offline persistente (`localStorage`), reprocesamiento secuencial ante eventos `online`, reintentos automáticos y emisión de estados. |
| `src/core/security/securityService.ts` | Servicio de seguridad con biometría nativa WebAuthn (`PublicKeyCredential` para huella/FaceID), cifrado y hash de PIN (SHA-256 + salt con Web Crypto API) y reglas de autobloqueo 100% offline. |
| `src/core/security/SecurityLockScreen.tsx` | Pantalla completa de bloqueo con teclado numérico táctil, indicadores de puntos, feedback táctil y botón de desbloqueo biométrico automático o por toque. |
| `src/core/security/SecuritySettingsModal.tsx` | Modal de configuración de PIN de 4 dígitos, registro de huella/FaceID, temporizador de bloqueo (inmediato, 1m, 5m, 15m) y prueba de bloqueo. |
| `src/core/security/useAppLock.ts` | Hook de gestión de bloqueo que vigila `visibilitychange`, foco de ventana e inactividad. |
| `src/core/pwa/usePWAInstall.ts` | Hook de instalación PWA: detecta modo `standalone`, iOS Safari y evento `beforeinstallprompt`. |
| `src/core/pwa/PWAInstallModal.tsx` | Modal guiado de instalación para teléfonos móviles y escritorios con instrucciones paso a paso para iOS Safari. |
| `src/core/firebase/firebase.ts` | Inicialización de Firebase/Auth/Firestore, proveedor de Google y manejo de errores. |
| `src/core/firebase/firestoreSync.ts` | Escritura/borrado atómico (`writeBatch`) de transacciones y saldos de cuentas, carga inicial segura y saneamiento de registros. |
| `src/core/utils/formatters.ts` | Formateo de GTQ/fechas y evaluación de expresiones de calculadora. |
| `src/core/widgets/` | Selectores reutilizables de cuenta (`AccountSelectDropdown`) y período (`PeriodSelectorBar`). |
| `src/features/auth/` | Registro, inicio de sesión, Google y recuperación de contraseña. |
| `src/features/dashboard/` | Inicio, resumen, accesos rápidos, actividad reciente, tarjeta estelar de **Resumen Acumulado del Año (Proyectado vs. Real YTD)** y alertas inteligentes de categorías. |
| `src/features/accounts/` | Cuentas, tarjetas, creación/edición, archivo, pagos y selector de colores. |
| `src/features/transactions/` | Lista, filtros y formulario modal con navegación en una sola fila; botón de nueva transacción de solo icono táctil estilizado; `financialEngine.ts` contiene validaciones y cálculos. |
| `src/features/financial_periods/` | Administración y cálculo de períodos/subperíodos, con selector desplegable de mes representativo para el Panorama Anual (`monthIndex`). |
| `src/features/annual_budget/` | **Único sistema unificado de Presupuesto y Panorama Anual**: matriz comparativa (Proyectado vs Real) en 4 horizontes temporales (Mensual 12M, Trimestral T1-T4, Semestral S1-S2, Anual Consolidado), basada 100% en las categorías configuradas del sistema, sincronizada con las fechas y metas de los períodos financieros, y exportación CSV. Incluye controles compactos, tipografía sutil optimizada para móviles y botón para colapsar/ocultar las tarjetas de Proyectado vs Real. |
| `src/features/analytics/` | Resúmenes/visualizaciones, métricas y exportación CSV. |
| `src/features/settings/` | Ajustes, categorías, opciones de seguridad & bloqueo PWA, instalación y sincronización. |

## 3. Modelo de datos y reglas de negocio

Los documentos de datos se guardan bajo `users/{uid}`. Sus subcolecciones son `settings`, `accounts`, `categories`, `periods`, `transactions` y `budgets`; perfiles viven en el documento `users/{uid}`.

Reglas confirmadas en el código:

- **Arquitectura PWA y Sin Conexión (Offline-First):**
  - La aplicación está configurada con `vite-plugin-pwa`, `manifest.webmanifest` independiente (`standalone`), iconos conformes (192px, 512px y 512px maskable con zona segura) y service worker Workbox que prealmacena en caché todos los activos estáticos y tipografías.
  - La base de datos y la cola de transacciones locales permiten operar 100% sin conexión, registrando ingresos y gastos aun en zonas sin cobertura.
- **Seguridad y Bloqueo Local (Biometría y PIN):**
  - **Biometría WebAuthn (`PublicKeyCredential`):** Permite autenticación con la huella dactilar nativa (Android) o Touch ID / Face ID (Apple). Se almacena la credencial en el enclave seguro del navegador sin requerir servidores externos.
  - **PIN Maestro (4 dígitos):** Se almacena utilizando sal criptográfica aleatoria de 16 bytes y hash SHA-256 generado con la Web Crypto API (`crypto.subtle.digest`).
  - **Autobloqueo:** Configurable para activarse de inmediato al cambiar de app o minimizar (`visibilitychange`), o por inactividad tras 1, 5 o 15 minutos.
  - **Botón de Bloqueo Inmediato:** Accesible desde el encabezado superior y desde la configuración de seguridad.
- **Sistema Unificado de Presupuesto:** Un único presupuesto anual alimenta toda la aplicación y las alertas en tiempo real en el Dashboard.
- **Atomicidad transaccional:** Toda creación, edición o eliminación de transacción sincroniza en Firestore la transacción y todos los saldos de cuenta afectados en una sola operación por lotes atómica (`writeBatch`).
- **Cola offline persistente y reintentos:** Las operaciones se encolan en `localStorage` (`wallet_offline_queue_${userId}`). Si no hay conexión o falla la red, los cambios se retienen y se procesan automáticamente cuando el dispositivo recupera señal (`online`).

## 4. Flujos principales

1. **Autenticación y Carga:** Al iniciar, si el bloqueo de seguridad está activo, `SecurityLockScreen` solicita el PIN o la biometría antes de permitir ver cualquier saldo. Al desbloquearse, conecta los oyentes en tiempo real.
2. **Instalación PWA:** Desde el botón "Instalar" en el encabezado o en la sección Más, el usuario en Android/PC puede instalar la PWA nativamente en su pantalla de inicio; en iOS Safari se muestra la guía ilustrada de 3 pasos (Compartir -> Agregar a pantalla de inicio).
3. **Registro y Edición de Transacciones:** Botón táctil estilizado, cálculo automático de saldos y encolamiento atómico offline.
4. **Períodos y Presupuestos:** Selector desplegable de mes representativo (`monthIndex`), sincronizado con el Panorama Anual.
5. **Configuración de Seguridad:** En "Más -> PWA & Seguridad Local", se puede configurar o cambiar el PIN, registrar el sensor biométrico, definir el tiempo de autobloqueo y probar el bloqueo de inmediato.

## 5. Estado actual

| Estado | Elementos |
|---|---|
| Implementado en el código | Vistas principales; Auth; CRUD de cuentas/categorías/períodos/transacciones; **PWA completa con manifest standalone y Service Worker Workbox**; **iconos 192, 512, maskable y apple-touch-icon**; **sistema de seguridad biométrica (WebAuthn / Huella / Face ID)**; **PIN maestro de 4 dígitos con cifrado local SHA-256**; **pantalla de bloqueo táctil y autobloqueo al salir de la app**; **modal guiado de instalación PWA con soporte iOS**; único sistema unificado de Presupuesto y Panorama Anual; tarjeta en Dashboard de Resumen Acumulado YTD; listeners Firestore con cola offline persistente; atomicidad con `writeBatch`; reglas de Firestore desplegadas. Carpeta `/mobile` eliminada con éxito. |
| Comprobación técnica | `npm run lint` (`tsc --noEmit`) termina con código 0. `npm run build` (`vite build`) genera el bundle PWA con `sw.js` y `manifest.webmanifest` exitosamente. |

## 6. Cómo ejecutar y comprobar

```bash
npm install
npm run dev
```

Vite escucha en `http://localhost:3000`.

```bash
npm run lint     # ejecuta tsc --noEmit
npm run build    # genera dist/ con Service Worker y manifest
```
