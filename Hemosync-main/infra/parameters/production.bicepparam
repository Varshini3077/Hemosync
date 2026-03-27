// HemoSync Production environment parameters
// Full-scale deployment with geo-replication enabled.
// Deploy: az deployment group create --template-file infra/main.bicep --parameters infra/parameters/production.bicepparam
// Or via script: ./infra/deploy.sh prod
using '../main.bicep'

param environment = 'prod'
param location = 'eastasia'
param projectName = 'hemosync'
param alertEmail = 'hemosync-alerts@outlook.com'
// microsoftAppId: replace with production bot Azure AD app registration client ID
param microsoftAppId = 'PLACEHOLDER'

// Production SKU summary:
// - Cosmos DB:     serverless, geo-replicated (eastasia primary + southindia secondary)
// - Redis:         C1 Standard (1 GB)
// - PostgreSQL:    B2ms Flexible Server
// - Functions:     EP1 Premium (elastic scale 1-20)
// - App Service:   P2v3 Linux (web + teams-bot + whatsapp on same plan)
// - OpenAI:        30K TPM GPT-4o in eastus
// - Azure Maps:    S1 (Route + Search)
// - Speech:        S0 Standard
// - APIM:          Consumption tier (zero infra cost)
// - Front Door:    Standard with WAF Prevention mode
// - Sentinel:      Enabled on Log Analytics workspace
// - FHIR:          R4 with SMART on FHIR in eastasia
