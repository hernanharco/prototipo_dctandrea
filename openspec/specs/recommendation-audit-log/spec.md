# recommendation-audit-log Specification

## Purpose

Legal protection layer: every recommendation is recorded in an auditable `recommendations` log, and informed consent is captured, versioned, and persisted. This trail protects the doctor against liability and supports review.

## Requirements

### Requirement: Auditable recommendation log

The system MUST record every recommendation with timestamp, recommended products, and the context that produced it. The log MUST be immutable in intent (append-only for audit).

#### Scenario: Recommendation recorded

- GIVEN the agent produces a recommendation
- WHEN it is returned to the user
- THEN an entry is appended with timestamp, products, and context
- AND the entry is retrievable for audit

### Requirement: Informed consent capture

The system MUST capture informed consent on the user's first chat use, persisting the consent version and timestamp. The system MUST NOT produce recommendations before consent is captured.

#### Scenario: First-use consent gate

- GIVEN a new user opens the chat
- WHEN they start a conversation
- THEN the consent prompt is shown with the current version
- AND consent version + timestamp are persisted before any recommendation

#### Scenario: Consent versioning

- GIVEN the consent text version changes
- WHEN a returning user continues
- THEN their prior consent version remains on record
- AND re-consent is requested for the new version if required

#### Scenario: No consent, no recommendation

- GIVEN a user has not provided consent
- WHEN they request a recommendation
- THEN no recommendation is produced or logged
- AND the system prompts for consent instead