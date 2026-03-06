// HemoSync Staging environment parameters
// Full-scale SKUs in eastasia for pre-production validation.
// Deploy: ./infra/deploy.sh staging
using '../main.bicep'

param environment = 'staging'
param location = 'eastasia'
param projectName = 'hemosync'
param alertEmail = 'hemosync-alerts@outlook.com'
// microsoftAppId: set to staging bot's Azure AD app registration client ID
param microsoftAppId = 'PLACEHOLDER'

// Staging uses production-equivalent SKUs (no geo-replication):
// - Cosmos DB:   serverless, single region (eastasia)
// - Redis:       C1 Standard (1 GB, with replication)
// - PostgreSQL:  B2ms (2 vCores, 4 GiB RAM)
// - Functions:   EP1 Premium
// - App Service: P2v3 Linux
// - OpenAI:      30K TPM
