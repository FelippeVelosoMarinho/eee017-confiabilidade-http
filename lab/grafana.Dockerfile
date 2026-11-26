# Compila o plugin e instala no Grafana.
FROM node:24-bookworm-slim AS plugin
WORKDIR /src
COPY ufmg-reliability-app/package.json ufmg-reliability-app/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY ufmg-reliability-app/ ./
RUN npm run build

FROM grafana/grafana-enterprise:13.2.4
COPY --from=plugin /src/dist /var/lib/grafana/plugins/ufmg-reliability-app
ENV GF_DEFAULT_APP_MODE=development \
    GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=ufmg-reliability-app \
    GF_AUTH_ANONYMOUS_ENABLED=true \
    GF_AUTH_ANONYMOUS_ORG_ROLE=Admin \
    GF_AUTH_BASIC_ENABLED=false
