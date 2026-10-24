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
   - **Completado:** se corrigió el texto de Seguridad para no afirmar cifrado local ni almacenamiento en enclave que no están implementados.
   - **Completado:** se inventariaron las persistencias locales: store principal, cola offline, proyecciones anuales, sesión, tema y credenciales/preferencias del bloqueo. Las proyecciones anuales también contienen información financiera y deben incluirse en la decisión de cifrado.
   - Definir ciclo de vida, desbloqueo, recuperación y rotación de la clave. No derivarla del PIN corto actual ni reutilizar la clave de MEGA.
   - Cifrar el store financiero, la cola offline y las proyecciones anuales; evitar que el store se hidrate en la interfaz antes del desbloqueo definido. Mantener las preferencias visuales/sesión necesarias fuera del cifrado, sin usarlas como autorización.
   - Diseñar migración recuperable desde las claves legadas de `localStorage`. No eliminar datos legados ni mutaciones pendientes hasta confirmar que el nuevo formato se descifra correctamente.
   - Evaluar WebAuthn PRF para derivar una clave únicamente en autenticadores compatibles; como es una extensión opcional, definir una alternativa segura de recuperación y no volver a PIN corto ni a texto claro. Documentar diferencias entre PWA y futuro uso de Keychain/Keystore con Capacitor; no afirmar que WebAuthn por sí solo cifra datos.
   - **Cierre:** migración recuperable, cola preservada, separación entre usuarios, logout/sesión revisados, datos cifrados en reposo y límites documentados frente a XSS o dispositivo desbloqueado.
2. **Pendiente — Endurecer el proxy de IA existente.**
   - Verificar ID token de Firebase y evaluar App Check; validar esquema y rangos; limitar uso por usuario/IP y tamaño de solicitud; no registrar prompts, respuestas ni datos financieros; comprobar el despliegue real y proteger la clave.
3. **Pendiente — Reforzar integridad en reglas de Firestore.**
   - Definir campos permitidos y tamaños por colección; validar referencias categoría/subcategoría/período cuando corresponda; revisar saldos y escrituras sin bloquear operaciones legítimas; contrastar las reglas locales con las desplegadas.
4. **Pendiente — Reducir exposición de sesión y diagnósticos.**
   - Revisar persistencia Auth, logout, colas por UID, limpieza segura sin perder cambios offline, consola/logs y cabeceras de Hosting. Evaluar App Check y controles de Auth desde consola.
5. **Pendiente — Especificar e implementar chat financiero web privado (texto solamente).**
   - Empezar con consultas de solo lectura; enviar contexto mínimo, seudonimizado y por solicitud; pedir consentimiento antes de enviar información financiera al proveedor de IA; excluir UID, nombres de cuenta y notas salvo decisión explícita.
   - Separar contexto temporal, historial exportable y preferencias recordadas. Historial local cifrado, exportación bajo demanda y memoria persistente opt-in, visible, editable y eliminable.
   - Preparar registros sugeridos por chat como borradores: inferir categoría/subcategoría, pedir confirmación, validar esquema y referencias en Wallet y guardar mediante el flujo financiero existente. La IA nunca escribe directamente en Firestore ni actualiza saldos.
6. **Pendiente — Preparar Capacitor tras cerrar las etapas anteriores.**
   - Reutilizar React/Vite; integrar biometría nativa como desbloqueo de clave protegida por el sistema operativo; probar sesión, offline, deep links, exportación y borrado en Android/iOS.

### Registro de avance

- **2026-10-24:** plan agregado, revisión estática e inventario de persistencias cerrados. La pantalla ya describe PIN/biometría como bloqueo local y aclara que no cifra los datos. El cifrado local y su migración recuperable siguen en curso y pendientes de implementar.

## Registro de Cambios y Correcciones de Auditoría (Octubre 2026)

Se evaluó la auditoría y se determinó que **los problemas críticos de integridad de saldos reportados (INT-01 e INT-02) eran falsos positivos del auditor (hallucinaciones)**. El código maneja los saldos de forma correcta mediante `saveTransactionToAccounts` con una sola reversión, y sí cuenta con `reconcileAccountBalances` y `previewBalanceReconciliation()`. 

Se aplicaron las siguientes correcciones sobre hallazgos verdaderos:
- **Privacidad (PRIV-01, PRIV-02, PRIV-03, PRIV-04):** `logout()` elimina la clave del store principal y `resetUserFinancialData` incluye `accounts` y `transactions`; la revisión actual confirma que la cola offline permanece en `localStorage`, por lo que la limpieza local no cubre todas las mutaciones pendientes. El cliente actual envía métricas agregadas a IA, sin UID, correo, nombres de cuenta ni notas en ese payload.
- **Integridad de Cola (INT-03):** La cola `offlineQueue.ts` ahora descarta operaciones que resultan en errores permanentes, destrabando la sincronización de futuros cambios.
- **Financiero (FIN-01, FIN-03):** Se arregló el cálculo de presupuestos para que los pagos de tarjetas no se sumen como doble gasto (FIN-01), y los saldos positivos a favor en tarjetas de crédito ahora sí se reflejan como dinero disponible (FIN-03).
