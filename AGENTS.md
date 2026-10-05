# Contexto del proyecto Wallet

Documento de orientación basado en el código y la configuración presentes en el repositorio al momento de su creación. No sustituye una auditoría funcional o de seguridad.

## 1. Qué hace y stack

Wallet es una aplicación web de finanzas personales en español, enfocada en GTQ (quetzales). Permite registrar cuentas y tarjetas, ingresos, gastos y transferencias; organizar transacciones por períodos financieros; planificar y monitorear proyecciones y presupuestos a través de un único sistema unificado de **Presupuesto & Panorama Anual** (con vistas Anual, Semestral, Trimestral y Mensual) y consultar resúmenes acumulativos y análisis en tiempo real.

| Área | Tecnología / evidencia |
|---|---|
| Interfaz | React 19, TypeScript, Vite 8, Tailwind CSS 4 |
| Componentes | Lucide React; Motion está declarado como dependencia |
| Backend de datos y autenticación | Firebase Auth y Cloud Firestore, SDK web |
| Hosting configurado | Firebase Hosting, publica `dist/` y redirige rutas a `index.html` |
| Idioma y moneda de interfaz | Español; formateo de moneda fijado a GTQ en `formatGTQ` |

Se retiraron `@google/genai`, Express, `dotenv` y `@types/express`: no tenían importaciones ni uso en el proyecto. También se eliminó `.env.example`, que solo declaraba `GEMINI_API_KEY` sin consumidor.

## 2. Estructura y responsabilidades

| Ruta | Responsabilidad |
|---|---|
| `src/main.tsx` | Monta React y carga estilos globales. |
| `src/App.tsx` | Shell autenticado, barra superior con botón de acción estilizado (solo icono interactivo), navegación principal, tema, apertura de vistas/modales y barra de estado de sincronización / sin conexión. |
| `src/index.css` | Estilos globales y reglas de alto contraste. |
| `src/core/types/models.ts` | Tipos de dominio y modelos de datos (incluyendo `activePeriodId` en `UserSettings`). |
| `src/core/data/initialData.ts` | Categorías por defecto, tienda inicial vacía y datos de demostración. |
| `src/core/state/WalletContext.tsx` | Estado central, autenticación, persistencia local, operaciones de dominio, reconciliación de snapshots y orquestación con la cola offline. |
| `src/core/sync/offlineQueue.ts` | Gestor de cola offline persistente (`localStorage`), reprocesamiento secuencial ante eventos `online`, reintentos automáticos y emisión de estados. |
| `src/core/firebase/firebase.ts` | Inicialización de Firebase/Auth/Firestore, proveedor de Google y manejo de errores. |
| `src/core/firebase/firestoreSync.ts` | Persistencia directa a Firestore; transacciones cliente para movimientos y saldos; seed, reset y saneamiento. |
| `src/core/utils/formatters.ts` | Formateo de GTQ/fechas y evaluación de expresiones de calculadora. |
| `src/core/widgets/` | Selectores reutilizables de cuenta (`AccountSelectDropdown`) y período (`PeriodSelectorBar`). |
| `src/features/auth/` | Registro, inicio de sesión, Google y recuperación de contraseña. |
| `src/features/dashboard/` | Inicio, resumen, accesos rápidos, actividad reciente, tarjeta estelar de **Resumen Acumulado del Año (Proyectado vs. Real YTD)** y alertas inteligentes de categorías (sobregiro >100% y límite >80%). |
| `src/features/accounts/` | Cuentas, tarjetas, creación/edición, archivo, pagos y selector de colores. |
| `src/features/transactions/` | Lista, filtros y formulario modal con navegación en una sola fila; botón de nueva transacción de solo icono táctil estilizado; `financialEngine.ts` contiene validaciones y cálculos. |
| `src/features/financial_periods/` | Administración y cálculo de períodos/subperíodos. |
| `src/features/annual_budget/` | **Único sistema unificado de Presupuesto y Panorama Anual**: matriz comparativa (Proyectado vs Real) en 4 horizontes temporales (Mensual 12M, Trimestral T1-T4, Semestral S1-S2, Anual Consolidado), basada 100% en las categorías configuradas del sistema, sincronizada con las fechas y metas de los períodos financieros, y exportación CSV. Se eliminó la duplicidad de presupuestos individuales aislados. |
| `src/features/analytics/` | Resúmenes/visualizaciones, métricas y exportación CSV. |
| `src/features/settings/` | Ajustes, categorías, opciones y acciones de sincronización. |
| `mobile/` | Aplicación Flutter que comparte Firebase Auth y el esquema de Firestore con la web; pantallas móviles, seguridad local por PIN/biometría y acceso a datos financieros. |

## 3. Modelo de datos y reglas de negocio

Los documentos de datos se guardan bajo `users/{uid}`. Sus subcolecciones son `settings`, `accounts`, `categories`, `periods`, `transactions` y `budgets`; perfiles viven en el documento `users/{uid}`. El esquema orientativo también aparece en `firebase-blueprint.json`.

| Entidad | Campos/relaciones principales |
|---|---|
| `UserProfile` | Identificador Firebase, nombre, correo, proveedor y fecha de creación. |
| `UserSettings` | Moneda, decimales, tema, ocultar saldos, `activePeriodId` compartido y opciones de protección/simulación. |
| `Account` | Tipo `cash`, `bank`, `savings` o `credit_card`; saldo inicial/actual, moneda, estado y datos de tarjeta. |
| `Category` | Tipo `expense` o `income`; contiene subcategorías embebidas. |
| `FinancialPeriod` | Nombre libre, mes de referencia explícito para el Panorama Anual, rango inclusivo de fechas, modo de división y subperíodos embebidos. Los documentos anteriores sin `referenceMonth` siguen siendo compatibles. |
| `Transaction` | Tipo `expense`, `income` o `transfer`; monto, moneda, fecha, cuenta/categoría o cuentas de origen/destino, y referencias opcionales de período. |
| `Budget` | Meta para un período y categoría, opcionalmente subcategoría, con banderas de umbral y distribución. |
| `AnnualProjectionsPlan` | Proyecciones anuales por categoría con monto base mensual y overrides por mes específico, sincronizada bidireccionalmente con los presupuestos de cada período. |

Reglas confirmadas en el código:

- **Sistema Unificado de Presupuesto:** Se eliminó la duplicidad de plantillas de presupuesto. Solo existe el Presupuesto Proyectado Anual por categoría, el cual alimenta tanto las alertas visuales en el Dashboard como la matriz comparativa de proyecciones y ejecución real.
- **Resumen Acumulado en el Panel:** El Dashboard muestra el progreso acumulativo anual (YTD) de Ingresos Proyectados vs Reales, Egresos Proyectados vs Reales y Ahorro Neto, junto con alertas en tiempo real de categorías que exceden el 80% o el 100% de su presupuesto mensual.
- **Conexión entre Períodos y Proyecciones:**
  - Cada período tiene un dropdown de mes de referencia independiente del nombre y las fechas; el Panorama Anual usa primero ese mes explícito, manteniendo heurísticas de fecha/nombre para períodos antiguos sin `referenceMonth`.
  - Las fechas siguen determinando el rango real de transacciones y se pueden configurar de forma independiente al mes representado.
  - Si existe un `Budget` configurado para ese período y categoría, la celda de proyección toma automáticamente esa meta real.
  - Para el valor real, se agrupan las transacciones que caen en las fechas del período financiero correspondiente.
  - Al editar y guardar en la pestaña de presupuestos del Panorama, los cambios se sincronizan automáticamente hacia la colección de presupuestos (`budgets`) de los períodos activos.
  - Columnas limpias con fechas reales del período en el subtítulo (ej. `10-01 al 10-31` o `09-25 al 10-24`).
  - Bloque de Ingresos arriba, Egresos abajo y Fila final de Diferencia Neta (Ingresos - Egresos).
- **Atomicidad cliente y validacion:** Web y Flutter calculan movimientos por separado y usan transacciones Firestore para releer el movimiento y saldos vigentes y guardar los cambios juntos. Rules restringe UID, IDs, campos basicos y referencias. Rules no garantiza toda la aritmetica financiera frente a un cliente manipulado; el propietario puede modificar sus propios datos desde un cliente personalizado.
- **Cuentas multi-dispositivo:** El arranque web ya no vuelve a subir cuentas ni movimientos desde la copia general de `localStorage`; las escrituras offline pendientes continúan en la cola web. Las cuentas usan IDs aleatorios y las eliminaciones registran tombstones para rechazar escrituras pendientes viejas. Se normalizan documentos legados de tarjeta cuyo saldo inicial y actual quedaron positivos.
- **IDs de documentos:** Los listeners web usan como ID canónico el ID del documento Firestore, no el campo `id` embebido.
- **Cola offline persistente y reintentos:** Las operaciones se encolan en `localStorage` (`wallet_offline_queue_${userId}`). Si no hay conexión o falla la red, los cambios se retienen y se procesan automáticamente cuando el dispositivo recupera señal (`online`), la pestaña gana foco o mediante reintentos periódicos.
- **Reconciliación de snapshots:** Al recibir un snapshot remoto en `onSnapshot`, se coteja contra las mutaciones pendientes locales en la cola. Las transacciones y cuentas creadas o editadas localmente que aún no han impactado en Firestore se conservan en pantalla (evitando parpadeos o que desaparezcan); las transacciones marcadas para eliminación local no reaparecen.
- **Consistencia multi-dispositivo:** `activePeriodId` se persiste y sincroniza en `UserSettings` en Firestore. Además, las vistas de transacciones y resumen asocian transacciones al período tanto por `periodId` como por rango de fechas inclusivo (`startDate <= date <= endDate`), garantizando que las transacciones registradas desde un dispositivo se visualicen de inmediato en otros dispositivos sin perderse por discrepancias de períodos iniciales.
- **Prevención de duplicados en seed:** Al iniciar sesión en un dispositivo nuevo, `seedUserInitialData` verifica si el usuario ya posee períodos o categorías en Firestore antes de generar registros por defecto, evitando la inyección de períodos ficticios redundantes.
- **Restablecimiento de cuenta:** Configuraciones permite borrar transacciones, cuentas, presupuestos y períodos, restaurar las categorías iniciales y limpiar planes locales de proyección. Conserva identidad de acceso, perfil y preferencias; requiere confirmación y conexión/sincronización completa para cuentas Firebase.
- Las cuentas archivadas no se aceptan en nuevas transacciones. Las tarjetas de crédito representan deuda con saldo actual menor o igual a cero; el gasto puede validarse contra el límite disponible.
- Una transferencia necesita dos cuentas activas distintas y no requiere categoría. Se marca como pago de tarjeta si el destino es tarjeta o si se indica explícitamente.
- Los períodos no pueden solaparse. Los subperíodos se generan en modo semanal, quincenal, mensual o sin subdivisión. Las fechas de inicio y fin son inclusivas.
- Los gastos de presupuesto se calculan por rango de fechas y categoría/subcategoría; no se convierten monedas en los cálculos revisados.
- El resumen del período resta gastos de ingresos; las transferencias no alteran el resultado neto.
- Los importes se representan como `number` de JavaScript, se redondean a dos decimales al guardar transacciones/presupuestos y al aplicar cambios a saldos.
- Firestore Rules usa denegacion por defecto, restringe datos por UID autenticado y valida campos basicos en cuentas y transacciones. No se usan Cloud Functions; el proyecto puede permanecer en Spark.

## 4. Flujos principales

1. **Autenticación y carga:** al iniciar, el contexto observa Firebase Auth. Si no hay usuario, muestra `AuthScreen`; si hay usuario, construye el perfil, prepara datos iniciales, sincroniza perfil/seed (sin duplicar períodos ni categorías si ya existen en remoto) y conecta listeners en tiempo real con reconciliación optimista.
2. **Nuevo usuario:** se crea una tienda vacía con categorías iniciales y un período mensual para el mes calendario actual. El seed solo crea documentos remotos que aún no existan.
3. **Registrar transaccion:** se valida la entrada, se resuelve periodo/subperiodo, se actualizan saldos optimistas y se encola en `offlineQueue`. Al reconectar, una transaccion Firestore relee los saldos vigentes y confirma movimiento/saldos juntos.
4. **Editar/eliminar transacción:** se comprueba propiedad, se revierte su impacto anterior en saldos, se aplica el nuevo y se encola atómicamente en `offlineQueue`.
5. **Períodos y presupuestos:** los cambios de período sincronizan `activePeriodId` en `UserSettings` y en los documentos de período, actualizando a todos los dispositivos sincronizados.
6. **Panorama y Presupuesto Único:** Accesible desde el Dashboard (botón estelar y acceso rápido), Análisis y Más. Presenta la matriz adaptable en horizontes Anual, Semestral, Trimestral y Mensual con las categorías reales del usuario, directamente amarrada a los presupuestos y fechas de los períodos configurados, y exportación CSV.
7. **Modo de demostración/local:** `switchUserMode` ofrece los modos `demo_francisco` y `clean_new_user`; la aplicación conserva una base por usuario en `localStorage`.
8. **Tema y navegación:** las pestañas principales son Inicio, Cuentas, Transacciones, Análisis y Más. El tema soporta claro, oscuro y sistema.
9. **Modo sin conexión y reconexión:** Si el usuario pierde conexión, la interfaz muestra un indicador de modo sin conexión con el conteo de cambios pendientes. Al regresar internet, la cola vacía automáticamente las mutaciones y Firestore propaga los cambios a otros dispositivos vía `onSnapshot`.

## 5. Estado actual

El estado describe presencia en el código, no validación de calidad ni despliegue.

| Estado | Elementos |
|---|---|
| Implementado en el código | Vistas principales; Auth por correo/contraseña y Google; CRUD de cuentas/categorías/períodos/transacciones; períodos con nombre libre y dropdown de mes de referencia para vincularlos explícitamente al Panorama; restablecimiento de datos financieros desde Configuraciones con confirmación y conservación de identidad/preferencias; cálculo de saldos y períodos; **único sistema unificado de Presupuesto y Panorama Anual** (Proyectado vs Real en horizontes Anual, Semestral, Trimestral y Mensual, con categorías reales del sistema, bloques de Ingresos arriba, Egresos abajo, Diferencia neta, cabeceras limpias, sincronización con períodos y exportación CSV); **tarjeta en el Dashboard de Resumen Acumulado del Año (YTD) y Alertas de Presupuesto por Categoría**; botones de agregar transacción de solo icono táctil y estilizado; listeners Firestore con reconciliación; almacenamiento local; cola offline persistente con reintentos automáticos; transacciones Firestore cliente para movimientos y saldos en web/movil; sincronización multi-dispositivo del período activo; selectores personalizados de alto contraste; exportación CSV. Se retiró la plantilla duplicada de presupuestos individuales. |
| En progreso / por verificar | Probar en producción el alta/edición de períodos y la asociación del mes en el Panorama Anual. |
| Pendiente conocido | No se encontró suite de pruebas automatizadas unitarias con script `test`. |
| Riesgos/observaciones de codigo | `firebase-applet-config.json` contiene configuracion cliente publica. Rules limita acceso por usuario y estructura, pero la validacion aritmetica reside en los clientes. |

**Despliegue 2026-10-05:** Firestore Rules y Hosting se desplegaron al proyecto `fintrack-gt`; Hosting publica en `https://wallet-gt.web.app`. No se desplegaron Cloud Functions y `firebase.json` ya no las configura.

**Aplicacion Flutter (`mobile/`):** Comparte Firebase Auth y Firestore nombrado (`kFirestoreDatabaseId`). Cuentas y movimientos usan transacciones Firestore cliente y el mismo esquema que web. `firebase_options.dart` configurado con credenciales Android, iOS y Web de `fintrack-gt`.

**Revisión y mejoras móvil y web Flutter (2026-10-05):**
- **Habilitación de Flutter Web:** En `mobile/lib/firebase_options.dart` se configuraron las opciones de Firebase para Web (`kIsWeb`), resolviendo la excepción `UnsupportedError` al compilar o ejecutar en Chrome/Web.
- **Google Sign-In en Web:** En `auth_repository.dart` se habilitó `signInWithPopup(GoogleAuthProvider())` en web, y se agregó `<meta name="google-signin-client_id">` en `mobile/web/index.html`.
- **Diseño responsivo:** `MainShell` se adaptó para mostrar `NavigationRail` en pantallas medianas/grandes (>= 720px) con ancho centrado máximo de 860px, y `NavigationBar` en móviles.
- **Resiliencia de almacenamiento y biometría en Web:** `FlutterSecureKv` incluye fallback a memoria para entornos web con restricciones de almacenamiento seguro, y `BiometricService` captura excepciones no soportadas sin romper la app.
- **Sincronización de tarjetas de crédito:** Campos y badges de `cutoffDay` y `paymentDueDay` en cuentas.
- **Transacciones y períodos:** Asignación con fallback al período activo y filtrado dual por `periodId` o rango de fechas.
- **Desacople de functions:** Excluido `functions/` en `tsconfig.json` para validación `tsc` limpia.

### Actualizacion 2026-10-05 - persistencia directa en Spark

- Se quitaron las llamadas a Cloud Functions de web y Flutter y la configuracion Functions de `firebase.json`. El codigo en `functions/` no esta desplegado ni participa del flujo.
- Web y Flutter recalculan saldos con transacciones Firestore a partir del movimiento previo y las cuentas remotas actuales. La web conserva cola offline; las transacciones financieras requieren conexion.
- Rules valida propietario, campos basicos, IDs y existencia de cuentas relacionadas. No reemplaza la logica financiera ni impide al propietario cambiar sus propios documentos desde un cliente manipulado.
- El sitio `wallet-gt` se creo dentro de `fintrack-gt`; Rules y Hosting ya estan desplegados en `https://wallet-gt.web.app`. El sitio original `fintrack-gt.web.app` sigue intacto.
- `npm run lint`: correcto. `npm run build`: correcto fuera del sandbox; quedan avisos de `__dirname` y bundle >500 kB.
- Se quito `cloud_functions` de dependencias Flutter. `firebase_options.dart` sigue como placeholder; Flutter analyze/build y prueba funcional entre dispositivos pendientes. No se ejecutaron pruebas automatizadas.
