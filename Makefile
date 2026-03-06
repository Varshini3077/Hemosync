.PHONY: dev build test lint typecheck clean seed deploy-staging deploy-production \
        infra-deploy infra-validate health docker-up docker-down help

# Default target
.DEFAULT_GOAL := help

# Variables
AZURE_RG ?= hemosync-rg
AZURE_LOCATION ?= centralindia
ENV ?= dev

##@ Development

dev: docker-up ## Start all services + local dev servers
	pnpm turbo run dev --parallel

build: ## Build all packages and apps
	pnpm turbo run build

clean: ## Remove all build artifacts and node_modules
	pnpm turbo run clean
	rm -rf node_modules .turbo

install: ## Install all dependencies
	pnpm install

##@ Testing

test: ## Run all unit tests
	pnpm turbo run test

test-integration: docker-up ## Run integration tests (requires Docker)
	pnpm turbo run test:integration

test-e2e: build docker-up ## Run end-to-end Playwright tests
	cd tests/e2e && pnpm exec playwright test

##@ Code Quality

lint: ## Run ESLint across all packages
	pnpm turbo run lint

typecheck: ## Run TypeScript type checking across all packages
	pnpm turbo run typecheck

format: ## Format all files with Prettier
	pnpm prettier --write "**/*.{ts,tsx,js,jsx,json,md,yaml,yml}"

format-check: ## Check formatting without writing
	pnpm prettier --check "**/*.{ts,tsx,js,jsx,json,md,yaml,yml}"

##@ Database

seed: docker-up ## Seed local PostgreSQL + Cosmos emulator with dev data
	pnpm tsx scripts/seed-postgres.ts
	pnpm tsx scripts/seed-cosmos.ts

migrate: ## Run pending PostgreSQL migrations
	@for f in db/migrations/*.sql; do \
		echo "Applying $$f..."; \
		PGPASSWORD=hemosync_dev psql -h localhost -U hemosync -d hemosync_audit -f $$f; \
	done

##@ Docker

docker-up: ## Start local Docker services (PostgreSQL, Redis, Azurite)
	docker compose up -d
	@echo "Waiting for services to be healthy..."
	@docker compose wait postgres redis azurite 2>/dev/null || sleep 5
	@echo "Services ready."

docker-down: ## Stop local Docker services
	docker compose down

docker-reset: ## Stop services and delete all local data volumes
	docker compose down -v

##@ Infrastructure

infra-validate: ## Validate Bicep templates for target environment
	az bicep build --file infra/main.bicep
	az deployment group validate \
		--resource-group $(AZURE_RG) \
		--template-file infra/main.bicep \
		--parameters infra/parameters/$(ENV).bicepparam

infra-deploy: ## Deploy Bicep infrastructure (ENV=dev|staging|production)
	az deployment group create \
		--resource-group $(AZURE_RG) \
		--template-file infra/main.bicep \
		--parameters infra/parameters/$(ENV).bicepparam \
		--name hemosync-$(ENV)-$(shell date +%Y%m%d%H%M%S)

##@ Deployment

deploy-staging: build ## Deploy to Azure staging slot
	gh workflow run deploy-staging.yml

deploy-production: build ## Deploy to Azure production (requires tagged release)
	@echo "Production deployment is triggered by git tags. Run: git tag v<version> && git push --tags"

##@ Utilities

health: ## Check health of all Azure Functions
	pnpm tsx scripts/health-check.ts

embed-token: ## Generate a dev Power BI embed token
	pnpm tsx scripts/generate-embed-token.ts

smoke-test: ## Run end-to-end broadcast smoke test
	pnpm tsx scripts/test-broadcast.ts

##@ Help

help: ## Show this help message
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_0-9-]+:.*?##/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)
