# ADR 002 — Two Databases: Cosmos DB for Operational + PostgreSQL for Audit

**Date:** 2024-11-08
**Status:** Accepted

---

## Context

HemoSync has two distinct categories of data with very different access patterns:

**Operational data** (blood bank catalog, active broadcast jobs, request state):
- Read on every request; must be sub-millisecond
- Schema evolves frequently as bank attributes and status fields are added
- Geospatial queries (nearest banks) are primary access pattern
- No strict relational integrity required

**Audit and analytics data** (request lifecycle events, donor outreach history, analytics events):
- Written once, read rarely in real time, but queried heavily in Power BI dashboards
- Requires relational integrity: foreign keys, joins across tables
- SQL analytics (GROUP BY hospital, HAVING response_time > N) are the primary query pattern
- Data must be retained for compliance and NDHM reporting

We evaluated:
1. **Single Cosmos DB** — good for operational data, but SQL analytics require Synapse Link which adds latency and cost; JSON querying for complex analytics is awkward
2. **Single PostgreSQL** — good for audit, but global distribution and sub-ms point reads for bank catalog require significant tuning
3. **Cosmos DB + PostgreSQL** — purpose-fit each workload, with clear separation of concerns

---

## Decision

Use **two databases**:
- **Azure Cosmos DB** (NoSQL, serverless, multi-region) for all operational data: blood bank catalog (`blood-banks` container), active requests (`requests` container), and broadcast jobs (`broadcast-jobs` container)
- **Azure Database for PostgreSQL Flexible Server** for all audit and analytics data: `audit_log`, `donor_outreach_history`, and `analytics_events` tables

A short-lived Redis cache sits in front of Cosmos DB for blood bank rankings to serve the most-common query (nearest banks for a given location) in under 1 ms.

---

## Consequences

**Positive:**
- Cosmos DB serverless scales to zero during idle periods (critical for a 24/7 emergency service that may see zero volume at 3 AM)
- PostgreSQL enables full SQL analytics without Synapse Link overhead; Power BI connects directly
- Clear operational boundary: if the audit database is unavailable, emergency broadcasts still work (operational path is Cosmos-only)
- Schema migrations are simple SQL files with no Cosmos schema concerns bleeding in

**Negative:**
- Two connection strings to manage (mitigated by Azure Key Vault)
- Two databases to monitor, back up, and scale independently
- Developers need to be aware of which store to query for which data
