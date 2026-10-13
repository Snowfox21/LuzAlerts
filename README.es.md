🌐 [English](README.md) | [Español](README.es.md)

# ⚡ LuzAlerts

> Monitoreo de cortes de luz en tiempo real para Paraguay — datos oficiales de ANDE + reportes de usuarios, en tu bolsillo.

Paraguay sufre cortes de luz frecuentes y muchas veces sin aviso. La ANDE publica avisos de cortes programados en su sitio web, pero solo en HTML crudo y sin ningún sistema de notificaciones. LuzAlerts scrapea esos datos cada hora, les agrega coordenadas GPS y los muestra en un mapa interactivo. Cuando los datos oficiales tienen vacíos, los propios usuarios los completan tocando "Reportar" desde donde estén.

---

## ¿Qué hace?

| | |
|---|---|
| 🗺 **Mapa en vivo** | Marcadores por color según estado: programado (amarillo), activo (rojo), resuelto (verde), vecinal (violeta) |
| 📡 **Datos oficiales** | Scrapea el sitio de la ANDE cada 60 minutos y geocodifica las zonas automáticamente |
| 👥 **Reportes colaborativos** | Los usuarios reportan cortes con un toque; 3 o más reportes en 500 m confirman la zona automáticamente |
| 🔔 **Notificaciones push** | Aviso cuando aparece un corte nuevo a menos de 5 km — y otro cuando vuelve la luz. Android vía Expo/FCM, iPhone vía Web Push |
| 🍎 **iPhone (PWA)** | La misma app como app web en [luzalerts.lat/app](https://luzalerts.lat/app/) — agregala a la pantalla de inicio y recibí avisos (iOS 16.4+), sin App Store |
| ✋ **"Yo también" y cierre de reportes** | Los vecinos confirman el reporte de otro con un toque; el autor puede cerrar su reporte, y los viejos se cierran solos a las 96 h |
| 🔗 **Compartir un reporte** | Enlace corto `luzalerts.lat/r/{code}` con vista previa en WhatsApp; en Android se abre directo en la app (App Links) |
| 📦 **Autoactualización** | El APK se distribuye fuera de Google Play y revisa `dl/latest.json` solo — el aviso de actualización aparece en la app |
| 📊 **Estado del scraper** | `/status` muestra intentos del scraper, saltos de ID de ANDE y cobertura; `/events.json` es un feed público de eventos |
| 💬 **Comentarios entre vecinos** | Comentarios anónimos por cada corte — útiles cuando el aviso oficial no coincide con la realidad |
| 🚀 **Onboarding** | Cuatro slides de introducción (bienvenida, mapa, leyenda de marcadores, notificaciones) + permisos al primer uso |
| 🌙 **Modo oscuro** | Interfaz oscura por defecto — útil cuando ya no hay luz |
| 🌐 **Landing page** | Sitio estático en [luzalerts.lat](https://luzalerts.lat) — política de privacidad, términos de uso, 404 |

---

## Tecnologías

| Capa | Tecnología |
|---|---|
| App móvil | React Native (Expo), TypeScript; PWA para iPhone con react-native-web + Leaflet |
| Backend | Python 3.12, FastAPI, SQLAlchemy async, Alembic, slowapi (rate-limit) |
| Base de datos | PostgreSQL 16 + PostGIS 3.4 |
| Scraper | httpx, BeautifulSoup4, pdfplumber, APScheduler |
| Geocodificación | OpenStreetMap Nominatim |
| Push | Expo Push Notifications → FCM (Android), Web Push / VAPID con pywebpush (PWA en iPhone) |
| Infraestructura | Docker Compose, Caddy (proxy inverso + TLS) |
| Landing | HTML/CSS/JS + React (CDN) — estático, servido por Caddy |

---

## Correr en local

**Requisitos:** Docker, Node.js 18+, Expo Go o un simulador.

### 1. Iniciar el backend

```bash
docker-compose up --build
```

Esto levanta tres servicios:

| Servicio | URL |
|---|---|
| PostgreSQL + PostGIS | `localhost:5432` |
| FastAPI (REST + Swagger) | `http://localhost:8000/docs` |
| Scraper | Corre al iniciar, luego cada 60 min |

### 2. Correr la app móvil

```bash
cd mobile
npm install
npx expo start
```

Escaneá el código QR con **Expo Go**, o presioná `i` / `a` para los simuladores.

> La app apunta a `https://luzalerts.lat` en producción.

### 3. PWA para iPhone (Web Push)

En iPhone se usa el mismo código de `mobile/` compilado para web (`expo export -p web`) y servido en `https://luzalerts.lat/app/` (`experiments.baseUrl`; el viejo `app.luzalerts.lat` redirige ahí). Los avisos llegan por Web Push (VAPID), en paralelo a Expo Push en Android. Requiere iOS 16.4+ y la app agregada a la pantalla de inicio (Safari → Compartir → Agregar a inicio).

Configuración única:

1. DNS: registro `A` de `app.luzalerts.lat` → el VPS, solo para el redirect (Caddy obtiene el certificado TLS solo).
2. Generar claves VAPID (`npx web-push generate-vapid-keys`) y poner `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` en el `.env` del VPS. Sin ellas la PWA no puede suscribirse (`GET /config/vapid-public-key` → 503).
3. Reconstruir `backend` y `scraper` (los dos necesitan `pywebpush`), aplicar migraciones (`0007` agrega `users.web_push_subscription`) y reiniciar Caddy.
4. Tiles del mapa: por defecto se usa el servidor público de OpenStreetMap, que no es para tráfico de producción. Definí `EXPO_PUBLIC_MAP_TILE_URL` (y `EXPO_PUBLIC_MAP_TILE_ATTRIBUTION`) al compilar con tu propio proveedor.
5. Deploy: `VPS=user@host ./scripts/deploy-pwa.sh`, o poné `VPS=user@host` en `scripts/.deploy.env` (fuera de git) y corré `./scripts/deploy-pwa.sh`.

Desarrollo local: `cd mobile && npx expo start --web`. Los avisos solo llegan a usuarios con ubicación conocida, así que permití la geolocalización en la app.

---

## Cómo funciona

```
Sitio web de ANDE
     │
     ▼
 Scraper (cada 60 min)
     │  parsea HTML → normaliza → geocodifica con Nominatim
     ▼
PostgreSQL + PostGIS ──► FastAPI ──► App React Native
     │                                   │
     │    token push + GPS ◄─────────────┘
     ▼
Expo Push Service → FCM → teléfono Android
Web Push (VAPID) → Apple Push → PWA en iPhone (luzalerts.lat/app)
```

**Reportes colaborativos:**
`Usuario toca "Reportar" → POST /reports → si hay 3+ reportes en 500 m → zona confirmada`

**Notificaciones push:**
`Se guarda un corte nuevo → PostGIS encuentra usuarios en 5 km → Expo Push API / Web Push → notificación`

**Compartir:**
`Reporte → código → luzalerts.lat/r/{code} (página del servidor con og tags para WhatsApp) → en Android abre la app, el resto ve la página`

---

## Estructura del proyecto

```
├── backend/
│   ├── alembic/                # Migraciones de base de datos (baseline 0001_initial)
│   ├── app/
│   │   ├── models.py           # Usuarios, Cortes, Reportes, Suscripciones, Comentarios
│   │   ├── routers/            # Endpoints REST
│   │   ├── security.py         # Autenticación de administrador
│   │   ├── crowdsource.py      # Lógica de auto-confirmación
│   │   ├── geocoding.py        # Integración con Nominatim
│   │   ├── sharing.py          # Códigos para compartir reportes
│   │   ├── public_report.py    # Página pública /r/{code} (og tags para WhatsApp)
│   │   ├── templates/          # HTML de la página pública del reporte
│   │   └── notifications.py    # Envío de push vía Expo + Web Push
│   ├── scripts/
│   │   └── migration_smoke.sh  # upgrade head → downgrade base en BD temporal
│   └── tests/                  # parser, comentarios, endpoints REST
│
├── scraper/
│   ├── ande_parser.py          # Cortes programados — HTML + fallback PDF
│   ├── consultas_parser.py     # Cortes de emergencia (WIP)
│   └── processor.py            # Normalizar → guardar → notificar (+ detección de resolución)
│
├── mobile/
│   ├── app/(tabs)/
│   │   ├── index.tsx           # Mapa
│   │   ├── list.tsx            # Lista de cortes
│   │   └── reports.tsx         # Formulario de reporte
│   ├── app/onboarding.tsx      # Cuatro slides de intro + solicitud de permisos
│   ├── app/report/[id].tsx     # Detalle de un reporte
│   ├── app/r/[code].tsx        # Enlace compartido de un reporte
│   ├── public/                 # Shell de la PWA: index.html, manifest.json, sw.js, íconos
│   └── src/
│       ├── api/                # Cliente Axios + tipos
│       ├── hooks/              # useDeviceSetup (push + ubicación)
│       ├── maps/               # Mapas nativos / Leaflet en web
│       ├── push/               # Suscripción Web Push de la PWA
│       ├── share/              # Compartir reportes
│       ├── update/             # Chequeo de autoactualización del APK
│       └── theme/              # Colores, espaciado
│
├── scripts/
│   ├── release-apk.sh          # Publica el APK + dl/latest.json (en ese orden)
│   └── deploy-pwa.sh           # Compila la app web y la sube a luzalerts.lat/app
│
├── web/                        # Sitio estático (servido por Caddy en luzalerts.lat)
│   ├── index.html              # Landing principal
│   ├── privacy.html            # Política de privacidad
│   ├── terms.html              # Términos de uso
│   ├── 404.html                # Página 404 personalizada
│   ├── luzicons.jsx            # Componentes de íconos compartidos
│   ├── luzscreens*.jsx         # Previews de pantallas de la app (React vía CDN)
│   └── favicon.*               # Favicons (16, 32, 192, apple-touch)
│
└── docs/                       # Design prompts, documentación interna
```

---

## API

Documentación interactiva disponible en `http://localhost:8000/docs` cuando corrés el proyecto en local.

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/outages/` | Listar cortes — filtrar por estado, barrio o radio GPS |
| `GET` | `/outages/{id}` | Detalle de un corte |
| `GET` | `/outages/{id}/comments` | Listar comentarios de un corte |
| `POST` | `/outages/{id}/comments` | Publicar un comentario (≤500 caracteres) |
| `POST` | `/reports/` | Enviar un reporte de usuario |
| `GET` | `/reports/` | Reportes activos (filtro de radio opcional) |
| `GET` | `/reports/{id}` | Detalle de un reporte |
| `POST` | `/reports/{id}/corroborate` | Confirmar el reporte de un vecino ("yo también") |
| `POST` | `/reports/{id}/resolve` | El autor cierra su propio reporte |
| `GET` | `/reports/by-code/{code}` | Resolver un código compartido (sin la dirección del autor) |
| `POST` | `/reports/{id}/shared` | Contar un compartido |
| `GET` | `/r/{code}` | Página pública del reporte con vista previa para WhatsApp |
| `POST` | `/users/` | Registrar dispositivo (token push o suscripción Web Push + ubicación) |
| `DELETE` | `/users/{device_id}/web-push` | Quitar la suscripción Web Push de la PWA |
| `GET` | `/config/vapid-public-key` | Clave pública VAPID para suscribir la PWA |
| `POST` | `/subscriptions/` | Suscribirse a cortes cerca de una ubicación personalizada |
| `GET` / `DELETE` | `/subscriptions/` | Listar / quitar suscripciones por ubicación |
| `GET` | `/status` | Intentos y éxitos del scraper, saltos de ID de ANDE, cobertura y fallas de 30 días |
| `GET` | `/events.json` | Feed público de eventos de cortes |

El esquema de la base de datos lo gestiona **Alembic** — corré `alembic upgrade head` (o simplemente `docker-compose up`, el entrypoint lo hace solo). Para probar las migraciones en una BD temporal: `./backend/scripts/migration_smoke.sh`.

---

## Hoja de ruta

- [x] Scraping de cortes oficiales de ANDE
- [x] Reportes colaborativos con auto-confirmación
- [x] Notificaciones push — geo-dirigidas (radio 5 km), con aviso de seguimiento cuando vuelve la luz
- [x] Comentarios por corte
- [x] Onboarding (4 slides: bienvenida, mapa, leyenda de marcadores, notificaciones) + modo oscuro
- [x] Migraciones Alembic + endpoints de administración protegidos
- [x] Tests: parser, comentarios, endpoints REST, smoke de migraciones
- [x] Landing page en [luzalerts.lat](https://luzalerts.lat) — política de privacidad, términos, 404, favicon
- [x] Agregación de cortes de varias fuentes con prioridad de ANDE
- [x] "Yo también", cierre de reportes por el autor y cierre automático a las 96 h
- [x] Compartir reportes con vista previa en WhatsApp + App Links de Android
- [x] Autoactualización del APK fuera de Google Play
- [x] Observabilidad del scraper (`/status`) y feed público de eventos (`/events.json`)
- [x] iPhone como PWA en [luzalerts.lat/app](https://luzalerts.lat/app/) con Web Push
- [ ] **Publicación en Google Play (Android)** — ficha de app, capturas de pantalla
- [ ] iOS nativo / App Store
- [ ] API de cortes de emergencia (`consultas.ande.gov.py`)
- [ ] Mapeo de número NIS → alimentador

---

## Contribuir

Los pull requests son bienvenidos. Para cambios grandes, abrí un issue primero para discutirlo.

1. Hacé un fork del repositorio
2. Creá una rama: `git checkout -b feature/tu-feature`
3. Hacé tus cambios y commiteá
4. Abrí un PR contra `develop`

---

## Licencia

© 2026 LuzAlerts. Todos los derechos reservados.
