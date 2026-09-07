# Build React with Vite (compile only — not the runtime server)
FROM docker.io/library/node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Runtime: nginx serves static files + proxies /api → backend
FROM docker.io/library/nginx:1.27-alpine

# Replace default config completely
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Writable paths for rootless / restricted environments
RUN mkdir -p /tmp/client_temp /tmp/proxy_temp /tmp/fastcgi_temp /tmp/uwsgi_temp /tmp/scgi_temp \
    && chmod -R 777 /tmp /var/cache/nginx /var/run \
    && touch /tmp/error.log /tmp/access.log \
    && chmod 666 /tmp/error.log /tmp/access.log

# Listen on 8080 so non-root can bind if the process drops privileges
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
