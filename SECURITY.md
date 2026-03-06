# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

HemoSync handles sensitive healthcare coordination data including blood bank locations, donor
personal information, and emergency request details. We take security vulnerabilities extremely
seriously.

**Please do NOT open a public GitHub issue for security vulnerabilities.**

### How to Report

1. **Email**: Send a detailed report to the repository owner via GitHub's private vulnerability
   reporting feature at:
   `https://github.com/Varshini3077/Hemosync/security/advisories/new`

2. **Include the following in your report:**
   - A clear description of the vulnerability
   - Steps to reproduce the issue
   - Affected component(s) and version(s)
   - Potential impact assessment
   - Any suggested remediation (optional but appreciated)

3. **Do NOT include** actual secrets, credentials, or patient/donor data in your report.

### Response Timeline

| Stage                         | Target Time   |
| ----------------------------- | ------------- |
| Acknowledgement of report     | 48 hours      |
| Initial assessment            | 5 business days |
| Patch release (critical/high) | 14 days       |
| Patch release (medium)        | 30 days       |
| Public disclosure             | After patch   |

We will keep you informed throughout the process and credit you in the release notes (unless you
prefer anonymity).

---

## Security Architecture

HemoSync follows defence-in-depth principles across all Azure services:

### Authentication & Authorisation
- All API endpoints are gated behind Azure API Management with subscription key validation
- Azure Active Directory (Entra ID) for internal service-to-service auth (Managed Identity)
- Microsoft Graph enrichment uses least-privilege app registration scopes
- Teams Bot uses Bot Framework authentication with app ID/password

### Secrets Management
- **All secrets are stored in Azure Key Vault** — zero secrets in environment variables in production
- Key Vault references are resolved at runtime via `@azure/keyvault-secrets`
- Managed Identity is used wherever possible to eliminate credential management

### Network Security
- Azure Front Door with Web Application Firewall (WAF) in Prevention mode
- All internal traffic over private endpoints (VNet integration)
- Azure API Management acts as the single ingress point — Functions are not directly exposed
- TLS 1.2+ enforced on all endpoints

### Data Protection
- Patient/donor data handled per **India DPDP Act 2023** requirements
- FHIR API access is read-only; no PHI is logged
- Cosmos DB and PostgreSQL data encrypted at rest (Azure-managed keys)
- Redis cache TTLs are short (5 minutes) to minimise data residency risk
- Audit logs stored in Azure Log Analytics and Microsoft Sentinel

### Monitoring & Incident Response
- Microsoft Sentinel SIEM with analytics rules for anomalous API patterns
- Azure Monitor alerts on authentication failures and unusual broadcast volumes
- Application Insights for real-time request tracing (no PII in telemetry)

---

## Known Security Considerations

- **SMS broadcast**: MSG91 webhook signatures should be validated (planned in v1.1)
- **WhatsApp webhook**: ACS event payload validation via HMAC (implemented)
- **Voice input (STT)**: Audio is processed client-side via Azure AI Speech SDK; audio bytes are
  not transmitted to our backend

---

## Responsible Disclosure

We follow a coordinated disclosure model. After a patch is released, we will publish a security
advisory on GitHub with credit to the reporter. We do not offer a bug bounty program at this time.
