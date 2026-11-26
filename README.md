# Planner

A private bilingual personal planner hosted on Sites. Desktop uses a persistent project-entry sidebar and a calendar/timeline tab; screens at least 1800 px show both panels. Mobile uses bottom navigation.

## Data

Hosted records use a D1 document per authenticated Sites user, with revision checks to prevent stale device writes. The preview API explicitly enters browser-local preview mode. Demo records are labeled and can be cleared. Calendar dates are date-only local values; event times are local wall times. The UI refreshes cloud data every 30 seconds and on focus when no changes are pending.

## Development

- npm install
- npm run dev (use the managed sites-preview daemon in Codex Cloud)
- npm run db:generate after schema changes
- npm run build

The build embeds client assets into dist/server/index.js and copies the hosting manifest and Drizzle migrations into dist. Hosting identity is tracked in .openai/hosting.json. Authentication remains Sites-owned.

## Mobile

Responsive web app with a web manifest and service worker. Supports browser installation / Add to Home Screen. Online access is required for cloud data; the service worker does not cache private records.
