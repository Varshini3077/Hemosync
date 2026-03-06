@description('Project name prefix for resource naming')
param projectName string

@description('Deployment environment: dev, staging, or prod')
param environment string

@description('Azure region for the Maps account')
param location string

@description('Name of the Key Vault to store subscription key')
param keyVaultName string

var accountName = '${projectName}-maps-${environment}'

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource mapsAccount 'Microsoft.Maps/accounts@2023-06-01' = {
  name: accountName
  location: location
  sku: {
    // S1 includes Route + Search APIs
    name: 'S1'
  }
  kind: 'Gen2'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    disableLocalAuth: false
  }
}

// ─── Store subscription key in Key Vault ─────────────────────────────────────
resource mapsKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'AzureMapsSubscriptionKey'
  properties: {
    value: mapsAccount.listKeys().primaryKey
    attributes: { enabled: true }
  }
}

@description('Azure Maps account name')
output mapsAccountName string = mapsAccount.name

@description('Azure Maps account unique ID')
output mapsUniqueId string = mapsAccount.properties.uniqueId

@description('Key Vault secret URI for Maps subscription key')
output mapsKeySecretUri string = mapsKeySecret.properties.secretUri
