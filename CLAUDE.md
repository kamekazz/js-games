# Zombie Survival - Multiplayer Top-Down Shooter

## Project Overview

Multiplayer top-down twin-stick zombie survival game with wave-based mechanics. Up to 4 players per room. Server-authoritative architecture with real-time WebSocket synchronization.

## Tech Stack

- **Frontend:** Vanilla JavaScript (ES6+ modules), Three.js, Vite, NippleJS (mobile joysticks)
- **Backend:** Django, Django REST Framework, Django Channels (WebSockets), Daphne (ASGI)
- **Database:** SQLite (dev), PostgreSQL (prod)
- **Infra:** Redis (channel layer), Docker, Nginx (prod reverse proxy)

## Project Structure

```
client/                   # Frontend
  engine/                 # Core engine (ECS, input, networking, rendering, audio)
  game/                   # Game-specific ECS components, entities, systems
  scenes/                 # Scene management (Auth, Menu, Lobby, Game)
  ui/                     # HUD, joysticks, menus, scoreboard
  styles/                 # CSS
  main.js                 # Entry point
server/                   # Backend (Django)
  config/                 # Django settings, ASGI/WSGI, URL routing
  apps/accounts/          # Authentication
  apps/lobby/             # Room management REST API
  apps/game/              # WebSocket consumer, game state, zombie AI
shared/                   # Constants and message types shared between client/server
```

## Architecture

**Entity-Component-System (ECS):** Entities are collections of components; systems operate on entities matching component queries; World manages the lifecycle.

**Networking:** Client sends inputs → server processes authoritatively (20 Hz tick rate) → server broadcasts state → client interpolates via StateBuffer.

**Scene Flow:** Auth → MainMenu → Lobby → Game → Results

## Development

```bash
# Backend
cd server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver          # http://localhost:8000

# Frontend (separate terminal)
cd client
npm install
npm run dev                         # http://localhost:5173

# Docker (dev)
docker-compose -f docker-compose.dev.yml up
```

## Build

```bash
cd client && npm run build          # Production bundle in dist/
docker-compose up                   # Full production stack
```

## Conventions

- **Language:** Pure JavaScript — no TypeScript
- **Classes:** PascalCase, one class per file, filename matches class name
- **Functions/variables:** camelCase
- **Constants:** SCREAMING_SNAKE_CASE (in `shared/constants.js`)
- **Private members:** Underscore prefix (`_setup()`, `_keys`)
- **Modules:** ES6 `import`/`export`; prefer `const`/`let` over `var`
- **Path aliases:** `@engine`, `@game`, `@ui`, `@shared` (configured in `vite.config.js`)
- **Patterns:** Singleton managers, Factory for entity creation, Observer for network events

## Key Constants (shared/constants.js)

- `TICK_RATE = 20` (server Hz)
- `WORLD_SIZE = 100`
- `PLAYER_SPEED = 12`
- `TILE_SIZE = 2`

## Testing

No automated test suite. Manual testing via browser (desktop + mobile).
