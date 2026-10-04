# Contexto del proyecto Wallet

Documento de orientación basado en el código y la configuración presentes en el repositorio al momento de su creación. No sustituye una auditoría funcional o de seguridad.

## 1. Qué hace y stack

Wallet es una aplicación web de finanzas personales en español, enfocada en GTQ (quetzales). Permite registrar cuentas y tarjetas, ingresos, gastos y transferencias; organizar transacciones por períodos financieros; definir presupuestos y consultar resúmenes y análisis.

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
| `src/App.tsx` | Shell autenticado, navegación principal, tema y apertura de vistas/modales. |
| `src/index.css` | Estilos globales. |
| `src/core/types/models.ts` | Tipos de dominio y modelos de datos. |
| `src/core/data/initialData.ts` | Categorías por defecto, tienda inicial vacía y datos de demostración. |
| `src/core/state/WalletContext.tsx` | Estado central, autenticación, persistencia local, operaciones de dominio y sincronización con Firestore. |
| `src/core/firebase/firebase.ts` | Inicialización de Firebase/Auth/Firestore, proveedor de Google y manejo de errores. |
| `src/core/firebase/firestoreSync.ts` | Escritura/borrado, carga inicial («seed») y saneamiento de registros para Firestore. |
| `src/core/utils/formatters.ts` | Formateo de GTQ/fechas y evaluación de expresiones de calculadora. |
| `src/core/widgets/` | Selectores reutilizables de cuenta y período. |
| `src/features/auth/` | Registro, inicio de sesión, Google y recuperación de contraseña. |
| `src/features/dashboard/` | Inicio, resumen, accesos rápidos y actividad reciente. |
| `src/features/accounts/` | Cuentas, tarjetas, creación/edición, archivo y pagos. |
| `src/features/transactions/` | Lista, filtros y formulario modal; `financialEngine.ts` contiene validaciones y cálculos. |
| `src/features/financial_periods/` | Administración y cálculo de períodos/subperíodos. |
| `src/features/budgets/` | Administración de presupuestos y progreso. |
| `src/features/analytics/` | Resúmenes/visualizaciones y exportación CSV. |
| `src/features/settings/` | Ajustes, categorías, opciones y acciones de sincronización. |

## 3. Modelo de datos y reglas de negocio

Los documentos de datos se guardan bajo `users/{uid}`. Sus subcolecciones son `settings`, `accounts`, `categories`, `periods`, `transactions` y `budgets`; perfiles viven en el documento `users/{uid}`. El esquema orientativo también aparece en `firebase-blueprint.json`.

| Entidad | Campos/relaciones principales |
|---|---|
| `UserProfile` | Identificador Firebase, nombre, correo, proveedor y fecha de creación. |
| `UserSettings` | Moneda, decimales, tema, ocultar saldos y opciones de protección/simulación. |
| `Account` | Tipo `cash`, `bank`, `savings` o `credit_card`; saldo inicial/actual, moneda, estado y datos de tarjeta. |
| `Category` | Tipo `expense` o `income`; contiene subcategorías embebidas. |
| `FinancialPeriod` | Rango inclusivo de fechas, modo de división y subperíodos embebidos. |
| `Transaction` | Tipo `expense`, `income` o `transfer`; monto, moneda, fecha, cuenta/categoría o cuentas de origen/destino, y referencias opcionales de período. |
| `Budget` | Meta para un período y categoría, opcionalmente subcategoría, con banderas de umbral y distribución. |

Reglas confirmadas en el código:

- Los montos de transacción deben ser mayores que cero, la moneda debe tener tres caracteres y la fecha debe ser ISO válida (`YYYY-MM-DD`). La creación del estado fija moneda de transacciones a `GTQ`.
- Gastos reducen el saldo de la cuenta; ingresos lo aumentan. Transferencias reducen origen y aumentan destino. Editar/eliminar revierte el efecto anterior antes de recalcular.
- Las cuentas archivadas no se aceptan en nuevas transacciones. Las tarjetas de crédito representan deuda con saldo actual menor o igual a cero; el gasto puede validarse contra el límite disponible.
- Una transferencia necesita dos cuentas activas distintas y no requiere categoría. Se marca como pago de tarjeta si el destino es tarjeta o si se indica explícitamente.
- Los períodos no pueden solaparse. Los subperíodos se generan en modo semanal, quincenal, mensual o sin subdivisión. Las fechas de inicio y fin son inclusivas.
- Los gastos de presupuesto se calculan por rango de fechas y categoría/subcategoría; no se convierten monedas en los cálculos revisados.
- El resumen del período resta gastos de ingresos; las transferencias no alteran el resultado neto.
- Los importes se representan como `number` de JavaScript, se redondean a dos decimales al guardar transacciones/presupuestos y al aplicar cambios a saldos; varios resúmenes también redondean al final. **Hay riesgo residual de error de punto flotante/centavos** porque las sumas y restas intermedias usan binarios `number`, algunos montos iniciales pueden no estar normalizados y no hay pruebas automatizadas que garanticen igualdad contable. Considerar almacenar/calcular en centavos enteros o usar una biblioteca decimal antes de ampliar cálculos financieros.
- Firestore Rules usa denegación por defecto y restringe los datos por UID autenticado. Validan propietario e ID en escrituras y no permiten borrar el documento de perfil. Se retiró la ruta `/test/{docId}` que permitía lectura pública.

## 4. Flujos principales

1. **Autenticación y carga:** al iniciar, el contexto observa Firebase Auth. Si no hay usuario, muestra `AuthScreen`; si hay usuario, construye el perfil, prepara datos iniciales, intenta sincronizar perfil/seed y conecta listeners en tiempo real para las colecciones del usuario.
2. **Nuevo usuario:** se crea una tienda vacía con categorías iniciales y un período mensual para el mes calendario actual, generado al crear la tienda. El seed solo crea documentos remotos que aún no existan. La demo conserva sus fechas de muestra fijas.
3. **Registrar transacción:** la vista abre `TransactionModal`; se valida la entrada, se resuelve período/subperíodo según fecha (con fallback al período activo), se actualizan los saldos y se guarda localmente; con sesión Firebase también se escriben transacción y cuentas.
4. **Editar/eliminar transacción:** se comprueba propiedad, se revierte su impacto anterior en saldos, se aplica el nuevo (o se elimina) y se sincroniza con Firestore.
5. **Períodos y presupuestos:** desde inicio o «Más» se abren sus modales. Los cambios de período recalculan subperíodos y referencias de transacciones; el progreso de presupuesto se deriva de las transacciones del período.
6. **Modo de demostración/local:** `switchUserMode` ofrece los modos `demo_francisco` y `clean_new_user`; la aplicación conserva una base por usuario en `localStorage`. La ruta/interfaz exacta para activar cada modo debe confirmarse al revisar su contexto de uso.
7. **Tema y navegación:** las pestañas principales son Inicio, Cuentas, Transacciones, Análisis y Más. El tema soporta claro, oscuro y sistema.

## 5. Estado actual

El estado describe presencia en el código, no validación de calidad ni despliegue.

| Estado | Elementos |
|---|---|
| Implementado en el código | Vistas principales; Auth por correo/contraseña y Google; CRUD de cuentas/categorías/períodos/transacciones/presupuestos; cálculo de saldos, períodos y presupuestos; listeners Firestore; almacenamiento local; exportación CSV. |
| En progreso / por verificar | Validar los flujos reales de pagos con tarjeta y sincronización; validar despliegue/configuración Firebase activa. |
| Pendiente conocido | No se encontró suite de pruebas ni script `test`; automatizar casos de reglas financieras, períodos, Firestore Rules y autenticación sería un siguiente paso. |
| Riesgos/observaciones de código | No existe cola offline propia ni protección mediante PIN/biometría en el código revisado; esos controles se retiraron del modelo/interfaz para no presentarlos como funciones hechas. `firebase-applet-config.json` contiene configuración cliente, no credenciales de servidor; comprobar restricciones de API key en Google/Firebase Console. Se quitó la regla de lectura pública `/test/{docId}` y su comprobación de conectividad no utilizada. |
| Por verificar | El comportamiento ante conflictos entre escrituras locales y snapshots remotos; cobertura efectiva de las reglas Firebase desplegadas; proveedores de Auth habilitados; soporte multidivisa; accesibilidad y diseño en dispositivos reales. |

**Comprobación (2026-10-04):** `bun run lint` y `bun run build` no pudieron iniciarse porque Bun no está instalado en el entorno. Se ejecutaron las tareas equivalentes con npm (`npm run lint`, `npm run build`) y ambas terminaron con código 0. Build advierte que `__dirname` no es compatible con el cargador nativo futuro de Vite y que el bundle JS supera 500 kB minificado. No se ejecutó despliegue ni hay suite de pruebas automatizadas.

## 6. Decisiones y convenciones observadas

- Componentes funcionales React y TypeScript; estado compartido mediante `WalletContext`.
- Tipos y campos de dominio definidos en `models.ts`; lógica financiera en módulos `*Engine.ts`, separada de las vistas.
- Nombres de tipos/variables en inglés y textos visibles principalmente en español.
- Fechas de dominio almacenadas como cadenas ISO; las funciones de formato de fecha convierten a hora local al construir fechas.
- Los documentos de subcolección incluyen `userId`; la capa de sincronización lo incorpora y elimina propiedades `undefined` antes de escribir.
- Los datos se guardan bajo rutas por usuario; el cliente usa persistencia de sesión Firebase local y una copia local en `localStorage` (`wallet_app_v4_store`).
- La app aún sincroniza con Firestore desde las operaciones cuando hay sesión; no ofrece un modo offline confiable ni una cola de reintentos propia.
- No se encontró una guía formal de estilo, contribución o arquitectura. Convenciones adicionales: **por verificar**.

Al cerrar cada funcionalidad, actualizar `CONTEXTO.md` y mantener `AGENTS.md` con el mismo contenido para reflejar el comportamiento real, comandos ejecutados y asuntos que sigan por verificar.

## 7. Cómo ejecutar y comprobar

Requiere Bun o Node/npm compatible con las versiones declaradas. Hay `bun.lock`.

```bash
bun install
bun run dev
```

Vite escucha en `http://localhost:3000` y en todas las interfaces (`0.0.0.0`). Alternativa con npm: `npm install` y `npm run dev`.

```bash
bun run lint     # ejecuta tsc --noEmit
bun run build    # genera dist/ para Hosting
bun run preview  # vista previa del build
```

El cliente importa `firebase-applet-config.json`; verifica que proyecto, Auth, Firestore y reglas configuradas correspondan al ambiente esperado. No hay comando de pruebas automatizadas declarado.

## 8. Próximos pasos sugeridos

1. Ejecutar lint y build, registrar resultados y corregir errores reproducibles.
2. Añadir pruebas unitarias para saldos (alta/edición/borrado), pagos de tarjeta, validación de fechas, solapamiento/subdivisión de períodos y progreso de presupuestos.
3. Revisar seguridad Firebase: confirmar reglas desplegadas, necesidad de lectura pública en `test`, controles de campos y límites; verificar restricciones de claves cliente.
4. Diseñar una cola offline confiable solo si es requisito, con estados de sincronización y reconciliación ante errores/conflictos.
5. Si PIN/biometría son requisitos, definir e implementar controles reales antes de volver a exponerlos.
6. Reducir el riesgo monetario migrando cálculos a centavos enteros/decimal y añadir pruebas que detecten diferencias de centavos.
7. Documentar decisiones de moneda/multidivisa, manejo de fechas y flujos de tarjeta; evaluar desacoplar configuración por ambientes.

## Fuentes principales

`package.json`, `firebase.json`, `firestore.rules`, `firebase-blueprint.json`, `src/App.tsx`, `src/core/types/models.ts`, `src/core/data/initialData.ts`, `src/core/state/WalletContext.tsx`, `src/core/firebase/`, y `src/features/`.
