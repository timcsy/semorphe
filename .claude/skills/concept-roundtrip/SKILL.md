---
name: concept-roundtrip
description: >
  Run targeted round-trip tests on specific C++ programs through the Semorphe pipeline.
  Verifies: C++ → lift → SemanticTree → generate → C++ → compile → compare stdout.
  Use for validating specific concepts, debugging known failures, or regression testing.
user-invocable: true
---

# Concept Round-Trip Testing

## User Input

```text
$ARGUMENTS
```

The argument can be:
- A C++ code snippet (inline or file path)
- A concept name to test (e.g., `if`, `while_loop`, `func_def`)
- A difficulty level (`easy`, `medium`, `hard`) to generate representative programs
- `all` to test all supported concepts with canonical examples

## Context

Unlike `/concept.fuzz` (which uses information-isolated agents for discovery), this skill runs **targeted, implementation-aware** round-trip tests. You have full access to Semorphe's source code and should use that knowledge to craft precise test cases that exercise specific code paths.

## Pre-flight

Read these files to understand the current pipeline:

- `src/core/types.ts` — SemanticNode, ConceptId, all type definitions
- `src/languages/cpp/blocks/` — all block spec JSON files (to know supported concepts)
- `src/languages/cpp/core/generators/` — code generators (to understand output format)
- `src/languages/cpp/core/lifters/` — lifters (to understand input handling)
- `src/core/projection/code-generator.ts` — main generation entry point
- `src/core/lift/pattern-lifter.ts` — main lift entry point

## Workflow

### Step 1: Determine Test Scope

Based on `$ARGUMENTS`, determine which programs to test:

**If a C++ snippet or file path:**
- Use the provided code directly

**If a concept name:**
- Generate 3-5 representative C++ programs that exercise that concept
- Include edge cases specific to the concept (e.g., nested if, empty body, chained operators)

**If a difficulty level:**
- Generate programs covering all concepts at that cognitive level
- L0: var_declare, var_assign, arithmetic, compare, if, while_loop, print, input, endl
- L1: logic, func_def, func_call, return, count_loop, break, continue
- L2: array_declare, array_access, cpp:include, cpp:using_namespace

**If `all`:**
- Generate one canonical program per supported concept
- Then generate 3 combination programs that mix multiple concepts

### Step 2: Compile Original Programs

For each test program:

```bash
mkdir -p /tmp/semorphe-roundtrip/
echo "$CODE" > /tmp/semorphe-roundtrip/test_{id}.cpp
g++ -std=c++17 -o /tmp/semorphe-roundtrip/test_{id} /tmp/semorphe-roundtrip/test_{id}.cpp 2>/tmp/semorphe-roundtrip/test_{id}_compile.log
```

If compilation fails, report the error and skip (the test program itself is invalid).

Run successfully compiled programs:

```bash
timeout 5 /tmp/semorphe-roundtrip/test_{id} > /tmp/semorphe-roundtrip/test_{id}_expected.txt 2>&1
```

### Step 3: Run Semorphe Pipeline

Create a Node.js runner script to perform the lift→generate round-trip. Read the project's existing test infrastructure first to understand how to initialize the pipeline:

```bash
# Check existing test patterns
grep -r "Lifter\|PatternLifter\|registerCpp" tests/ --include="*.ts" -l
```

Then create and run the round-trip script:

```typescript
// /tmp/semorphe-roundtrip/runner.ts
// Import and initialize the full pipeline
// For each program:
//   1. Parse C++ with tree-sitter
//   2. Lift AST → SemanticTree
//   3. Generate SemanticTree → C++ code
//   4. Write generated code to file
```

Run using the project's TypeScript setup:

```bash
npx tsx /tmp/semorphe-roundtrip/runner.ts
```

### Step 4: Compile and Run Generated Code

For each generated C++ file:

```bash
g++ -std=c++17 -o /tmp/semorphe-roundtrip/test_{id}_gen /tmp/semorphe-roundtrip/test_{id}_gen.cpp 2>/tmp/semorphe-roundtrip/test_{id}_gen_compile.log
timeout 5 /tmp/semorphe-roundtrip/test_{id}_gen > /tmp/semorphe-roundtrip/test_{id}_actual.txt 2>&1
```

### Step 5: Compare Results

For each test, perform three levels of comparison:

**Level 1 — Stdout Equivalence** (most important):
```bash
diff /tmp/semorphe-roundtrip/test_{id}_expected.txt /tmp/semorphe-roundtrip/test_{id}_actual.txt
```

**Level 2 — Semantic Tree Inspection**:
- Dump the SemanticTree as JSON
- Check that no nodes have `confidence: 'raw_code'` (unless the concept is genuinely unsupported)
- Check that concept names match expectations

**Level 3 — Code Structure Comparison** (informational):
- Compare original and generated code structure (not exact text — formatting may differ)
- Note any significant structural differences (e.g., `for` loop became `while` loop)

### Step 6: Classify and Report

Classify each test result:

| Result | Symbol | Meaning |
|--------|--------|---------|
| PASS | ✅ | Stdout matches, clean semantic tree |
| STDOUT_DIFF | ❌ | Stdout differs — semantic bug |
| COMPILE_FAIL | ❌ | Generated code won't compile — generator bug |
| LIFT_FAIL | ⚠️ | Lifter crashed or produced null tree |
| DEGRADED | 🟡 | Code was degraded to raw_code — coverage gap |
| TIMEOUT | ❌ | Generated code hangs — possible infinite loop |
| STRUCTURE_DIFF | 🔵 | Stdout matches but code structure changed significantly |

### Step 7: Output Report

Print a summary table:

```
## Round-Trip Test Results

| # | Program | Concepts | Result | Details |
|---|---------|----------|--------|---------|
| 1 | basic_if.cpp | if, compare, print | ✅ PASS | |
| 2 | nested_loop.cpp | while_loop, count_loop | ❌ STDOUT_DIFF | Missing increment |
| 3 | array_sum.cpp | array_declare, count_loop | ⚠️ LIFT_FAIL | Unknown node type |

Summary: 8/10 PASS, 1 STDOUT_DIFF, 1 LIFT_FAIL
```

For each failure, include:
1. The original C++ code
2. The semantic tree (JSON, condensed)
3. The generated C++ code
4. The diff between expected and actual stdout
5. A root cause hypothesis

### Step 8: Generate Regression Tests (if bugs found)

For each ❌ result, create a regression test:

```typescript
// tests/integration/roundtrip/rt_{concept}_{id}.test.ts
import { describe, it, expect } from 'vitest'
// ... pipeline imports

describe('round-trip: {description}', () => {
  const originalCode = `{code}`

  it('should lift without degradation', () => {
    // Parse and lift, verify no raw_code nodes
  })

  it('should generate compilable code', () => {
    // Lift → generate, verify output compiles
  })

  it('should preserve program semantics', () => {
    // Full round-trip, compare stdout
  })
})
```

## Quick Mode

For rapid iteration during development, run a minimal round-trip on a single snippet:

```
/concept.roundtrip `int main() { int x = 5; if (x > 3) { cout << "yes"; } return 0; }`
```

This skips report generation and just shows: PASS/FAIL + diff if failed.

## Configuration

- Compiler: `g++` (fallback to `clang++`)
- C++ standard: C++17
- Timeout per program: 5 seconds
- Temp directory: `/tmp/semorphe-roundtrip/`
- Clean up temp files after successful run (keep on failure for debugging)
