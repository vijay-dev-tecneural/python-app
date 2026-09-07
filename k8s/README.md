# Kubernetes manifests (not applied by default)

Maps the Compose stack onto **Pods + Services + Ingress**.

```
Client
  → Ingress (optional) or NodePort
    → Service/frontend :80
      → Pod(s) nginx :8080
           ├─ static React (Vite build)
           └─ /api/*  proxy_pass → Service/backend :8000
                → Pod(s) FastAPI
                     → Service/db :5432
                          → Pod Postgres + PVC
```

## Files

| File | What |
|------|------|
| `namespace.yaml` | Namespace `reactapp` |
| `postgres.yaml` | Secret, PVC, Deployment, Service `db` |
| `backend.yaml` | Deployment + Service `backend` |
| `frontend.yaml` | ConfigMap (nginx proxy), Deployment, Service `frontend` |
| `ingress.yaml` | Ingress → `frontend` |
| `kustomization.yaml` | `kubectl apply -k k8s/` |

## Service names = DNS (how proxy works)

Inside the cluster, Kubernetes DNS gives each Service a name:

| Service | Port | Used by |
|---------|------|---------|
| `db` | 5432 | backend `DATABASE_URL=...@db:5432/...` |
| `backend` | 8000 | nginx `proxy_pass http://backend:8000/api/;` |
| `frontend` | 80 | Ingress / external entry |

Same idea as Compose service names.

## Build images first

Images are `reactapp-backend:latest` and `reactapp-frontend:latest` (local tags).

```bash
# example with podman
podman build -t reactapp-backend:latest ./backend
podman build -t reactapp-frontend:latest ./frontend

# kind
kind load docker-image reactapp-backend:latest reactapp-frontend:latest

# minikube
minikube image load reactapp-backend:latest
minikube image load reactapp-frontend:latest

# or push to a registry and edit image: in backend.yaml / frontend.yaml
```

## Apply (when you want to run)

```bash
kubectl apply -k k8s/
# or
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml
kubectl apply -f k8s/ingress.yaml
```

Check:

```bash
kubectl -n reactapp get pods,svc,ingress
kubectl -n reactapp logs -l app=backend
kubectl -n reactapp port-forward svc/frontend 3000:80
# then open http://localhost:3000
```

## Proxy layers (two levels)

1. **In-pod nginx** (`frontend` ConfigMap / image): `/api` → `backend` Service  
2. **Cluster Ingress** (optional): public host → `frontend` Service only  

Clients only need the Ingress (or port-forward to `frontend`); they never talk to `backend` or `db` directly.

## Notes

- Demo DB password is in plain Secret — change for real use.
- Postgres is a single replica + PVC (fine for demo; use an operator/managed DB in production).
- Set `ingressClassName` / host in `ingress.yaml` for your cluster.
- SELinux / rootless local clusters may still need image tweaks; these YAMLs are standard cluster-oriented.
