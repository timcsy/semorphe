---
name: knowie-consolidate
description: Human-initiated — consolidate a ripe draft out into the long-term tier (the symmetric OUT to capture's IN)
user-invocable: true
argument-hint: "[a draft to consolidate; empty = scan draft/ for ripe ones]"
---

# Knowie Core

**What knowie is**: a project's *why* memory — the knowledge code can't hold, and that has no oracle to catch when it rots. It's a protocol parasitic on markdown: any AI that can read/write files can use it.

## Mission & root axioms (never violate)
- **Mission (telos): memory for shared understanding.** knowie remembers for the *human + AI consensus* — keep both aligned, the human holds decision sovereignty, the "why" stays traceable. Everything else serves this. (Not "memory so the agent gets stronger" — that's Letta/Hermes's root.)
1. **One concept, many projections.** Organize by concept.
2. **Memory stays (roughly) reconstructable.** Keep why + the *minimal how/what* needed to rebuild past cognition (a recall unit = why + how + which concepts). Don't duplicate what code already holds as truth (redundant, drifts) — but it's not "zero what"; the bar is "enough to reconstruct," not "why only."

## Structure
- `principles` / `vision` / `experience` = the normative / situational / existential perspectives; the three entry points.
- Inside `principles`: **root principles** (very stable, rarely change) + **derived principles** (derived from root, may evolve, must cite their derivation, must not contradict root).
- Detail sinks into `concepts/` **by concept**.
- `history/` = causal trail (why things became what they are).
- `draft/` = short-term memory: undecided things; decays by default, consolidated only when repeatedly used.
- `episodes/` = episodic memory: full lived experiences worth recalling — the scene behind an experience lesson, **or the brainstorming behind a consolidated draft** (*why* we explored it this way). Most fade; only the recall-worthy are kept.
- **Filenames follow the base's language** (`knowledge/.knowie.json` → `language`): for a `zh-TW` base, name new `concepts/` / `episodes/` / `history/` / `draft/` files in that language (Han characters), not English (`distillation.md`), matching what's already there. Exception: `skills/` folders and canonical filenames (`SKILL.md`, `README.md`, `.knowie.json`) stay as English identifiers — they're invocable/symlinked, not prose. Content language follows the same setting.

## Two intake lines
- **Thinking → `draft`**: undecided thoughts (problems / designs / insights) — incubate, then **dispatch on exit** (next bullet).
- **Doing → action reflow**: a finished roadmap item reflows — lesson → `experience`, full scene → `episodes`, decision-transition → `history`. experience's main source is *doing*, not draft.

## Consolidating is dispatch, not relocation
When anything leaves `draft/` (or an item finishes), **disperse it across every folder that applies — never move the block whole**: direction → roadmap/`experience` · recurring concept → `concepts/` · the **brainstorming scene (why we explored it this way, options weighed) → `episodes/`** · decision-transition → `history/`. The brainstorming scene is the easiest to lose — drop it and a future reader keeps the conclusion but forgets the *why behind the why*.

## Invariants (MUST)
- **Captured ≠ committed.** Undecided → `draft/`; writing into the three files or root principles needs human confirmation.
- **Record transitions, not just states.** Every change leaves a "why it changed"; mark the old one `superseded` and link to the new — don't delete.
- **Root principles stay stable.** Changing them takes a special path + a recorded reason; their churn should approach zero.
- **Converge.** Re-running a tidy should be near no-op; concepts converge toward few roots.
- **Answer to ground truth.** Any claim of "read it / compared it" attaches a verbatim quote + line number (user can grep). No silent skipping, no self-reported coverage.

## Tests (to judge, not to enumerate cases)
- **Qualifies as a concept?** → Does it project onto all three perspectives? Strong in only one → still a single lesson/principle; keep in `draft/`.
- **Record the causality?** → Would a future reader be confused ("didn't we say X?")? Yes → record.
- **Real parent-concept or fake?** → Does it have pruning power? Vague enough to hold anything = bad abstraction.
- **Keep or cut (any mechanism / phrase)?** → If cut, could an AI quietly skip it and no one notice? Yes → keep; No → cut.

## Division of labor
- **AI does the reversible, mechanical**: move, index, prune, detect, draft.
- **Human does the irreversible, semantic**: commit, amend root principles, anoint parent-concepts. AI proposes; it never writes into the long-term tier on its own.

## How these skills are written (they obey this too)
- Give **tests + reasons**, not exhaustive steps (contexts are infinite; only tests generalize).
- Whatever can live in structure (templates / filenames / indexes) shouldn't be written into instructions.
- Necessary friction (what plugs a hole) stays — compressed to one line; theater (what only looks good) is cut.

# Knowie Consolidate

The human-initiated **OUT** of the dispatch pipe: take a *ripe* `draft/` topic and consolidate it into the long-term tier — the memory-formation move from working memory (draft) to the long-term store. (capture is the IN — encoding new thinking → draft; consolidate is the OUT — mature draft → concept / principle / experience / roadmap / history. Together with next's retrieval they form the canonical cycle: encode → consolidate → retrieve.)

You run this when *you* feel a draft is ready — **captured ≠ committed**, and committing is the human's call. (judge tidies drafts as maintenance; next detects ripe ones while planning; this is the focused, human-driven consolidate.)

## Steps
1. **Find the ripe.** Given a draft (or scan `draft/`), judge maturity by the recognition chain: a *design* settled enough → its exit is the **vision roadmap** (a human commits to building it; not direct consolidation); an *insight* verified → a `concepts/` file / an `experience` lesson / a derived principle; a *problem* now answered → it becomes a design or experience. Not ripe → leave it in `draft/` (incubate or decay).
2. **Plan the dispatch — split, don't relocate** (see core: *Consolidating is dispatch*). Consolidation works **by dispatch, not by collapsing into one**: one draft usually holds several kinds: recurring concept → `concepts/`; lesson → `experience`; decision-transition + rejected options → `history/`; brainstorming scene, if recall-worthy → `episodes/`; committed direction → the roadmap. Show the plan first.
3. **Human confirms, then write.** Writing into the long-term tier (or amending root principles) is the human's irreversible, semantic call — propose; never commit on your own. Moving/retiring files (reversible) is yours.
4. **Retire the draft.** Once every piece is dispatched, let the draft go — its durable *why* now lives in the long-term tier; record the transition in `history/` if it was a decision. **Exception:** a design promoted to the roadmap keeps its draft as in-flight rationale until the item is done (judge §4).

## Invariants
- **Captured ≠ committed** — consolidate only what the human confirms is settled.
- **Dispatch, not dump** — route each piece to where it belongs; don't collapse a multi-perspective draft into one file.
- **A design's exit is the roadmap**, not a straight build (the human-commit gate).

## Output
Show the dispatch plan (what goes where, what retires) first; do `draft/` moves directly, but write into the long-term tier or root principles only on confirmation.
