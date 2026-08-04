---
name: knowie-capture
description: Dispatch a discussion or idea into the knowledge base — split by perspective, sort by maturity
user-invocable: true
argument-hint: "[the idea; or empty to capture the current discussion]"
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

# Knowie Capture

Take a chunk of thinking (a finished discussion, an idea) and **dispatch** it into the knowledge base — route it, don't dump it.

## The move
Split the input into *which kinds* of knowledge it produced, then route each piece by maturity. Writing ≠ dumping into one file.

## Tests — per piece of the input
- **Which perspective?** normative → `principles` · situational → `vision` · existential → `experience` · a recurring root → a `concepts/` file · a decision that *supersedes* a prior one, or a rejected option → `history/` (a **transition**, not a completion — see below).
- **Which kind → which exit?** (recognition chain: problem → design → experience)
  - *Experience* (a verified lesson / a pitfall hit) → `experience`; its full scene, if recall-worthy → `episodes` (link them, and link the episode out to the *how* it produced — spec / PR / commit — point out, don't copy; pin a commit for a regenerable spec). Note experience's main source is *doing*'s reflow, not draft.
  - *Design* (a proposal / mechanism) → can't be settled until built+used → park as a `draft/` topic block; **when mature, its exit is the vision roadmap** (a human commits to building it), not direct consolidation. On promotion the roadmap item gets **acceptance criteria** and a **two-way link** to the draft; the draft stays as the in-flight rationale (don't delete it) until the item is done, then it reflows + retires (see judge §4).
  - *Problem* (an open question) → `draft/` topic block; its exit is finding an answer (→ becomes a design or experience).
  - *Rejected option* → tombstone in `history/` with the reason — the richest why; don't drop it for the conclusion alone.
  - *Completion ≠ transition.* "Shipped X / tests green / increment done" is **not** `history/` — even under a "Transition" heading. Its home is the commit / CHANGELOG (the *how*-leg) + the exploration scene (`episodes`); its lesson reflows to `experience`. A milestone earns a `history/` entry **only when it revealed a pivot** — a prior decision or assumption changed — and then the entry records *that pivot*, not the delivery list. **Test:** delete the delivery/test lines; if an "old → new, and why it changed" remains, it's history — if only "we finished it" remains, it isn't (one `history/` entry per shipped increment is the smell).

## Two reflexes
- **Don't collapse dimensions.** One discussion usually spans perspectives — don't shove it all into `vision`. Route each piece to where it belongs.
- **When unsure if it's settled → `draft/`, not the three files.** (Captured ≠ committed.)

## Fire without being asked — reliance and pivot are the signals
The misses come from never running capture, not from running it wrong. Two signals should make you capture *on your own*, before being asked:
- **Reliance ≠ captured.** The moment you cite a criterion / lesson / decision as if it's established — "as we decided X", "per X", "this echoes X" — that reliance *is* proof X is load-bearing. **Stop and check X is actually in the base; if not, capture it now.** A vivid, agreed discussion is **not** capture — an idea fresh in context only *feels* stored, and the one you're actively relying on is the most dangerous miss.
- **Topic pivot.** When the thread changes subject, sweep what just got decided/learned for anything not yet in the base — a discussion abandoned for the next question is where capture is lost. (judge backstops both with a mechanical scan for cited-but-uncaptured names.)

## Procedural capture — repeated *doing* → a candidate skill
A second mode: not dispatching a discussion, but noticing you've done the **same operation repeatedly** (scrape-build a dataset, batch-translate…). That's procedural memory forming — capture it.
- **Notice + record a candidate** → a `draft/` block: what the task is + *how* you did it this time. (A candidate is still data/undecided → it incubates in `draft/` like anything else.)
- **On repetition + maturity → the human confirms → consolidate into `knowledge/skills/`** (the cerebellum, source of truth) as one skill: a folder + `SKILL.md` (agentskills.io format) carrying its *why*.
- **Then project it into the present tools' skill dirs so it's usable now.** The source of truth stays in `knowledge/skills/`; *project* it — per-skill **symlink** into each present tool's skill location (`.claude/skills/`, the cross-tool `.agents/skills/`), so edits to the source reach every tool with no drift. **Where symlinks fail (e.g. Windows), copy instead** and note it needs re-sync. It's reversible → **do it yourself; don't make the user run a CLI** for a skill they just made — the AI is present, so the AI does it (CLI is only for AI-absent bootstrap; see core). (judge §5 re-ensures these projections after a fresh clone or when a new tool appears.)
- **Stricter gate than knowledge**: a skill is *executed* (it acts, can fail silently) → consolidating needs firmer human confirmation than committing knowledge.
- **Form**: a *domain* skill automates a mechanical task → it may be procedural/rote (steps), unlike a *meta* skill (judgment). Don't force domain skills into judgment-form.

## Output
Show the dispatch plan (what goes where) first. Write `draft/` directly; for anything in the long-term tier or the roadmap, write only on confirmation.
