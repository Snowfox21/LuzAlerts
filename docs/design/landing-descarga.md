# Landing — bloque de descarga

Fuente de verdad para el bloque de descarga de `web/index.html`. Diseño aprobado por el
dueño el 14/11/2026 en el canvas de Claude Design (página `index`). Capturas en
[`landing-descarga/`](landing-descarga/): en ellas falta la captura de la app al lado del
texto (se dibuja con React desde unpkg, que no cargó al sacarlas).

## Dónde

Dos lugares con el mismo bloque:

1. **Hero**, debajo de la bajada («LuzAlerts te avisa al instante…»). El contenedor lleva
   `id="descargar"` (lo usan los enlaces `/#descargar` de otras páginas).
2. **CTA final**, debajo de «Descargá LuzAlerts y dejá de preguntarte si volvió la luz.»

## Contenido, de arriba abajo

| # | Elemento | Texto | Destino |
|---|----------|-------|---------|
| 1 | Botón principal, ancho completo | Descargar en Google Play | **Pendiente**: `#` hasta que el dueño pase el enlace |
| 2 | Dos botones secundarios en fila, mismo ancho | Descargar APK · Abrir en iOS | `/luzalerts.apk` (con `download`) · `/app/` (la PWA) |
| 3 | Línea del APK (solo en el hero) | `APK 1.2.8 · 110 MB · Android 7 o superior` | — |
| 4 | Nota | Gratis · Sin anuncios | — |

- La línea del APK la arma el script con `/dl/latest.json` (`APK {versionName} · {MB} MB · Android 7 o superior`). Sin red queda `APK para Android 7 o superior`.
- «Abrir en iOS» abre la PWA: en iPhone LuzAlerts es una app web, no hay app nativa.

## Estilo

- Bloque: columna, separación 12 px, ancho máximo 400 px; centrado en celular, alineado a la izquierda desde 1024 px.
- **Principal**: `.btn-primary` de la landing (fondo `--amber`, texto negro, 700, 16 px; en el CTA final 17 px), contenido centrado, con el **ícono de Google Play** (relleno, 18 px) a la izquierda.
- **Secundarios** (`.btn-secondary`): alto mínimo 48 px, borde 1 px `rgba(251,191,36,0.55)` (al pasar el mouse `--amber` y fondo `rgba(251,191,36,0.08)`), texto `--amber` 15 px 700, radio `--radius`. Íconos de 18 px: descarga para el APK, teléfono para iOS. Por debajo de 360 px de ancho se apilan.
- Línea del APK y nota: 13 px, `--text-muted`, centradas.

## Resto de la página

- **Encabezado**: botón «Descargar» → Google Play (pendiente, `#`).
- **Menú móvil**: «Descargar en Google Play» (pendiente), «Descargar APK», «App para iPhone».
- **Pie, columna Producto**: «Google Play» (pendiente), «Descargar APK», «App para iPhone», …
- Lo mismo en `novedades.html`; en `privacy.html` y `terms.html` el «Google Play» del pie.

## Capturas

| Estado | Captura |
|---|---|
| Hero, escritorio (1280 px) | [01-hero-escritorio](landing-descarga/01-hero-escritorio.png) |
| Hero, celular (375 px) | [01-hero-celular](landing-descarga/01-hero-celular.png) |
| CTA final, escritorio | [02-cta-final-escritorio](landing-descarga/02-cta-final-escritorio.png) |
| CTA final, celular | [02-cta-final-celular](landing-descarga/02-cta-final-celular.png) |

## Criterios de aceptación

- [ ] El hero y el CTA final muestran el principal y los dos secundarios en este orden.
- [ ] No hay ningún enlace a Google Play hasta que el dueño lo indique: todos son `#`.
- [ ] «Descargar APK» descarga `/luzalerts.apk`; «Abrir en iOS» abre `/app/`.
- [ ] La línea del APK muestra versión y tamaño reales de `/dl/latest.json`.
- [ ] A 375 px no hay scroll horizontal; por debajo de 360 px los secundarios se apilan.
