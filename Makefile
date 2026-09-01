COMPOSE := docker compose
NPM := npm

.DEFAULT_GOAL := help
.PHONY: help up down logs ps psql clean fclean re check-env \
	install test test-watch typecheck build

help:	## Show available targets
	@grep -E '^[a-z-]+:.*##' $(MAKEFILE_LIST) | sed 's/:.*##/\t/'

.env:
	@cp .env.example .env
	@echo ".env created from .env.example - set a real password before running again"
	@exit 1

check-env: .env
	@! grep -q '^POSTGRES_PASSWORD=changeme$$' .env \
		|| { echo ".env: POSTGRES_PASSWORD is still the placeholder"; exit 1; }
	@! grep -q '^JWT_SECRET=changeme' .env \
		|| { echo ".env: JWT_SECRET is still the placeholder"; exit 1; }
	@grep -qE '^POSTGRES_PASSWORD=[A-Za-z0-9._~-]+$$' .env \
		|| { echo ".env: POSTGRES_PASSWORD must match [A-Za-z0-9._~-]+ - openssl rand -hex 24"; exit 1; }
	@. ./.env && \
		expected="postgresql://$$POSTGRES_USER:$$POSTGRES_PASSWORD@localhost:$$POSTGRES_PORT/$$POSTGRES_DB?schema=public"; \
		[ "$$DATABASE_URL" = "$$expected" ] || { \
			echo ".env: DATABASE_URL does not match the POSTGRES_* variables"; \
			echo "	expected:	$$expected"; \
			echo "	actual:		$$DATABASE_URL"; exit 1; }

up: check-env build	## Start everything
	$(COMPOSE) up -d --build --wait

down:	## Stop and remove the containers, keeping the database
	$(COMPOSE) down
# Anonymous volumes are the node_modules holes, one set per container generation, cca 370MB each.
# They get orphaned by `down` and are never reused.
	@docker volume prune -f --filter label=com.docker.volume.anonymous >/dev/null

logs:	## Follow logs
	$(COMPOSE) logs -f

ps:	## Service status
	$(COMPOSE) ps

psql:	## Open a shell on the database
	@. ./.env && $(COMPOSE) exec db psql -U $$POSTGRES_USER -d $$POSTGRES_DB

clean: down ## Alias for down

fclean:	## Stop AND DELETE THE DATABASE
	@printf "This deletes the database volume. Continue? [y/N] "; read a; [ "$$a" = "y" ] || exit 1
	$(COMPOSE) down -v --remove-orphans

re: fclean up ## Nuke and restart

# A file target, like .env: make builds node_modules/ from the manifests and reinstalls only when one of them is newer.
# So `make test` on an up-to-date clone skips the install, but still works on a fresh one.
# npm doesn't reliably update the directory's timestamp, hence the touch.
node_modules: package.json package-lock.json
	$(NPM) ci
	@touch node_modules

install:	## Install npm dependencies (always runs)
	$(NPM) install
	@touch node_modules

test: node_modules	## Run the game engine tests once
	$(NPM) test

test-watch: node_modules	## Run the game engine tests, rerunning on save
	$(NPM) run test:watch --workspace shared

typecheck: node_modules	## Type-check every workspace
	$(NPM) run typecheck

build: node_modules	## Compile shared/ to dist/
	$(NPM) run build --workspace shared
