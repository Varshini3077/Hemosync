@description('Project name prefix for resource naming')
param projectName string

@description('Deployment environment: dev, staging, or prod')
param environment string

@description('Azure region for the Functions resources')
param location string

@description('Name of the Key Vault for Key Vault references')
param keyVaultName string

@description('Cosmos DB account name (used to build endpoint URL)')
param cosmosAccountName string

@description('Service Bus namespace name (used to build FQDN)')
param serviceBusNamespaceName string

@description('Redis Cache hostname')
param redisHostName string

var planName = '${projectName}-func-plan-${environment}'
var storageAccountName = replace('${projectName}func${environment}', '-', '')
var functionAppName = '${projectName}-func-${environment}'

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

// ─── Storage account (required by Functions runtime) ─────────────────────────
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: take(storageAccountName, 24)
  location: location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
  }
}

// ─── Functions Premium EP1 plan ───────────────────────────────────────────────
resource funcPlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: planName
  location: location
  kind: 'elastic'
  sku: {
    name: 'EP1'
    tier: 'ElasticPremium'
  }
  properties: {
    reserved: true
    maximumElasticWorkerCount: 20
  }
}

// ─── Function App ─────────────────────────────────────────────────────────────
resource functionApp 'Microsoft.Web/sites@2023-01-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: funcPlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|20'
      alwaysOn: true
      http20Enabled: true
      minTlsVersion: '1.2'
      // VNET integration placeholder — enable via portal or separate module
      // after VNET/subnet provisioning
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=core.windows.net'
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20'
        }
        {
          name: 'COSMOS_CONNECTION_STRING'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=CosmosDbConnectionString)'
        }
        {
          name: 'COSMOS_ENDPOINT'
          value: 'https://${cosmosAccountName}.documents.azure.com:443/'
        }
        {
          name: 'SERVICE_BUS_CONNECTION_STRING'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=ServiceBusConnectionString)'
        }
        {
          name: 'REDIS_CONNECTION_STRING'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=RedisConnectionString)'
        }
        {
          name: 'REDIS_HOST'
          value: redisHostName
        }
        {
          name: 'OPENAI_API_KEY'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=OpenAIApiKey)'
        }
        {
          name: 'OPENAI_ENDPOINT'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=OpenAIEndpoint)'
        }
        {
          name: 'AZURE_MAPS_KEY'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=AzureMapsSubscriptionKey)'
        }
        {
          name: 'SPEECH_KEY'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=SpeechServiceKey)'
        }
        {
          name: 'SPEECH_ENDPOINT'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=SpeechServiceEndpoint)'
        }
        {
          name: 'ACS_CONNECTION_STRING'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=ACSConnectionString)'
        }
        {
          name: 'POSTGRES_CONNECTION_STRING'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=PostgresConnectionString)'
        }
        {
          name: 'MICROSOFT_APP_ID'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=MicrosoftAppId)'
        }
        {
          name: 'JWT_SECRET'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=JwtSecret)'
        }
        {
          name: 'NODE_ENV'
          value: environment == 'prod' ? 'production' : environment
        }
        {
          name: 'SERVICE_BUS_NAMESPACE'
          value: '${serviceBusNamespaceName}.servicebus.windows.net'
        }
      ]
    }
  }
}

// ─── Key Vault RBAC: grant Functions managed identity Secret User role ────────
var keyVaultSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'

resource funcKvAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, functionApp.id, keyVaultSecretsUserRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

@description('Azure Functions app hostname')
output functionsHostname string = functionApp.properties.defaultHostName

@description('Azure Functions app name')
output functionsAppName string = functionApp.name

@description('Azure Functions managed identity principal ID')
output functionsPrincipalId string = functionApp.identity.principalId

@description('Storage account name used by Functions')
output storageAccountName string = storageAccount.name
