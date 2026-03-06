// HemoSync Dev environment parameters
// Smaller/cheaper SKUs for rapid iteration during development.
// Deploy: ./infra/deploy.sh dev
using '../main.bicep'

param environment = 'dev'
// eastus used for dev to keep costs low; OpenAI GPT-4o requires eastus anyway
param location = 'eastus'
param projectName = 'hemosync'
param alertEmail = 'hemosync-alerts@outlook.com'
// microsoftAppId: set to real Azure AD app registration client ID before deploying
param microsoftAppId = 'PLACEHOLDER'

// Dev SKU overrides (applied via module-level logic in each Bicep file):
// - Cosmos DB:   serverless (same — no provisioned RU option needed)
// - Redis:       C0 Basic (250 MB, no replication)
// - PostgreSQL:  B1ms (1 vCore, 2 GiB RAM)
// - Functions:   EP1 (same as prod — Premium required for VNET integration)
// - App Service: P2v3 (consider P1v3 for dev if budget is tight)
// - OpenAI:      10K TPM (reduced from 30K)
