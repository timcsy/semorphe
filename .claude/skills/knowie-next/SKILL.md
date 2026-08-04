---
name: knowie-next
description: Plan the next step as a brief grounded in vision, principles, and experience — then carry it into the spec
user-invocable: true
argument-hint: "[a direction or feature; empty = infer from vision + recent commits]"
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

# Knowie Next

Turn the knowledge base into a **structured plan** for the next step, and carry the *why* into the spec tool so it's obeyed during implementation.

## Steps
1. **Check `draft/` for ripe items first.** Before planning, scan `draft/` for any topic mature enough to graduate (recognition chain: a *design* settled enough to commit → its exit is the **vision roadmap**; an *experience/insight* verified enough → consolidate). Surface these — never silently build a design straight from `draft/`; a design must become a roadmap item (the human-commit gate) before it's implemented.
2. **Read with evidence** — attach a verbatim quote for whatever you rely on.
3. **Retrieve — recall over precision.** Pull everything relevant from all three perspectives **and `knowledge/skills/`** — a learned skill that does this step → recommend *using* it, don't re-plan it from scratch. Missing a relevant one is worse than one extra (retrieval recall is the bottleneck for adherence).
4. **Write the plan as a brief, organized by the three perspectives** (below).
5. **Hand off** — give the brief's cautions to the spec tool. Suggest only; never auto-implement, never auto-invoke another skill.

## The plan — a brief grounded in all three perspectives
Every line cites where it comes from; skip a line if empty.

**The next step is the *best* move, not necessarily the roadmap's sequential item.** next may re-prioritize, jump roadmap order, or flag a **re-route** (a committed route found wrong → say so and make admitting it cheap). Justify the jump from the three perspectives like any recommendation. Guardrail: a *new* route still passes the gate (draft → roadmap) before it's built — jumping ≠ bypassing the commit gate.

**Next: [name] — [one-line]** · roadmap position: [phase / milestone]

- **From vision** (the roadmap / situational):
  - **Prerequisites** — verify against the *code*, not just what vision says.
  - **In scope** / **Out of scope** — state exclusions explicitly, to prevent scope creep.
  - **Acceptance** — concrete, verifiable criteria.
- **From principles** (normative):
  - Which principle this serves — **quote it + show the derivation chain**. Can't trace to one? Flag it a pragmatic choice, not a principled one.
- **From experience** (existential):
  - Relevant lesson — **quote it + how to apply**.
  - **Risks** (from past pitfalls) + mitigation.
  - **Other routes considered** + why not — the rejected options carry the richest *why*.

## Output — end with a choice, don't auto-act
After the brief, if step 1 found ripe `draft/` items, end with the option:
**"Before we start, promote these first? (design → roadmap, then build it through the roadmap; insight → consolidate.)"** — list them. The human decides; you propose. This is the gate that keeps a design from being built straight out of `draft/`. (For a focused, human-initiated consolidate outside planning, that's `/knowie-consolidate`.)

Promoting is a **dispatch, not a relocation** (see core: *Consolidating is dispatch*) — direction → roadmap/`experience`, recurring concept → `concepts/`, brainstorming scene → `episodes/`, transition → `history/`. A new roadmap item carries **acceptance criteria** (verifiable) and a **two-way link** to its design draft. The draft is **not deleted** — it stays as the in-flight design rationale until the item is done (then it reflows + retires, judge §4). Only the pieces already dispatched elsewhere (concept, transition) leave the draft.

## Skill candidate — the prevention catch
If the planned step is a **repeated manual operation** with no skill yet → flag it a **skill candidate** (prevention: skill it *before* doing it manually again; capture records it, the human confirms). next is the earliest, cheapest catch of repetition — before the next manual redo. (judge catches what slips through, later.)

## Invariant
Every recommendation traces to vision / principles / experience. Nothing from thin air — if there's no relevant knowledge for a point, say so explicitly.
