# Design Prompts — LuzAlerts Landing

Готовые промпты для Claude Design, чтобы сверстать минимальный лендинг проекта.
Цель лендинга: посадочная страница на `luzalerts.com.py` с описанием приложения, ссылкой на Google Play и обязательными юридическими страницами для прохождения review в Play Store.

---

> ## ⚠️ Aviso para el modelo Claude Design
>
> **NO dibujes ni generes la interfaz interna de la aplicación móvil dentro de los device frames.** Las versiones generadas automáticamente del UI quedan inconsistentes con el producto real y deterioran la calidad percibida del lendingu.
>
> En lugar de eso, en cada lugar donde el prompt menciona un "mockup de teléfono", "pantalla del mapa", "lista de cortes" o similar:
>
> 1. Renderizá únicamente el **device frame Android (Pixel 7/8) completo y realista**, con su status bar y navigation bar reales del sistema (ver bloque "Платформа таргетинга и мокапы приложения" más abajo).
> 2. Dentro del marco, dejá un **placeholder neutro** — un rectángulo gris claro (`#E5E7EB` sobre fondo claro, `#1E293B` sobre fondo dark) con esquinas redondeadas que respeten el corner radius del dispositivo, ocupando exactamente el área del display.
> 3. En el centro del placeholder, un texto pequeño en gris medio (`#94A3B8`) con la etiqueta de qué captura va ahí, por ejemplo:
>    - `[Captura: Pantalla principal con mapa]`
>    - `[Captura: Lista de cortes]`
>    - `[Captura: Detalle de corte]`
> 4. En el HTML, el placeholder debe ser un `<img>` con `src="/screenshots/main.png"` (o similar) y un `alt` descriptivo — así basta con reemplazar el archivo PNG cuando estén las capturas reales, sin tocar markup.
>
> La status bar y la navigation bar del Android **sí deben dibujarse** (son parte del marco, no del contenido de la app). El contenido de la app **no**.

**Технические ограничения для всех экранов:**
- Адаптивная вёрстка (desktop ≥ 1024px, tablet 768–1023px, mobile < 768px)
- Lighthouse Performance ≥ 90
- Без сложного JS — статический HTML/CSS, опционально Tailwind или Astro
- Без cookie-баннеров, без аналитики (privacy-friendly)
- Хостинг — Caddy file_server рядом с backend на VPS

**Платформа таргетинга и мокапы приложения:**
- Приложение на первом релизе — **только Android** (iOS отложен). Все мокапы телефона на лендинге должны быть Android-устройствами (рекомендуется Pixel 7/8 device frame).
- **Статус-бар и навигационный бар на мокапах должны быть настоящими системными элементами Android, а не нарисованными стилизациями.** Это значит:
  - Сверху — реальный Android status bar: текущее время слева, иконки сигнала / Wi-Fi / батареи справа (Material You стиль, 24px высоты).
  - Снизу — реальный Android navigation bar: либо классические три кнопки (back / home / recents), либо современный gesture pill (горизонтальная полоска ≈ 4px высоты, центрированная).
  - Использовать настоящие шрифты и иконки системы, а не абстрактные плейсхолдеры.
- Источники device frames: Google [Device Mockup Generator](https://developer.android.com/distribute/marketing-tools/device-art-generator), Figma Community Pixel mockups, либо высококачественные PNG с прозрачным фоном.
- Внутри рамки телефона — скриншот UI приложения (карта, список, детали). Если реальных скриншотов ещё нет — использовать SVG-плейсхолдеры с **Material You** компонентами (top app bar, FAB, bottom navigation), а не произвольные рамки.

**Общая брендовая система (использовать во всех экранах):**

| Атрибут | Значение |
|---------|----------|
| Название | LuzAlerts |
| Тон голоса | Чёткий, утилитарный, заслуживающий доверия. Без «мы команда мечтателей». |
| Язык | Испанский (Парагвай). Для маркетинговых текстов — voseo (`sabés`, `podés`, `querés`); для юридических — formal `usted`. |
| Primary color | `#FBBF24` (amber-400, молния/электричество) |
| Dark surface | `#0F172A` (slate-900, ассоциация с отключением света) |
| Light surface | `#FFFFFF` / `#F8FAFC` |
| Status active | `#EF4444` (red — активный корте) |
| Status resolved | `#22C55E` (green — luz restaurada) |
| Шрифт | Inter (или system UI sans). Заголовки — bold 700; тело — 400. |
| Иконографика | Lucide / Heroicons (line, не filled). Молния (`⚡`), карта-пин, колокольчик уведомлений. |
| Образ | Дисклеймер «No afiliado a la ANDE» виден везде, но ненавязчиво. |

---

## Экран 1 — Página de inicio (Home)

**Промпт для Claude Design:**

> Diseñá una single-page landing en español para **LuzAlerts**, una aplicación móvil gratuita para Android que informa a la ciudadanía paraguaya sobre cortes de energía eléctrica programados y no programados publicados por la ANDE. La aplicación muestra los cortes en un mapa, envía notificaciones push cuando hay un corte en un radio de 5 km del usuario, y permite reportes colaborativos.
>
> **Audiencia:** ciudadanía paraguaya, de 18 a 60 años, mayoría usa Android de gama media-baja, conexiones móviles frecuentemente lentas. Tono cercano, voseo (sabés, podés). El público desconfía de "apps oficiales falsas" — debe quedar claro que somos independientes pero la fuente es la ANDE.
>
> **Estructura de la página (de arriba a abajo):**
>
> 1. **Header fijo** (transparente sobre hero, sólido al hacer scroll):
>    - Logo "LuzAlerts" a la izquierda (ícono de rayo amarillo + texto)
>    - Links a la derecha: "Cómo funciona", "Preguntas", "Privacidad". En mobile colapsa a un menú hamburguesa.
>
> 2. **Hero (full-viewport, fondo dark `#0F172A` con sutil grid o circuit pattern):**
>    - Headline grande (h1, ~56px desktop / 36px mobile), texto blanco:
>      `Sabé cuándo y dónde se corta la luz.`
>    - Subheadline (~20px, gris claro):
>      `LuzAlerts te avisa al instante cuando la ANDE programa un corte en tu zona, o cuando los vecinos reportan que se fue la luz cerca tuyo.`
>    - **Botón primario CTA** (amber `#FBBF24`, texto negro, esquinas 8px, ícono de Play Store):
>      `Descargar en Google Play`
>    - Texto pequeño debajo del botón:
>      `Gratis · Sin anuncios · Próximamente en iOS`
>    - A la derecha (en desktop) / abajo (en mobile): **device frame de teléfono Android** (Pixel 7/8) con un ángulo ligeramente inclinado y sombra suave.
>      **Status bar y navigation bar del Android deben renderizarse de forma realista** (hora + íconos de señal/Wi-Fi/batería arriba; gesture pill o botones back/home/recents abajo).
>      **Dentro del display, dejá únicamente un placeholder** (rectángulo gris claro con corner-radius coincidente con el del dispositivo) y la etiqueta `[Captura: Pantalla principal con mapa]` centrada en gris medio. **No dibujes el UI de la aplicación** — la captura real se inserta después como `<img src="/screenshots/main.png">`.
>    - En la parte inferior del hero, un disclaimer pequeño centrado:
>      `Proyecto independiente. No afiliado a la ANDE. Datos obtenidos de fuentes públicas oficiales.`
>
> 3. **Sección "Cómo funciona"** (fondo blanco, padding vertical 96px):
>    - Título h2 centrado:
>      `Tres formas de no quedarte a oscuras`
>    - Grid de 3 columnas (1 columna en mobile), cada tarjeta con ícono grande arriba + título + 2 líneas de texto:
>
>      **Tarjeta 1** — Ícono: pin de mapa
>      Título: `Mapa en tiempo real`
>      Texto: `Visualizá todos los cortes activos y programados en un mapa interactivo. Tocá un corte para ver horario, zona afectada y comentarios.`
>
>      **Tarjeta 2** — Ícono: campana de notificación
>      Título: `Alertas cercanas`
>      Texto: `Recibí una notificación push cuando hay un corte a menos de 5 km de tu ubicación. Y otra cuando vuelve la luz.`
>
>      **Tarjeta 3** — Ícono: grupo de personas
>      Título: `Reportes vecinales`
>      Texto: `¿Se te fue la luz pero la ANDE no avisó? Tocá "Sin luz" — cuando 3 vecinos cercanos hacen lo mismo, el corte se confirma para todos.`
>
> 4. **Sección "Capturas de pantalla"** (fondo `#F8FAFC`, padding 96px):
>    - Título h2 centrado:
>      `Mirá cómo se ve`
>    - Carrusel horizontal o grid de **3 device frames Android** (mismo Pixel que en el hero), con status bar y navigation bar reales del sistema. Cada uno con un placeholder interno y etiqueta:
>      - `[Captura: Pantalla principal con mapa]` → `<img src="/screenshots/main.png">`
>      - `[Captura: Lista de cortes]` → `<img src="/screenshots/list.png">`
>      - `[Captura: Detalle de corte]` → `<img src="/screenshots/detail.png">`
>    - **No generes UI de la aplicación dentro de los marcos** — solo placeholders. Las capturas reales se insertarán reemplazando los archivos PNG.
>    - En mobile: scroll horizontal con snap.
>
> 5. **Sección FAQ** (fondo blanco, padding 96px, max-width 720px centrado):
>    - Título h2 centrado:
>      `Preguntas frecuentes`
>    - Acordeón de 5 preguntas (cerradas por defecto):
>
>      **1.** `¿Es una app oficial de la ANDE?`
>      Respuesta: `No. LuzAlerts es un proyecto independiente, sin fines de lucro, no afiliado ni autorizado por la ANDE. Tomamos información publicada en el sitio oficial de la ANDE y la mostramos de forma más cómoda en tu celular. Para reclamos y servicios, comunicate directamente con la ANDE.`
>
>      **2.** `¿Tiene costo?`
>      Respuesta: `No. La aplicación es 100% gratuita y no muestra publicidad.`
>
>      **3.** `¿Qué datos recolecta sobre mí?`
>      Respuesta: `Solo los mínimos para que funcione: un identificador anónimo de tu dispositivo, tu ubicación aproximada (para avisarte de cortes cercanos) y un token de notificaciones. No pedimos nombre, teléfono ni correo. Más detalles en nuestra Política de Privacidad.`
>
>      **4.** `¿Cómo recibo las notificaciones?`
>      Respuesta: `Cuando autorizás las notificaciones y la ubicación durante el primer uso, te avisamos automáticamente cada vez que aparece un corte a menos de 5 km tuyo. También te avisamos cuando la luz vuelve.`
>
>      **5.** `¿Funciona en iPhone?`
>      Respuesta: `Por ahora solo en Android. La versión para iPhone está planificada para una próxima etapa.`
>
> 6. **CTA final** (fondo dark `#0F172A`, padding 80px, centrado):
>    - Título h2 blanco:
>      `Descargá LuzAlerts y dejá de preguntarte si volvió la luz.`
>    - Botón amber CTA grande:
>      `Descargar en Google Play`
>
> 7. **Footer** (fondo `#0F172A`, texto gris claro):
>    - 3 columnas en desktop, stack en mobile:
>      - **Columna 1:** Logo + tagline corto + disclaimer `Proyecto independiente. No afiliado a la ANDE.`
>      - **Columna 2 (Producto):** links `Google Play`, `Cómo funciona`, `Preguntas`
>      - **Columna 3 (Legal):** links `Política de Privacidad` (`/privacy`), `Términos de Uso` (`/terms`), `Contacto: maxim.voronin2@gmail.com`
>    - Línea inferior centrada: `© 2026 LuzAlerts · Hecho en Paraguay`
>
> **Entregables:**
> - HTML semántico (`<header>`, `<main>`, `<section>`, `<footer>`)
> - CSS con Tailwind (preferido) o vanilla con custom properties
> - Imágenes: usá placeholders SVG para mockups de teléfono — los reemplazaremos con capturas reales
> - Mobile-first, breakpoints a 768px y 1024px
> - Accesibilidad: contraste WCAG AA mínimo, focus states visibles, alt en imágenes, aria-expanded en acordeón

---

## Экран 2 — Política de Privacidad (`/privacy`)

**Промпт для Claude Design:**

> Diseñá una página estática de **Política de Privacidad** para LuzAlerts. Es un documento legal que se publica en `luzalerts.com.py/privacy` y se enlaza desde la ficha de la app en Google Play (requisito obligatorio).
>
> **Objetivo del diseño:** legibilidad. Esta página la van a leer reviewers de Google Play y usuarios curiosos sobre qué datos se recopilan. No es una página de marketing — debe verse seria, prolija, fácil de escanear.
>
> **Estructura:**
>
> 1. **Header** idéntico al del home (Logo + nav: Cómo funciona, Preguntas, Privacidad). El link "Privacidad" debe estar resaltado como activo.
>
> 2. **Encabezado de página** (padding vertical 64px, fondo `#F8FAFC`):
>    - Breadcrumb pequeño: `Inicio › Política de Privacidad`
>    - Título h1: `Política de Privacidad`
>    - Subtítulo: `Última actualización: 27 de abril de 2026`
>
> 3. **Cuerpo del documento** (max-width 720px centrado, fondo blanco, padding 64px):
>    - Tipografía cómoda para lectura larga: cuerpo 17–18px, line-height 1.7, color `#1F2937`.
>    - Espaciado generoso entre secciones (margin-top 48px en h2).
>    - Encabezados h2 numerados (1., 2., 3., …) en color `#0F172A`, bold.
>    - h3 más pequeños sin numeración.
>    - Tablas con bordes finos, header con fondo `#F1F5F9`, celdas con padding 12px.
>    - Listas con bullets discretos, indentación moderada.
>    - Enlaces internos en color `#2563EB` con underline al hover.
>    - Bloques de email (`maxim.voronin2@gmail.com`) destacados como `<code>` con fondo `#F1F5F9`.
>
>    **Contenido (insertar tal cual desde el archivo `docs/privacy-policy.es.md`):**
>    - Párrafo introductorio
>    - Sección 1 — Responsable del tratamiento
>    - Sección 2 — Datos que recopilamos (incluye una tabla y una sub-lista "Datos que NO recopilamos")
>    - Sección 3 — Base legal
>    - Sección 4 — Compartición con terceros (incluye tabla)
>    - Sección 5 — Almacenamiento y retención
>    - Sección 6 — Seguridad
>    - Sección 7 — Sus derechos
>    - Sección 8 — Menores de edad
>    - Sección 9 — Cambios a esta política
>    - Sección 10 — Legislación aplicable
>    - Sección 11 — Contacto
>
> 4. **Sidebar de navegación interna** (visible solo en desktop ≥ 1024px, sticky, a la izquierda del contenido):
>    - Lista vertical con los 11 títulos de sección, cada uno como ancla (`#seccion-1`, etc.)
>    - El item activo se resalta según la sección visible en viewport.
>    - En tablet y mobile: ocultar el sidebar y mostrar al inicio del contenido un `<details>` plegable con "Tabla de contenidos".
>
> 5. **Footer** idéntico al del home.
>
> **Entregables:**
> - HTML semántico (usar `<article>` para el documento legal, `<aside>` para el sidebar)
> - El contenido textual debe ser exactamente el del archivo `docs/privacy-policy.es.md` — no reformular.
> - Print stylesheet (`@media print`) que oculte header, footer y sidebar — útil si alguien quiere imprimir o exportar a PDF.
> - Sin tracking, sin scripts externos.

---

## Экран 3 — Términos de Uso (`/terms`)

**Промпт для Claude Design:**

> Diseñá la página estática de **Términos de Uso** para LuzAlerts en `luzalerts.com.py/terms`. Misma estructura visual que la Política de Privacidad — son páginas hermanas y deben verse consistentes.
>
> **Reutilizá el template del Экран 2** con estos cambios:
>
> 1. **Header:** mismo nav, pero ahora ningún item del menú principal está activo (los términos viven solo en el footer). Opcionalmente agregar un sub-link "Términos" al lado de "Privacidad" en el nav y resaltarlo.
>
> 2. **Encabezado de página:**
>    - Breadcrumb: `Inicio › Términos de Uso`
>    - Título h1: `Términos de Uso`
>    - Subtítulo: `Última actualización: 27 de abril de 2026`
>
> 3. **Cuerpo del documento** (mismo estilo tipográfico que Privacidad):
>
>    **Contenido (insertar tal cual desde `docs/terms.es.md`):**
>    - Párrafo introductorio
>    - Sección 1 — Descripción del servicio
>    - Sección 2 — Independencia respecto a la ANDE *(esta sección es importante; resaltarla con un callout box: borde izquierdo amarillo `#FBBF24` de 4px, fondo `#FEFCE8`, padding 16px)*
>    - Sección 3 — Carácter informativo y no garantías *(también resaltar como callout — fondo `#FEF2F2` con borde `#EF4444`)*
>    - Sección 4 — Reportes colaborativos y comentarios
>    - Sección 5 — Uso aceptable
>    - Sección 6 — Propiedad intelectual
>    - Sección 7 — Limitación de responsabilidad
>    - Sección 8 — Modificaciones del servicio
>    - Sección 9 — Modificaciones a estos términos
>    - Sección 10 — Legislación aplicable y jurisdicción
>    - Sección 11 — Disposiciones generales
>    - Sección 12 — Contacto
>
> 4. **Sidebar de navegación interna:** mismo comportamiento que en Privacidad, pero con los 12 títulos de sección de Términos.
>
> 5. **Footer** idéntico.
>
> **Notas específicas:**
> - Las secciones 2 y 3 son las más importantes desde el punto de vista legal (deslinde con ANDE y limitación de responsabilidad). El usuario debe poder ubicarlas fácilmente — además del callout, considerá hacer su entrada en el sidebar en bold o con un ícono de info.
> - El texto debe ser palabra por palabra el de `docs/terms.es.md`. No editar el contenido legal.
>
> **Entregables:** mismos que en Экран 2.

---

## Экран 4 — Página 404 (Not Found)

**Промпт для Claude Design:**

> Diseñá una página de error **404 / Not Found** para LuzAlerts, en el mismo estilo visual que el resto del sitio. Esta página se sirve cuando un usuario llega a una URL inexistente bajo `luzalerts.com.py`. Debe ser corta, amigable y guiar al usuario de vuelta al contenido principal.
>
> **Tono:** un guiño temático al producto (cortes de luz) sin caer en humor barato. La idea es: "esta página se quedó sin luz" — un paralelo natural con el dominio del producto.
>
> **Estructura:**
>
> 1. **Header** idéntico al del home (Logo + nav). Logo y links siguen funcionando — el usuario debe poder navegar desde aquí.
>
> 2. **Cuerpo central** (full-viewport menos el header, fondo dark `#0F172A`, contenido centrado vertical y horizontalmente, padding 48px):
>
>    - **Ilustración / ícono grande** (≈ 160px de alto):
>      Un ícono de rayo amarillo `#FBBF24` con una línea diagonal que lo tacha (estilo "no signal"), o alternativamente un mapa con un solo pin gris desconectado. SVG simple, sin animación pesada.
>
>    - **Código de error** (texto pequeño, color amber `#FBBF24`, letter-spacing amplio, uppercase):
>      `ERROR 404`
>
>    - **Título h1** (texto blanco, ~48px desktop / 32px mobile, bold):
>      `Esta página se quedó sin luz.`
>
>    - **Subtítulo** (~18px, gris claro `#CBD5E1`, max-width 520px centrado):
>      `La dirección que buscás no existe o fue movida. Pero tranquilo — el resto de LuzAlerts sigue funcionando.`
>
>    - **Botón primario CTA** (amber `#FBBF24`, texto negro, esquinas 8px):
>      `Volver al inicio`
>      (link a `/`)
>
>    - **Links secundarios** debajo del botón, separados por `·`, color gris claro con underline al hover:
>      `Cómo funciona` · `Preguntas frecuentes` · `Política de Privacidad` · `Términos de Uso`
>
> 3. **Footer** idéntico al del home, pero opcionalmente más compacto (una sola línea con copyright + disclaimer de no afiliación).
>
> **Comportamiento responsive:**
> - En mobile, la ilustración se reduce a ~120px y el padding lateral baja a 24px.
> - Los links secundarios se apilan verticalmente debajo de 480px de ancho.
>
> **Consideraciones técnicas:**
> - Esta página debe servirse con HTTP status `404` (no `200`), para que buscadores y herramientas la detecten correctamente. Configurar Caddy con la directiva `handle_errors`:
>   ```
>   handle_errors {
>       @404 expression {http.error.status_code} == 404
>       rewrite @404 /404.html
>       file_server
>   }
>   ```
> - Sin redirecciones automáticas — dejá que el usuario decida adónde ir.
> - Misma estructura SEO que las demás páginas pero con `<meta name="robots" content="noindex">` para que buscadores no indexen el 404.
>
> **Entregables:**
> - HTML semántico standalone (`/404.html`)
> - Reutiliza header/footer/CSS del Экран 1 — no rediseñar desde cero.
> - SVG inline para la ilustración (sin dependencias externas).

---

## Workflow recomendado

1. Empezá por **Экран 1** (Home) — define la paleta, tipografía y componentes (header, footer, botón CTA, callout).
2. Para **Экран 2**, **3** y **4**, reutilizá el header/footer/typography del Home — **no** rediseñes desde cero, mantené consistencia.
3. Despues de la primera iteración, validar contra:
   - [Google Play – Privacy policy requirements](https://support.google.com/googleplay/android-developer/answer/9859455)
   - Que el `<title>` y `<meta name="description">` estén llenos para SEO básico
   - Open Graph tags en el Home para preview en WhatsApp (canal principal de difusión en Paraguay)

## Datos para Open Graph (Экран 1)

```html
<title>LuzAlerts — Cortes de luz en Paraguay en tiempo real</title>
<meta name="description" content="App gratuita para Android que te avisa cuando hay un corte de luz cerca tuyo. Datos de la ANDE + reportes vecinales.">
<meta property="og:title" content="LuzAlerts — Cortes de luz en Paraguay">
<meta property="og:description" content="Sabé al instante cuándo y dónde se corta la luz en tu zona.">
<meta property="og:image" content="https://luzalerts.com.py/og-image.png">
<meta property="og:url" content="https://luzalerts.com.py">
<meta property="og:locale" content="es_PY">
```
