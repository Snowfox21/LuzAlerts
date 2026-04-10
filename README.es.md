🌐 [English](README.md) | [Español](README.es.md)

# ⚡ LuzParaguay

> Monitoreo de cortes de luz en tiempo real para Paraguay — datos oficiales de ANDE + reportes de usuarios, en tu bolsillo.

Paraguay sufre cortes de luz frecuentes y muchas veces sin aviso. La ANDE publica avisos de cortes programados en su sitio web, pero solo en HTML crudo y sin ningún sistema de notificaciones. LuzParaguay scrapea esos datos cada hora, les agrega coordenadas GPS y los muestra en un mapa interactivo. Cuando los datos oficiales tienen vacíos, los propios usuarios los completan tocando "Reportar" desde donde estén.

---

## ¿Qué hace?

| | |
|---|---|
| 🗺 **Mapa en vivo** | Marcadores por color según estado: programado (amarillo), activo (rojo), resuelto (verde) |
| 📡 **Datos oficiales** | Scrapea el sitio de la ANDE cada 60 minutos y geocodifica las zonas automáticamente |
| 👥 **Reportes colaborativos** | Los usuarios reportan cortes con un toque; 3 o más reportes en 500 m confirman la zona automáticamente |
| 🔔 **Notificaciones push** | Aviso automático cuando aparece un corte nuevo a menos de 5 km de tu ubicación |
| 🌙 **Modo oscuro** | Interfaz oscura por defecto — útil cuando ya no hay luz |

---

## Tecnologías

| Capa | Tecnología |
|---|---|
| App móvil | React Native (Expo), TypeScript |
| Backend | Python 3.12, FastAPI, SQLAlchemy async |
| Base de datos | PostgreSQL 16 + PostGIS 3.4 |
| Scraper | httpx, BeautifulSoup4, APScheduler |
| Geocodificación | OpenStreetMap Nominatim |
| Push | Expo Push Notifications → FCM (Android) / APNs (iOS) |
| Infraestructura | Docker Compose |

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

> La app detecta el backend automáticamente: `10.0.2.2:8000` en emulador Android, `localhost:8000` en simulador iOS y `api.luzparaguay.com` en producción.

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
Expo Push Service → FCM / APNs → teléfono del usuario
```

**Reportes colaborativos:**
`Usuario toca "Reportar" → POST /reports → si hay 3+ reportes en 500 m → zona confirmada`

**Notificaciones push:**
`Se guarda un corte nuevo → PostGIS encuentra usuarios en 5 km → Expo Push API → notificación`

---

## Estructura del proyecto

```
├── backend/
│   └── app/
│       ├── models.py          # Usuarios, Cortes, Reportes, Suscripciones
│       ├── routers/           # Endpoints REST
│       ├── crowdsource.py     # Lógica de auto-confirmación
│       ├── geocoding.py       # Integración con Nominatim
│       └── notifications.py   # Envío de push via Expo
│
├── scraper/
│   ├── ande_parser.py         # Cortes programados
│   ├── consultas_parser.py    # Cortes de emergencia (WIP)
│   └── processor.py           # Normalizar → guardar → notificar
│
└── mobile/
    ├── app/(tabs)/
    │   ├── index.tsx           # Mapa
    │   ├── list.tsx            # Lista de cortes
    │   └── reports.tsx         # Formulario de reporte
    └── src/
        ├── api/                # Cliente Axios + tipos
        ├── hooks/              # useDeviceSetup (push + ubicación)
        └── theme/              # Colores, espaciado
```

---

## API

Documentación interactiva disponible en `http://localhost:8000/docs` cuando corrés el proyecto en local.

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/outages/` | Listar cortes — filtrar por estado, barrio o radio GPS |
| `GET` | `/outages/{id}` | Detalle de un corte |
| `POST` | `/reports/` | Enviar un reporte de usuario |
| `GET` | `/reports/` | Reportes activos (filtro de radio opcional) |
| `POST` | `/users/` | Registrar dispositivo (token push + ubicación) |

---

## Hoja de ruta

- [x] Scraping de cortes oficiales de ANDE
- [x] Reportes colaborativos con auto-confirmación
- [x] Notificaciones push geo-dirigidas (radio 5 km)
- [ ] API de cortes de emergencia (`consultas.ande.gov.py`)
- [ ] Mapeo de número NIS → alimentador
- [ ] Publicación en App Store / Google Play

---

## Contribuir

Los pull requests son bienvenidos. Para cambios grandes, abrí un issue primero para discutirlo.

1. Hacé un fork del repositorio
2. Creá una rama: `git checkout -b feature/tu-feature`
3. Hacé tus cambios y commiteá
4. Abrí un PR contra `develop`

---

## Licencia

Repositorio privado — todos los derechos reservados.
