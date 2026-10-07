# Wallet: contexto del proyecto

Guía de orientación para trabajar en este repositorio. Describe la estructura y el comportamiento visibles en el código; no reemplaza una auditoría funcional o de seguridad. Mantener esta guía sincronizada cuando cambien arquitectura, flujos o comandos.

## Producto y stack

Wallet es una aplicación web de finanzas personales en español, orientada a quetzales (GTQ). Permite gestionar cuentas, tarjetas, categorías, ingresos, gastos, transferencias, períodos financieros, presupuestos y análisis.

| Área | Implementación actual |
|---|---|
| Interfaz | React 19, TypeScript 7, Vite 8, Tailwind CSS 4 |
| Componentes y animación | Lucide React y Motion |
| Datos y autenticación | Firebase Auth y Cloud Firestore mediante SDK web |
| PWA | `vite-plugin-pwa`/Workbox, actualización automática, manifest `standalone`, caché de recursos y caché de fuentes Google |
| Backend adicional | Firebase Cloud Functions v2 callable en `functions/`, Node.js 22 y Firebase Admin |
| Hosting | Firebase Hosting publica `dist/` y reescribe rutas a `index.html` |
| Idioma y moneda | Interfaz en español; `formatGTQ` formatea GTQ |

La aplicación móvil Flutter ya no forma parte del repositorio. La experiencia móvil se entrega como PWA.

## Estructura

| Ruta | Responsabilidad |
|---|---|
| `src/main.tsx`, `src/App.tsx`, `src/index.css` | Punto de entrada, shell/navegación, tema y estilos globales. |
| `src/core/types/models.ts` | Tipos de cuentas, movimientos, categorías, períodos, presupuestos, perfil y preferencias. |
| `src/core/data/initialData.ts` | Tienda inicial, categorías y períodos predeterminados. |
| `src/core/state/WalletContext.tsx` | Estado central, autenticación, persistencia local, listeners y operaciones de dominio. |
| `src/core/sync/offlineQueue.ts` | Cola persistente en `localStorage`, procesamiento secuencial y reintentos/conectividad. |
| `src/core/firebase/firebase.ts` | Inicialización de Firebase Auth/Firestore y tratamiento de errores. |
| `src/core/firebase/firestoreSync.ts` | Sincronización de perfil, preferencias y entidades con Firestore; transacciones de cuenta/movimiento. |
| `src/core/security/` | PIN local, biometría WebAuthn, configuración, pantalla de bloqueo y hook de autobloqueo. |
| `src/core/pwa/` | Detección de instalación/modo standalone y modal de instrucciones PWA. |
| `src/core/utils/formatters.ts` | Formato de importes/fechas y evaluación aritmética. |
| `src/core/widgets/` | Selectores reutilizables de cuentas y períodos. |
| `src/features/auth/` | Registro, acceso, Google y recuperación de contraseña. |
| `src/features/accounts/` | Cuentas y tarjetas: visualización, edición, archivo y gestión de saldos. |
| `src/features/transactions/` | Lista, modal y filtros de movimientos; `financialEngine.ts` valida movimientos y calcula saldos/resúmenes. |
| `src/features/financial_periods/` | Gestión, validación y cálculo de períodos/subperíodos. |
| `src/features/annual_budget/` | Presupuesto y Panorama Anual; matriz proyectado/real en vistas mensual, trimestral, semestral y anual, más exportación CSV. |
| `src/features/analytics/` | Resúmenes, métricas, visualizaciones y exportación CSV. |
| `src/features/dashboard/` | Resumen del período, saldos, actividad, acumulado YTD y alertas presupuestarias. |
| `src/features/settings/` | Vista Más y accesos a configuración, seguridad e instalación. |
| `functions/src/index.ts` | Callable Functions para operaciones de cuentas y movimientos y limpieza financiera. |
| `public/` | Iconos PWA, favicon y Apple touch icon. |

## Modelo de datos

Los datos de usuario se organizan en `users/{uid}`. El perfil está en el documento del usuario; las subcolecciones principales son `settings`, `accounts`, `categories`, `periods`, `transactions` y `budgets`. En `settings` se guardan el documento `default`, las preferencias de bloqueo en `security` y los planes anuales `projections_{year}`. También se usan `accountTombstones` en las Cloud Functions. Las reglas de Firestore se encuentran en `firestore.rules` y aplican denegación por defecto y aislamiento por propietario.

Modelos relevantes en `src/core/types/models.ts`:

- Las cuentas incluyen efectivo, banco, ahorro y tarjeta de crédito; estas últimas representan la deuda con saldo no positivo.
- Los movimientos son gastos, ingresos o transferencias, con fecha ISO y referencias opcionales a período/subperíodo.
- `FinancialPeriod` contempla `referenceMonth` y `monthIndex` para asociar períodos con meses del panorama.
- `Budget` se relaciona con un período y categoría, con metas y alertas configurables. Los planes proyectados anuales se guardan por usuario/año en `users/{uid}/settings/projections_{year}`; las metas reales por período permanecen en `budgets`.
- `UserSettings` incluye tema, ocultamiento de saldos y período activo.

## Comportamientos implementados

- La tienda local del usuario se persiste en `localStorage`; los cambios remotos se sincronizan con listeners de Firestore.
- `offlineQueue.ts` conserva operaciones pendientes por usuario en `localStorage` y las procesa cuando hay conexión. La disponibilidad offline depende de la operación y de datos previamente guardados; no asumir que todos los flujos remotos se pueden completar sin conexión.
- `firestoreSync.ts` aplica validación de dominio y usa transacciones de Firestore para guardar/eliminar movimientos junto con saldos relacionados. No describir esto como `writeBatch`: el código usa `runTransaction`.
- Las reglas de Firestore permiten operaciones autenticadas del propietario sujetas a validaciones específicas por colección.
- `functions/src/index.ts` declara funciones callable para cuentas y movimientos. Confirmar si una función está conectada al cliente antes de describirla como parte del flujo normal; el cliente también implementa sincronización directa con SDK web.
- El PIN nunca se sincroniza en texto: se sincroniza su verificador PBKDF2-SHA256 con sal y parámetros en `users/{uid}/settings/security`; verificadores SHA-256 antiguos se migran al validar el PIN. La configuración global del bloqueo se sincroniza. La credencial y activación biométrica WebAuthn siguen siendo locales a cada dispositivo. No afirmar que la información financiera está cifrada localmente ni que una credencial WebAuthn se almacena en un “enclave” específico.
- El hook de seguridad gestiona bloqueo por visibilidad/inactividad; los tiempos y controles exactos se definen en `securityService.ts` y `SecuritySettingsModal.tsx`.
- Vite configura manifest `standalone`, actualización automática del service worker, iconos PNG/SVG y precaché según `globPatterns`. Verificar archivos y configuración antes de afirmar compatibilidad o cobertura completa offline.
- El Presupuesto & Panorama Anual calcula proyecciones y valores reales desde los datos configurados; los planes anuales se sincronizan en `users/{uid}/settings/projections_{year}` en tiempo real y el contexto reactivo (`projectionsVersion`) actualiza el resumen del Dashboard al guardar o recibir cambios.
- La sincronización automática hacia presupuestos por período (`budgets`) aplica exclusivamente a categorías de egreso (`type === 'expense'`); las categorías de ingreso no generan documentos de presupuesto y `saveBudget` rechaza categorías que no sean de egreso.
- Al fijar una meta o mes en cero (`0`) en el plan, el sistema elimina limpiamente cualquier presupuesto directo existente en ese período (`deleteBudget`) en lugar de rechazarlo, y la matriz respeta los overrides en cero prioritariamente (soportando claves numéricas y string).
- El módulo de Cumplimiento de Presupuestos en Análisis evalúa únicamente categorías de egreso y desduplica los registros por categoría.
- `seedUserInitialData` en `firestoreSync.ts` valida la presencia previa de documentos antes de inicializar colecciones; jamás recrea categorías, períodos o presupuestos que el usuario haya eliminado deliberadamente. `mergeLocalStoreForUpload` no reinyecta categorías predeterminadas ya descartadas en el almacenamiento local.
- Al eliminar una categoría (`deleteCategory`), se remueven también sus proyecciones anuales vinculadas para evitar claves huérfanas.

## Comandos

Desde la raíz:

```bash
npm install
npm run dev       # Vite en el puerto 3000, host 0.0.0.0
npm run lint      # tsc --noEmit
npm run build     # vite build; salida en dist/
npm run preview
```

Funciones:

```bash
cd functions
npm run build
npm run deploy
```

`npm run clean` está definido con sintaxis `rm -rf`; considerar que es un comando de eliminación y revisar el entorno antes de ejecutarlo.

## Guía de mantenimiento

- Revisar primero `git status`; preservar cambios locales que ya existan.
- No inferir que una descripción antigua en este archivo sigue vigente: confirmar en el código y configuración.
- Al modificar flujos de datos, revisar en conjunto el estado local, `offlineQueue.ts`, `firestoreSync.ts`, reglas y, cuando corresponda, `functions/`.
- Al cambiar el modelo, actualizar los consumidores y este documento si la arquitectura o las reglas descritas cambian.
- No ejecutar pruebas o comandos que muten datos remotos sin autorización explícita. Los comandos `lint` y `build` son comprobaciones locales.
