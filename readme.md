# WebAtt Absen SPA

Mobile-first attendance screen built with Vue 2 + Vue Material. The UI mirrors the Material 3-inspired mock and can be dropped into a Nuxt-based PWA later.

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:5173 to preview the SPA.

### Build

```bash
npm run build
npm run preview
```

### Hosting under a subfolder

Set the base path before building so all asset URLs use the same subfolder:

```bash
VITE_BASE_PATH=/absensi/ npm run build
```

The value must include a trailing slash (e.g., `/app/`). Leave it empty to default to `/`.

With Docker Compose you can provide the same value via an `.env` file or inline:

```bash
APP_BASE_PATH=/absensi/ docker compose up --build
```

## Features

- Sticky app bar with live WITA clock and drawer toggle
- Primary CTA card that confirms, grabs geolocation, and queues offline entries
- Snackbar feedback plus offline banner and auto-sync when connection returns
- Attendance list with per-item overflow menu
- Navigation drawer and stub pages for Riwayat & Pengaturan

## Structure Highlights

- `src/App.vue` – Shell (app bar, drawer, snackbar, offline banner)
- `src/pages/HomeAbsen.vue` – Absen screen logic and CTA flow
- `src/components` – UI building blocks (app bar, drawer, CTA card, list, dialog)
- `src/store/attendance.js` – In-memory store with offline queue + sync mock

Material Icons are loaded via Google Fonts; styling sticks to Vue Material tokens with light utility CSS. All copy is Indonesian by default. 
