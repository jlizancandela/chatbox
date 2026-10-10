# PRD & Product Brief: Widget de Chat Embebible «Asistente de Jorge»

**Versión:** 1.0  
**Fecha:** Octubre 2024 / Q1 2025  
**Autor:** Stitch Design System & Systems Architecture  
**Estado:** Listo para Desarrollo (Approved Spec)  

---

## 1. Visión Ejecutiva del Producto

El **Asistente de Jorge** es un widget conversacional embebible e interactivo para el portfolio web de un Staff Systems Engineer. Su objetivo principal es permitir a reclutadores técnicos, directores de ingeniería y colegas explorar de forma orgánica, rápida y precisa el perfil profesional de Jorge (CV, arquitectura de sistemas distribuidos, experiencia y repositorios verificados de GitHub) sin requerir registro ni navegación manual exhaustiva.

El widget actúa como un demostrador tangible de arquitectura frontend/backend de baja latencia, respetando estrictos estándares de accesibilidad (WCAG 2.1 AA), ergonomía visual y protección de límites de inferencia.

---

## 2. Objetivos de Negocio y Métricas de Éxito (KPIs)

* **Tiempo medio de respuesta percibido (P99 latency):** < 250 ms hasta la llegada del primer token (TTFT).
* **Ratio de consultas respondidas con éxito (Grounded accuracy):** > 98% de fidelidad al CV y repositorios sin alucinación no acotada.
* **Tasa de conversión / Contacto directo:** Facilitar el envío de correo o contacto en LinkedIn desde estados fuera de contexto o botones de acción rápida.
* **Ergonomía y Accesibilidad:** 100% de controles interactivos con touch bounds ≥ 44×44px y contraste tipográfico ≥ 4.5:1.

---

## 3. Público Objetivo y Casos de Uso

1. **Reclutador Técnico / Talent Partner:** Desea comprobar de inmediato si Jorge domina tecnologías clave (Rust, Go, Kubernetes, Kafka, Raft) y si su experiencia encaja en posiciones Staff/Principal.
2. **Director de Ingeniería / Tech Lead:** Interesado en detalles de impacto cuantificable (reducción de costes, benchmarks de latencia, arquitectura CQRS/Event Sourcing).
3. **Colegas / Visitantes generales:** Quieren conocer proyectos Open Source relevantes y canales de contacto.

---

## 4. Requisitos Funcionales (FR)

### FR-01: Arquitectura Conversacional Monohilo (Single-Thread)
* La conversación es efímera por sesión; no requiere login ni persistencia en base de datos externa de usuarios.
* Límite de entrada: máximo 1.000 caracteres por mensaje.
* Contador visible (`850/1000`) únicamente cuando se supera el 80% del límite de caracteres.

### FR-02: Modos de Despliegue y Visualización
1. **Modo Burbuja Flotante (Floating Launcher & Teaser):**
   - Anclaje inferior derecho (`bottom: 24px; right: 24px; z-index: 50`).
   - Botón disparador accesible de 56×56px con icono y estado de disponibilidad en vivo.
   - Globo informativo "Teaser proactivo" descartable con persistencia en `sessionStorage`.
2. **Modo Embebido en Escritorio (Desktop Embedded Card):**
   - Tarjeta contenida de dimensiones fijas: **420px de ancho × 640px de alto**.
   - Integrable en cualquier sección o sandbox mediante Shadow DOM / Web Components o iframe aislado.
3. **Modo Pantalla Completa en Móvil (Full-Screen Drawer / 100dvh):**
   - Ajuste automático al viewport dinámico móvil (`100dvh`) con soporte para Safe Areas (notch e indicador de inicio).
   - Cabecera fija con botón de retroceso (`≥44px`), avatar, badge de IA y botón de nueva conversación.
   - Gesto de deslizamiento hacia abajo (*Swipe to dismiss*) o tecla Atrás/Esc.

### FR-03: Matriz Completa de Estados de Interfaz (Estados A a J)
* **Estado A (Empty State):** Bienvenida amigable, disclaimer obligatorio y 4 chips de sugerencia rápida (*¿Qué stack usa Jorge?*, *¿Qué proyectos ha hecho?*, *¿Dónde ha trabajado?*, *¿Cómo puedo contactarle?*).
* **Estado B (Conversación Activa):** Intercambio de mensajes con renderizado de negritas, bloques o términos inline en `monospaced font` y enlaces a repositorios subrayados en color de acento.
* **Estado C (Esperando Respuesta):** Indicador de tres puntos pulsantes ("Escribiendo..."), y transmutación del botón de envío a botón de parada ("Detener").
* **Estado D (Streaming Progresivo):** Texto token por token con cursor parpadeante, botón de detención y botón flotante "Ir al final" si el usuario hace scroll hacia arriba.
* **Estado E (Respuesta Interrumpida):** Etiqueta sutil `[Respuesta interrumpida]` tras presionar "Detener".
* **Estado F (Error de Red / Inferencia):** Alerta en burbuja de asistente con icono de advertencia, código de error (`ERR_UPSTREAM_RAG` / `504`) y botón "Reintentar".
* **Estado G (Límite de Tasa / Rate Limit):** Bloqueo temporal del input tras alcanzar la cuota (ej. 10 mensajes en 2 min) con cuenta regresiva.
* **Estado H (Fuera de Contexto / No-Context):** Respuesta controlada indicando que el dato solicitado no está en su base de conocimiento y redirigiendo al contacto personal.
* **Estado I (Poda de Contexto / Pruned Context):** Divisor horizontal neutro: *"Los mensajes más antiguos ya no forman parte del contexto"* tras superar la ventana de tokens.
* **Estado J (Confirmación de Reinicio):** Modal/popover de confirmación con opciones *"Borrar historial"* (destructivo) y *"Cancelar"*.

### FR-04: Exclusiones de Producto (Non-Goals)
* No incluye cuentas de usuario ni autenticación.
* No permite subida de archivos ni imágenes adjuntas.
* No incluye votaciones de pulgar arriba/abajo (thumbs up/down).
* No incluye selector de modelos ni menús complejos de configuración.

---

## 5. Requisitos No Funcionales (NFR) y Diseño

* **WCAG 2.1 AA Compliance:** Ratio de contraste ≥ 4.5:1 en textos y ≥ 3:1 en bordes interactivos y anillos de foco visibles.
* **Tipografía:** Stack tipográfico nativo del sistema (Inter / -apple-system / BlinkMacSystemFont), con tamaño de cuerpo base mínimo de 16px en móvil para evitar zoom automático en iOS Safari.
* **Paleta de Color:**
  - Neutros cálidos/limpios (`#FFFFFF`, `#F8FAFC`, `#E2E8F0`, `#0F172A`).
  - Color de acento primario: Azul-Teal sereno (`#0D9488` / `#0F766E`).
  - Radios de curvatura: 12px a 16px para tarjetas y burbujas.
* **Zero Layout Shift:** Alturas y áreas de input calculadas con límites máximos de 5 líneas para evitar saltos bruscos.

---

## 6. Arquitectura Técnica de Referencia

```
[ Cliente Web / Portfolio ]
       │
       ▼ (Eventos DOM / PostMessage)
[ Widget Container: 420x640px / 100dvh Drawer ]
       │
       ├── State Manager (A -> J)
       ├── Session Buffer (FIFO context window: 8.2k tokens max)
       └── Input Controller (Max 1000 chars, Auto-grow textarea)
               │
               ▼ (Fetch Streaming / SSE)
       [ Proxy API: /v1/chat/completions ]
               │
               ▼
       [ Pipeline RAG: BM25 + Dense Vectors (CV + GitHub Repos) ]
```

---

## 7. Roadmap y Criterios de Aceptación para MVP

1. **Sprint 1 (Core Component):** Maquetación de la tarjeta 420×640px, integración del textarea y renderizado de mensajes con markdown ligero.
2. **Sprint 2 (Streaming & Error States):** Implementación de Server-Sent Events (SSE), botón de detención y manejo de reintentos por timeout.
3. **Sprint 3 (Mobile & Floating Launcher):** Integración del launcher flotante con teaser descartable y drawer `100dvh` para dispositivos móviles.
4. **Sprint 4 (Auditoría de Accesibilidad & QA):** Pruebas de navegación completa vía teclado (`Tab`, `Esc`, `Enter`), verificación con lectores de pantalla y validación de contrastes.
