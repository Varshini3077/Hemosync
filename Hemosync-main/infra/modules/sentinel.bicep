@description('Name of the existing Log Analytics workspace to enable Sentinel on')
param logAnalyticsWorkspaceName string

// Reference the existing Log Analytics workspace created by loganalytics.bicep
resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' existing = {
  name: logAnalyticsWorkspaceName
}

// ─── Enable Microsoft Sentinel on the workspace ───────────────────────────────
resource sentinelSolution 'Microsoft.OperationsManagement/solutions@2015-11-01-preview' = {
  name: 'SecurityInsights(${logAnalyticsWorkspaceName})'
  location: logAnalyticsWorkspace.location
  plan: {
    name: 'SecurityInsights(${logAnalyticsWorkspaceName})'
    publisher: 'Microsoft'
    product: 'OMSGallery/SecurityInsights'
    promotionCode: ''
  }
  properties: {
    workspaceResourceId: logAnalyticsWorkspace.id
  }
}

// ─── Sentinel workspace settings ─────────────────────────────────────────────
resource sentinelSettings 'Microsoft.SecurityInsights/onboardingStates@2022-12-01-preview' = {
  name: 'default'
  scope: logAnalyticsWorkspace
  properties: {}
  dependsOn: [
    sentinelSolution
  ]
}

// ─── Data connector: Azure Activity Logs ─────────────────────────────────────
resource azureActivityConnector 'Microsoft.SecurityInsights/dataConnectors@2022-12-01-preview' = {
  name: guid(logAnalyticsWorkspace.id, 'AzureActivity')
  scope: logAnalyticsWorkspace
  kind: 'AzureActivity'
  properties: {
    subscriptionId: subscription().subscriptionId
    dataTypes: {
      alerts: {
        state: 'Enabled'
      }
    }
  }
  dependsOn: [
    sentinelSolution
    sentinelSettings
  ]
}

// ─── Analytics Rule: FHIR patient data anomaly detection ─────────────────────
// Alert when > 5 FHIR patient record queries in 1 minute from same source IP
resource fhirAnomalyRule 'Microsoft.SecurityInsights/alertRules@2022-12-01-preview' = {
  name: guid(logAnalyticsWorkspace.id, 'fhir-anomaly')
  scope: logAnalyticsWorkspace
  kind: 'Scheduled'
  properties: {
    displayName: 'FHIR Patient Data Anomaly: High Query Rate from Single IP'
    description: 'Detects when more than 5 FHIR patient record queries originate from the same IP address within 1 minute, indicating potential unauthorized bulk data access or scraping.'
    severity: 'High'
    enabled: true
    // Query runs every minute, looks back 1 minute
    query: '''
AzureDiagnostics
| where ResourceType == "SERVICES" and Category == "AuditLogs"
| where OperationName contains "patient"
| summarize QueryCount = count() by CallerIpAddress, bin(TimeGenerated, 1m)
| where QueryCount > 5
| project TimeGenerated, CallerIpAddress, QueryCount,
          AlertMessage = strcat("Suspicious FHIR activity: ", QueryCount, " queries from IP ", CallerIpAddress, " in 1 minute")
'''
    queryFrequency: 'PT1M'
    queryPeriod: 'PT1M'
    triggerOperator: 'GreaterThan'
    triggerThreshold: 0
    suppressionDuration: 'PT1H'
    suppressionEnabled: false
    tactics: [
      'Exfiltration'
      'Discovery'
    ]
    techniques: [
      'T1530'
    ]
    incidentConfiguration: {
      createIncident: true
      groupingConfiguration: {
        enabled: true
        reopenClosedIncident: false
        lookbackDuration: 'PT5H'
        matchingMethod: 'AnyAlert'
        groupByEntities: []
        groupByAlertDetails: []
        groupByCustomDetails: []
      }
    }
    entityMappings: [
      {
        entityType: 'IP'
        fieldMappings: [
          {
            identifier: 'Address'
            columnName: 'CallerIpAddress'
          }
        ]
      }
    ]
  }
  dependsOn: [
    sentinelSolution
    sentinelSettings
  ]
}

@description('Sentinel solution resource name')
output sentinelSolutionName string = sentinelSolution.name

@description('Log Analytics workspace ID Sentinel is enabled on')
output sentinelWorkspaceId string = logAnalyticsWorkspace.id
