# Stage 1: build the web app. Same steps and order as apps/web/Dockerfile,
# so Docker reuses the cached `npm ci` from there.
FROM node:24-slim AS web-build

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

COPY shared/tsconfig.json shared/tsconfig.build.json shared/
COPY shared/src shared/src

COPY apps/api/prisma.config.ts apps/api/
COPY apps/api/prisma apps/api/prisma

RUN npm ci

COPY apps/web apps/web
RUN npm run build --workspace @transcendence/web

# Stage 2: nginx with a self-signed certificate for https://localhost.
# Only the built files are copied over; node and node_modules stay behind.
FROM nginx:alpine

# First, so it stays cached: anything copied in below changes on every
# frontend edit, and a step after it would make a new certificate each time,
# which the browser asks you to accept again.
RUN apk add --no-cache openssl \
	&& mkdir -p /etc/nginx/certs \
	&& openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
		-keyout /etc/nginx/certs/localhost.key \
		-out /etc/nginx/certs/localhost.crt \
		-subj "/CN=localhost" \
		-addext "subjectAltName=DNS:localhost,IP:127.0.0.1" \
	&& cp /etc/nginx/certs/localhost.crt /usr/local/share/ca-certificates/localhost.crt \
	&& update-ca-certificates \
	&& apk del openssl

# The image fills in ${VARS} in *.template files when the container starts.
# By default it writes the result into conf.d/; this makes it write
# /etc/nginx/nginx.conf, the main config.
ENV NGINX_ENVSUBST_OUTPUT_DIR=/etc/nginx
COPY nginx/nginx.conf.template /etc/nginx/templates/nginx.conf.template
COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html

