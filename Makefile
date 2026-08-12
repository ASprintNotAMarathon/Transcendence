COMPOSE := docker compose

.DEFAULT_GOAL := help
.PHONY: help up down logs ps psql clean fclean re check-env

help:	## Show available targets
	@grep -E '^[a-z-]+:.*##' $(MAKEFILE_LIST) | sed 's/:.*##/\t/'

.env:
	@cp .env.example .env
	@echo ".env created from .env.example - set a real password before running again"
	@exit 1

check-env: .env
	@! grep -q '^POSTGRES_PASSWORD=changeme$$' .env \
		|| { echo ".env: POSTGRES_PASSWORD is still the placeholder"; exit 1; }
	@grep -qE '^POSTGRES_PASSWORD=[A-Za-z0-9._~-]+$$' .env \
		|| { echo ".env: POSTGRES_PASSWORD must match [A-Za-z0-9._~-]+ - openssl rand -hex 24"; exit 1; }
	@. ./.env && echo "$$DATABASE_URL" | grep -q ":$$POSTGRES_PASSWORD@" \
		|| { echo ".env: DATABASE_URL password differs from POSTGRES_PASSWORD"; exit 1; }
	

up: check-env	## Start everything
	$(COMPOSE) up -d --build

down:	## Stop, keep data
	$(COMPOSE) down

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