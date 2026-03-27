@description('Project name prefix for resource naming')
param projectName string

@description('Deployment environment: dev, staging, or prod')
param environment string

@description('Azure region for the Redis Cache')
param location string

@description('Name of the Key Vault to store connection string')
param keyVaultName string

var cacheName = '${projectName}-redis-${environment}'
// C0 for dev (250 MB), C1 Standard for staging/prod (1 GB)
var skuName = environment == 'dev' ? 'Basic' : 'Standard'
var skuCapacity = environment == 'dev' ? 0 : 1

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource redisCache 'Microsoft.Cache/redis@2023-08-01' = {
  name: cacheName
  location: location
  properties: {
    sku: {
      name: skuName
      family: 'C'
      capacity: skuCapacity
    }
    enableNonSslPort: false
    minimumTlsVersion: '1.2'
    redisConfiguration: {
      maxmemoryPolicy: 'allkeys-lru'
    }
    publicNetworkAccess: 'Enabled'
  }
}

// ─── Store connection string in Key Vault ────────────────────────────────────
resource redisConnectionStringSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'RedisConnectionString'
  properties: {
    value: '${redisCache.properties.hostName}:${redisCache.properties.sslPort},password=${redisCache.listKeys().primaryKey},ssl=True,abortConnect=False'
    attributes: { enabled: true }
  }
}

@description('Redis Cache hostname')
output redisHostName string = redisCache.properties.hostName

@description('Redis Cache SSL port')
output redisSslPort int = redisCache.properties.sslPort

@description('Redis Cache resource name')
output redisCacheName string = redisCache.name

@description('Key Vault secret URI for Redis connection string')
output redisConnectionStringSecretUri string = redisConnectionStringSecret.properties.secretUri
