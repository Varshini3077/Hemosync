@description('Project name prefix for resource naming')
param projectName string

@description('Deployment environment: dev, staging, or prod')
param environment string

@description('Azure region for the PostgreSQL Flexible Server')
param location string

@description('Name of the Key Vault to store admin credentials')
param keyVaultName string

@description('PostgreSQL administrator login name')
param adminLogin string = 'hemosyncadmin'

var serverName = '${projectName}-postgres-${environment}'
var databaseName = 'hemosync_audit'
// SKU: prod/staging use B2ms, dev uses B1ms
var skuName = environment == 'dev' ? 'Standard_B1ms' : 'Standard_B2ms'

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

// Admin password is retrieved from Key Vault via CI/CD; placeholder set here
// so the deployment does not block. CI/CD must update this secret before
// the server is first started in a production environment.
resource adminPasswordSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' existing = {
  parent: keyVault
  name: 'PostgresAdminPassword'
}

resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: serverName
  location: location
  sku: {
    name: skuName
    tier: 'Burstable'
  }
  properties: {
    version: '15'
    administratorLogin: adminLogin
    administratorLoginPassword: adminPasswordSecret.properties.value
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
    authConfig: {
      activeDirectoryAuth: 'Disabled'
      passwordAuth: 'Enabled'
    }
    network: {
      publicNetworkAccess: 'Enabled'
    }
  }
}

// ─── Firewall rule: allow all Azure services ─────────────────────────────────
resource firewallRuleAzureServices 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-06-01-preview' = {
  parent: postgresServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// ─── Create hemosync_audit database ──────────────────────────────────────────
resource auditDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01-preview' = {
  parent: postgresServer
  name: databaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// ─── SSL configuration is enforced by default on Flexible Server ─────────────
// The 'require_secure_transport' server parameter is 'ON' by default.

// ─── Store connection string in Key Vault ────────────────────────────────────
resource postgresConnectionStringSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'PostgresConnectionString'
  properties: {
    value: 'Host=${postgresServer.properties.fullyQualifiedDomainName};Database=${databaseName};Username=${adminLogin};Password=${adminPasswordSecret.properties.value};SslMode=Require'
    attributes: { enabled: true }
  }
}

@description('PostgreSQL server fully qualified domain name')
output serverFqdn string = postgresServer.properties.fullyQualifiedDomainName

@description('PostgreSQL server name')
output serverName string = postgresServer.name

@description('Audit database name')
output databaseName string = auditDatabase.name
