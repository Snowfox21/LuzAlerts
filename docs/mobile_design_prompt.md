# Mobile Design Prompts — LuzAlerts (Android)

Промпты для Claude Design (или другого визуального дизайн-инструмента), чтобы сверстать макеты **экранов самого мобильного приложения** LuzAlerts. Это не лендинг — это само приложение, под Android.

Назначение макетов:
- Заполнить плейсхолдеры на лендинге (`/screenshots/main.png`, `list.png`, `detail.png`).
- Подготовить визуальные ассеты для Google Play Store listing (требуется минимум 2 скриншота телефона).
- Использовать как референс для пиксельной полировки React Native UI перед релизом.

---

## Технические рамки (применять во всех экранах)

| Параметр | Значение |
|---------|----------|
| Платформа | **Android only** (iOS отложен) |
| Эталонное устройство | Pixel 7 / Pixel 8 (412 × 915 dp, density 2.625x) |
| Дизайн-язык | **Material 3 (Material You)** — top app bar, FAB, bottom navigation, cards, chips, snackbars |
| Тема по умолчанию | **Dark** (приложение запускается в тёмной теме — «полезно когда света и так уже нет») |
| Альтернативная тема | Light (опционально; можно показать во второй итерации, не обязательно для каждого экрана) |
| Системные бары | **Реальные**, не нарисованные. Сверху — Android status bar (часы, иконки сигнала/Wi-Fi/батареи). Снизу — gesture pill (~4px высоты, центрированный). |
| Шрифт | Roboto / Roboto Flex (системный Android) или Inter в качестве fallback |
| Иконки | **Lucide React Native** (используются в коде) — line style, не filled |
| Размер touch target | минимум 48 × 48 dp (Material 3 minimum) |
| Отступ от safe area | Контент под status bar минимум 16dp, над gesture pill минимум 24dp |
| Карта | Google Maps SDK для Android (тёмный стиль карты в dark mode) |
| Локаль интерфейса | Испанский (Парагвай). Voseo в обращениях к пользователю (`tocá`, `reportá`, `vení`). |

## Брендовая палитра

| Токен | Light | Dark | Использование |
|-------|-------|------|--------------|
| Primary brand | `#FBBF24` | `#FBBF24` | Логотип, CTA, FAB, акценты ⚡ |
| Background | `#FFFFFF` | `#0F172A` | Фон приложения |
| Surface (карточки) | `#F8FAFC` | `#1E293B` | Карты outage, bottom sheet |
| Surface variant | `#F1F5F9` | `#334155` | Поля ввода, чипы, divider hover |
| Text primary | `#0F172A` | `#F8FAFC` | Заголовки, основной текст |
| Text secondary | `#64748B` | `#94A3B8` | Подписи, метаданные |
| Border / divider | `#E2E8F0` | `#334155` | Линии между элементами |
| Status `programado` | `#FBBF24` (amber) | `#FBBF24` | Маркер на карте, бейдж |
| Status `activo` | `#EF4444` (red) | `#F87171` | Маркер, бейдж, push |
| Status `resuelto` | `#22C55E` (green) | `#4ADE80` | Маркер, бейдж |
| Crowdsource (`reporte`) | `#A855F7` (violet) | `#C084FC` | Маркер пользовательских репортов (отличается от ANDE) |

## Что отдавать как deliverable

- **Для каждого экрана обязателен dark-вариант;** light можно подготовить во второй итерации.
- **Pixel 7 device frame с реальными status bar + gesture pill.** Внутри — полностью отрендеренный UI, без плейсхолдеров (это противоположность лендингу: здесь как раз *нужно* нарисовать сам экран).
- **PNG 1080 × 1920** на каждый экран — формат, принимаемый Play Store screenshots.
- **Опционально Figma-source** для дальнейшей итерации.

---

## Экран 1 — Onboarding (3 слайда + permission flow)

**Контекст:** показывается один раз при первом запуске. Файл реализации: `mobile/app/onboarding.tsx`. Состоит из трёх слайдов с свайпом + финальный шаг запрашивает permissions у системы.

**Промпт для Claude Design:**

> Diseñá un flujo de **onboarding para Android** de 3 slides para la app LuzAlerts (información sobre cortes de luz en Paraguay). El usuario lo ve una sola vez al instalar la app.
>
> **Layout común a los 3 slides:**
> - Pixel 7 device frame, dark mode (`#0F172A` de fondo).
> - Status bar real arriba (hora a la izquierda, íconos de señal/Wi-Fi/batería a la derecha, color blanco sobre fondo dark).
> - Gesture pill abajo, centrado.
> - Padding lateral 24dp.
> - Estructura vertical:
>   1. Indicador de progreso arriba: 3 puntos pequeños (8dp), el activo en amber `#FBBF24`, los inactivos en `#334155`.
>   2. Espacio flexible.
>   3. **Ícono grande** dentro de un círculo de 96dp con fondo translúcido (12% opacity del color del slide). Ícono Lucide de 48dp en el color del slide.
>   4. Espacio 32dp.
>   5. **Título h1** (Roboto bold, 32sp, line-height 38sp, color blanco, alineado al centro). Permitir 2 líneas con `\n`.
>   6. Espacio 16dp.
>   7. **Body** (Roboto regular, 16sp, line-height 24sp, color `#CBD5E1`, alineado al centro, max 3 líneas).
>   8. Espacio flexible.
>   9. **Botón CTA full-width** (height 56dp, fondo amber `#FBBF24`, texto negro bold 16sp, esquinas 12dp).
>   10. Debajo del CTA, un link pequeño centrado: `Saltar` (color `#94A3B8`, 14sp).
>
> **Slide 1 — Welcome:**
> - Ícono: `Zap` (rayo) en color amber `#F59E0B`, círculo con fondo `rgba(245,158,11,0.12)`.
> - Título: `Cortes de luz\nen tiempo real`
> - Body: `Datos oficiales de la ANDE actualizados cada hora, más reportes de usuarios de toda Paraguay.`
> - CTA: `Siguiente`
>
> **Slide 2 — Map:**
> - Ícono: `MapPin` (pin) en `#EF4444`, círculo con fondo `rgba(239,68,68,0.12)`.
> - Título: `Tu zona,\nsiempre actualizada`
> - Body: `El mapa muestra cortes planificados y activos cerca de vos. Si hay un corte y no aparece, podés reportarlo en un toque.`
> - CTA: `Siguiente`
>
> **Slide 3 — Notifications:**
> - Ícono: `BellRing` (campana) en `#0A84FF`, círculo con fondo `rgba(10,132,255,0.12)`.
> - Título: `Avisamos cuando\nhay un corte`
> - Body: `Activá las notificaciones y la ubicación para recibir alertas cuando haya un corte a menos de 5 km de donde estás.`
> - CTA: `Activar y empezar`
>
> **Slide 3.b — System permission dialog (mockup adicional):**
> - Mostrá cómo aparece encima del slide 3 el diálogo nativo de Android pidiendo "Permitir que LuzAlerts acceda a tu ubicación: Mientras usás la app / Solo esta vez / No permitir". Es el diálogo estándar del sistema, no diseño propio — pero incluí un mockup para mostrar el flujo.
>
> **Variantes a entregar:**
> - 3 slides en dark mode (obligatorio)
> - 3 slides en light mode (opcional)
> - 1 captura del system permission dialog superpuesto al slide 3

---

## Экран 2 — Mapa (Home tab)

**Контекст:** главный экран приложения после онбординга. Файл: `mobile/app/(tabs)/index.tsx`. Показывает все cortes на карте Asunción + сосредоточен вокруг местоположения пользователя.

**Промпт для Claude Design:**

> Diseñá la **pantalla principal del mapa** de LuzAlerts para Android (Pixel 7), en dark mode.
>
> **Estructura de arriba a abajo:**
>
> 1. **Status bar real** del sistema (Android, dark icons sobre fondo dark, hora `21:43`).
>
> 2. **Top app bar** (Material 3 small, height 64dp):
>    - Fondo `#0F172A` con elevación sutil (sombra mínima al hacer scroll).
>    - A la izquierda: ícono `Zap` amber `#FBBF24` (24dp) + texto "LuzAlerts" (Roboto bold 20sp blanco).
>    - A la derecha: ícono `Settings` (24dp, color `#94A3B8`).
>
> 3. **Mapa de Google Maps** (full-width, ocupa el resto de la pantalla):
>    - Estilo dark map (no el default colorido — usar [Google Maps dark style JSON](https://mapstyle.withgoogle.com/) o equivalente, agua en `#0F172A`, calles en `#1E293B`, parques en `#1E293B` con tinte verde sutil).
>    - Centrado en Asunción (`-25.2637, -57.5759`) con un poco de zoom.
>    - **Marcadores de cortes:**
>      - Pin **amarillo** `#FBBF24` para cortes programados (3 unidades, distribuidos en el mapa).
>      - Pin **rojo** `#EF4444` para cortes activos (2 unidades, uno con un anillo pulsante alrededor).
>      - Pin **verde** `#22C55E` para cortes resueltos (1 unidad).
>      - Pin **violeta** `#A855F7` con ícono de personas para reportes vecinales (1 unidad — distinto en forma de los oficiales, p.ej. con un pequeño badge de "👥").
>    - Marcador de ubicación del usuario: punto azul brillante `#0A84FF` con halo de precisión (azul `rgba(10,132,255,0.2)`).
>
> 4. **Bottom sheet preview** (cuando un marker está seleccionado — mostrá esta variante):
>    - Sheet anclado abajo, ocupa ~30% de la altura, esquinas superiores 16dp redondeadas, fondo `#1E293B`.
>    - Drag handle: barra `#475569`, 32dp ancho, 4dp alto, centrada arriba con margin 8dp.
>    - Contenido (padding 16dp):
>      - Línea 1: **Chip de estado** (radius 8dp, padding 4×8dp, font 12sp bold). Para activo: fondo `rgba(239,68,68,0.15)`, texto `#F87171`, texto "ACTIVO". A la derecha del chip, un pequeño texto `Hace 23 min` en `#94A3B8` 12sp.
>      - Línea 2: Título del corte, Roboto bold 18sp blanco. Ejemplo: `Av. Eusebio Ayala y Cruz del Chaco`
>      - Línea 3: Barrio + ciudad, 14sp `#CBD5E1`. Ejemplo: `Mburucuyá, Asunción`
>      - Línea 4: Horario estimado, 14sp `#94A3B8` con ícono `Clock` 14dp inline. Ejemplo: `🕐 Estimado: 18:00 – 22:00`
>      - Botón secundario al final: `Ver detalles` (full-width, height 44dp, borde 1dp `#475569`, texto blanco 14sp medium, esquinas 8dp).
>
> 5. **FAB principal** "Sin luz" (flotante, no parte del bottom sheet):
>    - Position: 16dp del borde derecho, 16dp arriba del bottom sheet (o 16dp del borde inferior si no hay sheet abierto).
>    - Extended FAB de Material 3: height 56dp, padding horizontal 20dp, fondo amber `#FBBF24`, texto negro bold 16sp.
>    - Ícono `AlertTriangle` (20dp) + label `Sin luz`.
>    - Sombra: elevation 6.
>
> 6. **Botón secundario "Mi ubicación"** (FAB pequeño):
>    - Position: arriba del FAB principal, 12dp de gap.
>    - Round FAB 48dp, fondo `#1E293B`, ícono `Navigation` (20dp, color blanco).
>
> 7. **Bottom navigation bar** (Material 3, height 80dp, fondo `#1E293B`):
>    - 4 tabs con íconos Lucide (24dp) y label (12sp):
>      - **Mapa** (`Map`) — activo en este screen, ícono y texto en amber `#FBBF24`, con pill de fondo `rgba(251,191,36,0.12)` redondeado.
>      - **Lista** (`List`) — color `#94A3B8`.
>      - **Reportes** (`Users`) — color `#94A3B8`. Con badge rojo `#EF4444` con número "3" arriba a la derecha del ícono.
>      - **Ajustes** (`Settings`) — color `#94A3B8`.
>
> 8. **Gesture pill** real del sistema, abajo de todo, color blanco semi-transparente.
>
> **Estados adicionales a entregar:**
> - **Loading state:** mapa con un spinner centrado y un snackbar abajo `Cargando cortes…` (fondo `#1E293B`, texto blanco, esquinas 8dp).
> - **Empty state (sin cortes en la zona):** mapa renderizado pero sin pins; snackbar abajo `No hay cortes activos en tu zona ✓` con ícono `CheckCircle` verde.
> - **Sin permiso de ubicación:** banner amarillo `#FBBF24` con texto negro arriba del mapa: `Activá la ubicación para ver cortes cerca tuyo` + botón `Activar`.

---

## Экран 3 — Lista de cortes (List tab)

**Контекст:** вкладка списка. Файл: `mobile/app/(tabs)/list.tsx`. Все outages в виде вертикальных карточек с pull-to-refresh.

**Промпт для Claude Design:**

> Diseñá la pantalla de **lista de cortes** para LuzAlerts en Android, dark mode.
>
> **Estructura:**
>
> 1. **Status bar** real.
>
> 2. **Top app bar** (Material 3 medium, height 112dp):
>    - Fondo `#0F172A`.
>    - Línea 1 (small): título "LuzAlerts" + acción `Settings` derecha (igual que en Mapa).
>    - Línea 2 (large headline): texto "Cortes" en Roboto bold 28sp blanco, padding 16dp lateral.
>
> 3. **Filtros tipo Chips** (FilterChip de Material 3, scrollable horizontal, padding 16dp, gap 8dp):
>    - `Todos` (seleccionado por defecto, fondo `#FBBF24`, texto negro)
>    - `Programados` (border `#475569`, texto `#CBD5E1`)
>    - `Activos`
>    - `Resueltos`
>    - `Cerca tuyo` (con ícono `MapPin` 14dp inline)
>
> 4. **Lista vertical de outage cards** (FlatList, gap 12dp entre cards, padding lateral 16dp):
>
>    Cada card:
>    - Fondo `#1E293B`, esquinas 12dp, padding 16dp, sin elevación (solo divider sutil arriba si querés diferenciar).
>    - **Línea superior:** chip de estado pequeño (igual que en map sheet) + texto a la derecha con tiempo relativo en `#94A3B8` 12sp (`Hace 1h`, `Programado para mañana 09:00`).
>    - **Título:** dirección/zona del corte, Roboto bold 16sp blanco. 1–2 líneas.
>    - **Subtítulo:** barrio + ciudad, 14sp `#CBD5E1`.
>    - **Línea inferior** (en row):
>      - Ícono `Clock` (14dp `#94A3B8`) + horario "18:00 – 22:00" (12sp `#94A3B8`)
>      - Spacer
>      - Si hay reportes vecinales asociados: chip violeta pequeño `3 reportes` con ícono `Users` 12dp.
>      - Si hay comentarios: chip discreto `💬 5` (12sp `#94A3B8`).
>    - Tap en la card → navega a detalle del corte.
>
> 5. **Pull-to-refresh:** spinner amber arriba al tirar la lista hacia abajo.
>
> 6. **Bottom navigation** igual al map screen, pero ahora "Lista" es el tab activo.
>
> **Mostrar al menos 5 cards en distintos estados:**
> 1. Card programado (amber chip), futuro, sin reportes.
> 2. Card activo (red chip), ahora mismo, con 3 reportes vecinales y 5 comentarios.
> 3. Card activo crowdsource (chip violeta `REPORTADO`), 4 reportes, sin horario oficial.
> 4. Card resuelto (green chip), hace 2h, 12 comentarios.
> 5. Card programado para mañana, sin reportes ni comentarios.
>
> **Estados extra:**
> - **Empty state:** ilustración SVG simple (rayo amarillo + texto), título "No hay cortes registrados", subtítulo "Cuando aparezca uno cerca tuyo te avisamos."
> - **Loading state:** 4 skeleton cards animadas (shimmer effect, fondo `#1E293B`, líneas `#334155` shimmer).

---

## Экран 4 — Detalle de corte

**Контекст:** открывается при тапе на маркер/карточку. Файл: `mobile/app/outage/[id].tsx`. Включает информацию + раздел комментариев.

**Промпт для Claude Design:**

> Diseñá la pantalla de **detalle de un corte** para LuzAlerts en Android, dark mode. Es la vista que se abre al tocar un corte desde el mapa o la lista.
>
> **Estructura (scrollable):**
>
> 1. **Status bar** real.
>
> 2. **Top app bar** (Material 3 small, height 64dp, fondo `#0F172A`):
>    - Botón back (`ArrowLeft` 24dp blanco) a la izquierda.
>    - Título "Detalle del corte" en blanco 20sp medium.
>    - A la derecha: ícono `Share2` (24dp) — para compartir el corte por WhatsApp.
>
> 3. **Header del corte** (padding 16dp, fondo `#0F172A`):
>    - Chip de estado grande arriba (igual estilo que antes, pero 16sp bold).
>    - Título grande: dirección, Roboto bold 24sp blanco, line-height 32sp. Ejemplo: `Av. Eusebio Ayala c/ Cruz del Chaco`
>    - Subtítulo: barrio, ciudad, dpto. 16sp `#CBD5E1`.
>    - Si es source crowdsourced: badge violeta `Reportado por vecinos` 12sp con ícono `Users`.
>    - Si es source oficial: badge gris `Fuente: ANDE` 12sp con ícono `Building2`.
>
> 4. **Mapa mini** (height 180dp, ancho full, esquinas 12dp, margin lateral 16dp):
>    - Mapa estático centrado en el corte.
>    - 1 marker del color del estado.
>    - Esquina inferior derecha: botón pequeño "Abrir en Mapa" (chip 32dp, fondo `rgba(15,23,42,0.7)`, texto blanco 12sp).
>
> 5. **Cards de información** (padding lateral 16dp, gap vertical 12dp):
>
>    **Card "Horario"** (fondo `#1E293B`, padding 16dp, esquinas 12dp):
>    - Ícono `Clock` 20dp `#FBBF24` + título "Horario" 14sp `#94A3B8` uppercase.
>    - Línea: `Inicio` + valor `Hoy 18:00`
>    - Línea: `Fin estimado` + valor `Hoy 22:00`
>    - Línea: `Duración` + valor `4 horas`
>
>    **Card "Zona afectada"**:
>    - Ícono `MapPin` 20dp `#FBBF24` + título "Zona afectada".
>    - Texto: `Mburucuyá, Asunción`
>    - Sub-texto: lista de barrios afectados separados por comas, 14sp `#CBD5E1`.
>
>    **Card "Reportes vecinales"** (solo si hay):
>    - Ícono `Users` 20dp `#A855F7` + título.
>    - Línea: `4 vecinos confirmaron este corte en los últimos 30 minutos.`
>
> 6. **Sección de comentarios:**
>    - Divider 1dp `#334155` arriba.
>    - Título de sección: `Comentarios (5)` Roboto bold 18sp blanco, padding 16dp.
>    - **Input de comentario** (sticky o al final, según UX):
>      - TextField Material 3 outlined, height 56dp, ancho full menos botón.
>      - Placeholder `Compartí lo que está pasando en tu zona…`
>      - Contador de caracteres pequeño `0 / 500` `#94A3B8` 12sp en la esquina.
>      - Botón `Send` redondo 48dp amber `#FBBF24` con ícono `Send` negro 20dp.
>    - **Lista de comentarios** (gap 12dp):
>      - Cada comentario: card fondo `#1E293B`, padding 12dp, esquinas 12dp.
>      - Avatar circular 32dp con inicial anónima sobre fondo de color generado del device_id (ej. `#A855F7`, `#22C55E`). Letra blanca bold 14sp.
>      - Username anónimo: `Vecino #4F2A` 13sp medium `#CBD5E1`.
>      - Tiempo relativo: `Hace 12 min` 12sp `#94A3B8` a la derecha.
>      - Texto del comentario: 14sp `#F8FAFC` line-height 20sp, max 4 líneas, "ver más" si excede.
>
>    **Mostrar 4 comentarios de ejemplo:**
>    1. `"Confirmo, no hay luz en toda la cuadra de Mariscal López y Brasilia."` — hace 12 min.
>    2. `"En mi casa volvió hace 5 minutos pero parece que la cuadra de al lado sigue sin luz."` — hace 8 min.
>    3. `"¿Alguien sabe si la ANDE dijo a qué hora vuelve?"` — hace 4 min.
>    4. `"Estoy escuchando un transformador haciendo ruido raro en la esquina, alguien más?"` — hace 1 min.
>
> 7. **Sin bottom navigation** (es una pantalla pushed, no tab).
>
> 8. **Gesture pill** real abajo.
>
> **Variantes a entregar:**
> - Detalle de corte oficial (ANDE) con horario completo.
> - Detalle de corte crowdsourced (sin horario, con bandera "Reportado por vecinos" y 4 reportes).
> - Estado vacío de comentarios: ilustración pequeña + texto `Sé el primero en comentar.`

---

## Экран 5 — Reportes (Reports tab)

**Контекст:** список активных reports от пользователей (отдельно от официальных outages). Файл: `mobile/app/(tabs)/reports.tsx`.

**Промпт для Claude Design:**

> Diseñá la pantalla de **reportes vecinales** para LuzAlerts en Android, dark mode.
>
> **Estructura:**
>
> 1. **Status bar** + **Top app bar** Material 3 medium con título grande `Reportes vecinales`.
>
> 2. **Banner informativo** (debajo del top app bar, padding 16dp):
>    - Card fondo `rgba(168,85,247,0.08)` (violeta 8% opacity), borde izquierdo 4dp `#A855F7`, padding 12dp, esquinas 8dp.
>    - Ícono `Info` 16dp `#C084FC` + texto 13sp `#CBD5E1`:
>      `Cuando 3 vecinos reportan el mismo corte en menos de 500m, se confirma para todos.`
>
> 3. **Lista de reportes activos** (cards, similares a las de Lista pero adaptadas):
>    - Cada card:
>      - Avatar circular 40dp con inicial anónima color violeta + texto `Vecino #A1B2`.
>      - Tiempo relativo `Hace 5 min`.
>      - Línea: dirección/zona aproximada (basada en lat/lon).
>      - Línea inferior: chip pequeño `2 / 3 confirmaciones` con barra de progreso amber 4dp debajo.
>      - Si llega a 3 confirmaciones: chip verde `Confirmado ✓` y la card cambia a verde sutil.
>
> 4. **FAB extended "Reportar corte"** flotante amber, abajo a la derecha (igual que en map screen).
>
> 5. **Bottom navigation** con tab activo "Reportes".
>
> **Mostrar:**
> - 4 reportes en distintos estados (1/3, 2/3, 3/3 confirmado, 1/3 expirando con badge gris `Expira en 12 min`).
> - Empty state con ilustración + texto `Aún no hay reportes en tu zona.` y botón `Reportar uno ahora`.

---

## Экран 6 — Reportar corte (modal sheet)

**Контекст:** активируется при тапе на FAB "Sin luz". Это bottom sheet с подтверждением и автоматическим определением location.

**Промпт для Claude Design:**

> Diseñá el **modal de reporte de corte** que aparece al tocar el FAB "Sin luz" en LuzAlerts. Es un bottom sheet modal de Material 3.
>
> **Layout:**
>
> 1. **Backdrop scrim:** capa negra `rgba(0,0,0,0.5)` cubriendo el resto de la pantalla.
>
> 2. **Bottom sheet** (~75% de altura de pantalla, fondo `#0F172A`, esquinas superiores 24dp):
>    - Drag handle arriba.
>    - Padding 24dp.
>    - **Estructura vertical:**
>      - Ícono `AlertTriangle` 48dp dentro de círculo 96dp con fondo `rgba(239,68,68,0.15)`, color `#EF4444`. Centrado.
>      - Espacio 24dp.
>      - Título `¿No hay luz en tu zona?` Roboto bold 24sp blanco, centrado.
>      - Subtítulo `Vamos a usar tu ubicación actual para registrar el reporte. Si 3 vecinos reportan lo mismo en menos de 500m, se confirma como un corte real.` 15sp `#CBD5E1` line-height 22sp, centrado, max-width 320dp.
>      - Espacio 32dp.
>      - **Card de ubicación detectada** (fondo `#1E293B`, padding 16dp, esquinas 12dp):
>        - Ícono `MapPin` 20dp `#FBBF24` + texto bold blanco `Tu ubicación`.
>        - Sub-texto: dirección reverse-geocoded `Av. Mariscal López, Asunción` 13sp `#CBD5E1`.
>        - Sub-texto: precisión `±15 m` 12sp `#94A3B8`.
>        - A la derecha: ícono `RefreshCw` (botón para refrescar location).
>      - Espacio 24dp.
>      - **Botón primario CTA** (full-width 56dp, amber `#FBBF24`, texto negro bold 16sp):
>        `Confirmar reporte`
>      - Espacio 12dp.
>      - **Botón secundario** (full-width 48dp, fondo transparente, borde 1dp `#475569`, texto blanco 15sp):
>        `Cancelar`
>
> **Estados a entregar:**
> 1. Default (location detected, listo para confirmar).
> 2. Loading location (spinner reemplaza el ícono de mapa).
> 3. Sin permiso de ubicación: ícono cambia a `MapPinOff`, texto cambia a "Necesitamos tu ubicación para registrar el reporte" + botón `Activar ubicación`.
> 4. Confirmación enviada: animación de check verde 96dp + texto "Reporte enviado ✓" + sub-texto "Si más vecinos reportan, te avisamos cuando se confirme." + botón `Listo`.

---

## Экран 7 — Ajustes (Settings tab)

**Контекст:** четвёртый таб. Файл: `mobile/app/(tabs)/settings.tsx`. Минимальный — пользователь анонимный, делать особо нечего.

**Промпт для Claude Design:**

> Diseñá la pantalla de **Ajustes** de LuzAlerts en Android, dark mode. Es minimalista — la app es anónima, hay poco que configurar.
>
> **Estructura:**
>
> 1. **Status bar** + **Top app bar** large con título `Ajustes`.
>
> 2. **Lista de secciones** (estilo Material 3 list, divider 1dp `#334155` entre items):
>
>    **Sección "Notificaciones"** (header `#94A3B8` 12sp uppercase, padding 16dp):
>    - **Switch tile** "Alertas de cortes" — activo por defecto, switch amber.
>      - Sub-texto: `Recibí avisos cuando hay cortes a menos de 5 km.`
>    - **Switch tile** "Aviso cuando vuelve la luz" — activo.
>      - Sub-texto: `Te notificamos también cuando un corte cercano se resuelve.`
>    - **Slider tile** "Radio de alertas":
>      - Label arriba: "Radio de alertas: 5 km"
>      - Slider Material 3 con valores 1, 3, **5**, 10, 20 km.
>
>    **Sección "Ubicación"**:
>    - **Tile** "Mi zona actual" → muestra dirección reverse-geocoded + botón `Cambiar`. Sub-texto: `Asunción, Capital`.
>    - **Tile** "Suscripciones a zonas adicionales" con badge `2` y chevron derecho.
>
>    **Sección "Datos y privacidad"**:
>    - **Tile** "Mi ID anónimo" → `#A1B2C3D4` (los primeros 8 chars del UUID), con ícono `Copy` para copiar.
>    - **Tile** "Eliminar mis datos" — texto en rojo `#F87171`, ícono `Trash2` 20dp `#F87171`.
>    - **Tile** "Política de privacidad" → abre web view a `luzalerts.com.py/privacy`.
>    - **Tile** "Términos de uso".
>
>    **Sección "Información"**:
>    - **Tile** "Sobre LuzAlerts" → versión + autor.
>    - **Tile** "Reportar un problema" → mailto `maxim.voronin2@gmail.com`.
>
> 3. **Footer informativo** abajo (padding 24dp, centrado):
>    - Logo pequeño + texto:
>      `LuzAlerts v1.0.0`
>      `Proyecto independiente. No afiliado a la ANDE.`
>      Color `#64748B` 12sp.
>
> 4. **Bottom navigation** con tab "Ajustes" activo.
>
> **Variante a entregar:**
> - Vista principal (default).
> - Modal de confirmación al tocar "Eliminar mis datos": diálogo Material 3 con título "¿Eliminar todos tus datos?" + sub-texto explicativo + botones "Cancelar" / "Eliminar" (rojo).

---

## Экран 8 — Notificación push (mockup)

**Контекст:** не часть app, но нужно для презентации в Play Store. Это рендер push-уведомления на lock screen / notification shade.

**Промпт для Claude Design:**

> Diseñá un mockup de **notificación push de LuzAlerts** tal como aparece en el lock screen de un Pixel 7 con Android 14, dark mode.
>
> **Layout:**
>
> 1. **Lock screen real** del sistema:
>    - Wallpaper genérico oscuro con sutil gradient (no usar imagen de marca, debe verse como un fondo neutro de stock Android).
>    - Hora grande arriba (estilo clock widget Android 14, ~80sp).
>    - Fecha debajo: `Lunes, 28 de abril`.
>    - Status bar real arriba con íconos del sistema.
>
> 2. **Notificación de LuzAlerts** (estilo Material 3 notification card, ancho ~95% de pantalla, esquinas 24dp, fondo `#1E293B` semi-translúcido con blur):
>    - **Header** (height 28dp, padding lateral 16dp):
>      - Ícono pequeño 16dp del app (rayo amber sobre fondo dark redondo).
>      - Texto `LuzAlerts · ahora` 12sp `#94A3B8`.
>    - **Cuerpo**:
>      - Título: `Corte de luz cerca tuyo` Roboto bold 15sp blanco.
>      - Mensaje: `Hay un corte activo a 1,2 km de tu ubicación, en Av. Mariscal López. Tocá para ver el mapa.` 14sp `#CBD5E1`, max 2 líneas.
>    - Padding 16dp.
>
> 3. **Variante 2 — notificación de "luz restaurada":**
>    - Mismo estilo, pero con título `La luz volvió ✓` en color verde `#4ADE80`.
>    - Mensaje: `El corte cerca tuyo (Mariscal López) fue resuelto hace unos minutos.`
>
> **Entregar 2 mockups** (corte detectado / luz restaurada) lado a lado para usar en marketing y en el carrusel de Play Store.

---

## Workflow recomendado para producir los assets

1. Empezar por **Экран 2 (Mapa)** — es el screenshot más importante para el Play Store y define la paleta visual.
2. **Экран 3 (Lista)** + **Экран 4 (Detalle)** — segundo y tercer screenshot del listing.
3. **Экран 1 (Onboarding)** — slide 1 sirve también como cuarto screenshot del listing.
4. **Экран 8 (Push notification)** — útil como feature graphic o screenshot de marketing.
5. Экраны 5, 6, 7 — segunda iteración, no son críticos para el primer release.

## Output esperado para Play Store

Google Play exige al menos 2 screenshots de teléfono. Recomendado 4–8. Resolución mínima 320px por lado, máxima 3840px, ratio entre 16:9 y 9:16. Sweet spot: **1080 × 1920 PNG**.

Lista de archivos finales sugeridos (a poner en `/screenshots/` del repo):

```
screenshots/
├── 01-map.png            # Экран 2 (Mapa con marker activo seleccionado)
├── 02-list.png           # Экран 3 (Lista filtrada)
├── 03-detail.png         # Экран 4 (Detalle con comentarios)
├── 04-onboarding-1.png   # Экран 1 slide 1
├── 05-report-modal.png   # Экран 6 (Modal de reporte)
├── 06-push.png           # Экран 8 (Push notification)
└── feature-graphic.png   # 1024×500 — banner del Play Store
```

Estos mismos archivos se usan como reemplazo de los placeholders en el landing (`luzalerts.com.py/screenshots/main.png` etc.).
