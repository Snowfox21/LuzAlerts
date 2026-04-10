# ⚡ LuzParaguay

> Real-time power outage tracker for Paraguay — official ANDE data + crowdsourced reports, in your pocket.

Paraguay has frequent unannounced power cuts. ANDE publishes planned outage notices on their website — but only in Spanish, only as raw HTML, and with no notification system. LuzParaguay scrapes that data every hour, enriches it with GPS coordinates, and puts it on an interactive map. When the official data has gaps, users fill them in by tapping "Report" from wherever they are.

---

## What it does

| | |
|---|---|
| 🗺 **Live map** | Color-coded markers — planned (yellow), active (red), resolved (green) |
| 📡 **Official data** | Scrapes ANDE's website every 60 minutes, geocodes zones automatically |
| 👥 **Crowdsourcing** | Users report outages in one tap; 3+ reports in 500 m auto-confirms the area |
| 🔔 **Push notifications** | Notified automatically when a new outage appears within 5 km of your location |
| 🌙 **Dark mode** | Default dark UI — useful when the lights are already out |

---

## Tech stack

| Layer | Tech |
|---|---|
| Mobile | React Native (Expo), TypeScript |
| Backend | Python 3.12, FastAPI, async SQLAlchemy |
| Database | PostgreSQL 16 + PostGIS 3.4 |
| Scraper | httpx, BeautifulSoup4, APScheduler |
| Geocoding | OpenStreetMap Nominatim |
| Push | Expo Push Notifications → FCM (Android) / APNs (iOS) |
| Infra | Docker Compose |

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

> The app auto-detects the backend: `10.0.2.2:8000` on Android emulator, `localhost:8000` on iOS simulator, and `api.luzparaguay.com` in production.

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
│   └── app/
│       ├── models.py          # Users, Outages, Reports, Subscriptions
│       ├── routers/           # REST endpoints
│       ├── crowdsource.py     # Auto-confirmation logic
│       ├── geocoding.py       # Nominatim integration
│       └── notifications.py   # Expo push dispatch
│
├── scraper/
│   ├── ande_parser.py         # Planned outages
│   ├── consultas_parser.py    # Emergency outages (WIP)
│   └── processor.py           # Normalize → save → notify
│
└── mobile/
    ├── app/(tabs)/
    │   ├── index.tsx           # Map
    │   ├── list.tsx            # Outage list
    │   └── reports.tsx         # Report form
    └── src/
        ├── api/                # Axios client + types
        ├── hooks/              # useDeviceSetup (push + location)
        └── theme/              # Colors, spacing
```

---

## API

Full interactive docs available at `http://localhost:8000/docs` when running locally.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/outages/` | List outages — filter by status, barrio, or GPS radius |
| `GET` | `/outages/{id}` | Outage detail |
| `POST` | `/reports/` | Submit a user report |
| `GET` | `/reports/` | Active reports (optional radius filter) |
| `POST` | `/users/` | Register device (push token + location) |

---

## Roadmap

- [x] Official ANDE outage scraping
- [x] Crowdsourced reports with auto-confirmation
- [x] Push notifications (geo-targeted, 5 km radius)
- [ ] Emergency outage API (`consultas.ande.gov.py`)
- [ ] NIS number → feeder mapping
- [ ] App Store / Google Play release

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
