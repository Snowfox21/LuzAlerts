🌐 [English](README.md) | [Español](README.es.md)

# ⚡ LuzAlerts

> Real-time power outage tracker for Paraguay — official ANDE data + crowdsourced reports, in your pocket.

Paraguay has frequent unannounced power cuts. ANDE publishes planned outage notices on their website — but only as raw HTML you have to scan by eye, with no map and no notification system. LuzAlerts scrapes that data every hour, enriches it with GPS coordinates, and puts it on an interactive map. When the official data has gaps, users fill them in by tapping "Report" from wherever they are.

---

## What it does

| | |
|---|---|
| 🗺 **Live map** | Color-coded markers — planned (yellow), active (red), resolved (green), crowdsourced (purple) |
| 📡 **Official data** | Scrapes ANDE's website every 60 minutes, geocodes zones automatically |
| 👥 **Crowdsourcing** | Users report outages in one tap; 3+ reports in 500 m auto-confirms the area |
| 🔔 **Push notifications** | Notified when a new outage appears within 5 km — and again when the lights come back |
| 💬 **Neighbor comments** | Anonymous comments per outage — useful when the official notice is wrong |
| 🚀 **Onboarding** | Four-slide intro (welcome, map, legend, notifications) + permission flow on first launch |
| 🌙 **Dark mode** | Default dark UI — useful when the lights are already out |
| 🌐 **Landing page** | Static marketing site at [luzalerts.lat](https://luzalerts.lat) — privacy policy, terms of use, 404 |

---

## Tech stack

| Layer | Tech |
|---|---|
| Mobile | React Native (Expo), TypeScript |
| Backend | Python 3.12, FastAPI, async SQLAlchemy, Alembic, slowapi (rate-limit) |
| Database | PostgreSQL 16 + PostGIS 3.4 |
| Scraper | httpx, BeautifulSoup4, pdfplumber, APScheduler |
| Geocoding | OpenStreetMap Nominatim |
| Push | Expo Push Notifications → FCM (Android) |
| Infra | Docker Compose, Caddy (reverse proxy + TLS) |
| Landing | HTML/CSS/JS + React (CDN) — static, served by Caddy |

---

## Running locally

**Prerequisites:** Docker, Node.js 18+, Expo Go or a simulator.

### 1. Start the backend

```bash
docker-compose up --build
```

This starts three services:

| Service | URL |
|---|---|
| PostgreSQL + PostGIS | `localhost:5432` |
| FastAPI (REST + Swagger) | `http://localhost:8000/docs` |
| Scraper | Runs on startup, then every 60 min |

### 2. Run the mobile app

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with **Expo Go**, or press `i` / `a` for simulators.

> The app always points to `https://luzalerts.lat`. Caddy routes `/outages*`, `/reports*`, `/users*`, `/subscriptions*` to the FastAPI backend and serves the static landing for everything else.

---

## How it works

```
ANDE website
     │
     ▼
 Scraper (every 60 min)
     │  parse HTML → normalize → Nominatim geocoding
     ▼
PostgreSQL + PostGIS ──► FastAPI ──► React Native app
     │                                   │
     │    push token + GPS location ◄────┘
     ▼
Expo Push Service → FCM / APNs → user's phone
```

**Crowdsourced reports:**
`User taps "Report" → POST /reports → if 3+ reports within 500 m → area confirmed`

**Push notifications:**
`New outage saved → PostGIS finds users within 5 km → Expo Push API → notification`

---

## Project layout

```
├── backend/
│   ├── alembic/                # Database migrations (baseline 0001_initial)
│   ├── app/
│   │   ├── models.py           # Users, Outages, Reports, Subscriptions, Comments
│   │   ├── routers/            # REST endpoints
│   │   ├── security.py         # X-Admin-Key dependency
│   │   ├── crowdsource.py      # Auto-confirmation logic
│   │   ├── geocoding.py        # Nominatim integration
│   │   └── notifications.py    # Expo push dispatch
│   ├── scripts/
│   │   └── migration_smoke.sh  # upgrade head → downgrade base on temp DB
│   └── tests/                  # parser, comments, REST endpoints
│
├── scraper/
│   ├── ande_parser.py          # Planned outages — HTML + PDF fallback
│   ├── consultas_parser.py     # Emergency outages (WIP)
│   └── processor.py            # Normalize → save → notify (+ resolve detection)
│
├── mobile/
│   ├── app/(tabs)/
│   │   ├── index.tsx           # Map
│   │   ├── list.tsx            # Outage list
│   │   └── reports.tsx         # Report form
│   ├── app/onboarding.tsx      # Four-slide intro + permission requests
│   └── src/
│       ├── api/                # Axios client + types
│       ├── hooks/              # useDeviceSetup (push + location)
│       └── theme/              # Colors, spacing
│
├── web/                        # Static landing site (served by Caddy at luzalerts.lat)
│   ├── index.html              # Main landing page
│   ├── privacy.html            # Privacy policy
│   ├── terms.html              # Terms of use
│   ├── 404.html                # Custom 404
│   ├── luzicons.jsx            # Shared icon components
│   ├── luzscreens*.jsx         # App screen previews (rendered via React CDN)
│   └── favicon.*               # Favicons (16, 32, 192, apple-touch)
│
└── docs/                       # Design prompts, internal docs
```

---

## API

Full interactive docs available at `http://localhost:8000/docs` when running locally.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/outages/` | List outages — filter by status, barrio, or GPS radius |
| `GET` | `/outages/{id}` | Outage detail |
| `GET` | `/outages/{id}/comments` | List comments on an outage |
| `POST` | `/outages/{id}/comments` | Post a comment (≤500 chars) |
| `POST` | `/reports/` | Submit a user report |
| `GET` | `/reports/` | Active reports (optional radius filter) |
| `POST` | `/users/` | Register device (push token + location) |
| `POST` | `/subscriptions/` | Subscribe to outages near a custom location |
| `GET` | `/users/` | **Admin** — list all users (`X-Admin-Key` required) |
| `DELETE` | `/users/{device_id}` | **Admin** — delete a user (`X-Admin-Key` required) |

Database schema is managed by **Alembic** — run `alembic upgrade head` (or just `docker-compose up`, the entrypoint does it). To smoke-test migrations on a temp DB: `./backend/scripts/migration_smoke.sh`.

---

## Roadmap

- [x] Official ANDE outage scraping
- [x] Crowdsourced reports with auto-confirmation
- [x] Push notifications — geo-targeted, 5 km radius, plus a follow-up when power is restored
- [x] Per-outage comments
- [x] Onboarding flow (4 slides: welcome, map, marker legend, notifications) + dark mode
- [x] Alembic migrations + admin endpoints behind `X-Admin-Key`
- [x] Tests: parser, comments, REST endpoints, migration smoke
- [x] Landing page live at [luzalerts.lat](https://luzalerts.lat) — privacy policy, terms, 404, favicon
- [ ] **Google Play release (Android)** — store listing, screenshots
- [ ] iOS / App Store release (post-MVP)
- [ ] Emergency outage API (`consultas.ande.gov.py`)
- [ ] NIS number → feeder mapping

---

## Contributing

Pull requests are welcome. For major changes, open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create a branch: `git checkout -b feature/your-feature`
3. Make your changes and commit
4. Open a PR against `develop`

---

## License

Private repository — all rights reserved.
