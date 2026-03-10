---
name: concept-integrate
description: >
  Final integration gate for new Semorphe concepts. Runs all verification steps
  (TypeScript compilation, unit tests, round-trip tests, fuzz tests), then
  integrates passing concepts into the codebase with proper registration.
  Use as the last step after /concept.generate to validate and ship new concepts.
user-invocable: true
---

# Concept Integration

## User Input

```text
$ARGUMENTS
```

The argument should be one of:
- A concept name (e.g., `do_while`, `switch_case`) to integrate
- A path to a concept discovery report to integrate all concepts from it
- `check` — run verification only, don't integrate
- `status` — show current integration status of all pending concepts

## Context

This is the **final gate** before a new concept becomes part of Semorphe. It verifies that all artifacts (BlockSpec, generator, lifter, render mapping, tests) work correctly together, then wires everything into the system.

## Pre-flight Checklist

Before running integration, verify these files exist for the target concept:

- [ ] Block spec JSON entry in `src/languages/cpp/blocks/*.json`
- [ ] Code generator in `src/languages/cpp/core/generators/*.ts`
- [ ] Lifter in `src/languages/cpp/core/lifters/*.ts`
- [ ] Render mapping in the block spec JSON (or explicit renderStrategy)
- [ ] Unit tests in `tests/`
- [ ] Concept registered in `src/languages/cpp/concepts.json`

If any artifact is missing, report which ones and suggest running `/concept.generate` first.

## Workflow

### Step 1: TypeScript Compilation Check

```bash
npx tsc --noEmit
```

This catches:
- Missing imports
- Type mismatches between generator/lifter and SemanticNode
- Incorrect BlockSpec field types

If this fails, report the errors and stop. Do not proceed with broken types.

### Step 2: Run Full Test Suite

```bash
npm test
```

All existing tests must pass. A new concept must not break anything.

If tests fail:
- If failures are in the new concept's tests → report and suggest fixes
- If failures are in existing tests → **STOP** — the new concept broke something. Investigate and report.

### Step 3: Run Targeted Round-Trip Tests

For the concept being integrated, generate 5-10 representative C++ programs and run round-trip verification (same process as `/concept.roundtrip`):

1. Write C++ programs that use the concept in isolation and in combination with other concepts
2. Compile originals → record expected stdout
3. Lift → generate → compile generated → record actual stdout
4. Compare outputs

All programs must either PASS or be DEGRADED (if they use features beyond the concept being tested).

### Step 4: Cross-Concept Compatibility

Test that the new concept works correctly when combined with existing concepts:

1. **Nesting test**: Put the new concept inside existing constructs (if body, loop body, function body)
2. **Sibling test**: Place the new concept next to existing statements
3. **Expression context test**: If the concept produces expressions, use them in arithmetic, comparisons, function arguments
4. **Style variant test**: Run generation with both `cout` and `printf` I/O styles (if relevant)

Generate 3-5 combination programs for this.

### Step 5: Block Rendering Verification

Verify that the block renders correctly in Blockly:

1. Create a SemanticNode for the concept programmatically
2. Run `renderToBlocklyState()` on it
3. Verify the Blockly state JSON has correct block type, fields, inputs, and connections
4. If the concept has `expressionCounterpart`, verify both statement and expression forms render

```typescript
// Verification script pattern
import { renderToBlocklyState } from '../src/core/projection/block-renderer'
// ... create semantic tree with the new concept
// ... render and inspect the output JSON
```

### Step 6: Registration Verification

Check that the concept is properly registered in all required locations:

1. **Concept registry** (`src/languages/cpp/concepts.json`):
   - conceptId matches
   - Layer is correct (universal / lang-core / lang-library)
   - Level is correct (0/1/2)
   - Properties and children match generator/lifter expectations

2. **Block spec registry** (block JSON files):
   - Block type follows naming convention (`u_` for universal, `c_` for C++ specific)
   - Category is set for toolbox placement
   - Level matches concept level

3. **Toolbox category** (`src/languages/cpp/toolbox-categories.ts`):
   - The block's category is included in a toolbox category's `registryCategories`
   - Or the block type is in `extraTypes` of some category

4. **Lift patterns** (`src/languages/cpp/lift-patterns.json` or lifter registration):
   - AST node type mapping exists
   - Constraints are correct
   - Priority doesn't conflict with existing patterns

### Step 7: Integration Decision

Based on all checks, make a decision:

| Status | Action |
|--------|--------|
| All checks pass | ✅ Proceed to integrate |
| Only style/formatting issues | ✅ Auto-fix and integrate |
| Round-trip failures on edge cases | ⚠️ Integrate with known limitations documented |
| Type errors or test failures | ❌ Do not integrate — report issues |
| Breaks existing concepts | ❌ Do not integrate — this is a blocker |

### Step 8: Final Integration (if approved)

If all checks pass:

1. **Verify git status is clean** (or only contains the new concept's files)
2. **Run final full test suite** one more time
3. **Create a summary** of what was integrated

Output:

```markdown
## Integration Complete: {concept_name}

### Artifacts Integrated
- Block spec: `src/languages/cpp/blocks/{file}.json` — {block_type}
- Generator: `src/languages/cpp/core/generators/{file}.ts`
- Lifter: `src/languages/cpp/core/lifters/{file}.ts`
- Concept def: `src/languages/cpp/concepts.json`
- Tests: `tests/unit/languages/cpp/{concept}.test.ts`

### Test Results
- TypeScript: ✅ No errors
- Unit tests: ✅ {N} passed
- Round-trip: ✅ {N}/{M} programs passed
- Cross-concept: ✅ {N} combinations tested

### Cognitive Level
- Level {0|1|2} — available when user selects L{level} or higher

### Known Limitations
- {any edge cases that degrade to raw_code}
- {any style variants not yet supported}

### Suggested Follow-up
- {related concepts that could be added next}
- {edge cases to add to fuzz testing}
```

## Status Mode

When called with `status`, scan the codebase and report:

```markdown
## Concept Integration Status

### Fully Integrated (in concepts.json + block specs + generators + lifters)
| Concept | Level | Layer | Block Type |
|---------|-------|-------|------------|
| var_declare | L0 | universal | u_var_declare |
| ... | ... | ... | ... |

### Partially Implemented (missing some artifacts)
| Concept | Has Generator | Has Lifter | Has Block | Has Tests |
|---------|--------------|------------|-----------|-----------|
| {name} | ✅ | ❌ | ✅ | ❌ |

### In concepts.json But No Implementation
| Concept | Level | Notes |
|---------|-------|-------|
| {name} | L2 | No generator or lifter found |
```

## Guidelines

- **Never skip TypeScript compilation** — type safety is the first line of defense
- **Never skip existing tests** — a new concept must not break what already works
- **Prefer conservative integration** — it's better to integrate with documented limitations than to force-push broken code
- **One concept at a time** — integrate and verify each concept independently before doing batch integration
- **Clean git state** — always start from a clean working tree
