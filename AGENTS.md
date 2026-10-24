# Wallet: contexto del proyecto

Guía de orientación para trabajar en este repositorio. Describe la estructura y el comportamiento visibles en el código; no reemplaza una auditoría funcional o de seguridad. Mantener esta guía sincronizada cuando cambien arquitectura, flujos o comandos.

## Producto y stack

Wallet es una aplicación web de finanzas personales en español, orientada a quetzales (GTQ). Permite gestionar cuentas, tarjetas, categorías, ingresos, gastos, transferencias, períodos financieros, presupuestos y análisis.

| Área | Implementación actual |
|---|---|
| Interfaz | React 19, TypeScript 7, Vite 8, Tailwind CSS 4 |
| Componentes y animación | Lucide React y Motion |
| Datos y autenticación | Firebase Auth y Cloud Firestore mediante SDK web |
| Servidor backend y proxy IA | Servidor Express en `server.ts` con Vite middlewares y ruta `POST /api/financial-inference` usando `@google/genai`; la clave vive en el entorno del servidor y el cliente envía métricas financieras agregadas |
| PWA | `vite-plugin-pwa`/Workbox, actualización automática, manifest `standalone`, caché de recursos y caché de fuentes Google |
| Backend adicional | Firebase Cloud Functions v2 callable en `functions/`, Node.js 22 y Firebase Admin |
| Hosting | Firebase Hosting publica `dist/` y reescribe rutas a `index.html` |
| Idioma y moneda | Interfaz en español; `formatGTQ` formatea GTQ |

La aplicación móvil Flutter ya no forma parte del repositorio. La experiencia móvil se entrega como PWA.

## Estructura

| Ruta | Responsabilidad |
|---|---|
| `server.ts` | Servidor backend Express con Vite middleware en desarrollo y endpoint `POST /api/financial-inference` para análisis inferencial con Google Gemini. |
| `src/main.tsx`, `src/App.tsx`, `src/index.css` | Punto de entrada, shell/navegación, tema y estilos globales. |
| `src/core/types/models.ts` | Tipos de cuentas, movimientos, plantillas, categorías, períodos, presupuestos, perfil, reporte de salud financiera y preferencias. |
| `src/core/data/initialData.ts` | Tienda inicial, categorías y períodos predeterminados. |
| `src/core/state/WalletContext.tsx` | Estado central, autenticación, persistencia local, listeners y operaciones de dominio. |
| `src/core/sync/offlineQueue.ts` | Cola persistente en `localStorage`, procesamiento secuencial y reintentos/conectividad. |
| `src/core/firebase/firebase.ts` | Inicialización de Firebase Auth/Firestore y tratamiento de errores. |
| `src/core/firebase/firestoreSync.ts` | Sincronización de perfil, preferencias y entidades con Firestore; transacciones de cuenta/movimiento. |
| `src/core/security/` | PIN local, biometría WebAuthn, configuración, pantalla de bloqueo y hook de autobloqueo. |
| `src/core/pwa/` | Detección de instalación/modo standalone y modal de instrucciones PWA. |
| `src/core/utils/formatters.ts` | Formato de importes/fechas y evaluación aritmética. |
| `src/core/widgets/` | Selectores reutilizables de cuentas, períodos y modal de desglose de transacciones (`DrilldownTransactionsModal.tsx`). |
| `src/features/auth/` | Registro, acceso, Google y recuperación de contraseña. |
| `src/features/accounts/` | Cuentas y tarjetas: visualización, edición, archivo y gestión de saldos. |
| `src/features/transactions/` | Lista, modal y filtros de movimientos; `financialEngine.ts` valida movimientos y calcula saldos/resúmenes; `accountStatementEngine.ts` y `AccountStatementModal.tsx` generan y exportan Estados de Cuenta oficiales (CSV e Impresión/PDF). |
| `src/features/transactions/TemplatesView.tsx` | Gestión por usuario de plantillas y recordatorios periódicos de movimientos. |
| `src/features/financial_periods/` | Gestión, validación y cálculo de períodos/subperíodos. |
| `src/features/annual_budget/` | Presupuesto y Panorama Anual; matriz proyectado/real en vistas mensual, trimestral, semestral y anual, más exportación CSV. |
| `src/features/analytics/` | Resúmenes, métricas, visualizaciones, exportación CSV, comparación diaria de ingresos y egresos en calendario continuo del período y vistas semanal/quincenal por período, y motor de diagnóstico de salud (`financialHealthEngine.ts`) con bitácora de 52 semanas y modal (`FinancialHealthModal.tsx`) con inferencia semanal IA y offline. |
| `src/features/dashboard/` | Resumen del período, saldos, actividad, acumulado YTD y alertas presupuestarias. |
| `src/features/settings/` | Vista Más, accesos a configuración, seguridad, instalación y modal de seguridad, privacidad y confidencialidad (`AboutSecurityModal.tsx`). |
| `functions/src/index.ts` | Callable Functions para operaciones de cuentas y movimientos y limpieza financiera. |
| `public/` | Iconos PWA, favicon y Apple touch icon. |

## Modelo de datos

Los datos de usuario se organizan en `users/{uid}`. El perfil está en el documento del usuario; las subcolecciones principales son `settings`, `accounts`, `categories`, `periods`, `transactions`, `budgets` y `templates`. En `settings` se guardan el documento `default`, las preferencias de bloqueo en `security` y los planes anuales `projections_{year}`. También se usan `accountTombstones` en las Cloud Functions. Las reglas de Firestore se encuentran en `firestore.rules` y aplican denegación por defecto y aislamiento por propietario.

Modelos relevantes en `src/core/types/models.ts`:

- Las cuentas incluyen efectivo, banco, ahorro y tarjeta de crédito; estas últimas representan la deuda con saldo no positivo.
- Los movimientos son gastos, ingresos o transferencias, con fecha ISO y referencias opcionales a período/subperíodo.
- `FinancialPeriod` contempla `referenceMonth` y `monthIndex` para asociar períodos con meses del panorama.
- `Budget` se relaciona con un período y categoría, con metas y alertas configurables. Los planes proyectados anuales se guardan por usuario/año en `users/{uid}/settings/projections_{year}`; las metas reales por período permanecen en `budgets`.
- `FinancialHealthReport` guarda diagnósticos ejecutivos en `users/{uid}/financial_reports/{reportId}` con desglose de 4 semanas, bitácora anual completa de 52 semanas (`annual52Weeks`), score (0-100), tasa de ahorro, DTI de tarjetas, cobertura líquida y recomendaciones accionables.
- `WeeklyFinancialHealthInference` modela inferencias semanales generadas por IA o contingencia heurística (`weekKey`, resumen de inferencia, hallazgos clave, advertencias, recomendación y tono analítico), indexadas por `${year}-W${weekNum}`.
- `TransactionTemplate` guarda categoría, subcategoría, monto, cuenta y nota; opcionalmente define fecha base y recurrencia semanal (7 días), quincenal (15 días) o mensual. Se guarda en `users/{uid}/templates`.
- `UserSettings` incluye tema, ocultamiento de saldos, período activo y preferencia de activación de IA semanal (`enableAiWeeklyAnalysis`).

## Comportamientos implementados

- La tienda local del usuario se persiste en `localStorage`; los cambios remotos se sincronizan con listeners de Firestore.
- `offlineQueue.ts` conserva operaciones pendientes por usuario en `localStorage` y las procesa cuando hay conexión. La disponibilidad offline depende de la operación y de datos previamente guardados; no asumir que todos los flujos remotos se pueden completar sin conexión.
- `firestoreSync.ts` aplica validación de dominio y usa transacciones de Firestore para guardar/eliminar movimientos junto con saldos relacionados. No describir esto como `writeBatch`: el código usa `runTransaction`.
- Las reglas de Firestore permiten operaciones autenticadas del propietario sujetas a validaciones específicas por colección.
- `functions/src/index.ts` declara funciones callable para cuentas y movimientos. Confirmar si una función está conectada al cliente antes de describirla como parte del flujo normal; el cliente también implementa sincronización directa con SDK web.
- El PIN nunca se sincroniza en texto: se sincroniza su verificador PBKDF2-SHA256 con sal y parámetros en `users/{uid}/settings/security`; verificadores SHA-256 antiguos se migran al validar el PIN. La configuración global del bloqueo se sincroniza. La credencial y activación biométrica WebAuthn siguen siendo locales a cada dispositivo. No afirmar que la información financiera está cifrada localmente ni que una credencial WebAuthn se almacena en un “enclave” específico.
- La tienda financiera y la cola offline se serializan actualmente en `localStorage`; no están cifradas. El bloqueo PIN/biometría es una barrera de interfaz y no cifra dichos datos.
- El hook de seguridad gestiona bloqueo por visibilidad/inactividad; los tiempos y controles exactos se definen en `securityService.ts` y `SecuritySettingsModal.tsx`.
- Vite configura manifest `standalone`, actualización automática del service worker, iconos PNG/SVG y precaché según `globPatterns`. Verificar archivos y configuración antes de afirmar compatibilidad o cobertura completa offline.
- El Presupuesto & Panorama Anual calcula proyecciones y valores reales desde los datos configurados; los planes anuales se sincronizan en `users/{uid}/settings/projections_{year}` en tiempo real y el contexto reactivo (`projectionsVersion`) actualiza el resumen del Dashboard al guardar o recibir cambios.
- La sincronización automática hacia presupuestos por período (`budgets`) aplica exclusivamente a categorías de egreso (`type === 'expense'`); las categorías de ingreso no generan documentos de presupuesto y `saveBudget` rechaza categorías que no sean de egreso.
- Al fijar una meta o mes en cero (`0`) en el plan, el sistema elimina limpiamente cualquier presupuesto directo existente en ese período (`deleteBudget`) en lugar de rechazarlo, y la matriz respeta los overrides en cero prioritariamente (soportando claves numéricas y string).
- El módulo de Cumplimiento de Presupuestos en Análisis evalúa únicamente categorías de egreso y desduplica los registros por categoría.
- El módulo de actividad temporal en Análisis respeta las fechas del período activo o subperíodo seleccionado. Muestra todo el rango como calendario continuo; las vistas semanal y quincenal comparan ingresos/egresos con líneas por semanas de calendario (lunes a domingo) y bloques consecutivos de 15 días desde el inicio del rango, recortados al final. Al tocar un día o bloque se abre `DrilldownTransactionsModal` con los movimientos de esas fechas. Las transferencias no se cuentan como ingresos ni egresos en la gráfica.
- En la lista de Transacciones, las cuentas de cada movimiento se muestran como etiquetas visuales con el color configurado en la cuenta; las transferencias muestran sus cuentas de origen y destino.
- `seedUserInitialData` en `firestoreSync.ts` valida la presencia previa de documentos antes de inicializar colecciones; jamás recrea categorías, períodos o presupuestos que el usuario haya eliminado deliberadamente. `mergeLocalStoreForUpload` no reinyecta categorías predeterminadas ya descartadas en el almacenamiento local.
- Al reconciliar categorías y presupuestos locales se crean solo documentos cuyos IDs todavía no existen en Firestore; cada creación vuelve a comprobar la ausencia dentro de una transacción. Los documentos remotos existentes no se sobrescriben durante esta recuperación.
- Las notificaciones de plantillas requieren permiso del navegador y la aplicación abierta; al abrir una, el formulario de transacción carga sus campos para confirmar o ajustar el movimiento. El siguiente ciclo se calcula desde la fecha base y avanza al guardar el movimiento.
- Al eliminar una categoría (`deleteCategory`), se remueven también sus proyecciones anuales vinculadas para evitar claves huérfanas.
- **Desglose Dinámico de Transacciones (Drill-down in-situ):**
  - Al interactuar con cualquier tarjeta o barra de presupuesto (en la sección de Estado de Presupuesto del Inicio y en Cumplimiento de Presupuestos de Análisis), con los segmentos de Distribución por Categorías y Subcategorías de mayor gasto, o con cualquier tarjeta de cuenta líquida o tarjeta de crédito en **Cuentas**, el modal emergente `DrilldownTransactionsModal` muestra al instante el conjunto exacto de transacciones que componen y afectan dicho rubro.
  - Para categorías, el modal incorpora pestañas de **«Movimientos»** y **«Distribución de Subcategorías»** con un gráfico de dona SVG interactivo en tiempo real, porcentajes, montos en GTQ, barra de proporción relativa y filtrado directo in-situ al tocar cualquier porción o subcategoría.
  - Para cuentas y tarjetas, el modal incluye pestañas de alcance ("Período actual" vs. "Todo el historial"), desglose de transferencias como entradas o salidas según la cuenta consultada, estado de saldo/deuda/límites, buscador en tiempo real y permite tocar cualquier registro para abrir directamente su edición sin perder el contexto de la pantalla activa.
- **Estado de Cuenta Oficial (Exportación CSV e Impresión / PDF):**
  - El motor `accountStatementEngine.ts` genera estados de cuenta bancarios por período fiscal y subperíodo:
    - Resumen financiero del período (ingresos totales, gastos, balance neto sin duplicar transferencias y conteo de movimientos en GTQ).
    - Resumen consolidado por cuenta anclado al **Saldo Actual real (en vivo en Wallet)**, calculando con exactitud matemática el saldo inicial del período, entradas (+), salidas (-), flujo neto del período y saldo al corte final, además de deuda, límite y crédito disponible real en tarjetas de crédito.
    - Detalle cronológico de movimientos del período con fecha, concepto, categoría, cuenta, débitos (-), créditos (+) y monto neto.
  - El modal `AccountStatementModal.tsx` proporciona una vista previa ejecutiva con membrete, selectores de período y filtros de cuenta con buscador interactivo, accesible desde Análisis, Transacciones y Cuentas.
  - Soporta exportación a CSV estructurado multisección (con BOM UTF-8 para apertura directa en Microsoft Excel) y función de impresión / guardar como PDF con reglas `@media print` para generar estados de cuenta impecables.
- **Diagnóstico de Salud Financiera y Bitácora Anual de 52 Semanas:**
  - El motor (`financialHealthEngine.ts`) calcula la bitácora integral de 52 semanas del año (cortes de 7 días agrupados por su mes de pertenencia) con balances semanales, burn rate y categorías predominantes, permitiendo seguimiento continuo sin la carga mental de revisiones diarias.
  - **Inferencia Semanal con IA:**
    - El usuario puede solicitar inferencias dinámicas generadas por IA mediante el proxy de servidor en `POST /api/financial-inference`.
    - **Datos enviados:** El cliente envía agregados de ingresos, egresos, ahorro, fechas de semana/mes, tasa, score y tipo de táctica de tarjeta; no incluye UID, correo, nombre de cuenta ni notas en el payload actual. Estos datos financieros son sensibles y deben llamarse agregados/seudonimizados, no anónimos.
    - **Seguridad de Credenciales:** La clave de API de Gemini reside exclusivamente en el entorno del servidor (`GEMINI_API_KEY`); el cliente web nunca accede ni almacena credenciales de IA.
    - **Contingencia Heurística Offline:** Si el usuario no tiene conexión a internet o el servicio de IA no responde, el sistema ejecuta de forma transparente un motor de inferencia heurístico local con reglas financieras deterministas, garantizando diagnósticos y recomendaciones inmediatas en cualquier circunstancia.
    - **Control bajo demanda:** En el modal de salud financiera, cada tarjeta de semana de la bitácora incluye controles interactivos para solicitar o regenerar la inferencia semanal según la necesidad del usuario.
- **Gestión de Etiquetas (Tags) y Asignación Masiva:**
  - **Modelo y Sincronización:** Cada etiqueta (`Tag`) cuenta con `id`, `name`, `color` (paleta financiera de alto contraste y código hex) y se persiste en Firestore bajo `users/{uid}/tags/{tagId}` con replicación en `offlineQueue.ts` (`SAVE_TAG`, `DELETE_TAG`).
  - **Administración en Configuración:** Accesible desde `Más > Etiquetas` mediante `TagsSettingsModal.tsx`. Permite crear y editar etiquetas con vista previa en tiempo real y contador de registros asociados.
  - **Protección de Integridad Referencial:** Bloquea estrictamente la eliminación de cualquier etiqueta que esté vinculada a uno o más movimientos (`usageCount > 0`), informando al usuario y requiriendo desvincularla previamente.
  - **Filtrado Avanzado:** En `Transacciones`, permite filtrar por etiqueta desde el panel de filtros (`filterTagId`), mediante barra horizontal de chips de acceso rápido o escribiendo el nombre de la etiqueta en el buscador principal.
  - **Asignación en Movimientos:** En el formulario de transacción (`TransactionModal.tsx`), el usuario puede asignar y deseleccionar etiquetas con selector visual tipo pill.
  - **Asignación Masiva:** Modo de selección múltiple con casillas de verificación en `TransactionsView.tsx` y barra flotante de acciones para seleccionar varios o todos los registros visibles y abrir `BulkTagModal.tsx`, permitiendo vincular o remover etiquetas a gran escala de forma atómica.

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

## Plan de Seguridad, Privacidad e Integridad

Este plan prepara primero la protección de datos local y después el chat financiero y la aplicación móvil. Marcar cada etapa como completada solo cuando el código y su verificación lo respalden. No desplegar reglas, Functions ni cambios de servicios remotos sin autorización explícita.

### Estado de la revisión inicial

- **Completado — Revisión estática del repositorio (2026-10-24):** se revisaron autenticación, persistencia local, cola offline, bloqueo, reglas Firestore, Functions y proxy de IA. No equivale a prueba de penetración ni confirma configuraciones desplegadas en Firebase/Google Cloud.
- Hallazgos verificados: el store y la cola offline se serializan en texto claro en `localStorage`; PIN/biometría bloquean la interfaz, pero no cifran el store; el verificador del PIN se sincroniza; algunas reglas permiten campos y tamaños amplios; la ruta Express de IA no valida identidad ni limita uso en el código actual; ciertos logs incluyen identidad o payloads.
- Las reglas de `firestore.rules` aplican denegación por defecto y aislamiento por UID, pero su estado en producción no se verificó. No se encontró `storage.rules` ni configuración de Firebase Storage; el alcance de Wallet y del chat es texto, sin fotos ni adjuntos.
- Firebase Hosting sirve `dist` con rewrite SPA y no declara rewrite para Express. Debe confirmarse si el proxy Express está desplegado aparte y cuál es su URL efectiva.

### Etapas y criterios de cierre

1. **En curso — Cifrado local web sin pérdida de datos.**
   - **Completado:** Se corrigió el texto de Seguridad para no afirmar falsamente cifrado local ni almacenamiento en enclave no implementados.
   - **Completado:** Se inventariaron las persistencias locales que almacenan datos financieros: store principal (`wallet_app_v4_store`), cola offline (`wallet_offline_queue_v1_<uid>`) y proyecciones anuales (`wallet_projections_<uid>_<year>`).
   - **Completado:** Implementación integral de Etiquetas (`Tag`) con administración en Configuración, asignación masiva, filtrado avanzado en Transacciones, sincronización offline y reglas de integridad en Firestore desplegadas.
   - **Diseño arquitectónico consolidado (Aprobado):**
     - **Jerarquía de Claves y Separación del PIN:** La clave maestra de cifrado de la aplicación (AEK, AES-256-GCM) se genera con CSPRNG en el cliente. El PIN numérico es exclusivamente una barrera de interfaz en sesión (tiempo de inactividad / desenfoque); **nunca** se usa para derivar la clave que envuelve la AEK, evitando ataques de fuerza bruta offline contra contraseñas de baja entropía.
     - **Doble Sobre de Envoltura (Envelopes):**
       - **Sobre A (Hardware / Biometría opcional):** Envuelto con clave derivada de WebAuthn PRF (`navigator.credentials.get` con extensión `prf`). WebAuthn PRF es una extensión opcional; la app verifica que la extensión devuelva datos válidos y si no es compatible o falla, recurre de inmediato a la Clave de Recuperación.
       - **Sobre B (Recuperación de Alta Entropía):** Envuelto con clave derivada mediante HKDF/PBKDF2 de una Clave de Recuperación criptográficamente aleatoria de 128 o 256 bits generada por el sistema. El usuario debe completar una verificación obligatoria de respaldo antes de activar el cifrado. No se utilizan frases arbitrarias inventadas por el usuario ni se asume "invulnerabilidad matemática"; la seguridad depende estrictamente de la entropía de la clave aleatoria.
     - **Separación entre Bloqueo y Cifrado:** Quitar el PIN de pantalla nunca revierte los datos a texto plano. Desactivar el cifrado local es una operación explícita, independiente y confirmada que requiere descifrar la AEK previamente.
     - **Máquina de Estados de Arranque e Inconsistencias:**
       - Estados: `INITIALIZING` -> `UNENCRYPTED` | `LOCKED_ENCRYPTED` | `INCONSISTENCY_HALTED` -> `UNLOCKING` -> `READY`.
       - **Protección contra Modo Legado Accidental:** Si existe una marca persistente `wallet_encryption_active_<uid>` (en configuración local o remota) pero el sobre de la AEK falta o está corrupto, la aplicación **se detiene en `INCONSISTENCY_HALTED`**. Jamás asume que es un usuario nuevo ni inicializa datos vacíos que sobrescriban el almacenamiento.
       - Ninguna escritura a `localStorage` ni a Firestore puede ocurrir mientras el estado sea distinto de `READY`.
     - **Migración Recuperable en 4 Fases (Store, Cola y Proyecciones):**
       - 1. *PREPARE:* Comprueba cuota de almacenamiento disponible (`navigator.storage.estimate`), genera la AEK y crea los sobres A y B.
       - 2. *VERIFY:* Cifra y descifra una muestra de prueba verificando la integridad de ida y vuelta.
       - 3. *ACTIVATE:* Escribe los datos cifrados en las claves `wallet_enc_*` y establece la marca persistente de cifrado activo.
       - 4. *CLEANUP:* Purga las claves de texto plano solo tras la confirmación exitosa del paso anterior. En caso de error o `QuotaExceededError`, aborta de forma no destructiva sin tocar los datos legados.
     - **Preservación Estricta de la Cola Offline:** Las mutaciones offline pendientes se cifran en reposo con la AEK activa, se aíslan por UID y se garantiza que sigan procesándose secuencialmente una vez la bóveda alcance el estado `READY`.
     - **Límites Claros del Modelo de Amenazas:** Firestore **no** cuenta con cifrado de extremo a extremo (E2EE) en esta etapa; los datos en la nube viajan por TLS y se protegen por las reglas de seguridad de Firestore. El alcance de esta etapa es proteger los datos almacenados en reposo en el navegador (`localStorage`) contra extracción local física o forense sin la clave.
   - **Cierre:** Migración recuperable en 4 fases, cola preservada, separación estricta entre usuarios, arranque a prueba de inconsistencias, datos en reposo protegidos y límites explícitamente documentados.
2. **Completado — Endurecer el proxy de IA existente.**
   - **Completado:** Verificación del ID token de Firebase Auth (`Authorization: Bearer <token>`) validado en servidor vía Google tokeninfo endpoint.
   - **Completado:** Limitación de tasa (Rate Limiting) en memoria con ventana deslizante (máximo 15 solicitudes por minuto por UID/IP).
   - **Completado:** Validación estricta de esquemas y rangos de datos agregados (semanas 1-53, montos finitos no negativos, score 0-100, tasa de ahorro y tipos válidos).
   - **Completado:** Límite máximo de carga útil de 64kb en Express para mitigar ataques de denegación de servicio.
   - **Completado:** Higiene de registros: se eliminó el registro de prompts, identidades y métricas financieras en consola.
3. **Pendiente — Reforzar integridad en reglas de Firestore.**
   - Definir campos permitidos y tamaños por colección; validar referencias categoría/subcategoría/período cuando corresponda; revisar saldos y escrituras sin bloquear operaciones legítimas; contrastar las reglas locales con las desplegadas.
4. **Pendiente — Reducir exposición de sesión y diagnósticos.**
   - Revisar persistencia Auth, logout, colas por UID, limpieza segura sin perder cambios offline, consola/logs y cabeceras de Hosting. Evaluar App Check y controles de Auth desde consola.
5. **Completado — Asistente Financiero Privado IA Web (Chat de texto en Quetzales).**
   - **Completado:** Consultas contextuales en lenguaje natural basadas en agregados seudonimizados sin PII (sin nombres de cuentas reales, números, correos ni notas privadas).
   - **Completado:** Consentimiento informado explícito (Opt-in) con modal de advertencias de privacidad antes de enviar la primera consulta al proxy backend.
   - **Completado:** Integridad de transacciones estricta: el modelo sugiere borradores interactivos validados (`<<<TRANSACTION_DRAFT_START>>>...<<<TRANSACTION_DRAFT_END>>>`); jamás escribe directo a Firestore ni altera saldos automáticamente; el usuario confirma y revisa cada operación en `TransactionModal`.
   - **Completado:** Historial de conversación cifrado en reposo localmente en el navegador (`localStorage`) con la Bóveda AES-256-GCM del usuario (o fallback sin cifrar si la bóveda no está activa).
   - **Completado:** Endpoint backend seguro `POST /api/financial-chat` en `server.ts` con verificación de ID Token de Firebase Auth, rate limiting (20 req/min), ventana rodante de 12 mensajes, límite de 64kb y erradicación total de logs con contenido o prompts.
   - **Completado:** Integración fluida en la interfaz: accesos directos desde la barra superior de acciones, banner interactivo en el Inicio (`DashboardView`) y tarjeta en Configuración (`MoreView`).
6. **Pendiente — Preparar Capacitor tras cerrar las etapas anteriores.**
   - Reutilizar React/Vite; integrar biometría nativa como desbloqueo de clave protegida por el sistema operativo; probar sesión, offline, deep links, exportación y borrado en Android/iOS.

### Registro de avance

- **2026-10-24:**
  - **Etiquetas y Asignación Masiva Completadas:** Se implementó el modelo de `Tag`, reglas de Firestore desplegadas, persistencia offline, pantalla de administración en Configuración, asignación masiva de transacciones con casillas de selección múltiple, protección de eliminación por integridad referencial y filtros avanzados.
  - **Cifrado Local Web en Reposo Implementado (Etapa 1):** Bóveda AES-256-GCM implementada con desacoplamiento de PIN, soporte opcional para WebAuthn PRF, Clave de Recuperación aleatoria de 256 bits, verificación previa de respaldo, máquina de estados de arranque contra inconsistencias y migración no destructiva en 4 fases.
  - **Proxy de IA Endurecido (Etapa 2):** Implementada la verificación de tokens de Firebase Auth, rate limiting por usuario/IP, validación estricta de rangos y esquemas, tamaño máximo de 64kb y erradicación de logs con métricas o prompts.
  - **Asistente Financiero Privado IA Completado (Etapa 5):** Implementado el chat financiero interactivo con consentimiento previo, agregados seudonimizados sin PII, sugerencias y borradores de transacciones interactivos bajo confirmación del usuario, historial cifrado con la bóveda AES-256 local y endpoint backend `POST /api/financial-chat` con Gemini 2.5 Flash / Flash-Lite en Quetzales (GTQ).

## Registro de Cambios y Correcciones de Auditoría (Octubre 2026)

Se evaluó la auditoría y se determinó que **los problemas críticos de integridad de saldos reportados (INT-01 e INT-02) eran falsos positivos del auditor (hallucinaciones)**. El código maneja los saldos de forma correcta mediante `saveTransactionToAccounts` con una sola reversión, y sí cuenta con `reconcileAccountBalances` y `previewBalanceReconciliation()`. 

Se aplicaron las siguientes correcciones sobre hallazgos verdaderos:
- **Privacidad (PRIV-01, PRIV-02, PRIV-03, PRIV-04):** `logout()` elimina la clave del store principal y `resetUserFinancialData` incluye `accounts` y `transactions`; la revisión actual confirma que la cola offline permanece en `localStorage`, por lo que la limpieza local no cubre todas las mutaciones pendientes. El cliente actual envía métricas agregadas a IA, sin UID, correo, nombres de cuenta ni notas en ese payload.
- **Integridad de Cola (INT-03):** La cola `offlineQueue.ts` ahora descarta operaciones que resultan en errores permanentes, destrabando la sincronización de futuros cambios.
- **Financiero (FIN-01, FIN-03):** Se arregló el cálculo de presupuestos para que los pagos de tarjetas no se sumen como doble gasto (FIN-01), y los saldos positivos a favor en tarjetas de crédito ahora sí se reflejan como dinero disponible (FIN-03).
