@description('Project name prefix for resource naming')
param projectName string

@description('Deployment environment: dev, staging, or prod')
param environment string

@description('Azure region for the Log Analytics workspace')
param location string

var workspaceName = '${projectName}-logs-${environment}'

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: workspaceName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    workspaceCapping: {
      dailyQuotaGb: -1
    }
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

@description('Resource ID of the Log Analytics workspace')
output workspaceId string = logAnalyticsWorkspace.id

@description('Name of the Log Analytics workspace')
output workspaceName string = logAnalyticsWorkspace.name

@description('Customer ID (workspace GUID) for the Log Analytics workspace')
output workspaceCustomerId string = logAnalyticsWorkspace.properties.customerId
