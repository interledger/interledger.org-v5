# Architecture Decision Records

This folder contains Architecture Decision Records (ADRs) for the Interledger Foundation website.

An ADR captures a single technical decision: the context that forced it, what was chosen, what was ruled out, and what tradeoffs were accepted. They are numbered sequentially and never edited after acceptance. If the team changes its mind, a new ADR is written that supersedes the original.

## Decisions

| #   | Title                                             | Status   | Date       |
| --- | ------------------------------------------------- | -------- | ---------- |
| 001 | Path handling for Astro content collections       | Accepted | 2026-03-27 |
| 002 | Spanish fallback disclaimer behavior              | Accepted | 2026-04-09 |
| 003 | Reusable page templates and cross-section routing | Proposed | 2026-04-17 |

## Writing a new ADR

1. Copy the template below into a new file: `NNN-short-title.md`
2. Fill in each section. Keep it concise — a good ADR is under a page.
3. Add a row to the table above.
4. Open a PR. The ADR is accepted when the PR merges.

### Template

```markdown
# ADR-NNN: Title

**Status:** Proposed | Accepted | Superseded by ADR-XXX
**Date:** YYYY-MM-DD
**Issue:** INTORG-XXX

## Context

What is the situation that requires a decision? What constraints exist?

## Decision

What was decided.

## Alternatives considered

What else was on the table and why it was ruled out.

## Consequences

What follows from this decision — both positive and negative.
```
