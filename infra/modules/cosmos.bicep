@description('Project name prefix for resource naming')
param projectName string

@description('Deployment environment: dev, staging, or prod')
param environment string

@description('Azure region for primary Cosmos DB deployment')
param location string

@description('Name of the Key Vault to store connection string')
param keyVaultName string

@description('Enable geo-replication to secondary region (production only)')
param enableGeoReplication bool = false

var accountName = '${projectName}-cosmos-${environment}'
var primaryRegion = location
var secondaryRegion = 'southindia'

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2023-11-15' = {
  name: accountName
  location: primaryRegion
  kind: 'GlobalDocumentDB'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    locations: enableGeoReplication ? [
      {
        locationName: primaryRegion
        failoverPriority: 0
        isZoneRedundant: false
      }
      {
        locationName: secondaryRegion
        failoverPriority: 1
        isZoneRedundant: false
      }
    ] : [
      {
        locationName: primaryRegion
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    databaseAccountOfferType: 'Standard'
    enableAutomaticFailover: enableGeoReplication
    enableMultipleWriteLocations: false
    capabilities: [
      {
        name: 'EnableServerless'
      }
    ]
    backupPolicy: {
      type: 'Continuous'
      continuousModeProperties: {
        tier: 'Continuous7Days'
      }
    }
    networkAclBypass: 'AzureServices'
    publicNetworkAccess: 'Enabled'
    isVirtualNetworkFilterEnabled: false
    disableLocalAuth: false
  }
}

resource cosmosDatabase 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2023-11-15' = {
  parent: cosmosAccount
  name: 'hemosync'
  properties: {
    resource: {
      id: 'hemosync'
    }
  }
}

// ─── blood-banks container (partition: /location/city) ───────────────────────
resource containerBloodBanks 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-11-15' = {
  parent: cosmosDatabase
  name: 'blood-banks'
  properties: {
    resource: {
      id: 'blood-banks'
      partitionKey: {
        paths: [
          '/location/city'
        ]
        kind: 'Hash'
        version: 2
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          { path: '/*' }
        ]
        excludedPaths: [
          { path: '/"_etag"/?' }
        ]
      }
    }
  }
}

// ─── requests container (partition: /hospitalId) ─────────────────────────────
resource containerRequests 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-11-15' = {
  parent: cosmosDatabase
  name: 'requests'
  properties: {
    resource: {
      id: 'requests'
      partitionKey: {
        paths: [
          '/hospitalId'
        ]
        kind: 'Hash'
        version: 2
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          { path: '/*' }
        ]
        excludedPaths: [
          { path: '/"_etag"/?' }
        ]
      }
      defaultTtl: -1
    }
  }
}

// ─── donors container (partition: /bloodType) ────────────────────────────────
resource containerDonors 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-11-15' = {
  parent: cosmosDatabase
  name: 'donors'
  properties: {
    resource: {
      id: 'donors'
      partitionKey: {
        paths: [
          '/bloodType'
        ]
        kind: 'Hash'
        version: 2
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          { path: '/*' }
        ]
        excludedPaths: [
          { path: '/"_etag"/?' }
        ]
      }
    }
  }
}

// ─── Store connection string in Key Vault ─────────────────────────────────────
resource cosmosConnectionStringSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'CosmosDbConnectionString'
  properties: {
    value: cosmosAccount.listConnectionStrings().connectionStrings[0].connectionString
    attributes: { enabled: true }
  }
}

@description('Cosmos DB account name')
output cosmosAccountName string = cosmosAccount.name

@description('Cosmos DB account endpoint')
output cosmosEndpoint string = cosmosAccount.properties.documentEndpoint

@description('Cosmos DB database name')
output cosmosDatabaseName string = cosmosDatabase.name

@description('Key Vault secret URI for Cosmos DB connection string')
output cosmosConnectionStringSecretUri string = cosmosConnectionStringSecret.properties.secretUri
