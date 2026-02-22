# Deployment Guide — Zombie Survival

Everything runs in Docker. You need **Docker** and **Docker Compose** installed on the server.

## Quick Start

```bash
git clone https://github.com/kamekazz/js-games.git
cd js-games
```

Create a `.env` file in the project root:

```env
DJANGO_SECRET_KEY=your-random-secret-key-here
DJANGO_ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
CSRF_TRUSTED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
POSTGRES_DB=jsgames
POSTGRES_USER=jsgames
POSTGRES_PASSWORD=choose-a-strong-password
```

Then run:

```bash
docker compose up -d --build
```

The app will be available on **port 80**.

That's it. Everything else (database migrations, static files, Redis, Nginx) is handled automatically by the containers on startup.

---

## What Gets Created

| Container | What it does |
|-----------|-------------|
| **client** (Nginx) | Serves the frontend on port 80, proxies `/api/` and `/ws/` to Django |
| **django** (Daphne) | Backend API + WebSocket server on port 8000 (internal only) |
| **postgres** | PostgreSQL 16 database, data persisted in a Docker volume |
| **redis** | Redis 7 for real-time WebSocket communication between players |

## Environment Variables

| Variable | Required | Example |
|----------|----------|---------|
| `DJANGO_SECRET_KEY` | Yes | Any long random string (50+ chars). Generate one with `python -c "import secrets; print(secrets.token_urlsafe(64))"` |
| `DJANGO_ALLOWED_HOSTS` | Yes | Comma-separated hostnames: `yourdomain.com,www.yourdomain.com` |
| `CORS_ALLOWED_ORIGINS` | Yes | Full URLs with protocol: `https://yourdomain.com` |
| `CSRF_TRUSTED_ORIGINS` | Yes | Same as CORS: `https://yourdomain.com` |
| `POSTGRES_DB` | No | Default: `jsgames` |
| `POSTGRES_USER` | No | Default: `jsgames` |
| `POSTGRES_PASSWORD` | Yes | Choose a strong password |

## HTTPS / SSL

The app serves on port 80 (HTTP). To add HTTPS, put a reverse proxy in front (e.g., Caddy, Traefik, or Nginx with Certbot). Example with Caddy:

```
yourdomain.com {
    reverse_proxy localhost:80
}
```

Caddy handles SSL certificates automatically. Make sure your `.env` origins use `https://`.

## Updating

```bash
cd js-games
git pull
docker compose up -d --build
```

The Django container automatically runs database migrations on startup, so no manual steps needed.

## Useful Commands

```bash
# View logs
docker compose logs -f

# View logs for a specific service
docker compose logs -f django

# Restart everything
docker compose restart

# Stop everything
docker compose down

# Stop and wipe the database (start fresh)
docker compose down -v

# Create a Django admin user
docker compose exec django python manage.py createsuperuser
```

## Ports

Only **port 80** needs to be open on the server. All other communication (Django, PostgreSQL, Redis) stays internal to Docker.

If port 80 is already in use, change it in `docker-compose.yml` under the client service:

```yaml
ports:
  - "8080:80"  # change 8080 to whatever you want
```
