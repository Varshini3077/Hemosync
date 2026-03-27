@description('Project name prefix for resource naming')
param projectName string

@description('Deployment environment: dev, staging, or prod')
param environment string

@description('Azure region for App Service resources')
param location string

@description('Name of the Key Vault to wire app settings from')
param keyVaultName string

var planName = '${projectName}-asp-${environment}'
var webAppName = '${projectName}-web-${environment}'
var teamsBotAppName = '${projectName}-teams-bot-${environment}'
var whatsAppAppName = '${projectName}-whatsapp-${environment}'
var linuxFxVersion = 'NODE|20-lts'

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

// ─── App Service Plan P2v3 Linux ──────────────────────────────────────────────
resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: planName
  location: location
  kind: 'linux'
  sku: {
    name: 'P2v3'
    tier: 'PremiumV3'
    capacity: 1
  }
  properties: {
    reserved: true
  }
}

// ─── Web App: hemosync-web (React dashboard) ──────────────────────────────────
resource webApp 'Microsoft.Web/sites@2023-01-01' = {
  name: webAppName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: linuxFxVersion
      alwaysOn: true
      http20Enabled: true
      minTlsVersion: '1.2'
      appSettings: [
        {
          name: 'VITE_API_BASE_URL'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=APIMGatewayUrl)'
        }
        {
          name: 'VITE_AZURE_MAPS_KEY'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=AzureMapsSubscriptionKey)'
        }
        {
          name: 'POWERBI_CLIENT_ID'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=PowerBIClientId)'
        }
        {
          name: 'POWERBI_CLIENT_SECRET'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=PowerBIClientSecret)'
        }
        {
          name: 'NODE_ENV'
          value: environment == 'prod' ? 'production' : environment
        }
      ]
    }
  }
}

// ─── Staging slot for hemosync-web ───────────────────────────────────────────
resource webAppStagingSlot 'Microsoft.Web/sites/slots@2023-01-01' = {
  parent: webApp
  name: 'staging'
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: linuxFxVersion
      alwaysOn: true
    }
  }
}

// ─── Web App: hemosync-teams-bot ─────────────────────────────────────────────
resource teamsBotApp 'Microsoft.Web/sites@2023-01-01' = {
  name: teamsBotAppName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: linuxFxVersion
      alwaysOn: true
      http20Enabled: true
      minTlsVersion: '1.2'
      appSettings: [
        {
          name: 'MicrosoftAppId'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=MicrosoftAppId)'
        }
        {
          name: 'MicrosoftAppPassword'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=MicrosoftAppPassword)'
        }
        {
          name: 'COSMOS_CONNECTION_STRING'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=CosmosDbConnectionString)'
        }
        {
          name: 'APIM_BASE_URL'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=APIMGatewayUrl)'
        }
        {
          name: 'NODE_ENV'
          value: environment == 'prod' ? 'production' : environment
        }
      ]
    }
  }
}

// ─── Staging slot for hemosync-teams-bot ─────────────────────────────────────
resource teamsBotStagingSlot 'Microsoft.Web/sites/slots@2023-01-01' = {
  parent: teamsBotApp
  name: 'staging'
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: linuxFxVersion
      alwaysOn: true
    }
  }
}

// ─── Web App: hemosync-whatsapp (Express webhook) ────────────────────────────
resource whatsAppApp 'Microsoft.Web/sites@2023-01-01' = {
  name: whatsAppAppName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: linuxFxVersion
      alwaysOn: true
      http20Enabled: true
      minTlsVersion: '1.2'
      appSettings: [
        {
          name: 'ACS_CONNECTION_STRING'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=ACSConnectionString)'
        }
        {
          name: 'WHATSAPP_PHONE_NUMBER_ID'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=WhatsAppPhoneNumberId)'
        }
        {
          name: 'WHATSAPP_ACCESS_TOKEN'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=WhatsAppAccessToken)'
        }
        {
          name: 'SERVICE_BUS_CONNECTION_STRING'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=ServiceBusConnectionString)'
        }
        {
          name: 'NODE_ENV'
          value: environment == 'prod' ? 'production' : environment
        }
      ]
    }
  }
}

// ─── Staging slot for hemosync-whatsapp ──────────────────────────────────────
resource whatsAppStagingSlot 'Microsoft.Web/sites/slots@2023-01-01' = {
  parent: whatsAppApp
  name: 'staging'
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: linuxFxVersion
      alwaysOn: true
    }
  }
}

// ─── Key Vault RBAC: grant all web app managed identities Secret User role ──
var keyVaultSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'

resource webAppKvAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, webApp.id, keyVaultSecretsUserRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
    principalId: webApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource teamsBotKvAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, teamsBotApp.id, keyVaultSecretsUserRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
    principalId: teamsBotApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource whatsAppKvAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, whatsAppApp.id, keyVaultSecretsUserRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
    principalId: whatsAppApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

@description('Web dashboard default hostname')
output webHostname string = webApp.properties.defaultHostName

@description('Teams bot default hostname')
output teamsBotHostname string = teamsBotApp.properties.defaultHostName

@description('WhatsApp webhook default hostname')
output whatsAppHostname string = whatsAppApp.properties.defaultHostName

@description('App Service plan resource ID')
output appServicePlanId string = appServicePlan.id

@description('Teams bot managed identity principal ID')
output teamsBotPrincipalId string = teamsBotApp.identity.principalId

@description('Web app managed identity principal ID')
output webAppPrincipalId string = webApp.identity.principalId
