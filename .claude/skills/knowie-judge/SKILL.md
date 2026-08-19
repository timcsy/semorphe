---
name: knowie-judge
description: Cross-check the knowledge base for coherence and alignment, detect rot, and tidy — proposing, never committing on its own
user-invocable: true
argument-hint: "[scope: a file, a pair, or an event; empty = full check]"
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

# Knowie Judge

Check the knowledge base is coherent, aligned with the code, and free of rot — then tidy. Diagnose and operate in one pass, but **propose; never commit on your own** (see core: division of labor).

## 1. Read with evidence
Scan each core file's Key Extensions table for topics the scope hits (or, if empty, derive from recent commits). For every sub-file the table points to: either **read it and attach a verbatim quote + line**, or **say why you skip it**. Never silently skip — the quote is the proof, not your word.

## 2. Reconcile
- **Within each file (structure)**: principles — root present, each derived cites its chain? · vision — milestones have verifiable criteria, **and does the body stay forward-looking** (stable positioning + a live roadmap only, no completed-stage sediment: delivery logs, obsolete "current state" snapshots, lifted caveats accreting inline)? · experience — lessons distilled (four-part), not raw events? · any file — a bullet crammed with several claims → propose splitting (readability is per-bullet structure, not line count).
- **Across perspectives**: does the same concept's projection in principles / vision / experience agree, or contradict?
- **Against ground truth (code)**: are the principles actually followed? milestones actually done? the lessons' pitfalls still real? Attach evidence; don't guess.
- Mark 🟢 aligned / 🟡 tension (quote it) / 🔴 conflict (quote + proposed fix).

## 3. Detect rot — mechanically, not from memory
- **Orphans**: any sub-file no Key Extensions table points to.
- **Dead links**: any pointer to a file that's gone or renamed.
- **Conceptual dead references**: dead links, one level up — a *named* criterion / lesson / concept cited as established ("see X", "echoes X", "the X principle") that has no file or heading defining it. grep the citations against the actual concept/lesson titles; a name relied on but never captured is the failure mode where a vivid discussion was mistaken for a stored one (capture's reliance trigger backstopped here). Flag it → it should be captured.
- **Stale**: entries referencing deleted code, finished milestones, resolved problems.
- **Backlinks (derive, don't require `[[ ]]`)**: the same scan inverted — `grep '](path'` gives a node's inbound links. Surface them on request, and flag a *materialized* back-edge that's asymmetric (A links B, but an intended B→A is missing). Links are plain `[](path)`; the graph is derived, not stored (see principle 8).
- **Derivation blast-radius**: every derived principle cites its parent. When a principle is challenged or revised, grep those citations to list every dependent (and theirs, transitively) — surface the **full impact set** so a wrong root's downstream (derived principles / vision / experience) gets updated together, not silently left stale. Trace it; don't recall it from memory.
- **Draft↔vision sync (both directions)**: every vision item that links a draft as its design-context → that draft must carry a promotion marker (promoted / in-flight-rationale) — a promoted draft with no marker reads as still-open when it's already committed. Reverse: a draft claiming it's in vision → vision must actually have it. grep both directions; mismatches are stale.
  - **Scan drafts linked from ANYWHERE in vision, not just roadmap items** — the Key Extensions table (and prose) link drafts too, and a draft reachable only from there is invisible to a roadmap-only scan. (Caught 2026-08-19: a draft's header still claimed "only criterion ⑤ remains, retire after ⑤" while ⑤ had shipped two days earlier and vision already listed the milestone complete.)
  - **A marker that names a completion condition is itself decay-prone**: `grep` every draft for a stated exit ("retire after X", "in-flight for Y") and check X/Y against vision's completed milestones and `history/`. **Nobody comes back to read a "retire after X" marker on the day X ships.** A marker naming a *finished* condition is stale even when the draft should legitimately live on — it may simply have a *new* consumer, so the fix is re-pointing it, not retiring it.
- **Subdir READMEs present**: every knowledge subdirectory (concepts / episodes / history / draft) must have a `README.md` (it orients a third party who's never heard of knowie). `ls */README.md`; a missing one is a gap.
- **Undocumented decisions**: a notable change (a skill or subdir added/removed, a feature killed, a principle revised, a convention set) should leave a `history/` transition — and its durable idea may belong in a `concept`, its scene in an `episode`. Scan recent commits / the current structure against `history/`; a decision with **no causal record** is a hole. (Reflow §4 only fires on *finished roadmap items* — decisions made outside that flow slip through; this catches them.)

Run these with grep/ls — by eye, both humans and AIs miss them.

## 4. Reflow what was learned — dispatch, don't collapse
A finished roadmap item reflows into several places (don't dump all into one):
- lesson (distilled) → `experience`; its full scene, if recall-worthy → `episodes` (link the lesson to it, and link the episode out to its *how*-artifacts — spec / PR / commit — don't copy them; pin a commit for a regenerable spec).
- decision-transition → `history`; then **retire the roadmap item** (redeem-and-retire) **and its source design draft** — the draft's brainstorming scene, if recall-worthy, also reflows to `episodes`. Only now is the draft let go (it was the in-flight rationale until done).
- challenges a principle? → flag a **proposal to amend root/derived principles**, don't bury it in experience.
- a recurring new thing? → a concept.

## 5. Tidy — batch, each layer its own way
- `concepts/`: converge upward — find the parent-concept (pruning-power test); watch the count flatten.
- `experience/`: two-way — merge similar lessons up; split full scenes down to `episodes`; clear stale.
- `vision/`: **redeem-and-retire, then converge** — a done roadmap item reflows out (§4), then collapses to a **one-line result + a pointer** to its `history/` transition; its delivery detail, obsolete "current state" snapshot, and lifted caveats **retire** to `episodes` (scene) / `history` (transition) — they don't sediment in the body (collapsing them under `<details>` is a symptom, not the fix: the bulk is still there). Keep the body's two modes apart: stable positioning (slow) + a live roadmap of future/in-flight only; completed → a thin milestone index (one line each). wishes not committed → back to `draft/`. **Test:** does this line say *where next*? If it says *what we finished / how it looked then*, converge it to a pointer.
- `draft/`: by review-signal, push each topic **one step along its chain** — experience→consolidate, design→roadmap, problem→find-answer; long-untouched → let go (decay). Recency + frequency, not age. (The human-initiated version of this consolidate is `/knowie-consolidate`.) **Exception: a draft linked from an active roadmap item is in-flight design rationale — never reap it; it retires only when its roadmap item completes (§4).**
- `episodes/`: keep only the recall-worthy; let the rest fade.
- `skills/`: **detection backstop** — a recurring operation (across episodes / history / git) with no skill → flag a **skill candidate** (same recurrence-scan as draft's review-signal; capture records, human confirms). A stale/unused skill → flag for retirement: it still *executes* (higher stakes than stale knowledge — a stale skill acts, a stale doc just misleads), so don't let it rot loadable.
  - **Re-ensure projections** (reversible → just do it): each skill in `knowledge/skills/` (the source) should be projected — per-skill symlink — into the present tools' skill dirs (`.claude/skills/`, `.agents/skills/`). Heal missing/broken ones (a fresh clone has the source but not the projections; a newly-present tool has none yet); copy-fallback where symlinks fail (Windows). Idempotent — already-correct is a no-op. **Exception — a retired skill's missing projection is intentional, not rot**: before healing, read the source `SKILL.md`; if it is marked retired/superseded, leave it unprojected and say so. Retiring a skill *is* the removal of its projection (the source stays as memory), so blindly healing un-retires it — the opposite of this section's own rule that a stale skill must not rot loadable.

## 6. Stay within the line
Moving files (reversible) is yours. But **commit, amend root principles, anoint parent-concepts → propose only; wait for the human.**

## Output — evidence, not theater
To the user: a health report (🟢🟡🔴 with quotes) + a prioritized action list + "want me to fix any of these?". Show what you actually read (quotes) and what rot you found (orphans / dead links) — not verbose internal logs.
