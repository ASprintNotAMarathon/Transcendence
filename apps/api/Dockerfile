# Development image for the api.

# Docker saves the result of each step and reuses it on the next build only if that step and everything
# above it is unchanged. As soon as one step changes, everything below it gets rebuilt.
FROM node:24-slim

WORKDIR /app

# node:24-slim has no libssl. Node doesn't need it, but Prisma probably links against it, so it has to be here
# before Kimia's ORM lands
RUN apt-get update \
	&& apt-get install -y --no-install-recommends openssl ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

# COPY takes two arguments - it copies source (on our machine) to the destination (inside the image)
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# shared has to go above the 'npm ci' because npm runs shared's 'prepare' script during the install, which compiles it
COPY shared/tsconfig.json shared/tsconfig.build.json shared/
COPY shared/src shared/src

# apps/api's postinstall runs `prisma generate` during the npm ci below, and it
# reads these two. They sit above the install for that reason alone.
COPY apps/api/prisma.config.ts apps/api/
COPY apps/api/prisma apps/api/prisma

# this one is the expensive step - it's 790 packages and lasts cca 26 sec, so everything it needs goes
# above it, and everything that changes, goes below it.
RUN npm ci

# these are the most frequently changed files, if this COPY came before the install(RUN), the Docker
# would reinstall those 790 packages every time we save something new here. Having it in this order makes
# the re-build faster and cheaper
COPY apps/api apps/api

CMD ["npm", "run", "start:dev", "--workspace", "api", "--", "--no-shell"]