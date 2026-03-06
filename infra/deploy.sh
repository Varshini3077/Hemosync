#!/usr/bin/env bash
# deploy.sh — HemoSync Azure infrastructure deployment script
#
# Usage:
#   ./infra/deploy.sh <environment>
#
# Examples:
#   ./infra/deploy.sh dev
#   ./infra/deploy.sh staging
#   ./infra/deploy.sh prod
#
# Prerequisites:
#   - Azure CLI installed and authenticated (az login)
#   - Subscription set (az account set --subscription <id>)
#   - Resource providers registered:
#       az provider register --namespace Microsoft.HealthcareApis
#       az provider register --namespace Microsoft.HealthDataAIServices
#       az provider register --namespace Microsoft.Maps
#       az provider register --namespace Microsoft.BotService
#       az provider register --namespace Microsoft.ApiManagement
#       az provider register --namespace Microsoft.SecurityInsights
#
# Outputs:
#   .env.azure — environment file populated with all deployed resource endpoints

set -euo pipefail

# ─── Validate arguments ───────────────────────────────────────────────────────
ENVIRONMENT="${1:-}"
if [[ -z "$ENVIRONMENT" ]]; then
  echo "ERROR: environment argument required. Usage: ./infra/deploy.sh <dev|staging|prod>"
  exit 1
fi

if [[ "$ENVIRONMENT" != "dev" && "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "prod" ]]; then
  echo "ERROR: environment must be one of: dev, staging, prod"
  exit 1
fi

# ─── Configuration ────────────────────────────────────────────────────────────
PROJECT_NAME="hemosync"
RESOURCE_GROUP="${PROJECT_NAME}-rg-${ENVIRONMENT}"
BICEP_PARAM_FILE="infra/parameters/${ENVIRONMENT}.bicepparam"
BICEP_TEMPLATE="infra/main.bicep"

# Region selection: dev uses eastus (OpenAI proximity), others use eastasia
if [[ "$ENVIRONMENT" == "dev" ]]; then
  LOCATION="eastus"
else
  LOCATION="eastasia"
fi

ENV_OUTPUT_FILE=".env.azure"

# ─── Helpers ──────────────────────────────────────────────────────────────────
log() {
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $*"
}

check_az_login() {
  if ! az account show &>/dev/null; then
    echo "ERROR: Not logged in to Azure CLI. Run: az login"
    exit 1
  fi
}

# ─── Pre-flight checks ────────────────────────────────────────────────────────
log "Starting HemoSync deployment — environment: ${ENVIRONMENT}"
check_az_login

SUBSCRIPTION_ID=$(az account show --query id -o tsv)
log "Using subscription: ${SUBSCRIPTION_ID}"

# Validate parameter file exists
if [[ ! -f "$BICEP_PARAM_FILE" ]]; then
  echo "ERROR: Parameter file not found: ${BICEP_PARAM_FILE}"
  exit 1
fi

# ─── Create resource group if it doesn't exist ───────────────────────────────
log "Ensuring resource group '${RESOURCE_GROUP}' exists in '${LOCATION}'..."
if ! az group show --name "$RESOURCE_GROUP" &>/dev/null; then
  log "Creating resource group '${RESOURCE_GROUP}'..."
  az group create \
    --name "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --tags \
      project="$PROJECT_NAME" \
      environment="$ENVIRONMENT" \
      managedBy="bicep" \
      deployedAt="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  log "Resource group created."
else
  log "Resource group already exists."
fi

# ─── Run Bicep deployment ────────────────────────────────────────────────────
DEPLOYMENT_NAME="${PROJECT_NAME}-deploy-${ENVIRONMENT}-$(date -u +"%Y%m%d%H%M%S")"
log "Starting ARM deployment '${DEPLOYMENT_NAME}'..."

DEPLOYMENT_OUTPUT=$(az deployment group create \
  --name "$DEPLOYMENT_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --template-file "$BICEP_TEMPLATE" \
  --parameters "$BICEP_PARAM_FILE" \
  --query "properties.outputs" \
  --output json)

if [[ $? -ne 0 ]]; then
  log "ERROR: Deployment failed. Check Azure portal for details."
  exit 1
fi

log "Deployment completed successfully."

# ─── Extract outputs ──────────────────────────────────────────────────────────
log "Extracting deployment outputs..."

extract_output() {
  local key="$1"
  echo "$DEPLOYMENT_OUTPUT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
val = data.get('${key}', {}).get('value', '')
print(val)
" 2>/dev/null || echo ""
}

FRONT_DOOR_ENDPOINT=$(extract_output "frontDoorEndpoint")
APIM_GATEWAY_URL=$(extract_output "apimGatewayUrl")
FUNCTIONS_HOSTNAME=$(extract_output "functionsHostname")
WEB_HOSTNAME=$(extract_output "webHostname")
TEAMS_BOT_HOSTNAME=$(extract_output "teamsBotHostname")
WHATSAPP_HOSTNAME=$(extract_output "whatsAppHostname")
OPENAI_ENDPOINT=$(extract_output "openAIEndpoint")
COSMOS_ACCOUNT_NAME=$(extract_output "cosmosAccountName")
KEY_VAULT_URI=$(extract_output "keyVaultUri")
APP_INSIGHTS_CONNECTION=$(extract_output "appInsightsConnectionString")
FHIR_SERVICE_URL=$(extract_output "fhirServiceUrl")
MAPS_ACCOUNT_NAME=$(extract_output "mapsAccountName")
SPEECH_ENDPOINT=$(extract_output "speechEndpoint")
ACS_SERVICE_NAME=$(extract_output "communicationServiceName")
SERVICE_BUS_FQDN=$(extract_output "serviceBusNamespaceFqdn")
REDIS_HOSTNAME=$(extract_output "redisHostName")
LOG_ANALYTICS_WORKSPACE_ID=$(extract_output "logAnalyticsWorkspaceId")

# ─── Write .env.azure ────────────────────────────────────────────────────────
log "Writing endpoints to ${ENV_OUTPUT_FILE}..."

cat > "$ENV_OUTPUT_FILE" << EOF
# HemoSync Azure Infrastructure Endpoints
# Generated by infra/deploy.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# Environment: ${ENVIRONMENT}
# Resource Group: ${RESOURCE_GROUP}
# Deployment: ${DEPLOYMENT_NAME}
#
# WARNING: This file contains endpoint URLs — do NOT commit to version control.
# Actual secrets are in Azure Key Vault: ${KEY_VAULT_URI}
# Retrieve them with:
#   az keyvault secret show --vault-name <kv-name> --name <secret-name> --query value -o tsv

# ─── Infrastructure metadata ──────────────────────────────────────────────────
AZURE_RESOURCE_GROUP=${RESOURCE_GROUP}
AZURE_SUBSCRIPTION_ID=${SUBSCRIPTION_ID}
AZURE_ENVIRONMENT=${ENVIRONMENT}

# ─── Front Door ───────────────────────────────────────────────────────────────
AZURE_FRONT_DOOR_ENDPOINT=https://${FRONT_DOOR_ENDPOINT}

# ─── API Management ───────────────────────────────────────────────────────────
AZURE_APIM_GATEWAY_URL=${APIM_GATEWAY_URL}
VITE_API_BASE_URL=${APIM_GATEWAY_URL}/hemosync

# ─── Azure Functions ──────────────────────────────────────────────────────────
AZURE_FUNCTIONS_HOSTNAME=${FUNCTIONS_HOSTNAME}
AZURE_FUNCTIONS_URL=https://${FUNCTIONS_HOSTNAME}/api

# ─── App Service hostnames ────────────────────────────────────────────────────
AZURE_WEB_HOSTNAME=${WEB_HOSTNAME}
AZURE_TEAMS_BOT_HOSTNAME=${TEAMS_BOT_HOSTNAME}
AZURE_WHATSAPP_HOSTNAME=${WHATSAPP_HOSTNAME}

# ─── Azure OpenAI ─────────────────────────────────────────────────────────────
AZURE_OPENAI_ENDPOINT=${OPENAI_ENDPOINT}
AZURE_OPENAI_DEPLOYMENT=gpt-4o
# Key: az keyvault secret show --vault-name <kv> --name OpenAIApiKey -o tsv

# ─── Cosmos DB ────────────────────────────────────────────────────────────────
AZURE_COSMOS_ACCOUNT_NAME=${COSMOS_ACCOUNT_NAME}
AZURE_COSMOS_ENDPOINT=https://${COSMOS_ACCOUNT_NAME}.documents.azure.com:443/
AZURE_COSMOS_DATABASE=hemosync
# Connection string: az keyvault secret show --vault-name <kv> --name CosmosDbConnectionString -o tsv

# ─── Key Vault ────────────────────────────────────────────────────────────────
AZURE_KEY_VAULT_URI=${KEY_VAULT_URI}

# ─── Application Insights ─────────────────────────────────────────────────────
APPLICATIONINSIGHTS_CONNECTION_STRING=${APP_INSIGHTS_CONNECTION}

# ─── FHIR ─────────────────────────────────────────────────────────────────────
AZURE_FHIR_SERVICE_URL=${FHIR_SERVICE_URL}

# ─── Azure Maps ───────────────────────────────────────────────────────────────
AZURE_MAPS_ACCOUNT_NAME=${MAPS_ACCOUNT_NAME}
# Key: az keyvault secret show --vault-name <kv> --name AzureMapsSubscriptionKey -o tsv

# ─── Azure AI Speech ─────────────────────────────────────────────────────────
AZURE_SPEECH_ENDPOINT=${SPEECH_ENDPOINT}
# Key: az keyvault secret show --vault-name <kv> --name SpeechServiceKey -o tsv

# ─── Azure Communication Services ────────────────────────────────────────────
AZURE_ACS_RESOURCE_NAME=${ACS_SERVICE_NAME}
# Connection string: az keyvault secret show --vault-name <kv> --name ACSConnectionString -o tsv

# ─── Service Bus ──────────────────────────────────────────────────────────────
AZURE_SERVICE_BUS_NAMESPACE=${SERVICE_BUS_FQDN}
AZURE_SERVICE_BUS_BROADCAST_QUEUE=broadcast-jobs
AZURE_SERVICE_BUS_CONFIRMATIONS_QUEUE=confirmations
# Connection string: az keyvault secret show --vault-name <kv> --name ServiceBusConnectionString -o tsv

# ─── Redis ────────────────────────────────────────────────────────────────────
AZURE_REDIS_HOSTNAME=${REDIS_HOSTNAME}
# Connection string: az keyvault secret show --vault-name <kv> --name RedisConnectionString -o tsv

# ─── Log Analytics ────────────────────────────────────────────────────────────
AZURE_LOG_ANALYTICS_WORKSPACE_ID=${LOG_ANALYTICS_WORKSPACE_ID}
EOF

log "✓ ${ENV_OUTPUT_FILE} written with all endpoints."
log ""
log "Next steps:"
log "  1. Set real secrets in Key Vault (replace PLACEHOLDER values):"
log "     az keyvault secret set --vault-name <kv-name> --name <secret> --value <value>"
log "  2. Register the Teams bot app in Azure AD and update MicrosoftAppId/Password secrets"
log "  3. Register WhatsApp channel in ACS portal (requires Facebook Business Manager)"
log "  4. Upload synthetic FHIR data for demo:"
log "     az healthcareapis fhir-service create ..."
log "  5. Copy .env.azure values to your CI/CD pipeline secrets"
log ""
log "Deployment complete! Resource group: ${RESOURCE_GROUP}"
