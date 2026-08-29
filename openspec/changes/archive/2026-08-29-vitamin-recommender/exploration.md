# Exploration: Vitamin Recommender (Nutrilite)

## Current State

- Monorepo `prototipo_dctandrea`: `frontend/` (React 18.3 + TypeScript + Vite 6 + Tailwind 4, export de Figma Make) + `backend/` (placeholder vacío, solo README, stack sin definir).
- El frontend es una landing page de doctora (Medicina Funcional & Hábitos). Los dos puntos de conexión con el futuro backend son simulados:
  - `ChatWidget.tsx`: chat flotante que responde con `setTimeout` y un texto fijo "Configuración pendiente". Es el componente que alojará el recomendador con memoria.
  - `Booking.tsx`: formulario de reserva que simula la API con `setTimeout`.
- Build de verificación: `pnpm --dir frontend build`. Sin tests configurados.
- Catálogo Nutrilite: el usuario tiene PDFs en `~/Documentos/amway/`: `PriceList_April-2026_ES.pdf` (lista de precios completa, tabular) + fichas de producto individuales (referencia, tamaño, precio, beneficios, "consumidores potenciales", dosis, ingredientes y disclaimer legal).
- Patrón de referencia probado (proyecto rider-defensa): backend Node con `assistant.ts` — RAG sobre documentos + llamada a Gemini (REST v1beta, `GEMINI_MODEL`/`GEMINI_API_KEY` configurables), retry con backoff (2s/5s/10s) ante 503/429, degradación elegante sin key; memoria en tabla `chat_messages`; API `POST /assistant/ask` + `GET /assistant/history` con auth por header `x-api-key`; bridge server-to-server en la web (`/api/assistant`) para que la key nunca llegue al browser; infra: Node en contenedor (Hetzner) + Next.js en Vercel + Supabase.

## Affected Areas

- `frontend/src/app/components/ChatWidget.tsx` — el chat simulado se reemplaza por el cliente del recomendador real (bridge `/api/assistant` + memoria + consentimiento).
- `frontend/src/app/components/Booking.tsx` — el formulario simulado se conecta a un endpoint real de reserva (fuera del alcance del recomendador, pero tocará el mismo patrón de llamada HTTP).
- `frontend/vite.config.ts` — el bridge server-to-server puede requerir un proxy/dev (`server.proxy`) para `/api/*` en desarrollo.
- `backend/` — directorio vacío; aquí nace el servicio del agente, la BD y el log de recomendaciones.
- `~/Documentos/amway/*.pdf` — fuente de datos del catálogo Nutrilite (semilla del modelo de productos).

## Approaches

### A. Stack del backend

1. **Node + TypeScript + Hono** — runtime JS moderno, mismo lenguaje que el frontend.
   - Pros: TS nativo y ligero; primera clase con el ecosistema Vite; middleware integrado; corre en Node/Bun/edge; ideal para un API pequeño + bridge.
   - Cons: ecosistema más joven que Express; menos tutoriales legacy.
   - Effort: Low.

2. **Node + TypeScript + Fastify** — framework maduro y rápido, validación por schema.
   - Pros: rendimiento alto, plugin architecture sólida, validación integrada (JSON Schema).
   - Cons: un poco más de boilerplate que Hono; overkill para un MVP de 3-4 rutas.
   - Effort: Low.

3. **Node + TypeScript + Express** — el más conocido.
   - Pros: familiaridad, comunidad enorme, todo el mundo lo conoce.
   - Cons: tipado TS más manual, middleware legacy, menos moderno.
   - Effort: Low.

**Recomendación: Hono.** Mismo lenguaje que el frontend, mínimo y TS-first; encaja con el patrón rider-defensa (bridge server-to-server + API). Si el usuario es más fluido en Express, Express es aceptable — pero para un proyecto nuevo y pequeño, Hono da más con menos.

### B. Base de datos

1. **Drizzle + SQLite (dev) → PostgreSQL (prod)** — ORM TS-first, portátil entre motores.
   - Pros: Drizzle es ligero, tipado, sin binarios pesados; esquema portable de SQLite a Postgres; cero infra en dev.
   - Cons: SQLite en dev ≠ Postgres en prod (diferencias de features); requiere migración al pasar a prod.
   - Effort: Medium.

2. **Supabase (Postgres hosteado)** — ya usado en rider-defensa.
   - Pros: Postgres real + SQL editor + dashboard, auth y realtime cuando lleguen; el equipo ya lo conoce.
   - Cons: dependencia de SaaS; para un prototipo sin auth aporta infra que hoy no se usa.
   - Effort: Low-Medium.

**Recomendación: Drizzle + SQLite para el prototipo, con esquema portable.** Cero infra, arranque inmediato, y Drizzle abstrae la migración a Postgres/Supabase en prod. Si el usuario prefiere seguir con Supabase (ya probado en rider-defensa), es viable y acelera el camino a prod — ambos son compatibles con Drizzle como capa de acceso.

**Modelo de datos propuesto** (tablas relacionales):
- `customers` (id, name, email, phone, created_at) — base del CRM y memoria.
- `products` (reference, name, category, size, price, benefits, dosage, ingredients, disclaimer) — catálogo estructurado Nutrilite.
- `purchases` (id, customer_id, product_reference, qty, purchased_at) — la "base de compras" que el agente consulta.
- `conversations` (id, customer_id, created_at) + `messages` (id, conversation_id, role, content, created_at) — memoria persistente del usuario (patrón rider-defensa).
- `recommendations` (id, conversation_id, customer_id, symptom, product_references, rationale, consent_version, created_at) — log de auditoría legal.

### C. LLM del agente

1. **Gemini (REST v1beta)** — patrón rider-defensa, ya probado.
   - Pros: reutiliza el código probado (retry/backoff, degradación sin key); modelo configurable; función de llamada (function calling) disponible para consultar compras.
   - Cons: vendor lock-in a Google; rate limits.
   - Effort: Low.

2. **OpenAI / Anthropic / local (Ollama)** — alternativas.
   - Pros: algunos modelos más fuertes en razonamiento; local = sin coste/vendor.
   - Cons: hay que reescribir el cliente; más coste/setup; no reutiliza el patrón.
   - Effort: Medium-High.

**Recomendación: Gemini**, reutilizando el patrón rider-defensa. Para consultar la BD de compras: **preferir inyección de contexto server-side** (el backend consulta `purchases` del usuario y lo inyecta en el prompt) sobre tool-calling nativo — más simple, determinista y auditable en un prototipo. Mantener `GEMINI_MODEL`/`GEMINI_API_KEY` configurables.

### D. Límites legales

1. **Límite duro en prompt + guard post-proceso** — capa defensiva en el prompt del sistema (nunca diagnosticar, nunca prometer cura, siempre derivar a consulta médica) Y un guard determinista que inspecciona la salida: si detecta lenguaje de diagnóstico/tratamiento/cura, redirige a la recomendación preventiva + derivación médica.
   - Pros: doble barrera; el guard no depende del modelo.
   - Cons: el guard de lenguaje requiere una lista de patrones mantenible.
   - Effort: Medium.

2. **Consentimiento informado en primer uso** — antes de la primera recomendación, el usuario acepta un disclaimer (esto NO es diagnóstico, es preventivo, consulta a tu médico); se persiste el consentimiento con versión y timestamp.
   - Pros: respaldo legal directo, cumplimiento LOPD/GDPR para datos de salud.
   - Cons: fricción inicial en el UX del chat.
   - Effort: Low.

3. **Log de cada recomendación** — tabla `recommendations` que registra síntoma, productos, rationale, versión de consentimiento y timestamp; expuesta al CRM y a la médico como auditoría.
   - Pros: trazabilidad completa; si hay reclamación, hay evidencia.
   - Cons: persistencia adicional, pero barata.
   - Effort: Low.

**Recomendación: las tres, en conjunto.** Prompt + guard + consentimiento + log de auditoría. La combinación es la "capa legal" que protege a la médico: la queja se responde con el registro exacto de qué se recomendó, bajo qué consentimiento y con qué disclaimer.

### E. CRM sin auth

**Alcance mínimo viable**: CRUD de catálogo (productos), clientes, compras y lector de conversaciones + log de recomendaciones, como panel admin en el frontend (ruta `/admin`).
- Pros: la médico gestiona catálogo/ventas y revisa auditoría desde la web.
- Cons (riesgo): **sin autenticación, cualquier visitante podría leer/escribir datos personales y de compras** (dato de salud) → incumplimiento LOPD/GDPR y fuga de información de clientes.

**Recomendación**: permitir el CRM sin auth SOLO para el prototipo/dev, con advertencia explícita. Marcar como bloqueante añadir al menos una autenticación trivial (basic auth por header o sesión simple) antes de exponerlo a Internet, porque el modelo de datos incluye PII y datos de compra.

### F. Catálogo Nutrilite: RAG vs datos estructurados

1. **Datos estructurados en BD (semilla desde PDFs)** — extraer las ~40 referencias del `PriceList` + fichas a la tabla `products`.
   - Pros: datos precisos y consultables (referencia, precio, dosis, beneficios, disclaimer); permite emparejar compras por referencia; la recomendación referencia SKUs exactos; evita alucinación en datos legales/dosis.
   - Cons: requiere un script de extracción/curación manual de los PDFs.
   - Effort: Medium.

2. **RAG sobre los PDFs** — indexar los PDFs y responder con recuperación.
   - Pros: responde preguntas de forma libre sobre todo el contenido.
   - Cons: riesgo de alucinación en dosis/precios/claims (crítico por lo legal); datos no consultables por la BD de compras ni el CRM.
   - Effort: Medium.

**Recomendación: datos estructurados en BD como fuente de verdad para las recomendaciones.** El catálogo es pequeño y tabular (PriceList + fichas) — la extracción es viable y segura. RAG sobre PDFs solo como capa opcional de enriquecimiento para Q&A libre, nunca como fuente de datos de dosis/beneficios. El disclaimer legal que ya aparece en cada ficha Nutrilite ("no es un sustitutivo de una dieta variada... no exceder la dosis diaria") se replica en el modelo y en el prompt del agente.

## Recommendation

- **Backend**: Node + TypeScript + **Hono** (patrón rider-defensa; bridge `/api/assistant` + API `assistant/ask` + `assistant/history`).
- **BD**: **Drizzle + SQLite** para el prototipo, esquema portable a Postgres/Supabase en prod (alternativa: Supabase directo, ya conocido).
- **LLM**: **Gemini** (reutilizar patrón rider-defensa), con inyección de contexto server-side de las compras del usuario (en vez de tool-calling nativo).
- **Capa legal**: prompt con límite duro + guard determinista post-proceso + consentimiento informado en primer uso + tabla `recommendations` de auditoría.
- **CRM**: panel admin `/admin` (catálogo, clientes, compras, conversaciones, log) sin auth SOLO en dev; añadir auth básica antes de exponer a Internet.
- **Catálogo**: datos estructurados en `products` (semilla desde PDFs), no RAG como fuente de verdad.

## Risks

- **PII y datos de compra sin auth**: el CRM expuesto sin autenticación vulnera LOPD/GDPR y expone datos de clientes; debe limitarse a dev o ganar auth básica antes de producción.
- **Responsabilidad médica**: si el agente parece diagnosticar o prometer cura, hay riesgo legal; mitigado por guard + consentimiento + log, pero requiere pruebas reales con usuarios.
- **Extracción del catálogo**: los PDFs tienen formatos irregulares; la semilla necesita curación manual (precios/dosis/beneficios).
- **Diferencia SQLite vs Postgres**: features de SQLite que no migran a Postgres (o viceversa); mantener el esquema en Drizzle portable.
- **Dependencia del modelo LLM**: hallazgos legales dependen de que el guard post-proceso funcione, no solo del prompt.

## Ready for Proposal

Yes — hay suficiente evidencia y dirección clara para proponer el cambio. El orquestador debe confirmar con el usuario: (1) Hono vs Express, (2) SQLite→Postgres vs Supabase directo, y (3) si el CRM sin auth en dev es aceptable para el prototipo.