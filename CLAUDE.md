@AGENTS.md
@CONTEXT.md

## graphify (code structure graph)

A SessionStart hook regenerates `graphify-out/graph.json` from the current code (AST-only,
no LLM cost) if the `graphify` CLI is installed in this environment — otherwise it's a silent
no-op. If `graphify-out/graph.json` exists, prefer it over grepping around for structural
questions:
- `graphify query "<question>"` — scoped answer with sources
- `graphify path "<A>" "<B>"` — how two things connect
- `graphify explain "<concept>"` — a node and its neighbors
- `graphify-out/GRAPH_REPORT.md` — god nodes, communities, architecture overview

This is a structural map of what the code currently looks like, not a log of past decisions —
for "why was this built this way", CONTEXT.md is still the source of truth.
