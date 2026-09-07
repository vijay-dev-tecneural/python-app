# Architecture & request flow

This document explains how the React frontend, nginx reverse proxy, FastAPI backend, and PostgreSQL work together — in Docker Compose and (optionally) Kubernetes.

## Components

| Piece | Role |
|-------|------|
| **React (Vite)** | UI in the browser. Built to static files (`dist/`). |
| **nginx** | Serves those static files and **reverse-proxies** `/api` to FastAPI. |
| **FastAPI** | REST API; talks to the database. |
| **PostgreSQL** | Stores todos. |

React never talks to Postgres. It only calls HTTP APIs. FastAPI owns the database.

---

## Big picture (Compose / Podman)

```
Browser (you)
    │
    │  http://localhost:3000
    ▼
┌─────────────────────────────┐     container network      ┌──────────────────┐      ┌──────────┐
│  frontend                   │  ───────────────────────►  │  backend FastAPI │ ───► │ Postgres │
│  nginx                      │   /api/* → backend:8000    │  :8000           │      │  :5432   │
│  • static React (dist/)     │                            │                  │      │          │
│  • reverse proxy /api       │                            │                  │      │          │
└─────────────────────────────┘                            └──────────────────┘      └──────────┘
```

| Container | Host port | Internal |
|-----------|-----------|----------|
| frontend (nginx) | **3000** | 8080 |
| backend (FastAPI) | **8000** | 8000 |
| db (Postgres) | **5432** | 5432 |

For normal UI use you only need **http://localhost:3000**. Port 8000 is optional (Swagger at `/docs`).

---

## Proxy vs reverse proxy

### Proxy (general)

A **proxy** is a middleman: it receives a request, talks to another system, and returns the response.

### Forward proxy (not used here)

Sits in front of **clients** going out to the internet:

```
Browser → company proxy → internet
```

### Reverse proxy (what this project uses)

Sits in front of **your servers**. Clients only talk to the reverse proxy; it routes to the right backend:

```
Browser → reverse proxy (nginx) → FastAPI / static files / …
```

In web and container docs, when people say “proxy `/api`”, they almost always mean **reverse proxy**.

### Why reverse-proxy `/api`?

1. **One origin** — browser uses `localhost:3000` for both UI and API (no CORS pain).
2. **Hide internals** — browser does not need to know `backend:8000` or Postgres.
3. **Stable frontend code** — React calls relative URLs like `/api/todos`.
4. **In Kubernetes** — Services + Ingress continue the same pattern at cluster scale.

---

## Where the reverse-proxy code lives

### Docker / Podman (runtime on port 3000)

**File:** [`frontend/nginx.conf`](../frontend/nginx.conf)

```nginx
location /api/ {
    proxy_pass http://backend:8000/api/;
    proxy_set_header Host $host;
    # ...
}
```

| Directive | Meaning |
|-----------|---------|
| `location /api/` | Only URLs starting with `/api/` |
| `proxy_pass http://backend:8000/api/` | Forward to the FastAPI container/service named `backend` |
| `proxy_set_header ...` | Pass Host / client IP / scheme to the backend |

Static React files:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

**Dockerfile** ([`frontend/Dockerfile`](../frontend/Dockerfile)):

1. Build React with Vite → `dist/`
2. Copy `dist/` + `nginx.conf` into an nginx image
3. nginx is the process that runs at runtime

### Local Vite dev only (`npm run dev`, port 5173)

**File:** [`frontend/vite.config.js`](../frontend/vite.config.js)

```js
proxy: {
  '/api': {
    target: 'http://localhost:8000',
    changeOrigin: true,
  },
}
```

Same idea as nginx, but only while developing with Vite. **Not** used when you open Compose on port 3000.

### Historical / unused in Docker

[`frontend/server.mjs`](../frontend/server.mjs) — old Node static server + proxy. Docker now uses nginx instead.

### React does **not** implement the proxy

[`frontend/src/App.jsx`](../frontend/src/App.jsx) only does:

```js
fetch('/api/todos')
fetch(`/api/todos/${id}`, { method: 'PATCH', body: ... })
```

The browser hits the **same host** as the page; nginx (or Vite in dev) forwards `/api` to FastAPI.

---

## How React “loads” as a static app

### Build time (image build)

```
frontend/src/*.jsx  ── Vite (npm run build) ──►  dist/
                                                   index.html
                                                   assets/*.js
                                                   assets/*.css
```

### Runtime (browser opens :3000)

1. Browser `GET /` → nginx serves `index.html`
2. Browser loads `/assets/….js` and CSS (static files from nginx)
3. JS runs **in the browser** and mounts React into `<div id="root">`
4. React calls `fetch('/api/...')` for data
5. Those `/api` requests are reverse-proxied to FastAPI

nginx does **not** run React. The browser runs React after downloading the JS bundle.

---

## End-to-end: click a todo checkbox

```
1. User clicks checkbox in React UI
2. App.jsx → toggleTodo() → fetch('PATCH /api/todos/1', { completed: true })
3. Browser sends request to http://localhost:3000/api/todos/1
4. nginx matches location /api/ and reverse-proxies to http://backend:8000/api/todos/1
5. FastAPI updates Postgres and returns JSON
6. nginx returns that JSON to the browser
7. React setState() updates the list and re-renders
```

---

## API surface (FastAPI)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health + DB check |
| GET | `/api/todos` | List todos |
| POST | `/api/todos` | Create `{ "title": "..." }` |
| PATCH | `/api/todos/{id}` | Update title / completed |
| DELETE | `/api/todos/{id}` | Delete |

Swagger UI (when backend port is exposed): http://localhost:8000/docs  

Through nginx (same origin as UI): http://localhost:3000/docs  

---

## Kubernetes (optional)

Manifests live in [`k8s/`](../k8s/). They are **not** applied automatically.

```
Client
  → Ingress (optional reverse proxy at the edge)
    → Service/frontend
      → Pod nginx
           /          → static React
           /api/*     → reverse proxy → Service/backend → FastAPI pods
                                              → Service/db → Postgres
```

| Compose name | Kubernetes Service DNS |
|--------------|------------------------|
| `backend` | `backend` (same namespace) |
| `db` | `db` |
| `frontend` | `frontend` |

In-cluster nginx proxy config is also in ConfigMap `frontend-nginx` in [`k8s/frontend.yaml`](../k8s/frontend.yaml) (`proxy_pass http://backend:8000/api/`).

See [`k8s/README.md`](../k8s/README.md) for apply notes.

---

## Mental model (one paragraph)

**Vite** builds React into static files. **nginx** serves those files and **reverse-proxies** any path under `/api` to **FastAPI**. FastAPI reads/writes **Postgres**. The browser only needs the frontend entry (port 3000 or an Ingress host). “Proxy” here means reverse proxy: a server-side middleman in front of your API, not a corporate outbound proxy.

---

## Deeper learning guide

Step-by-step explanations (page load, click todo, `proxy_pass` → Service, K8s Pods, where to look in YAML):

→ **[`how-it-works.md`](how-it-works.md)**
