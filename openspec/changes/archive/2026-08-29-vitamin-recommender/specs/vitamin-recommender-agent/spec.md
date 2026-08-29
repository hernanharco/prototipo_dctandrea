# vitamin-recommender-agent Specification

## Purpose

LLM-powered preventive vitamin recommender. It helps visitors explore Nutrilite products for prevention and lifestyle, never for diagnosis or cure, and always defers to medical consultation. It is the legal boundary, memory, and Gemini integration layer of the chat.

## Requirements

### Requirement: Legal boundary — prevention only, never diagnosis/cure

The agent MUST NOT diagnose conditions, prescribe, or promise cures. It SHALL frame every recommendation as prevention/lifestyle support and SHALL defer to medical consultation. A deterministic post-process guard MUST block any response that asserts diagnosis, treatment, or cure claims.

#### Scenario: User asks for a diagnosis

- GIVEN a user asks "what disease do I have?" to the assistant
- WHEN the agent generates a response
- THEN the guard rejects any diagnostic/curative claim
- AND the response defers to medical consultation with the disclaimer

#### Scenario: Prevention framing

- GIVEN a user describes a discomfort in prevention terms
- WHEN the agent recommends a product
- THEN the recommendation is framed as prevention/lifestyle support
- AND it includes a deferral to a medical professional

### Requirement: Purchase-context injection (server-side)

The agent MUST receive the user's purchase history injected server-side from `purchases`, NOT via tool-calling, so it can personalize prevention suggestions.

#### Scenario: Known purchase history

- GIVEN a customer has prior purchases in `purchases`
- WHEN the agent answers
- THEN the server injects purchase context into the request
- AND the agent references it without fetching it itself

### Requirement: Persistent conversation memory

The system SHALL persist conversations per user in `conversations`+`messages` so the agent maintains continuity across turns and sessions.

#### Scenario: Multi-turn continuity

- GIVEN a user returns to a previous conversation
- WHEN they send a follow-up
- THEN prior context is loaded from `messages`
- AND the agent answers consistently

### Requirement: Gemini integration resilience

The agent SHALL degrade gracefully when `GEMINI_API_KEY` is absent and SHOULD retry with backoff on 503/429 responses.

#### Scenario: Missing API key

- GIVEN `GEMINI_API_KEY` is not configured
- WHEN a user sends a message
- THEN the agent returns a graceful fallback instead of erroring

#### Scenario: Retry on 429/503

- GIVEN Gemini returns a 429 or 503
- WHEN the agent retries
- THEN it backs off before retrying
- AND succeeds or fails gracefully after retries are exhausted