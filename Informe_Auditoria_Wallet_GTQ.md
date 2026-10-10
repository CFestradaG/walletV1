# Informe de auditoría integral — Wallet GTQ

*Análisis funcional, financiero, de seguridad, privacidad e integridad de datos*

| **Ficha del documento** |                                                                                                                                                                  |
|-------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Objeto analizado**    | Aplicación web progresiva (PWA) de finanzas personales: React 19, TypeScript, Vite, Firebase Auth y Cloud Firestore (repositorio walletV1-main.zip, 92 archivos) |
| **Tipo de revisión**    | Revisión estática de código (caja blanca) y simulación de la lógica de saldos                                                                                    |
| **Fecha de emisión**    | 9 de octubre de 2026                                                                                                                                             |
| **Versión del informe** | 1.0                                                                                                                                                              |
| **Elaborado por**       | Claude (Anthropic), asistente de IA                                                                                                                              |
| **Clasificación**       | Confidencial · uso interno del proyecto                                                                                                                          |

*Este informe no sustituye una auditoría de seguridad formal, una prueba de penetración ni asesoría legal. Describe únicamente lo observado en el código entregado; el Anexo B detalla qué se revisó y qué no.*

## Contenido

| **N.º** | **Sección**                                    |
|---------|------------------------------------------------|
| 1       | Resumen ejecutivo                              |
| 2       | Alcance, metodología y limitaciones            |
| 3       | Arquitectura observada                         |
| 4       | Análisis funcional                             |
| 5       | Integridad de datos                            |
| 6       | Análisis financiero                            |
| 7       | Seguridad                                      |
| 8       | Privacidad                                     |
| 9       | Calidad, mantenibilidad y operación            |
| 10      | Aspectos positivos                             |
| 11      | Plan de remediación priorizado                 |
| 12      | Matriz consolidada de hallazgos                |
| A       | Anexo A · Evidencia de la simulación de saldos |
| B       | Anexo B · Cobertura de la revisión             |

## 1. Resumen ejecutivo

### 1.1 Veredicto

Wallet GTQ tiene una base funcional sólida y bien pensada para una primera versión: períodos financieros configurables, panorama anual proyectado contra real, tarjetas con día de corte y de pago, plantillas de movimientos, bloqueo local con PIN y biometría, instalación como PWA y una cola para trabajar sin conexión. Las reglas de Firestore parten de denegar todo y aíslan los datos por usuario, lo cual es la decisión correcta.

Sin embargo, **no está lista para usuarios reales con datos financieros reales**. Hay un defecto crítico que corrompe saldos al editar movimientos, la cola de sincronización puede duplicar o bloquear cambios, el bloqueo por PIN protege la pantalla pero no los datos, y varias promesas de privacidad que muestra la propia app no se cumplen en el código (borrado total de datos, anonimización de la IA, datos «no expuestos»). Mi recomendación es limitarla a pruebas cerradas hasta resolver los puntos de la sección 1.3.

La aplicación registra y analiza dinero, pero no lo mueve. Por eso el riesgo principal es **la exactitud de la información financiera y la confidencialidad de los datos**, no el robo de fondos.

### 1.2 Calificación por dimensión

*Calificación cualitativa del auditor, de 1 (deficiente) a 10 (sobresaliente), basada en lo revisado.*

| **Dimensión**       | **Nota** | **Riesgo**  | **Razón principal**                                                                                             |
|---------------------|----------|-------------|-----------------------------------------------------------------------------------------------------------------|
| Funcional           | 7 / 10   | **Bajo**    | Cobertura amplia y coherente; faltan multi-moneda, recurrentes en segundo plano y la IA no opera en producción. |
| Integridad de datos | 3 / 10   | **Crítico** | Error de doble reversión de saldos, cola sin idempotencia ni control de concurrencia, sin reconciliación.       |
| Financiero (lógica) | 6 / 10   | **Medio**   | Cálculos básicos correctos; riesgos de doble conteo con tarjetas y mensajes de financiamiento engañosos.        |
| Seguridad           | 5 / 10   | **Medio**   | Buenas reglas base y PBKDF2; faltan límites de intentos, App Check, cabeceras y verificación de correo.         |
| Privacidad          | 4 / 10   | **Alto**    | Datos en texto plano que sobreviven al cierre de sesión, borrado incompleto y afirmaciones inexactas.           |
| Calidad y operación | 4 / 10   | **Alto**    | Sin pruebas, estado monolítico y documentación contradictoria.                                                  |

### 1.3 Prioridades inmediatas

1.  **Corregir INT-01** (doble reversión de saldo) y agregar pruebas unitarias; reparar los saldos ya afectados con una rutina de reconciliación.

2.  **Proteger la cola offline** (INT-03 e INT-04): exclusión mutua entre pestañas, idempotencia y bandeja de errores permanentes.

3.  **Cerrar la brecha de privacidad** (PRIV-01 y PRIV-02): limpiar el almacenamiento local al cerrar sesión, implementar borrado total real y corregir los textos de la app.

4.  **Endurecer el PIN** (SEG-01): pedir el PIN actual, limitar intentos y dejar claro qué protege y qué no.

5.  **Retirar datos demo y revisar el envío a IA** (PRIV-03 y PRIV-04), y decidir si la IA se queda (con una Function autenticada) o se retira.

### 1.4 Hallazgos por severidad

| **Severidad** | **Cantidad** | **Criterio**                                                                                            |
|---------------|--------------|---------------------------------------------------------------------------------------------------------|
| **Crítico**   | 1            | Corrompe datos financieros o expone información de forma directa; corregir antes de cualquier uso real. |
| **Alto**      | 8            | Riesgo significativo de pérdida, exposición o incumplimiento; corregir antes de un lanzamiento público. |
| **Medio**     | 21           | Debilidad real con impacto acotado o que requiere condiciones adicionales.                              |
| **Bajo**      | 12           | Mejora recomendada o riesgo menor.                                                                      |
| **Info**      | 4            | Observación sin riesgo directo.                                                                         |

Total: **46 hallazgos**.

## 2. Alcance, metodología y limitaciones

### 2.1 Qué se hizo

- Extracción y lectura del repositorio walletV1-main.zip (92 archivos) y de su documentación (CONTEXTO.md, AGENTS.md).

- Lectura completa de la configuración (Firebase, Vite, PWA), las reglas e índices de Firestore, las Cloud Functions, el servidor Express, la capa de sincronización, la cola offline, el servicio de seguridad local, el motor financiero y las utilidades.

- Lectura parcial, dirigida por búsquedas, de WalletContext.tsx (autenticación, persistencia, listeners, transacciones, cuentas, reseteo), initialData.ts, financialHealthEngine.ts, las pantallas de bloqueo y ajustes de seguridad y periodEngine.ts.

- Búsquedas transversales de patrones de riesgo (eval, new Function, innerHTML, fetch, almacenamiento local, registro de datos personales).

- Simulación en Node.js de la secuencia exacta de syncTransactionWithAccounts para confirmar el defecto de saldos (Anexo A).

### 2.2 Qué no se hizo

- No se ejecutó la aplicación, npm run build, npm run lint, pruebas ni npm audit; la aplicación no se probó en un dispositivo.

- No se tuvo acceso a la consola de Firebase/Google Cloud: no se verificaron las reglas realmente desplegadas, la configuración de Auth (proveedores, dominios, protección contra enumeración), App Check, restricciones de la API key, IAM, cuotas ni facturación.

- No se revisaron línea por línea varias pantallas ni el motor del presupuesto anual (ver Anexo B), por lo que pueden existir hallazgos adicionales allí.

- No se realizaron pruebas de penetración ni análisis dinámico. Tampoco es asesoría legal.

### 2.3 Escala de severidad

Se combina impacto y probabilidad. **Crítico**: daña datos o expone información sin condiciones especiales. **Alto**: impacto significativo con condiciones plausibles. **Medio**: impacto acotado o dependiente de otra falla. **Bajo**: mejora o riesgo menor. **Info**: observación. Cada hallazgo incluye un esfuerzo estimado: S (horas a pocos días), M (una a tres semanas), L (más de tres semanas).

## 3. Arquitectura observada

La aplicación es una PWA de una sola página. La carpeta de la app móvil en Flutter fue retirada del repositorio y la experiencia móvil se entrega como PWA instalable. Los datos viven en Firestore bajo users/{uid} y se replican en el navegador.

| **Capa**             | **Tecnología / ubicación**                                   | **Observación**                                                                                               |
|----------------------|--------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------|
| **Interfaz**         | React 19, TypeScript, Vite 8, Tailwind CSS 4, Lucide, Motion | Estructura por funcionalidades (features/) y núcleo común (core/).                                            |
| **Estado**           | WalletContext.tsx + localStorage                             | Store completo de todos los usuarios en wallet_app_v4_store; monolito de ~2 200 líneas.                       |
| **Sincronización**   | onSnapshot + cola en localStorage + runTransaction           | Primero se actualiza el estado local; después se encola la escritura remota.                                  |
| **Autenticación**    | Firebase Auth (correo/contraseña y Google)                   | Persistencia local del navegador; sin verificación de correo ni MFA.                                          |
| **Base de datos**    | Cloud Firestore, base con nombre ai-studio-walletv1-…        | Subcolecciones: settings, accounts, categories, periods, transactions, budgets, templates, financial_reports. |
| **Reglas**           | firestore.rules                                              | Denegar por defecto y aislamiento por uid; validación fuerte sólo en cuentas, movimientos y reportes.         |
| **Cloud Functions**  | functions/src/index.ts (v2, Node 22)                         | Cuentas, movimientos y limpieza; no se invocan desde el cliente.                                              |
| **Servidor Express** | server.ts                                                    | Sólo desarrollo; contiene el endpoint de IA (Gemini) sin autenticación.                                       |
| **Hosting**          | Firebase Hosting (dist/, reescritura SPA)                    | Estático; sin cabeceras de seguridad.                                                                         |
| **PWA**              | vite-plugin-pwa / Workbox                                    | Precaché de recursos, actualización automática, manifest standalone.                                          |

## 4. Análisis funcional

Se evalúa qué hace la aplicación, qué tan completa es frente a una app de referencia como Wallet by BudgetBakers y qué defectos de comportamiento se observan. La comparación usa las funciones habituales de ese tipo de producto y no se reverificó contra la versión actual de Wallet.

### 4.1 Cobertura funcional

| **Capacidad**                                               | **Estado**   | **Comentario**                                                                          |
|-------------------------------------------------------------|--------------|-----------------------------------------------------------------------------------------|
| **Cuentas (efectivo, banco, ahorro) y tarjetas de crédito** | Presente     | Tarjetas con límite, corte y fecha de pago; saldo de deuda en negativo.                 |
| **Ingresos, gastos y transferencias**                       | Presente     | Con categorías y subcategorías; validación de cuentas y categorías.                     |
| **Períodos financieros configurables**                      | Presente     | Subperíodos (p. ej. quincenales) y períodos cerrados; diferenciador frente a Wallet.    |
| **Presupuestos y panorama anual**                           | Presente     | Matriz proyectado vs. real (mensual, trimestral, semestral, anual) con exportación CSV. |
| **Plantillas y recurrencia**                                | Parcial      | Recordatorios sólo con la app abierta (FUN-03).                                         |
| **Análisis y salud financiera**                             | Presente     | Puntaje, bitácora de 52 semanas, alertas; fórmulas no documentadas (FIN-05).            |
| **IA semanal**                                              | Parcial      | Probablemente inactiva en producción (FUN-02).                                          |
| **Modo sin conexión / PWA**                                 | Parcial      | Cola con riesgos de integridad (INT-03 a INT-06).                                       |
| **Bloqueo con PIN y biometría**                             | Parcial      | Barrera de interfaz, no protección de datos (SEG-01).                                   |
| **Multi-moneda con conversión**                             | Ausente      | FUN-01.                                                                                 |
| **Metas de ahorro, etiquetas, adjuntos o fotos de recibos** | No detectado | No se encontraron en los modelos de datos.                                              |
| **Importación de movimientos (CSV o extractos)**            | No detectado | Sólo se encontró exportación CSV.                                                       |
| **Deudas y préstamos (aparte de tarjetas)**                 | No detectado | —                                                                                       |
| **Cuentas compartidas / hogar**                             | Ausente      | El modelo de reglas aísla todo por un único uid.                                        |
| **Informes en PDF y respaldo completo**                     | Ausente      | —                                                                                       |

### 4.2 Hallazgos funcionales

#### FUN-01 · Sin soporte multi-moneda (todo se trata como GTQ)

|                   |                                                                                                                                                                                                                                                                                         |
|-------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Severidad**     | **ALTO**                                                                                                                                                                                                                                                                                |
| **Evidencia**     | Las transacciones se crean con currency: 'GTQ' fijo y formatGTQ formatea todo en quetzales. Las cuentas tienen un campo currency, pero calculatePortfolioSummary y los resúmenes suman saldos sin conversión; validateTransactionInput sólo comprueba que la moneda tenga 3 caracteres. |
| **Impacto**       | Una cuenta en dólares se sumaría como si fueran quetzales, distorsionando patrimonio, presupuestos y puntaje de salud. Las cuentas en USD son comunes en el mercado local y es una función central en Wallet by BudgetBakers.                                                           |
| **Recomendación** | Decidir el alcance: (a) prohibir cuentas no GTQ de forma explícita, o (b) implementar moneda por cuenta, tipo de cambio (manual o por API) y totales convertidos a una moneda base.                                                                                                     |
| **Esfuerzo**      | L                                                                                                                                                                                                                                                                                       |

#### FUN-02 · La inferencia con IA probablemente no funciona en producción

|                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
|-------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Severidad**     | **MEDIO**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Evidencia**     | El endpoint /api/financial-inference existe sólo en server.ts (Express). firebase.json publica dist/ como sitio estático con reescritura de todas las rutas a index.html, por lo que una petición POST a esa ruta no llega a ningún backend. El cliente cae silenciosamente a la heurística local. Además, AGENTS.md describe otra ruta (/api/gemini/weekly-health-inference) y otro modelo (Gemini 2.5 Flash), mientras el código usa gemini-3.8-flash y gemini-3.1-flash-lite, identificadores que no pude verificar. |
| **Impacto**       | La función «IA semanal» que describe la documentación y la pantalla de seguridad probablemente nunca se ejecuta fuera del entorno de desarrollo, y la degradación silenciosa oculta el problema.                                                                                                                                                                                                                                                                                                                        |
| **Recomendación** | Mover la inferencia a una Cloud Function callable autenticada (con App Check) o retirar la función; confirmar los identificadores de modelo; mostrar al usuario cuándo el resultado proviene de la heurística local.                                                                                                                                                                                                                                                                                                    |
| **Esfuerzo**      | M                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

#### FUN-03 · Los movimientos recurrentes dependen de que la app esté abierta

|                   |                                                                                                                                                                                                                                                                       |
|-------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Severidad**     | **MEDIO**                                                                                                                                                                                                                                                             |
| **Evidencia**     | Según AGENTS.md, los recordatorios de plantillas requieren permiso de notificaciones del navegador y la aplicación abierta; el ciclo siguiente se calcula al guardar el movimiento. No hay notificaciones push en segundo plano ni generación automática en servidor. |
| **Impacto**       | Para pagos fijos (renta, servicios, cuotas) el usuario sólo se entera si abre la app. Es una expectativa distinta a los «pagos planificados» de Wallet by BudgetBakers.                                                                                               |
| **Recomendación** | Generar recurrentes mediante Cloud Scheduler + Functions y notificar con Firebase Cloud Messaging (web push).                                                                                                                                                         |
| **Esfuerzo**      | L                                                                                                                                                                                                                                                                     |

#### FUN-04 · Lecturas completas de colecciones: costo y latencia crecen con el historial

|                   |                                                                                                                                                                                                                                                                          |
|-------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Severidad**     | **MEDIO**                                                                                                                                                                                                                                                                |
| **Evidencia**     | Los listeners onSnapshot se suscriben a colecciones completas (transactions, accounts, categories…). Cada guardado de transacción hace además getDocs de todas las categorías, y seedUserInitialData lee todas las colecciones (incluidas transacciones) en cada inicio. |
| **Impacto**       | El número de lecturas facturables y el tiempo de arranque crecen linealmente con los años de datos, en cada dispositivo y en cada apertura.                                                                                                                              |
| **Recomendación** | Consultar por ventana de fechas o período, paginar el historial, leer categorías desde el estado local en lugar de getDocs, y precalcular agregados mensuales.                                                                                                           |
| **Esfuerzo**      | M–L                                                                                                                                                                                                                                                                      |

#### Observaciones menores

| **ID** | **Severidad** | **Observación y recomendación**                                                                                                                                                                                             |
|--------|---------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| FUN-05 | **Bajo**      | Accesibilidad: el viewport de index.html incluye maximum-scale=1.0, user-scalable=no, lo que impide ampliar el contenido (WCAG 1.4.4). Recomendación: quitar esas restricciones y auditar contraste y lectores de pantalla. |
| FUN-06 | **Bajo**      | switchUserMode y los usuarios demo (usr_francisco, usr_nuevo) siguen exportados y se siembran en cada navegador, aunque ningún componente los usa. Recomendación: retirarlos de producción (ver PRIV-04).                   |
| FUN-07 | **Info**      | Las pantallas de transacciones, cuentas, dashboard, análisis y presupuesto anual no se auditaron línea por línea (ver Anexo B); su comportamiento se infiere de los motores de cálculo y la documentación del repositorio.  |

## 5. Integridad de datos

La integridad es la dimensión más débil: el diseño es razonable (movimientos y saldos se confirman en una transacción de Firestore), pero un error de implementación, la falta de idempotencia y la cola offline hacen que los saldos puedan terminar siendo incorrectos sin que nadie lo note. El defecto principal se corrige con una sola línea:

> // firestoreSync.ts · syncTransactionWithAccounts
>
> let accounts = previous ? reverseTransactionOnAccounts(previous, currentAccounts) : currentAccounts;
>
> \- if (previous) accounts = reverseTransactionOnAccounts(previous, accounts);
>
> accounts = applyTransactionToAccounts(tx, accounts);

#### INT-01 · Doble reversión del saldo al editar o volver a guardar una transacción

|                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
|-------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Severidad**     | **CRÍTICO**                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Evidencia**     | firestoreSync.ts, función syncTransactionWithAccounts: cuando la transacción ya existe, el movimiento previo se revierte dos veces (let accounts = previous ? reverseTransactionOnAccounts(previous, currentAccounts) : currentAccounts; seguido de if (previous) accounts = reverseTransactionOnAccounts(previous, accounts);). La simulación del Anexo A lo reproduce: un gasto de Q100 editado a Q120 sobre una cuenta de Q1,000 debería dejar Q880 y el servidor guarda Q980. |
| **Impacto**       | Cada edición deja el saldo remoto desviado por el monto original del movimiento. El estado local aplica la lógica correcta (una sola reversión), así que la diferencia aparece al sincronizar con Firestore, que el propio código trata como fuente autoritativa. También se dispara sin intervención del usuario: el listener de transacciones vuelve a encolar movimientos antiguos sin userId (WalletContext.tsx) y los reintentos de la cola reaplican la misma transacción.  |
| **Recomendación** | Eliminar la segunda reversión (basta una); cubrir con pruebas unitarias alta, edición, eliminación y reintento; y construir una herramienta de reconciliación que recalcule currentBalance = initialBalance + Σ movimientos para reparar datos ya contaminados.                                                                                                                                                                                                                   |
| **Esfuerzo**      | S (corrección) · M (reconciliación)                                                                                                                                                                                                                                                                                                                                                                                                                                               |

#### INT-02 · Saldos derivados sin ningún mecanismo de reconciliación

|                   |                                                                                                                                                                                                                                 |
|-------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Severidad**     | **ALTO**                                                                                                                                                                                                                        |
| **Evidencia**     | El saldo (currentBalance) se almacena en cada cuenta y se modifica de forma incremental con applyTransactionToAccounts y reverseTransactionOnAccounts. Ningún proceso lo compara con initialBalance más la suma de movimientos. |
| **Impacto**       | Cualquier error puntual (como INT-01), reintento duplicado o escritura directa se arrastra indefinidamente y el usuario no tiene forma de detectarlo.                                                                           |
| **Recomendación** | Agregar una verificación de integridad («Auditar saldos») que recalcule y muestre diferencias, y ejecutarla de forma automática al abrir la app. A mediano plazo, mantener los saldos como agregados verificables en servidor.  |
| **Esfuerzo**      | M                                                                                                                                                                                                                               |

#### INT-03 · La cola offline se bloquea ante un error permanente

|                   |                                                                                                                                                                                                                                                                                                                                                              |
|-------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Severidad**     | **ALTO**                                                                                                                                                                                                                                                                                                                                                     |
| **Evidencia**     | offlineQueue.ts, processUserQueue: ante cualquier error la cola se detiene (break) y la mutación fallida queda en la cabeza. retries se incrementa pero no se usa; no hay espera creciente, límite de intentos ni descarte. Un error permanente (regla de Firestore que rechaza el documento, categoría inexistente) se reintenta cada 30 s indefinidamente. |
| **Impacto**       | Un solo movimiento rechazado bloquea todos los cambios posteriores del dispositivo. La interfaz los muestra como guardados localmente, pero nunca llegan al servidor.                                                                                                                                                                                        |
| **Recomendación** | Distinguir errores transitorios de permanentes, aplicar backoff exponencial, mover las mutaciones con fallo permanente a una bandeja visible («requiere atención») y permitir reintentar o descartar.                                                                                                                                                        |
| **Esfuerzo**      | M                                                                                                                                                                                                                                                                                                                                                            |

#### INT-04 · Procesamiento concurrente de la misma cola (multi-pestaña / PWA + navegador)

|                   |                                                                                                                                                                                                                                                                                                 |
|-------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Severidad**     | **ALTO**                                                                                                                                                                                                                                                                                        |
| **Evidencia**     | El conjunto processingUsers vive en la memoria de cada pestaña, mientras la cola está en localStorage, compartido entre pestañas. Dos pestañas (o la PWA instalada y el navegador) pueden procesar la misma cola a la vez, además del sondeo cada 30 s y los eventos online y visibilitychange. |
| **Impacto**       | Ejecución duplicada de mutaciones. Con INT-01 presente, un duplicado de una transacción ya guardada altera el saldo (Anexo A, escenario 2).                                                                                                                                                     |
| **Recomendación** | Usar la Web Locks API (navigator.locks.request) para exclusión mutua y asignar a cada mutación un identificador de idempotencia que el servidor verifique.                                                                                                                                      |
| **Esfuerzo**      | M                                                                                                                                                                                                                                                                                               |

#### INT-05 · Efectos secundarios dentro de funciones actualizadoras de estado

|                   |                                                                                                                                                                                                                                                                                                                                                                                    |
|-------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Severidad**     | **MEDIO**                                                                                                                                                                                                                                                                                                                                                                          |
| **Evidencia**     | En WalletContext.tsx (addTransaction, updateTransaction, deleteTransaction) la llamada offlineQueue.enqueue(...) ocurre dentro de la función que se pasa a updateCurrentUserStore, que se ejecuta dentro de setDb. React puede invocar estas funciones más de una vez (StrictMode, renderizado concurrente). Hoy main.tsx no activa StrictMode, por lo que el riesgo está latente. |
| **Impacto**       | Si se activa StrictMode o cambia el comportamiento del renderizador, cada operación se encolaría dos veces y aparecería el escenario de duplicados de INT-04.                                                                                                                                                                                                                      |
| **Recomendación** | Calcular el nuevo estado de forma pura y llamar a enqueue fuera del actualizador.                                                                                                                                                                                                                                                                                                  |
| **Esfuerzo**      | S                                                                                                                                                                                                                                                                                                                                                                                  |

#### INT-06 · Pérdida silenciosa de datos locales por cuota de localStorage

|                   |                                                                                                                                                                                                                                            |
|-------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Severidad**     | **MEDIO**                                                                                                                                                                                                                                  |
| **Evidencia**     | Cada cambio serializa el store completo (JSON.stringify(db)) a localStorage con un catch {} vacío; la cola offline sólo registra console.error si falla el guardado. localStorage suele limitarse a ~5 MB por origen.                      |
| **Impacto**       | Con historial grande, la persistencia local y la cola pueden dejar de guardarse sin aviso: los cambios hechos sin conexión se pierden al cerrar la app. Además, reescribir todo el store en cada cambio degrada el rendimiento en móviles. |
| **Recomendación** | Migrar a IndexedDB (por ejemplo con idb o Dexie), guardar de forma incremental y avisar al usuario cuando falle el almacenamiento.                                                                                                         |
| **Esfuerzo**      | M                                                                                                                                                                                                                                          |

#### INT-07 · Cloud Functions sin uso y tres versiones de las mismas reglas de negocio

|                   |                                                                                                                                                                                                                                                                                                                                                              |
|-------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Severidad**     | **MEDIO**                                                                                                                                                                                                                                                                                                                                                    |
| **Evidencia**     | El cliente no usa httpsCallable (búsqueda sin resultados) y escribe directo a Firestore con el SDK. Las Functions (saveTransaction, saveAccount, deleteAccount…) validan más que las reglas y el cliente (categoría activa del tipo correcto, tope de monto de 1 000 000 000, tombstones). Las reglas aceptan hasta 10¹² y cualquier moneda de 3 caracteres. |
| **Impacto**       | Falsa sensación de protección: las validaciones de servidor no se ejecutan. Las reglas aceptan datos que las Functions rechazarían, y la integridad depende por completo del código del cliente.                                                                                                                                                             |
| **Recomendación** | Elegir una sola vía. Para dinero, lo recomendable es escribir cuentas y movimientos exclusivamente por Functions, con reglas allow write: if false en esas colecciones. La opción mínima es borrar las Functions y llevar sus validaciones a las reglas.                                                                                                     |
| **Esfuerzo**      | L                                                                                                                                                                                                                                                                                                                                                            |

#### INT-08 · Asignación de período inconsistente (fallback y solapamientos)

|                   |                                                                                                                                                                                                                                                                                                                                             |
|-------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Severidad**     | **MEDIO**                                                                                                                                                                                                                                                                                                                                   |
| **Evidencia**     | Si la fecha de un movimiento no cae en ningún período, WalletContext lo asigna al período activo o al primero (resolved.period \|\| activePeriod \|\| periods\[0\]), mientras getTransactionsForPeriod y los presupuestos filtran por rango de fechas. resolveTransactionPeriod devuelve el primer período coincidente si hay solapamiento. |
| **Impacto**       | Un mismo movimiento puede contarse en un período según periodId y en otro según la fecha; los totales y presupuestos pueden diferir entre pantallas.                                                                                                                                                                                        |
| **Recomendación** | Definir un único criterio (fecha → período), crear o exigir el período cuando no exista y validar que los períodos no se solapen.                                                                                                                                                                                                           |
| **Esfuerzo**      | M                                                                                                                                                                                                                                                                                                                                           |

#### Observaciones menores

| **ID** | **Severidad** | **Observación y recomendación**                                                                                                                                                                                                                                                                                                                                                                                                                                      |
|--------|---------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| INT-09 | **Bajo**      | Dinero en punto flotante con redondeo a 2 decimales en cada operación (Math.round(x\*100)/100), e identificadores tx\_\${Date.now()} (colisión posible y predecibles). Recomendación: almacenar enteros en centavos y usar IDs aleatorios (UUID o autogenerados por Firestore).                                                                                                                                                                                      |
| INT-10 | **Bajo**      | Cuentas líquidas pueden quedar en saldo negativo sin advertencia, los pagos a tarjeta no se topan contra la deuda y las transferencias desde tarjeta no validan el límite. Además, deleteAccount verifica los movimientos asociados sólo en el cliente: las reglas permiten borrar la cuenta aunque existan movimientos (sólo la Function no usada lo impide). Recomendación: agregar advertencias o validaciones configurables y reforzar en servidor (ver INT-07). |

## 6. Análisis financiero

Se revisaron los cálculos de saldos, resumen del portafolio, resumen por período y progreso de presupuestos. Las operaciones básicas (ingreso, gasto, transferencia, reversión) son consistentes entre sí y el redondeo a centavos es coherente; los hallazgos se concentran en tarjetas, saldos a favor y mensajes al usuario.

### 6.1 Resultado de la revisión de cálculos

| **Cálculo**                                                                                                   | **Resultado** | **Comentario**                                                     |
|---------------------------------------------------------------------------------------------------------------|---------------|--------------------------------------------------------------------|
| **Aplicar y revertir un movimiento sobre saldos (applyTransactionToAccounts / reverseTransactionOnAccounts)** | Correcto      | Simétricos entre sí; el problema está en cómo se invocan (INT-01). |
| **Dinero disponible, deuda y patrimonio neto (calculatePortfolioSummary)**                                    | Con reparos   | Ignora saldos a favor en tarjetas (FIN-03).                        |
| **Resumen del período (calculatePeriodSummary)**                                                              | Con reparos   | Transferencias con categoría cuentan como gasto (FIN-01).          |
| **Progreso de presupuesto (calculateBudgetProgress)**                                                         | Aceptable     | Reparto uniforme por subperíodo (FIN-04).                          |
| **Validación de límite de crédito**                                                                           | Correcto      | Considera la deuda actual y revierte la edición antes de validar.  |
| **Puntaje de salud financiera y bitácora de 52 semanas**                                                      | No auditado   | Fórmulas no documentadas (FIN-05).                                 |

### 6.2 Hallazgos financieros

#### FIN-01 · Transferencias con categoría se cuentan como gasto (riesgo de doble conteo con tarjetas)

|                   |                                                                                                                                                                                                                                                                                                        |
|-------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Severidad**     | **MEDIO**                                                                                                                                                                                                                                                                                              |
| **Evidencia**     | financialEngine.ts: calculatePeriodSummary suma a totalExpense toda transferencia con categoryId, incluidos los pagos a tarjeta (isCreditCardPayment); calculateBudgetProgress hace lo mismo. Si la compra con tarjeta ya se registró como gasto, el pago posterior de la tarjeta volvería a contarse. |
| **Impacto**       | Posible doble conteo en resúmenes, presupuestos y puntaje de salud. No pude comprobar en la interfaz si un pago a tarjeta puede llevar categoría; el riesgo existe si el formulario lo permite.                                                                                                        |
| **Recomendación** | Excluir isCreditCardPayment del gasto; reservar «transferencia con categoría» para casos explícitos (p. ej., pago de préstamo) y agregar pruebas del ciclo compra → pago.                                                                                                                              |
| **Esfuerzo**      | S                                                                                                                                                                                                                                                                                                      |

#### FIN-02 · Tarjetas sin intereses ni comisiones y mensajes de «Financiamiento 0%»

|                   |                                                                                                                                                                                                                                         |
|-------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Severidad**     | **MEDIO**                                                                                                                                                                                                                               |
| **Evidencia**     | Las tarjetas modelan saldo, límite, día de corte y día de pago, pero no tasa, comisiones ni pago mínimo. financialHealthEngine.ts genera textos como «Financiamiento 0%» y «~45 días de financiamiento» al recomendar qué tarjeta usar. |
| **Impacto**       | El 0 % sólo es cierto si se paga el total antes de la fecha límite; el mensaje puede inducir decisiones costosas y los cálculos de deuda subestiman el costo real.                                                                      |
| **Recomendación** | Condicionar el texto («si pagas el total antes del…»), permitir registrar tasa y comisiones por tarjeta y estimar el costo de financiamiento.                                                                                           |
| **Esfuerzo**      | M                                                                                                                                                                                                                                       |

#### FIN-03 · Un saldo a favor en tarjeta no se refleja en el patrimonio neto

|                   |                                                                                                                                                  |
|-------------------|--------------------------------------------------------------------------------------------------------------------------------------------------|
| **Severidad**     | **MEDIO**                                                                                                                                        |
| **Evidencia**     | calculatePortfolioSummary sólo acumula deuda cuando currentBalance \< 0 en tarjetas y no suma saldos positivos al dinero disponible.             |
| **Impacto**       | Un sobrepago o reembolso queda fuera del patrimonio neto, que se subestima.                                                                      |
| **Recomendación** | Tratar el saldo positivo de una tarjeta como saldo a favor (restarlo de la deuda total o mostrarlo aparte) y validar pagos que excedan la deuda. |
| **Esfuerzo**      | S                                                                                                                                                |

#### Observaciones menores

| **ID** | **Severidad** | **Observación y recomendación**                                                                                                                                                                                                                                                                                                                                                                             |
|--------|---------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| FIN-04 | **Bajo**      | Presupuestos: calculateBudgetProgress reparte la meta de forma uniforme entre subperíodos (meta ÷ n), sin considerar estacionalidad ni gastos fijos con fecha. Recomendación: permitir asignación por subperíodo y mostrar el ritmo esperado a la fecha.                                                                                                                                                    |
| FIN-05 | **Info**      | El puntaje de salud financiera (0–100), la tasa de ahorro, la cobertura de liquidez y la bitácora de 52 semanas (financialHealthEngine.ts, annualBudgetEngine.ts) usan fórmulas y umbrales propios que no están documentados. No se auditaron en profundidad. Recomendación: documentar las fórmulas, agregar pruebas con casos conocidos y validarlas con una persona especialista en finanzas personales. |

## 7. Seguridad

Hay decisiones correctas (reglas con denegación por defecto, aislamiento por usuario, PBKDF2 con 310 000 iteraciones y migración desde SHA-256, validación del propietario antes de cada escritura). Las debilidades están en la capa que rodea esas decisiones: el bloqueo local es sólo de interfaz, faltan controles contra abuso (App Check, límites, cabeceras) y las Cloud Functions no son la vía real de escritura.

#### SEG-01 · El bloqueo por PIN/biometría protege la pantalla, no los datos

|                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
|-------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Severidad**     | **ALTO**                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Evidencia**     | El store completo se guarda en texto plano en localStorage (wallet_app_v4_store) y la configuración del bloqueo también (wallet_security_config\_\<uid\>); quien tenga acceso al navegador puede desactivarlo editando ese valor. SecuritySettingsModal.tsx importa verifyUserPin pero no lo usa: cambiar o eliminar el PIN no pide el PIN actual (sólo un confirm()). SecurityLockScreen.tsx no limita intentos fallidos, y un PIN de 4 dígitos tiene sólo 10 000 combinaciones. |
| **Impacto**       | Es una barrera útil contra una persona que toma el teléfono desbloqueado por unos segundos, pero no contra quien tenga acceso real al navegador. Las descripciones del repositorio («cifrado y hash de PIN», «100% offline») pueden leerse como una protección que no existe.                                                                                                                                                                                                     |
| **Recomendación** | Pedir el PIN actual para cambiarlo o quitarlo; limitar intentos con espera creciente y cierre de sesión tras N fallos; subir a 6 dígitos o permitir clave alfanumérica; y, si se quiere proteger datos en reposo, cifrar el almacenamiento local con una clave derivada del PIN (WebCrypto). Describir el alcance real en la documentación.                                                                                                                                       |
| **Esfuerzo**      | M                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

#### SEG-02 · El verificador del PIN se sincroniza a Firestore

|                   |                                                                                                                                                                                                                                                 |
|-------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Severidad**     | **MEDIO**                                                                                                                                                                                                                                       |
| **Evidencia**     | firestoreSync.ts guarda pinCredential (sal y hash PBKDF2-SHA256, 310 000 iteraciones) en users/{uid}/settings/security. Con sólo 10 000 PIN posibles, un atacante que lea ese documento puede recuperar el PIN sin conexión en minutos o menos. |
| **Impacto**       | Quien comprometa la cuenta de Firebase ya tiene acceso a todos los datos, así que el riesgo adicional es acotado; sin embargo, el PIN suele reutilizarse en otros servicios y la sincronización aporta poco.                                    |
| **Recomendación** | No sincronizar el verificador (PIN por dispositivo) o sincronizar sólo la preferencia de bloqueo. El uso de PBKDF2 con 310 000 iteraciones es correcto y debe conservarse.                                                                      |
| **Esfuerzo**      | S                                                                                                                                                                                                                                               |

#### SEG-03 · La biometría WebAuthn no se verifica criptográficamente

|                   |                                                                                                                                                                                                                                                                       |
|-------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Severidad**     | **MEDIO**                                                                                                                                                                                                                                                             |
| **Evidencia**     | verifyBiometrics genera un challenge aleatorio que no se conserva y acepta cualquier aserción devuelta (if (assertion) return { ok: true }), sin validar firma ni contador. CONTEXTO.md habla de «enclave seguro del navegador», afirmación que AGENTS.md ya corrige. |
| **Impacto**       | Sirve como verificación local de presencia, pero no es autenticación fuerte ni vinculada al servidor.                                                                                                                                                                 |
| **Recomendación** | Mantenerla como comodidad local y describirla así, o completar el flujo WebAuthn con verificación en servidor si se quiere usarla como segundo factor.                                                                                                                |
| **Esfuerzo**      | M                                                                                                                                                                                                                                                                     |

#### SEG-04 · Endpoint de IA sin autenticación, límites ni validación

|                   |                                                                                                                                                                                                                     |
|-------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Severidad**     | **MEDIO — pasa a Alto si se despliega el servidor**                                                                                                                                                                 |
| **Evidencia**     | server.ts: POST /api/financial-inference no verifica identidad, no limita la frecuencia, no valida el esquema del cuerpo y concatena campos controlados por quien llama (highlight, cardTactics) dentro del prompt. |
| **Impacto**       | Si se publica el servidor Express, cualquiera podría consumir la cuota y el costo de Gemini y manipular el prompt. Con la configuración actual de Hosting estático el riesgo es latente (ver FUN-02).               |
| **Recomendación** | Verificar el ID token de Firebase, aplicar límites por usuario, validar con un esquema (p. ej. zod), usar una Function con App Check y mantener la clave sólo en variables del servidor.                            |
| **Esfuerzo**      | M                                                                                                                                                                                                                   |

#### SEG-05 · Autenticación básica: contraseña mínima de 6, sin verificación de correo ni segundo factor

|                   |                                                                                                                                                                                                                                   |
|-------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Severidad**     | **MEDIO**                                                                                                                                                                                                                         |
| **Evidencia**     | registerUser exige 6 caracteres; no se usa sendEmailVerification; no hay MFA; recaptchaSiteKey está vacío en firebase-applet-config.json (sin App Check); acciones sensibles como restablecer los datos no piden reautenticación. |
| **Impacto**       | Cuentas fáciles de adivinar o registradas con correos ajenos, y abuso automatizado de los servicios de Firebase.                                                                                                                  |
| **Recomendación** | Subir la política de contraseñas, exigir correo verificado antes de sincronizar, habilitar App Check (reCAPTCHA Enterprise o equivalente) y MFA opcional, y reautenticar antes de operaciones destructivas.                       |
| **Esfuerzo**      | M                                                                                                                                                                                                                                 |

#### SEG-06 · Reglas de Firestore: buena base, pero validación desigual

|                   |                                                                                                                                                                                                                                                                                                                                              |
|-------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Severidad**     | **MEDIO**                                                                                                                                                                                                                                                                                                                                    |
| **Evidencia**     | firestore.rules aplica denegación por defecto, aislamiento por uid, validación de ID y existsAfter para cuentas de transacciones. Sin embargo, categories, periods, budgets y settings sólo verifican userId; no limitan campos (keys().hasOnly) ni tamaño. Las cuentas permiten fijar currentBalance arbitrario y creditLimit no se valida. |
| **Impacto**       | Un usuario autenticado puede escribir documentos arbitrarios y grandes en su propio espacio (abuso de almacenamiento y costo) y alterar saldos sin pasar por la lógica de movimientos.                                                                                                                                                       |
| **Recomendación** | Definir esquemas por colección (campos permitidos, tipos, longitudes máximas) y, para saldos, ver INT-07. Probar las reglas con el emulador y pruebas automatizadas.                                                                                                                                                                         |
| **Esfuerzo**      | M                                                                                                                                                                                                                                                                                                                                            |

#### SEG-07 · Sin cabeceras de seguridad en Firebase Hosting

|                   |                                                                                                                                                                                                                                 |
|-------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Severidad**     | **MEDIO**                                                                                                                                                                                                                       |
| **Evidencia**     | firebase.json no define headers: no hay Content-Security-Policy, X-Content-Type-Options, Referrer-Policy ni frame-ancestors/X-Frame-Options.                                                                                    |
| **Impacto**       | Si algún día ocurre una inyección de scripts, el atacante podría leer todo localStorage (PRIV-01) y las credenciales de sesión de Firebase. La CSP es la defensa de profundidad más valiosa para una app con datos financieros. |
| **Recomendación** | Agregar CSP estricta (autoalojar fuentes y evitar unsafe-eval; ver SEG-08), HSTS, nosniff, Referrer-Policy y frame-ancestors 'none'.                                                                                            |
| **Esfuerzo**      | S                                                                                                                                                                                                                               |

#### SEG-08 · Cloud Functions sin App Check ni límites de instancias

|                   |                                                                                                                                                                                                                                      |
|-------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Severidad**     | **MEDIO**                                                                                                                                                                                                                            |
| **Evidencia**     | Las funciones onCall de functions/src/index.ts no declaran enforceAppCheck, maxInstances ni controles de frecuencia. clearFinancialAccountsAndTransactions elimina todas las cuentas y movimientos del usuario con una sola llamada. |
| **Impacto**       | Hoy no están conectadas (INT-07), pero si se adoptan quedarían expuestas a abuso y a borrados accidentales.                                                                                                                          |
| **Recomendación** | Activar App Check obligatorio, maxInstances, confirmación reforzada o reautenticación para la función de borrado y registro de auditoría.                                                                                            |
| **Esfuerzo**      | S                                                                                                                                                                                                                                    |

#### Observaciones menores

| **ID** | **Severidad** | **Observación y recomendación**                                                                                                                                                                                                                                                                                                                  |
|--------|---------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| SEG-09 | **Bajo**      | evaluateCalculatorExpression (formatters.ts) usa new Function sobre una entrada filtrada por lista blanca (\[0-9+\\\*/.() \]). El riesgo de inyección es bajo, pero obliga a permitir unsafe-eval en una CSP futura. Recomendación: reemplazar por un pequeño analizador aritmético.                                                             |
| SEG-10 | **Bajo**      | handleFirestoreError serializa correo y uid en el mensaje del Error y en la consola; hay 23 llamadas a console.\* en src. Recomendación: no registrar datos personales y usar un sistema de logs con niveles.                                                                                                                                    |
| SEG-11 | **Info**      | La API key de Firebase y los IDs del proyecto están en firebase-applet-config.json. Es normal (son identificadores públicos), pero debe protegerse con restricciones de referente/API en Google Cloud, dominios autorizados en Auth y App Check. .gitignore ya excluye .env\*.                                                                   |
| SEG-12 | **Bajo**      | Dependencias: express, @google/genai y @types/express siguen en package.json aunque CONTEXTO.md dice que se retiraron; el repositorio incluye bun.lock mientras la documentación usa npm; no se ejecutó npm audit. Recomendación: depurar dependencias, fijar un gestor de paquetes y activar auditoría automática (Dependabot/npm audit en CI). |

## 8. Privacidad

La app presenta a los usuarios una pantalla de «Seguridad, privacidad y confidencialidad» con promesas fuertes. La revisión del código muestra que varias no están respaldadas: el borrado total no borra, la anonimización envía nombres de tarjeta y los datos locales no se protegen ni se eliminan al salir. Corregir el código o corregir el texto es igual de importante.

#### PRIV-01 · Datos financieros en texto plano en el navegador, que no se borran al cerrar sesión

|                   |                                                                                                                                                                                                                                                                                                           |
|-------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Severidad**     | **ALTO**                                                                                                                                                                                                                                                                                                  |
| **Evidencia**     | WalletContext.tsx guarda el store de todos los usuarios que han iniciado sesión en ese navegador en localStorage (wallet_app_v4_store). logout() sólo ejecuta signOut y limpia el ID de sesión; no elimina el store, la cola offline (wallet_offline_queue_v1\_\<uid\>) ni la configuración de seguridad. |
| **Impacto**       | En un equipo compartido o prestado, la siguiente persona (o cualquier extensión o script con acceso al origen) puede leer cuentas, saldos, movimientos y notas de usuarios anteriores.                                                                                                                    |
| **Recomendación** | Borrar o cifrar el almacenamiento local al cerrar sesión, no mezclar usuarios en una misma clave, migrar a IndexedDB cifrada con clave derivada del PIN, y avisar al usuario que la persistencia local es opcional.                                                                                       |
| **Esfuerzo**      | M                                                                                                                                                                                                                                                                                                         |

#### PRIV-02 · El «derecho al olvido» que promete la app no se cumple

|                   |                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
|-------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Severidad**     | **ALTO**                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Evidencia**     | AboutSecurityModal.tsx afirma que el usuario puede «restablecer y eliminar la totalidad» de sus datos. resetUserFinancialData sólo borra settings, categories, periods y budgets; no elimina accounts, transactions, templates ni financial_reports. La Function clearFinancialAccountsAndTransactions no se invoca desde el cliente, no existe borrado de la cuenta de Firebase Auth (deleteUser no se usa) y las reglas prohíben borrar users/{uid}. |
| **Impacto**       | Tras «restablecer», cuentas y movimientos permanecen en Firestore y pueden reaparecer en los listeners. Nunca se elimina la identidad ni el documento de usuario. Es una promesa pública sin respaldo técnico, con implicaciones reputacionales y, según los usuarios y países atendidos, regulatorias. Conviene validarlo con una prueba en una cuenta de ensayo.                                                                                     |
| **Recomendación** | Implementar una Function de eliminación completa (recursiveDelete de users/{uid}) más deleteUser con reautenticación, exportación previa de datos y confirmación explícita; actualizar los textos legales.                                                                                                                                                                                                                                             |
| **Esfuerzo**      | M                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

#### PRIV-03 · La afirmación «100% anonimizado» sobre la IA no es exacta

|                   |                                                                                                                                                                                                                                                                                         |
|-------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Severidad**     | **MEDIO**                                                                                                                                                                                                                                                                               |
| **Evidencia**     | requestWeeklyAiInference envía cardTactics.title, cardTactics.message y recommendedCardName (los nombres de las tarjetas son texto libre del usuario) y weekData.highlight, además de montos, fechas y métricas. La interfaz y AGENTS.md describen el envío como estrictamente anónimo. |
| **Impacto**       | Datos potencialmente identificables (nombre de banco, alias de tarjeta) saldrían hacia un tercero (Google/Gemini) sin una descripción exacta ni consentimiento informado. No verifiqué el valor por defecto de enableAiWeeklyAnalysis.                                                  |
| **Recomendación** | Enviar sólo métricas numéricas y etiquetas genéricas («tarjeta A»); activar la función únicamente con consentimiento explícito, desactivada por defecto; corregir los textos.                                                                                                           |
| **Esfuerzo**      | S                                                                                                                                                                                                                                                                                       |

#### PRIV-04 · Datos de demostración con nombre y correo de apariencia real dentro del bundle público

|                   |                                                                                                                                                                                                                                                    |
|-------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Severidad**     | **MEDIO**                                                                                                                                                                                                                                          |
| **Evidencia**     | initialData.ts define usr_francisco con nombre «Francisco Estrada» y correo francisco@estrada.gt, además de períodos y movimientos de ejemplo. loadInitialDatabase siembra ese usuario demo y usr_nuevo en el localStorage de cualquier visitante. |
| **Impacto**       | Cualquiera que abra el código del sitio puede ver esos datos; si corresponden a una persona real, es una exposición innecesaria. Además mezcla datos de prueba con el flujo de producción.                                                         |
| **Recomendación** | Eliminar los datos demo del bundle de producción (o anonimizarlos por completo) y no sembrar usuarios ficticios en el almacenamiento del visitante.                                                                                                |
| **Esfuerzo**      | S                                                                                                                                                                                                                                                  |

#### Observaciones menores

| **ID**  | **Severidad** | **Observación y recomendación**                                                                                                                                                                                                                                                                                                                                                                        |
|---------|---------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| PRIV-05 | **Bajo**      | Terceros y transparencia: se cargan Google Fonts desde fonts.googleapis.com (envía la IP del usuario a Google en cada carga sin caché) y no se observan política de privacidad, términos ni registro de consentimiento. Recomendación: autoalojar fuentes y publicar política y términos. Este informe no constituye asesoría legal; conviene validar el marco normativo aplicable con un profesional. |
| PRIV-06 | **Bajo**      | Los textos de AboutSecurityModal.tsx incluyen frases absolutas («no está expuesta a miradas externas», «100% anonimizado», «sin comprometer jamás tu privacidad») que no se pueden garantizar. Recomendación: redactar con precisión lo que se hace y lo que no (p. ej., cifrado en tránsito y en reposo de Google, bloqueo local de interfaz).                                                        |
| PRIV-07 | **Info**      | Notas, nombres de cuentas y movimientos se guardan sin cifrado de extremo a extremo; Google los cifra en reposo y quienes administren el proyecto de Firebase pueden leerlos. Si la propuesta de valor será «privacidad fuerte», considerar cifrado del lado del cliente de los campos sensibles.                                                                                                      |

## 9. Calidad, mantenibilidad y operación

#### CAL-01 · No hay pruebas automatizadas

|                   |                                                                                                                                                                                                                                         |
|-------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Severidad**     | **ALTO**                                                                                                                                                                                                                                |
| **Evidencia**     | No existen archivos \*.test.\* o \*.spec.\* ni un script test en package.json; sólo lint (tsc --noEmit) y build. CONTEXTO.md documenta «comprobación técnica» únicamente con esos dos comandos.                                         |
| **Impacto**       | Una aplicación que maneja dinero sin pruebas es frágil: INT-01 se habría detectado con una prueba unitaria de diez líneas, y cualquier refactor puede reintroducirlo.                                                                   |
| **Recomendación** | Agregar Vitest para financialEngine, periodEngine, offlineQueue y la lógica de saldos; pruebas de reglas con el Firebase Emulator; pruebas end-to-end (Playwright) de los flujos principales; y ejecutar todo en CI antes de desplegar. |
| **Esfuerzo**      | M                                                                                                                                                                                                                                       |

CAL-02 · \`WalletContext.tsx\` concentra demasiadas responsabilidades

|                   |                                                                                                                                                                                                  |
|-------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Severidad**     | **MEDIO**                                                                                                                                                                                        |
| **Evidencia**     | El archivo tiene alrededor de 2 200 líneas (82 KB) y mezcla autenticación, persistencia local, suscripciones a Firestore, reconciliación con la cola offline y todas las operaciones de dominio. |
| **Impacto**       | Difícil de razonar, de probar y de modificar sin romper algo; es la causa de varios riesgos de integridad (INT-04, INT-05).                                                                      |
| **Recomendación** | Separarlo en módulos: repositorio de datos, servicio de sincronización/cola, lógica de dominio pura (testeable) y un contexto delgado para la interfaz.                                          |
| **Esfuerzo**      | L                                                                                                                                                                                                |

#### CAL-03 · Documentación contradictoria entre sí y con el código

|                   |                                                                                                                                                                                                                                                                                                                                                                                                                           |
|-------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Severidad**     | **MEDIO**                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Evidencia**     | CONTEXTO.md describe writeBatch y hash SHA-256 del PIN; AGENTS.md aclara que el código usa runTransaction y PBKDF2; el código implementa PBKDF2 con migración desde SHA-256. AGENTS.md cita la ruta /api/gemini/weekly-health-inference y Gemini 2.5 Flash, pero el código usa /api/financial-inference y otros modelos. CONTEXTO.md dice que Express y @google/genai se retiraron, y siguen en package.json y server.ts. |
| **Impacto**       | Quien lea la documentación (incluidas herramientas de IA que generan código) tomará decisiones sobre premisas falsas.                                                                                                                                                                                                                                                                                                     |
| **Recomendación** | Dejar un solo documento de arquitectura, actualizarlo en cada cambio y verificarlo contra el código; eliminar afirmaciones de «implementado» no respaldadas.                                                                                                                                                                                                                                                              |
| **Esfuerzo**      | S                                                                                                                                                                                                                                                                                                                                                                                                                         |

#### Observaciones menores

| **ID** | **Severidad** | **Observación y recomendación**                                                                                                                                                                                                                                                                                     |
|--------|---------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| CAL-04 | **Bajo**      | Higiene del repositorio: se versionan .firebase/ y dev-dist/ (no están en .gitignore), el paquete se llama react-example, quedan metadata.json y firebase-blueprint.json de la herramienta generadora, y no hay CI/CD. Recomendación: limpiar, nombrar el proyecto y automatizar lint, pruebas, build y despliegue. |
| CAL-05 | **Bajo**      | Operación: sin monitoreo de errores (p. ej. Sentry/Crashlytics), sin respaldos programados de Firestore ni plan de recuperación, y sin alertas de presupuesto de facturación en el proyecto. Recomendación: configurar exportaciones programadas, alertas de costo y monitoreo.                                     |

## 10. Aspectos positivos

Conviene conservar y construir sobre lo que ya está bien resuelto:

- **Reglas de Firestore con denegación por defecto**, aislamiento por uid, validación de IDs, montos y fechas, y comprobación de cuentas con existsAfter.

- **Transacciones de Firestore** para guardar el movimiento y los saldos afectados de forma atómica (el diseño es correcto; falla un detalle de implementación).

- **PIN con PBKDF2-SHA256 y 310 000 iteraciones**, sal aleatoria y migración automática de verificadores antiguos.

- **Autobloqueo** por visibilidad, foco e inactividad, con tiempos configurables.

- **Validación de dominio** reutilizable (validateTransactionInput) que revierte la edición antes de comprobar límites de tarjeta.

- **Normalización defensiva** de datos heredados (por ejemplo, deuda de tarjeta con signo incorrecto) y reconciliación de IDs al inicializar datos.

- **Separación por funcionalidades** (features/) y motores de cálculo como funciones puras, que facilitan agregar pruebas.

- **Diseño pensado para el contexto local**: quetzales, períodos quincenales, corte y pago de tarjetas, interfaz en español, PWA instalable en Android e iOS.

- **Documentación honesta en \`AGENTS.md\`**, que advierte no asumir que algo está conectado sin confirmarlo en el código.

## 11. Plan de remediación priorizado

**Inmediato (0–7 días)**

- Corregir la doble reversión y agregar pruebas unitarias de saldos.
- Crear y ejecutar la rutina de reconciliación de saldos sobre las cuentas existentes.
- Pedir el PIN actual y limitar intentos fallidos.
- Borrar el almacenamiento local al cerrar sesión; retirar los datos demo.
- Corregir los textos de privacidad y seguridad de la app; desactivar la IA por defecto o protegerla.

*Hallazgos relacionados:* INT-01, INT-02, SEG-01, PRIV-01, PRIV-03, PRIV-04, PRIV-06

**Corto plazo (2–4 semanas)**

- Cola offline robusta: Web Locks, idempotencia, backoff y bandeja de errores.
- Decidir entre Functions o reglas como única vía de escritura de dinero.
- Reglas con esquema por colección y pruebas con el emulador.
- App Check, verificación de correo, política de contraseñas y reautenticación.
- Cabeceras de seguridad y CSP; autoalojar fuentes.
- Eliminación total de datos y de cuenta (Function + deleteUser).

*Hallazgos relacionados:* INT-03, INT-04, INT-05, INT-07, SEG-04 a SEG-08, PRIV-02, PRIV-05

**Mediano plazo (1–3 meses)**

- Dividir WalletContext.tsx y mover la persistencia a IndexedDB (con cifrado opcional).
- Dinero en centavos enteros y un único criterio de período.
- Multi-moneda, recurrentes en servidor y notificaciones push.
- Pruebas end-to-end, CI/CD, monitoreo y respaldos de Firestore.
- Paginación y agregados para controlar costo de lecturas.
- Documentar y validar las fórmulas de salud financiera.

*Hallazgos relacionados:* INT-06, INT-08, INT-09, FUN-01 a FUN-04, FIN-01 a FIN-05, CAL-01 a CAL-05


## 12. Matriz consolidada de hallazgos

| **ID**  | **Severidad** | **Hallazgo**                                                                               | **Esfuerzo** | **Sección** |
|---------|---------------|--------------------------------------------------------------------------------------------|--------------|-------------|
| INT-01  | **Crítico**   | Doble reversión del saldo al editar o volver a guardar una transacción                     | S            | 5           |
| INT-02  | **Alto**      | Saldos derivados sin ningún mecanismo de reconciliación                                    | M            | 5           |
| INT-03  | **Alto**      | La cola offline se bloquea ante un error permanente                                        | M            | 5           |
| INT-04  | **Alto**      | Procesamiento concurrente de la misma cola (multi-pestaña / PWA + navegador)               | M            | 5           |
| FUN-01  | **Alto**      | Sin soporte multi-moneda (todo se trata como GTQ)                                          | L            | 4           |
| SEG-01  | **Alto**      | El bloqueo por PIN/biometría protege la pantalla, no los datos                             | M            | 7           |
| PRIV-01 | **Alto**      | Datos financieros en texto plano en el navegador, que no se borran al cerrar sesión        | M            | 8           |
| PRIV-02 | **Alto**      | El «derecho al olvido» que promete la app no se cumple                                     | M            | 8           |
| CAL-01  | **Alto**      | No hay pruebas automatizadas                                                               | M            | 9           |
| INT-05  | **Medio**     | Efectos secundarios dentro de funciones actualizadoras de estado                           | S            | 5           |
| INT-06  | **Medio**     | Pérdida silenciosa de datos locales por cuota de localStorage                              | M            | 5           |
| INT-07  | **Medio**     | Cloud Functions sin uso y tres versiones de las mismas reglas de negocio                   | L            | 5           |
| INT-08  | **Medio**     | Asignación de período inconsistente (fallback y solapamientos)                             | M            | 5           |
| FUN-02  | **Medio**     | La inferencia con IA probablemente no funciona en producción                               | M            | 4           |
| FUN-03  | **Medio**     | Los movimientos recurrentes dependen de que la app esté abierta                            | L            | 4           |
| FUN-04  | **Medio**     | Lecturas completas de colecciones: costo y latencia crecen con el historial                | M–L          | 4           |
| FIN-01  | **Medio**     | Transferencias con categoría se cuentan como gasto (riesgo de doble conteo con tarjetas)   | S            | 6           |
| FIN-02  | **Medio**     | Tarjetas sin intereses ni comisiones y mensajes de «Financiamiento 0%»                     | M            | 6           |
| FIN-03  | **Medio**     | Un saldo a favor en tarjeta no se refleja en el patrimonio neto                            | S            | 6           |
| SEG-02  | **Medio**     | El verificador del PIN se sincroniza a Firestore                                           | S            | 7           |
| SEG-03  | **Medio**     | La biometría WebAuthn no se verifica criptográficamente                                    | M            | 7           |
| SEG-04  | **Medio**     | Endpoint de IA sin autenticación, límites ni validación                                    | M            | 7           |
| SEG-05  | **Medio**     | Autenticación básica: contraseña mínima de 6, sin verificación de correo ni segundo factor | M            | 7           |
| SEG-06  | **Medio**     | Reglas de Firestore: buena base, pero validación desigual                                  | M            | 7           |
| SEG-07  | **Medio**     | Sin cabeceras de seguridad en Firebase Hosting                                             | S            | 7           |
| SEG-08  | **Medio**     | Cloud Functions sin App Check ni límites de instancias                                     | S            | 7           |
| PRIV-03 | **Medio**     | La afirmación «100% anonimizado» sobre la IA no es exacta                                  | S            | 8           |
| PRIV-04 | **Medio**     | Datos de demostración con nombre y correo de apariencia real dentro del bundle público     | S            | 8           |
| CAL-02  | **Medio**     | WalletContext.tsx concentra demasiadas responsabilidades                                   | L            | 9           |
| CAL-03  | **Medio**     | Documentación contradictoria entre sí y con el código                                      | S            | 9           |
| INT-09  | **Bajo**      | Dinero en coma flotante e IDs predecibles                                                  | —            | 5           |
| INT-10  | **Bajo**      | Validaciones incompletas: sobregiro, pagos a tarjeta y borrado de cuentas                  | —            | 5           |
| FUN-05  | **Bajo**      | Zoom bloqueado en el viewport (accesibilidad)                                              | —            | 4           |
| FUN-06  | **Bajo**      | Usuarios demo y switchUserMode aún presentes                                               | —            | 4           |
| FIN-04  | **Bajo**      | Reparto uniforme de presupuestos por subperíodo                                            | —            | 6           |
| SEG-09  | **Bajo**      | Uso de new Function en la calculadora                                                      | —            | 7           |
| SEG-10  | **Bajo**      | Datos personales en mensajes de error y consola                                            | —            | 7           |
| SEG-12  | **Bajo**      | Dependencias residuales y sin auditoría                                                    | —            | 7           |
| PRIV-05 | **Bajo**      | Terceros (Google Fonts) y ausencia de política de privacidad                               | —            | 8           |
| PRIV-06 | **Bajo**      | Textos de seguridad con afirmaciones absolutas                                             | —            | 8           |
| CAL-04  | **Bajo**      | Higiene del repositorio                                                                    | —            | 9           |
| CAL-05  | **Bajo**      | Sin monitoreo, respaldos ni alertas de costo                                               | —            | 9           |
| FUN-07  | **Info**      | Pantallas no auditadas línea por línea                                                     | —            | 4           |
| FIN-05  | **Info**      | Fórmulas de salud financiera sin documentar ni auditar                                     | —            | 6           |
| SEG-11  | **Info**      | API key y configuración de Firebase en el repositorio                                      | —            | 7           |
| PRIV-07 | **Info**      | Sin cifrado de extremo a extremo en Firestore                                              | —            | 8           |

## Anexo A · Evidencia de la simulación de saldos

Se replicaron en Node.js las funciones applyTransactionToAccounts y reverseTransactionOnAccounts de financialEngine.ts y la secuencia de operaciones de syncTransactionWithAccounts tal como está escrita. Cuenta inicial de Q1,000; gasto de Q100 (saldo Q900).

| **N.º** | **Escenario**                                                              | **Esperado** | **Código actual** | **Diferencia**         |
|---------|----------------------------------------------------------------------------|--------------|-------------------|------------------------|
| 1       | Editar el gasto de Q100 a Q120                                             | Q880         | Q980              | +Q100 (monto original) |
| 2       | Volver a guardar la misma transacción de Q100 (reintento o cola duplicada) | Q900         | Q1,000            | +Q100                  |

**Cómo interpretarlo.** Cada vez que una transacción existente pasa por syncTransactionWithAccounts, el saldo remoto se desvía en el monto de esa transacción. Aplica a ediciones hechas por el usuario y a re-guardados automáticos (reintentos de la cola, reencolado de movimientos heredados sin userId). Las eliminaciones usan otra función (deleteTransactionWithAccounts) y revierten una sola vez, por lo que no presentan este defecto.

**Limitación.** Es una simulación de la lógica, no una prueba contra Firestore; confirmar con un caso real en una cuenta de ensayo antes y después de corregir.

## Anexo B · Cobertura de la revisión

| **Nivel de revisión**                           | **Archivos**                                                                                                                                                                                                                                                                                                                                                                                                                   |
|-------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Lectura completa**                            | firebase.json, .firebaserc, firestore.rules, firestore.indexes.json, firebase-applet-config.json, package.json, vite.config.ts, index.html, server.ts, functions/src/index.ts, core/firebase/firebase.ts, core/firebase/firestoreSync.ts, core/security/securityService.ts, core/security/useAppLock.ts, core/sync/offlineQueue.ts, features/transactions/financialEngine.ts, core/utils/formatters.ts, CONTEXTO.md, AGENTS.md |
| **Lectura parcial (por secciones o búsquedas)** | core/state/WalletContext.tsx (persistencia, autenticación, listeners, transacciones, cuentas, reseteo), core/data/initialData.ts, features/analytics/financialHealthEngine.ts (cliente de IA), core/security/SecurityLockScreen.tsx, core/security/SecuritySettingsModal.tsx, features/settings/AboutSecurityModal.tsx, features/financial_periods/periodEngine.ts                                                             |
| **Sólo búsquedas de patrones**                  | Todo src/ (uso de fetch, eval, new Function, innerHTML, localStorage, console.\*, httpsCallable, deleteUser, sendEmailVerification)                                                                                                                                                                                                                                                                                            |
| **No revisados en detalle**                     | AccountsView, AnalyticsView, FinancialHealthModal, AnnualBudgetModal, annualBudgetEngine, DashboardView, FinancialHealthCard, MoreView, TransactionModal, TransactionsView, TemplatesView, templateRecurrence, PeriodsModal, AuthScreen, PWAInstallModal, usePWAInstall, widgets y App.tsx                                                                                                                                     |

**Siguiente paso sugerido:** revisar las pantallas no cubiertas, correr npm audit, lint y build, y probar las reglas y los flujos críticos (alta, edición y borrado de movimientos con y sin conexión) contra el emulador de Firebase.

---

## Anexo C · Resolución post-auditoría (Validación y Correcciones)

Tras someter este informe a una validación manual cruzada con el estado actual del repositorio, se determinó lo siguiente:

### Falsos Positivos (Ignorados)
- **INT-01 (Falso):** El reporte alucinó una doble reversión que no existe en el código. El motor financiero actual aplica correctamente una sola reversión (`saveTransactionToAccounts`).
- **INT-02 (Falso):** El reporte afirmó que no había mecanismo de reconciliación, pero el proyecto sí incluye `reconcileAccountBalances` (implementado en `MoreView.tsx`).

### Hallazgos Validados y Corregidos
- **PRIV-01 a PRIV-04:** Corregidos. Se actualizó `logout()` para purgar `localStorage`, se completó la lógica de "derecho al olvido" incluyendo cuentas y transacciones en el borrado, se quitaron textos libres del payload enviado a la IA y se anonimizó la data de demostración.
- **INT-03:** Corregido. La cola offline ahora detecta errores permanentes y desecha la mutación en lugar de hacer `break`, evitando bloqueos permanentes.
- **FIN-01 y FIN-03:** Corregidos. Los pagos a tarjeta de crédito con categoría asociada ya no causan doble conteo de gastos, y los saldos positivos (a favor) en tarjetas de crédito ya se suman al dinero disponible en el cálculo del patrimonio.
