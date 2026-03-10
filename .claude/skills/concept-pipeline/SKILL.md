---
name: concept-pipeline
description: >
  End-to-end pipeline for adding new C++ concepts to Semorphe.
  Chains all 5 concept skills: discover → generate → roundtrip → fuzz → integrate.
  Use when you want to go from "I want to support <feature>" to fully integrated concept
  in a single command.
user-invocable: true
---

# Concept Pipeline — End-to-End

## User Input

```text
$ARGUMENTS
```

The argument is the target C++ library, header, or language feature to add support for (e.g., `<algorithm>`, `do-while`, `switch/case`, `pointer arithmetic`, `STL containers`).

Optional flags (append after the target):
- `--dry-run` — Run discover + generate only, skip testing and integration
- `--skip-fuzz` — Skip the fuzz testing phase (faster, less thorough)
- `--concepts=X,Y,Z` — Only process specific concepts from the discovery report (skip the rest)
- `--fuzz-count=N` — Number of fuzz programs to generate (default: 10)

## Overview

This skill orchestrates the full concept addition pipeline:

```
┌─────────────┐    ┌──────────────┐    ┌───────────────┐    ┌──────────────┐    ┌───────────────┐
│  1. Discover │───▶│  2. Generate  │───▶│  3. Roundtrip  │───▶│   4. Fuzz     │───▶│  5. Integrate  │
│              │    │              │    │               │    │              │    │               │
│ Research &   │    │ BlockSpec,   │    │ Targeted      │    │ Info-isolated│    │ Final gate,   │
│ classify     │    │ generator,   │    │ round-trip    │    │ blind testing│    │ registration  │
│ concepts     │    │ lifter, tests│    │ verification  │    │              │    │ & commit      │
└─────────────┘    └──────────────┘    └───────────────┘    └──────────────┘    └───────────────┘
     WebSearch          Code gen            Compile &            Agent A+B           tsc + test
     + fetch            + tests             compare stdout       dual-agent          + verify
```

Each phase has a **go/no-go gate**. If a phase fails, the pipeline stops and reports what went wrong so you can fix it before continuing.

## Workflow

### Phase 1: Discover

**Invoke**: `/concept.discover $ARGUMENTS`

**Gate**: Discovery report generated at `specs/concept-discovery-{topic}.md`

**Decision point**: After discovery, present the concept catalog to the user:

```
Found {N} concepts in {topic}:
  L0: {list}
  L1: {list}
  L2: {list}

Recommended implementation order: {ordered list}

Proceed with all {N} concepts? Or specify which ones with --concepts=X,Y,Z
```

If `--concepts` flag was provided, filter to only those concepts. Otherwise, proceed with the recommended implementation order.

### Phase 2: Generate (per concept)

**For each concept** in the implementation order:

1. **Invoke**: `/concept.generate {concept_name}` (using the discovery report as context)
2. **Gate**: All 5 artifacts exist:
   - [ ] Block spec JSON entry
   - [ ] Code generator function
   - [ ] Lifter registration
   - [ ] Render mapping
   - [ ] Unit test file
3. **Quick check**: `npx tsc --noEmit` — types must compile

If TypeScript fails, fix the errors before moving to the next concept.

### Phase 3: Round-Trip Verification (per concept)

**For each generated concept**:

1. **Invoke**: `/concept.roundtrip {concept_name}`
2. **Gate**: All targeted tests must PASS or be DEGRADED (expected limitation)

Results table:

```
Concept: {name}
  Programs tested: {N}
  ✅ PASS: {N}
  🟡 DEGRADED: {N} (expected)
  ❌ FAIL: {N}
```

If any ❌ FAIL:
- Attempt auto-fix (common issues: missing semicolons, wrong indentation, operator precedence)
- Re-run round-trip after fix
- If still failing after 2 attempts, mark the concept as **blocked** and continue to the next one

### Phase 4: Fuzz Testing (batch)

**Skip if**: `--dry-run` or `--skip-fuzz` flag is set.

1. **Invoke**: `/concept.fuzz {difficulty} {count}` where:
   - Difficulty = highest cognitive level among the new concepts
   - Count = `--fuzz-count` value or default 10
2. **Gate**: No SEMANTIC_DIFF or COMPILE_FAIL bugs in the new concepts

Fuzz results feed back into round-trip as regression tests.

If fuzz reveals bugs:
- For SEMANTIC_DIFF: investigate and fix the generator/lifter
- For COMPILE_FAIL: fix the generator
- For LIFT_FAIL: document as known limitation
- Re-run fuzz on fixed concepts

### Phase 5: Integration (per concept)

**Skip if**: `--dry-run` flag is set.

**For each concept** that passed phases 2-4:

1. **Invoke**: `/concept.integrate {concept_name}`
2. **Gate**: All checks pass (TypeScript, tests, registration)

### Final: Summary Report

After all phases complete, present a final summary:

```markdown
## Concept Pipeline Complete: {topic}

### Results

| Concept | Discover | Generate | Roundtrip | Fuzz | Integrate | Status |
|---------|----------|----------|-----------|------|-----------|--------|
| {name}  | ✅       | ✅       | ✅ 5/5    | ✅   | ✅        | SHIPPED |
| {name}  | ✅       | ✅       | ⚠️ 4/5   | N/A  | ❌        | BLOCKED |

### Shipped: {N} concepts
{list with cognitive levels}

### Blocked: {N} concepts
{list with failure reasons}

### Coverage Impact
- Before: {N} concepts supported
- After: {N+M} concepts supported
- New cognitive level coverage:
  - L0: +{n} concepts
  - L1: +{n} concepts
  - L2: +{n} concepts

### Suggested Next Steps
1. Fix blocked concepts: {list}
2. Related features to explore: {list}
3. Run `/concept.fuzz all 20` for broader regression testing
```

### Git Commit

If any concepts were successfully integrated, offer to commit:

```
{N} concepts integrated. Create commit?

Suggested message:
  feat: add {topic} concepts ({concept_list})
```

## Error Recovery

If the pipeline is interrupted or a phase fails:

- All intermediate artifacts are preserved (discovery reports, generated files, test results)
- You can resume from any phase by running the individual skill:
  - Resume from generate: `/concept.generate specs/concept-discovery-{topic}.md`
  - Resume from roundtrip: `/concept.roundtrip {concept_name}`
  - Resume from integrate: `/concept.integrate {concept_name}`

## Examples

```bash
# Full pipeline for a library
/concept.pipeline <algorithm>

# Quick pipeline without fuzz
/concept.pipeline switch/case --skip-fuzz

# Only specific concepts from a library
/concept.pipeline <string> --concepts=string_length,string_append,string_find

# Dry run to see what would be generated
/concept.pipeline pointer arithmetic --dry-run

# Full pipeline with extra fuzz coverage
/concept.pipeline do-while --fuzz-count=30
```
