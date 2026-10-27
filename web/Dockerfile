# Finora Web: static files served by Nginx; mount config.json at runtime.
# Build from the repository root (the build reads DESIGN.md):
#   docker build -f web/Dockerfile -t finora-web .
FROM node:24-alpine AS build
WORKDIR /src
RUN corepack enable
COPY DESIGN.md ./DESIGN.md
COPY web/package.json web/pnpm-lock.yaml ./web/
RUN cd web && pnpm install --frozen-lockfile
COPY web ./web
RUN cd web && pnpm build

FROM nginx:1.29-alpine
COPY --from=build /src/web/dist /usr/share/nginx/html
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
