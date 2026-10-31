# Informe de perfil público de GitHub — @jlizancandela

Desarrollo web full-stack · PHP · TypeScript · React/Preact

## Perfil

Cuenta activa desde agosto de 2023: github.com/jlizancandela. El perfil tiene nombre visible y bio configurados ("Desarrollador web junior | PHP · JavaScript/TypeScript · SQL | React/Preact"), con enlace al sitio jorgelizancandela.com.

Estadísticas: 23 repositorios públicos · 3 años en GitHub · 0 repositorios archivados · 1 estrella (portafolio) · actividad en 2026 en 9 repositorios, los más recientes portafolio, chatbox y proyecto.

## Proyecto destacado: Asistente de portfolio (chatbox)

Repositorio `chatbox`: monorepo en TypeScript con la API y el widget del asistente conversacional del portfolio.

Tecnologías: Fastify 5 · TypeScript estricto · PostgreSQL con pgvector · Preact · Vite · Docker · GitHub Actions.
Arquitectura: recuperación vectorial sobre PostgreSQL, embeddings de EmbeddingGemma generados en proceso con ONNX, generación con Groq y migraciones con node-pg-migrate. Pruebas con node:test y cobertura con c8.

Valor del proyecto: conecta backend, base de datos vectorial, frontend y despliegue en un producto publicado, y el widget se distribuye como paquete que consume el repositorio `portafolio`.

## Proyecto destacado: Sistema de reservas para peluquería

Repositorio `proyecto`: aplicación full-stack para gestionar reservas, especialistas y servicios.

Tecnologías: PHP 8.2 · Apache · MySQL 8 · Preact · Latte · JavaScript.
Arquitectura: DDD por módulos, con router propio, acceso a datos con PDO, pruebas con Pest y Mockery, Stripe, ImageKit, DOMPDF y Docker Compose.

Valor del proyecto: integra arquitectura, pruebas, pagos, gestión de imágenes, generación de informes y despliegue reproducible en una sola aplicación.

## Portfolio de proyectos

Productos completos:

- chatbox — Asistente RAG del portfolio, publicado como paquete y consumido por `portafolio`.
- proyecto — Aplicación de reservas full-stack con DDD, pruebas, pagos y Docker.
- gestorProyectos — Gestión de proyectos con Laravel 13, PHP 8.3 y Blade.
- mvc — Tienda de ropa con patrón MVC y plantillas Twig.
- portafolio — Portfolio personal con Astro y Preact, que integra el widget de chatbox.
- Lignia-Carpinteria — Landing de carpintería con Astro (antes CarpinteriaJucla).
- perez_guerrero — Sitio profesional de podología con WordPress; repositorio privado, trabajo para cliente.

Aplicaciones con APIs:

- omdb — Consulta de películas con la API de OMDB, React Router, caché y tests con Vitest y MSW.
- gifapp — Buscador de GIFs con TypeScript y GIPHY.
- pablo_firebase — Proyecto TypeScript conectado con Firebase.
- texto-a-mp3 — Conversor de texto a audio.

React y TypeScript:

- HeroApp — Aplicación de héroes con React y TypeScript.
- countryquiz — Quiz de países en TypeScript, con estado global y tests.
- Cookies-Banner-React — Componente reutilizable de consentimiento.
- carrusel — Carrusel en React y TypeScript.
- Menu — Menú desplegable en React.
- Mickey — Juego en TypeScript.

Calidad y pruebas:

- tes_canonigo — Auditorías de interfaz con Playwright y TypeScript.
- setup_Vitest — Base de configuración para Vitest, React y Vite.
- autorizacion — Práctica de autorización con TypeScript.

Fundamentos y práctica:

- 4linea — Juego Conecta 4 en JavaScript.
- Arquitectura — Práctica de maquetación con Astro.
- jlizancandela — Repositorio de perfil.

## Tecnologías y evidencia

- Backend PHP: PHP, MySQL, Apache, WordPress — evidencia: proyecto, perez_guerrero
- Backend Node: Node.js, Fastify, TypeScript — evidencia: chatbox
- Datos: PostgreSQL y pgvector — evidencia: chatbox
- Frontend: TypeScript, JavaScript, React/Preact, Astro — evidencia: HeroApp, Menu, carrusel, portafolio, Lignia-Carpinteria
- Calidad: Pest, Mockery, Vitest, Playwright, node:test — evidencia: proyecto, omdb, tes_canonigo, chatbox
- Entrega: Docker Compose, Dockerfile, GitHub Actions — evidencia: proyecto, chatbox
- Integraciones: Stripe, ImageKit, Groq, OMDB, Firebase, GIPHY — evidencia: proyecto, chatbox, omdb, pablo_firebase, gifapp

## Valoración

Fortalezas:

- Dos proyectos con alcance real: un producto full-stack y un asistente con IA publicado.
- Amplitud en PHP y TypeScript, con backend en ambos lenguajes.
- Evidencia de testing con cuatro herramientas distintas y de integración continua.
- Contenerización y despliegue reproducible.
- Integraciones externas de pagos, imágenes, generación de texto y datos.

Oportunidades de mejora:

- `chatbox` no tiene descripción, temas ni README: el proyecto más fuerte es el peor documentado del perfil.
- `portafolio` tampoco tiene descripción.
- Ningún repositorio declara licencia.
- Fijar de 4 a 6 repositorios representativos en el perfil.
- Unificar descripciones y temas del resto.

Nota metodológica: el informe analiza repositorios públicos y la información visible del perfil. No evalúa contribuciones privadas ni experiencia profesional fuera de GitHub; `perez_guerrero` se menciona solo como trabajo de cliente de acceso privado.

Fuente: perfil y repositorios públicos de GitHub · Corte: 31 de octubre de 2026.
