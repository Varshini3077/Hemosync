@description('Project name prefix for resource naming')
param projectName string

@description('Deployment environment: dev, staging, or prod')
param environment string

@description('Azure region for monitoring resources')
param location string

@description('Resource ID of the Log Analytics workspace')
param logAnalyticsWorkspaceId string

@description('Email address to receive alert notifications')
param alertEmail string

@description('Azure Functions app name for metric alerts')
param functionsAppName string

var appInsightsName = '${projectName}-appi-${environment}'
var actionGroupName = '${projectName}-ag-${environment}'

// ─── Application Insights (workspace-based) ───────────────────────────────────
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspaceId
    RetentionInDays: 90
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// ─── Action group: email to hemosync-alerts ───────────────────────────────────
resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: actionGroupName
  location: 'global'
  properties: {
    groupShortName: 'HemoAlert'
    enabled: true
    emailReceivers: [
      {
        name: 'HemoSync Alerts'
        emailAddress: alertEmail
        useCommonAlertSchema: true
      }
    ]
  }
}

// ─── Alert 1: Function error rate > 5% for 5 min ─────────────────────────────
resource alertFunctionErrorRate 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${projectName}-alert-func-errors-${environment}'
  location: 'global'
  properties: {
    description: 'Azure Functions error rate exceeded 5% for 5 minutes'
    severity: 2
    enabled: true
    scopes: [
      resourceId('Microsoft.Web/sites', functionsAppName)
    ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'FunctionErrors'
          metricName: 'FunctionExecutionCount'
          metricNamespace: 'Microsoft.Web/sites'
          operator: 'GreaterThan'
          threshold: 5
          timeAggregation: 'Count'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
    autoMitigate: true
  }
}

// ─── Alert 2: Average response time > 10s ────────────────────────────────────
resource alertResponseTime 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${projectName}-alert-response-time-${environment}'
  location: 'global'
  properties: {
    description: 'Average HTTP response time exceeded 10 seconds'
    severity: 2
    enabled: true
    scopes: [
      resourceId('Microsoft.Web/sites', functionsAppName)
    ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'ResponseTime'
          metricName: 'HttpResponseTime'
          metricNamespace: 'Microsoft.Web/sites'
          operator: 'GreaterThan'
          threshold: 10
          timeAggregation: 'Average'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
    autoMitigate: true
  }
}

// ─── Alert 3: Cosmos DB RU consumption > 80% ─────────────────────────────────
// This alert is scoped to the resource group level since the Cosmos account name
// is derived from the naming convention (passed as a parameter by main.bicep
// after cosmos module deployment).
resource alertCosmosRU 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${projectName}-alert-cosmos-ru-${environment}'
  location: 'global'
  properties: {
    description: 'Cosmos DB normalized RU consumption exceeded 80%'
    severity: 2
    enabled: true
    scopes: [
      resourceId('Microsoft.DocumentDB/databaseAccounts', '${projectName}-cosmos-${environment}')
    ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'CosmosRU'
          metricName: 'NormalizedRUConsumption'
          metricNamespace: 'Microsoft.DocumentDB/databaseAccounts'
          operator: 'GreaterThan'
          threshold: 80
          timeAggregation: 'Maximum'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
    autoMitigate: true
  }
}

@description('Application Insights connection string')
output appInsightsConnectionString string = appInsights.properties.ConnectionString

@description('Application Insights instrumentation key')
output appInsightsInstrumentationKey string = appInsights.properties.InstrumentationKey

@description('Application Insights resource name')
output appInsightsName string = appInsights.name

@description('Action group resource ID')
output actionGroupId string = actionGroup.id
