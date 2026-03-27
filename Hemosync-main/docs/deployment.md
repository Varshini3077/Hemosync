# HemoSync — Azure Deployment Guide

Deploy HemoSync to Azure in under 30 minutes using Bicep Infrastructure as Code.

---

## 1. Prerequisites

Install the following tools before proceeding:

- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) v2.55+
- [Bicep CLI](https://learn.microsoft.com/azure/azure-resource-manager/bicep/install) v0.26+ (`az bicep install`)
- [Node.js](https://nodejs.org/) v20 LTS
- [pnpm](https://pnpm.io/installation) v9+
- [Azure Functions Core Tools](https://learn.microsoft.com/azure/azure-functions/functions-run-local) v4
- An Azure subscription with Contributor access

Verify:

```bash
az --version
az bicep version
node --version   # must be v20.x
pnpm --version
func --version   # must be 4.x
```

---

## 2. Clone and Install

```bash
git clone https://github.com/Varshini3077/Hemosync.git
cd Hemosync
pnpm install
```

---

## 3. Deploy Infrastructure

Log in to Azure and set your subscription:

```bash
az login
az account set --subscription "<your-subscription-id>"
```

Run the deployment script for the target environment (`dev`, `staging`, or `prod`):

```bash
./infra/deploy.sh prod
```

This Bicep deployment provisions all 23 Azure services including Cosmos DB, PostgreSQL, Service Bus, API Management, Functions App, App Service plans, Bot Service, ACS, Redis, Maps, FHIR, Key Vault, Application Insights, and Sentinel.

Deployment takes approximately 15–20 minutes. Output includes all resource endpoints and resource group name.

---

## 4. Populate Key Vault Secrets

After infrastructure is provisioned, populate Key Vault with all required secrets. Use the Key Vault URI from deployment output:

```bash
KV="https://<vault-name>.vault.azure.net"

az keyvault secret set --vault-name "<vault-name>" --name "AzureOpenAIKey"          --value "<your-openai-key>"
az keyvault secret set --vault-name "<vault-name>" --name "CosmosConnectionString"  --value "<connection-string>"
az keyvault secret set --vault-name "<vault-name>" --name "RedisConnectionString"   --value "<connection-string>"
az keyvault secret set --vault-name "<vault-name>" --name "PostgresPassword"        --value "<password>"
az keyvault secret set --vault-name "<vault-name>" --name "ServiceBusConnection"    --value "<connection-string>"
az keyvault secret set --vault-name "<vault-name>" --name "AcsConnectionString"     --value "<connection-string>"
az keyvault secret set --vault-name "<vault-name>" --name "Msg91AuthKey"            --value "<auth-key>"
az keyvault secret set --vault-name "<vault-name>" --name "AzureMapsKey"            --value "<subscription-key>"
az keyvault secret set --vault-name "<vault-name>" --name "AzureSpeechKey"          --value "<speech-key>"
az keyvault secret set --vault-name "<vault-name>" --name "BotAppPassword"          --value "<bot-password>"
az keyvault secret set --vault-name "<vault-name>" --name "PowerBiClientSecret"     --value "<client-secret>"
az keyvault secret set --vault-name "<vault-name>" --name "GraphClientSecret"       --value "<client-secret>"
az keyvault secret set --vault-name "<vault-name>" --name "EraktkoshApiKey"         --value "<api-key>"
```

All Function App settings reference these secrets via Key Vault references (`@Microsoft.KeyVault(SecretUri=...)`).

---

## 5. Seed Database

Export the production connection strings, then run the seed command:

```bash
export COSMOS_CONNECTION_STRING="<from Key Vault or deployment output>"
export DATABASE_URL="postgresql://<user>:<password>@<host>:5432/hemosync_audit?sslmode=require"

pnpm seed
```

This inserts 30 Delhi NCR blood banks into Cosmos DB and runs all 3 PostgreSQL migrations.

---

## 6. Deploy Applications

Deploy the Azure Functions API:

```bash
cd api
func azure functionapp publish hemosync-api-prod
cd ..
```

Deploy the web dashboard (Azure Static Web Apps via GitHub Actions is recommended — see `.github/workflows/`). For a manual deploy:

```bash
cd apps/web
pnpm build
az staticwebapp deploy --name hemosync-web-prod --resource-group hemosync-rg --source dist
cd ../..
```

Deploy the Teams bot and WhatsApp handler to App Service:

```bash
cd apps/teams-bot
pnpm build
az webapp deploy --name hemosync-teams-bot-prod --resource-group hemosync-rg --src-path dist
cd ../whatsapp-handler
pnpm build
az webapp deploy --name hemosync-whatsapp-prod --resource-group hemosync-rg --src-path dist
cd ../..
```

---

## 7. Register Teams Bot

1. In the [Azure Portal](https://portal.azure.com), open the **Azure Bot Service** resource (`hemosync-bot-prod`)
2. Under **Configuration**, set the **Messaging endpoint** to: `https://hemosync-teams-bot-prod.azurewebsites.net/api/messages`
3. Note the **Microsoft App ID** (BOT_APP_ID) and generate a new **client secret** (BOT_APP_PASSWORD)
4. In the [Teams Admin Center](https://admin.teams.microsoft.com):
   - Go to **Teams apps > Manage apps > Upload an app**
   - Upload `apps/teams-bot/manifest/manifest.zip`
   - Approve the app for your organization

---

## 8. Register WhatsApp Webhook

1. In the [Azure Portal](https://portal.azure.com), open the **Azure Communication Services** resource
2. Go to **Channels > WhatsApp**
3. Under **Webhook**, set the endpoint to: `https://hemosync-whatsapp-prod.azurewebsites.net/api/whatsapp`
4. Set the **Verify token** to match `ACS_WHATSAPP_VERIFY_TOKEN` in Key Vault
5. Subscribe to **messages** events

---

## 9. Verify Deployment

Run the health check against the production APIM gateway:

```bash
APIM_KEY="<your-apim-subscription-key>" \
  FUNCTIONS_BASE_URL="https://<apim-name>.azure-api.net/api" \
  pnpm health-check
```

Expected output: all 7 endpoints show `✓` with response times under 500 ms.
