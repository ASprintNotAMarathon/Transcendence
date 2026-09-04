# Development image for the web app.

# Same ordering rule as the api's Dockerfile: manifests first, source last

FROM node:24-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

COPY shared/tsconfig.json shared/tsconfig.build.json shared/
COPY shared/src shared/src

RUN npm ci

COPY apps/web apps/web

CMD ["npm","run", "dev", "--workspace", "@transcendence/web", "--", "--host"]