# customer-crm Specification

## Purpose

Dev-only admin panel at `/admin` to manage catalog, customers, purchases, conversations, and the recommendation audit log. It has no authentication by conscious, documented decision for the prototype; this is an accepted LOPD/GDPR risk if it ever becomes public.

## Requirements

### Requirement: Admin panel scope

The CRM SHALL expose views for catalog, customers, purchases, conversations, and recommendation log at `/admin`.

#### Scenario: List entities

- GIVEN an authenticated developer opens `/admin` (dev environment)
- WHEN they select a section
- THEN the panel lists the corresponding records
- AND records are readable for inspection

### Requirement: Dev-only exposure guard

The CRM MUST be reachable only in a dev environment and MUST NOT be exposed to the public Internet without authentication. Basic auth is a MUST before any non-dev deployment.

#### Scenario: Blocked in non-dev

- GIVEN the app runs outside a dev environment
- WHEN `/admin` is requested
- THEN the route is not served or is denied
- AND no PII/health data is exposed

#### Scenario: Documented risk acknowledgement

- GIVEN the dev-only no-auth CRM is enabled
- WHEN a developer deploys outside dev
- THEN the LOPD/GDPR exposure risk is documented as a known blocker

### Requirement: Recommendation visibility

The CRM SHALL display the auditable recommendation log so the doctor can review every recommendation given.

#### Scenario: Review log

- GIVEN recommendations exist in the audit log
- WHEN the doctor opens the recommendations section
- THEN each entry shows timestamp, products, and context