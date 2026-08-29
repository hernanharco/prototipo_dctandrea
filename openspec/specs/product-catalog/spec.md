# product-catalog Specification

## Purpose

Structured Nutrilite catalog acting as the single source of truth for all product data consumed by the agent, the chat, and the CRM. Products carry legal disclaimers and dosage information required for safe recommendations.

## Requirements

### Requirement: Structured product schema

The system SHALL store products with fields: `reference`, `name`, `category`, `size`, `price`, `benefits`, `dosage`, `ingredients`, and `disclaimer`. The catalog MUST be the source of truth for product data.

#### Scenario: Product lookup

- GIVEN a product exists in the catalog
- WHEN the agent or CRM reads it by reference
- THEN all structured fields are returned
- AND the disclaimer is present for display

#### Scenario: Missing product

- GIVEN a reference not in the catalog
- WHEN a lookup is requested
- THEN the system returns a not-found result
- AND the agent must not invent product details

### Requirement: Seed from PDFs

The catalog SHALL be seeded from curated PDF sources (`~/Documentos/amway/*.pdf`) via a curation script. Seed data SHOULD be validated against the schema before insertion.

#### Scenario: Seed run

- GIVEN source PDFs are available
- WHEN the seed script runs
- THEN products are inserted with full structured fields
- AND records without required fields are rejected or flagged

#### Scenario: Re-seed idempotency

- GIVEN the seed runs a second time
- WHEN products already exist
- THEN the catalog is not duplicated
- AND existing records are updated rather than re-inserted