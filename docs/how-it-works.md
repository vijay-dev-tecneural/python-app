# How this app works (learning guide)

Plain-language walkthrough of page load, todo clicks, nginx reverse proxy, and how the same idea maps to Kubernetes. Complements [`architecture.md`](architecture.md).

---

## 1. The four pieces

| Piece | Role |
|-------|------|
| **React** | UI that runs **in the browser** after JS is downloaded |
| **nginx** | Serves static HTML/JS/CSS and **reverse-proxies** `/api` to FastAPI |
| **FastAPI** | REST API (create/list/update/delete todos) |
| **PostgreSQL** | Stores todo rows |

React never talks to the database. Only FastAPI does.

---

## 2. Proxy vs reverse proxy

### Proxy (general word)

A **proxy** is a middleman: it receives a request, talks to another system, and returns the answer.

### Forward proxy (not used here)

Sits in front of **users** going out to the internet:

```text
Browser → company proxy → google.com
```

### Reverse proxy (what we use)

Sits in front of **your servers**. Clients only talk to the reverse proxy; it chooses which app handles the request:

```text
Browser → reverse proxy (nginx) → FastAPI / static files
```

In Docker/K8s docs, when people say “proxy `/api`”, they almost always mean **reverse proxy**.

### Why reverse-proxy `/api`?

1. Browser uses **one origin** (e.g. `localhost:3000`) for UI + API → less CORS pain  
2. Backend hostname (`backend:8000`) stays **internal**  
3. React can call simple relative URLs: `fetch('/api/todos')`  
4. In Kubernetes, Services + Ingress scale the same pattern  

---

## 3. When you open http://localhost:3000

This is **loading the website** (static files). The full todo API path comes next, but first the UI must boot.

```text
You open :3000
        │
        ▼
   nginx (frontend)
        │  GET /
        ▼
   index.html
        │
        ▼
   Browser sees <script src="/assets/....js">
        │  GET /assets/....js
        ▼
   nginx sends JS + CSS (built by Vite)
        │
        ▼
   Browser RUNS the JS
        │
        ▼
   React mounts into <div id="root">
   UI appears (form, list shell)
```

### Important facts

- **nginx does not “run React”.** It only serves files.  
- **React runs in the browser.**  
- Vite was used **at image build time** to turn `src/*.jsx` into `dist/` (HTML/JS/CSS). At runtime you only need those files + nginx.

After React starts, the app usually also calls:

```text
GET /api/health
GET /api/todos
```

to fill the list — those use the reverse-proxy path described below.

---

## 4. When you click a todo (checkbox)

The page does **not** fully reload. React is already running; it sends a small HTTP request.

```text
Click checkbox
        │
        ▼
   React: toggleTodo()
   fetch('PATCH /api/todos/1', { completed: true })
        │
        ▼
   Browser → http://localhost:3000/api/todos/1
        │
        ▼
   nginx sees /api/  →  reverse proxy
   proxy_pass http://backend:8000/api/
        │
        ▼
   FastAPI updates Postgres
   returns JSON { id, title, completed, ... }
        │
        ▼
   nginx returns JSON to browser
        │
        ▼
   React setTodos(...)  →  re-renders list
   (strikethrough / checked state)
```

### “How does data load into the static website?”

It does **not** rewrite HTML files on disk.

| Layer | What happens |
|-------|----------------|
| Static site | HTML/JS/CSS served once (or cached) |
| Todo data | JSON in **React state** (browser memory) |
| Screen update | React re-renders the list from that state |

```text
Postgres → FastAPI → JSON → browser memory (React) → pixels on screen
```

---

## 5. Where is the proxy code? (Compose / Docker)

| File | Role |
|------|------|
| **`frontend/nginx.conf`** | **The reverse proxy** — `location /api/` + `proxy_pass` |
| `frontend/Dockerfile` | Builds React with Vite, runs nginx with that config |
| `docker-compose.yml` | Maps host `3000` → container `8080`; service name `backend` |
| `frontend/src/App.jsx` | Only `fetch('/api/...')` — **no** proxy logic |
| `frontend/vite.config.js` | Proxy only for local `npm run dev` (port 5173) |
| `frontend/server.mjs` | Old Node proxy; Docker uses nginx now |

Core snippet:

```nginx
location /api/ {
    proxy_pass http://backend:8000/api/;
}
```

---

## 6. What does `proxy_pass http://backend:8000` mean?

**Yes — it reaches the backend service.**

| Part | Meaning |
|------|---------|
| `backend` | Hostname = service name `backend` (Compose **or** Kubernetes Service) |
| `8000` | Port exposed by that service |
| `/api/` | Path sent to FastAPI |

### Docker Compose

```text
nginx container → DNS name "backend" → backend container
```

### Kubernetes

```text
nginx Pod
  → DNS name "backend"
  → Service/backend (ClusterIP)
  → one FastAPI Pod (load balanced)
```

So:

- **`backend` is a Service name**, not a random Pod IP  
- The browser never has to know about `backend`  
- If backend Pods restart and get new IPs, the Service name still works  

It is **not** Postgres (`db` is a different service name).

---

## 7. Same click on Kubernetes (Pods are separate)

React and the browser behave the **same**. Only the network inside the cluster changes.

```text
Browser (your machine)
  → one public URL (Ingress host or port-forward to frontend)
  → Service/frontend → nginx Pod
       → proxy_pass http://backend:8000
       → Service/backend → FastAPI Pod
            → Service/db → Postgres Pod
  → JSON back the same path
  → React updates UI
```

### Local Compose vs Kubernetes

| Step | Compose | Kubernetes |
|------|---------|------------|
| Open UI | `:3000` → frontend container | Ingress or `port-forward svc/frontend` → nginx Pod |
| Static files | nginx in that container | nginx in frontend Pod(s) |
| Click todo | Browser → `:3000/api/...` | Browser → same public host `/api/...` |
| Who gets `/api` first | frontend nginx | frontend nginx Pod |
| What is `backend`? | Compose DNS → one container | K8s Service → one of N FastAPI Pods |
| What is `db`? | Compose DNS | K8s Service `db` |
| React update | Browser memory | Same |

**Pod separation does not change the browser.** It only changes how names resolve and how traffic is load-balanced **inside** the cluster.

### Two reverse-proxy layers (with Ingress)

```text
Internet / laptop
    → Ingress controller     # reverse proxy #1 (edge → frontend)
       → Service/frontend → nginx Pod
          → /api → Service/backend   # reverse proxy #2 (app)
             → FastAPI Pod
```

---

## 8. Where is this in Kubernetes YAML?

Folder: **`k8s/`**

| File | What you’ll see |
|------|-----------------|
| **`k8s/frontend.yaml`** | ConfigMap with `nginx.conf` including **`proxy_pass http://backend:8000`**; Deployment + Service `frontend` |
| **`k8s/backend.yaml`** | Deployment + Service named **`backend`** (what nginx calls) |
| **`k8s/postgres.yaml`** | Deployment + Service named **`db`**; Secret with `DATABASE_URL` |
| **`k8s/ingress.yaml`** | Edge rule: public host → Service `frontend` |
| **`k8s/namespace.yaml`** | Namespace `reactapp` |
| **`k8s/README.md`** | How to apply later |

**Search for proxy in YAML:** open `k8s/frontend.yaml` and find `location /api/` / `proxy_pass`.

Todo **business logic** is not in YAML — it stays in `backend/app/main.py`. YAML only wires Pods and Services.

Click path mapped to YAML:

```text
Browser
  → ingress.yaml              (optional)
  → frontend.yaml Service/Deployment
  → frontend.yaml ConfigMap   ← proxy_pass backend
  → backend.yaml Service/Deployment
  → postgres.yaml Service/Deployment
```

---

## 9. Timeline summary

```text
t=0  Open :3000 (or K8s frontend URL)
     → nginx serves HTML/JS (static)

t=1  Browser runs React
     → optional GET /api/todos (fill list via reverse proxy)

t=2  You click a todo
     → PATCH /api/todos/{id}
     → nginx → backend Service → FastAPI → Postgres

t=3  JSON returns
     → React updates state and re-renders
     → no full page reload
```

---

## 10. One-sentence mental models

- **Static site:** nginx gives the browser files; the browser runs React.  
- **Todo click:** React `fetch`es `/api/...` on the same host; nginx reverse-proxies to the **backend Service**; FastAPI uses the **db Service**; JSON updates React state.  
- **`proxy_pass http://backend:8000`:** send this request to the service named `backend` on port 8000.  
- **Kubernetes:** same browser story; Services replace fixed container IPs so many Pods can come and go.

---

## Related docs

| Doc | Content |
|-----|---------|
| [`architecture.md`](architecture.md) | Diagrams, API table, file map |
| [`../k8s/README.md`](../k8s/README.md) | Apply K8s manifests (when you choose to) |
| [`../README.md`](../README.md) | How to run Compose / local dev |
