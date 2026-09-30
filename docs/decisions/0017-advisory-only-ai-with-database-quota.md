# 0017 — Advisory-only AI with database-enforced quota

**Status:** accepted (Phase 7)

**Context.** The platform moves money and decides disputes. AI help is useful for search, drafting and reading, but must never act on those things, and must not become a cost or data-leak channel.

**Decision.**
- The AI layer is a thin provider interface with an Anthropic adapter over plain `fetch`; no SDK, no tool use, no agent loop.
- Safety is structural: the model cannot call anything. Its reply is validated against a schema and shown as text. Products and categories are re-resolved from the real database.
- Quota, the on/off switch and role gating live in a SECURITY DEFINER function (`ai_take_quota`), so a forged request can't bypass the UI. Off by default.
- Usage is logged without prompts or answers (append-only) to limit personal data retention.
- The admin briefing reads an aggregate-only database function; the AI narrates, it does not compute.

**Consequences.** No live model testing was possible without a key. A failed model call still consumes quota. Changing provider means writing one adapter.
