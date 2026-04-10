# LuzParaguay

Real-time power outage monitoring app for Paraguay. Combines official ANDE data with crowdsourced reports from users.

---

## Features

- **Official outages** — automatic scraping of planned outages from ANDE's website every 60 minutes
- **Crowdsourcing** — users can report outages from their location in one tap
- **Interactive map** — markers color-coded by status (planned / active / resolved)
- **Push notifications** — get notified automatically when a new outage appears within 5 km of your location
- **Dark mode** — default UI optimized for low-battery situations

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native (Expo), TypeScript |
| Backend API | Python 3.12, FastAPI, SQLAlchemy (async) |
| Database | PostgreSQL 16 + PostGIS 3.4 |
| Scraper | httpx, BeautifulSoup4, APScheduler |
| Geocoding | OpenStreetMap Nominatim |
| Push notifications | Expo Push Notifications (FCM / APNs) |
| Infrastructure | Docker Compose |

---

## Architecture

```
ANDE website
     │
     ▼
 Scraper (60 min)
     │  httpx + BeautifulSoup
     │  Nominatim geocoding
     ▼
PostgreSQL + PostGIS
     │
     ▼
FastAPI Backend ◄──── React Native App
 /outages              Map screen
 /reports              Report button
 /users                Device registration + push token
     │
     ▼
Expo Push Service
 (FCM → Android)
 (APNs → iOS)
```

**Data flow — official outages:**
`ANDE site → Scraper → normalize + geocode → DB → API → App`

**Data flow — crowdsourced reports:**
`App → POST /reports → DB → validate (3+ reports in 500m = confirmed) → API → Map`

**Data flow — push notifications:**
`Scraper saves new outage → PostGIS finds users within 5 km → Expo Push API → device`

---

## Project Structure

```
├── backend/               # FastAPI REST API
│   ├── app/
│   │   ├── main.py        # Entry point, router registration
│   │   ├── models.py      # SQLAlchemy ORM (users, outages, reports, subscriptions)
│   │   ├── schemas.py     # Pydantic request/response schemas
│   │   ├── routers/       # users, outages, reports, subscriptions
│   │   ├── crowdsource.py    # Confirmation threshold logic
│   │   ├── geocoding.py      # Nominatim reverse/forward geocoding
│   │   └── notifications.py  # Expo Push API — notify users near new outages
│   ├── tests/
│   └── Dockerfile
│
├── scraper/               # ANDE data scraper
│   ├── ande_parser.py     # Planned outages (ANDE website)
│   ├── consultas_parser.py# Emergency outages (consultas.ande.gov.py) — WIP
│   ├── processor.py       # Normalize, geocode, save to DB + 7-day cleanup
│   ├── main.py            # APScheduler entry point
│   └── Dockerfile
│
├── mobile/                # React Native (Expo) app
│   ├── app/
│   │   ├── (tabs)/        # Main tab screens
│   │   │   ├── index.tsx  # Map with outage markers
│   │   │   ├── list.tsx   # Outage list
│   │   │   ├── reports.tsx# Report an outage
│   │   │   └── settings.tsx# Subscriptions, NIS
│   │   ├── outage/[id].tsx# Official outage detail
│   │   └── report/[id].tsx# User report detail
│   └── src/
│       ├── api/           # Axios client + TypeScript types
│       ├── components/    # OutageCard
│       ├── constants/     # Feature toggles (features.ts)
│       ├── hooks/         # useDeviceSetup (push token + location registration)
│       ├── theme/         # Colors, spacing, typography
│       └── utils/         # Shared utilities
│
└── docker-compose.yml     # db + backend + scraper
```

---

## Running Locally

### Prerequisites

- Docker + Docker Compose
- Node.js 18+ and npm
- Expo Go app (for mobile testing) or iOS Simulator / Android Emulator

### 1. Start backend + database + scraper

```bash
docker-compose up --build
```

Services:
- **PostgreSQL** — `localhost:5432` (user: `luz`, pass: `luz`, db: `luzpy`)
- **Backend API** — `http://localhost:8000` (Swagger docs at `/docs`)
- **Scraper** — runs immediately on start, then every 60 minutes

### 2. Run the mobile app

```bash
cd mobile
npm install
npx expo start --ios      # iOS Simulator
npx expo start --android  # Android Emulator
```

### 3. Connect to the database directly

```bash
docker exec -it luzpy_db psql -U luz -d luzpy
```

---

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/outages/` | List outages (filter by status, barrio, radius) |
| `GET` | `/outages/{id}` | Outage detail |
| `POST` | `/reports/` | Submit a user outage report |
| `GET` | `/reports/` | Active user reports (optionally by radius) |
| `GET` | `/reports/{id}` | Report detail |
| `POST` | `/users/` | Register device |
| `POST` | `/subscriptions/` | Subscribe to a barrio or feeder |
| `DELETE` | `/subscriptions/{id}` | Unsubscribe |

---

## Feature Flags

Located in `mobile/src/constants/features.ts`:

```typescript
export const FEATURES = {
  WHATSAPP_ANDE_BOT: false, // Enable after beta — requires confirmed bot number
};
```

---

## Roadmap

- [x] Push notifications (Expo Push / FCM / APNs)
- [ ] Emergency outage API (`consultas.ande.gov.py`)
- [ ] NIS → feeder number mapping
- [ ] PDF parsing for ANDE outage documents
- [ ] App Store / Google Play release

---

## License

Private repository. All rights reserved.
