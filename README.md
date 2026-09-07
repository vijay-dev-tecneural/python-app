# FastAPI React Tutorial: Full-Stack Todo App with PostgreSQL (Docker Compose)

**FastAPI + React full-stack tutorial** for students: build a **Todo REST API** in **Python FastAPI**, a **React (Vite)** UI, and **PostgreSQL**, runnable with **Docker Compose**. Includes OpenAPI docs, SQLAlchemy models, and optional Kubernetes manifests.

> **Lab 1** in the [Python learning path](https://github.com/saurabhahuja71/learning-path#2-python--data--apis) · Audience: intermediate beginners · Time: ~1–3 hours · Level: intermediate

## What is this project?

A classic three-tier learning app:

| Service | Tech | Host port |
|---------|------|-----------|
| Frontend | React (Vite) + nginx | **3000** |
| Backend | **Python FastAPI** + Uvicorn | **8000** |
| Database | PostgreSQL 16 | **5432** |

The UI creates, lists, toggles, and deletes todos stored in Postgres.

**People also search:** *FastAPI React tutorial*, *FastAPI PostgreSQL Docker Compose*, *Python full stack todo app*, *FastAPI SQLAlchemy example*, *college FastAPI project*, *React Vite proxy API*.

## What you will learn

- FastAPI routes, Pydantic schemas, dependency injection  
- SQLAlchemy models + Postgres  
- Auto **OpenAPI** docs at `/docs`  
- React frontend talking to a JSON API  
- Multi-container networking with Compose  
- Optional K8s layout under `k8s/`

## Prerequisites

- Docker or Podman Compose **or** Python 3.11+ and Node 18+
- Basic Python and HTTP knowledge
- Lab 0 optional: [python-by-example](https://github.com/saurabhahuja71/python-by-example)

## Quick start (Compose — recommended)

```bash
git clone https://github.com/saurabhahuja71/react-fastapi-todo.git
cd react-fastapi-todo

docker compose up --build
# or: podman compose up --build
```

| URL | Purpose |
|-----|---------|
| http://localhost:3000 | Todo UI |
| http://localhost:8000/docs | Swagger / OpenAPI |
| http://localhost:8000/api/health | Health + DB ping |

Stop:

```bash
docker compose down
docker compose down -v   # also wipe DB volume
```

## Project layout

```text
react-fastapi-todo/
├── frontend/          # React (Vite) + nginx
├── backend/           # FastAPI + SQLAlchemy
│   └── app/main.py models.py schemas.py database.py
├── docker-compose.yml
├── k8s/               # optional Kubernetes
├── docs/how-it-works.md
├── docs/architecture.md
└── .env.example
```

## Run locally (without full stack containers)

### 1. Database

```bash
docker run --name reactapp-db \
  -e POSTGRES_USER=todos \
  -e POSTGRES_PASSWORD=todos \
  -e POSTGRES_DB=todos \
  -p 5432:5432 \
  -d postgres:16-alpine
```

### 2. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL=postgresql://todos:todos@localhost:5432/todos
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

UI: http://localhost:5173 (Vite proxies `/api` → backend).

## REST API overview

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health + DB |
| GET | `/api/todos` | List todos |
| POST | `/api/todos` | Create `{ "title": "..." }` |
| PATCH | `/api/todos/{id}` | Update todo |
| DELETE | `/api/todos/{id}` | Delete todo |

```bash
curl http://localhost:8000/api/health
curl -X POST http://localhost:8000/api/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Learn FastAPI"}'
```

## Environment

| Variable | Where | Default |
|----------|--------|---------|
| `DATABASE_URL` | backend | `postgresql://todos:todos@localhost:5432/todos` |
| `VITE_API_URL` | frontend | empty (same-origin `/api`) |

See `.env.example`. Demo passwords are **not** for production.

## Lab exercises

1. Add a `description` field to Todo (model + schema + UI).  
2. Add pagination to `GET /api/todos`.  
3. Write a pytest for create/list endpoints.  
4. Compare this stack with [grpc-golang-todo](https://github.com/saurabhahuja71/grpc-golang-todo).  
5. Deploy using `k8s/` manifests in a local cluster.

## Deeper docs

- [`docs/how-it-works.md`](docs/how-it-works.md) — request path, proxy, Services  
- [`docs/architecture.md`](docs/architecture.md)  
- [`k8s/README.md`](k8s/README.md)

## Learning path

| # | Lab | Focus |
|---|-----|--------|
| 0 | [python-by-example](https://github.com/saurabhahuja71/python-by-example) | Browser Python |
| **1 (this)** | react-fastapi-todo | Full-stack API |
| 2 | [pets-updates](https://github.com/saurabhahuja71/pets-updates) | Flask product workshop |
| 3–4 | ML labs | pandas / sklearn |

Hub: [learning-path](https://github.com/saurabhahuja71/learning-path)

## FAQ — FastAPI for students

**FastAPI vs Flask?**  
FastAPI gives type hints, validation, and free OpenAPI docs. Flask is simpler and older; both are valuable.

**Why PostgreSQL not SQLite?**  
Closer to real deployments; Compose makes it easy.

**Is CORS open in the sample?**  
Yes (`allow_origins=["*"]`) for demos — tighten for production.

## Topics / SEO tags

`fastapi` `react` `postgresql` `python` `fullstack` `docker-compose` `sqlalchemy` `todo-app` `tutorial` `uvicorn` `college` `rest-api` `openapi`

## Author

[Saurabh Ahuja](https://github.com/saurabhahuja71) · [learning-path](https://github.com/saurabhahuja71/learning-path)

## License

Educational sample. Review dependency licenses before commercial use.
