# Wayfinder local tracker

No git / issue tracker in this repo, so wayfinding lives here as markdown.

- `map.md` — the map (label `wayfinder:map`).
- `tickets/NNNN-slug.md` — child tickets. Frontmatter carries identity and state:
  - `id`, `title`, `type` (`wayfinder:research|prototype|grilling|task`)
  - `status`: `open` | `closed`
  - `assignee`: empty = unclaimed. Claim by setting it before any work.
  - `blocked_by`: list of ticket ids. Unblocked when all are `closed`.
- Resolution: append a `## Resolution` section to the ticket, set `status: closed`, add a line to the map's Decisions so far.
- `research/<slug>.md` — research findings (stand-in for throwaway `research/<name>` branches), linked from the ticket.

Frontier = tickets with `status: open`, empty `assignee`, all `blocked_by` closed.
