---
name: concept-fuzz
description: >
  Generate information-isolated fuzz tests for Semorphe's code↔blocks pipeline.
  Uses a dual-agent architecture: Agent A (blind to implementation) writes real C++ programs,
  Agent B verifies round-trip correctness and compiler output equivalence.
  Use to find edge cases and bugs that implementation-aware testing would miss.
user-invocable: true
---

# Concept Fuzz Testing

## User Input

```text
$ARGUMENTS
```

The argument specifies the scope: a difficulty level (`easy`, `medium`, `hard`, `all`), a specific topic (`loops`, `functions`, `arrays`, `pointers`), a number of programs to generate (default: 10), or a combination (e.g., `hard loops 20`).

## Architecture: Dual-Agent Information Isolation

This skill uses **two agents with strict information boundaries** to produce high-quality tests:

```
Agent A (Problem Author)         Agent B (Verifier)
━━━━━━━━━━━━━━━━━━━━━━━         ━━━━━━━━━━━━━━━━━━━
KNOWS:                           KNOWS:
  ✓ C++ language specification     ✓ Full Semorphe source code
  ✓ Cognitive level definitions    ✓ How to run lift/render/generate
  ✓ "Write real C++ programs"      ✓ How to call g++/clang++
                                   ✓ How to compare outputs
DOES NOT KNOW:
  ✗ Semorphe source code         DOES NOT KNOW:
  ✗ Which concepts are supported   ✗ Why these programs were chosen
  ✗ How lifter/generator works     ✗ Agent A's intent
  ✗ Known bugs or limitations
```

**Why this matters**: If the test author knows the implementation, they unconsciously avoid patterns the code doesn't handle. An ignorant author writes code the way a real student would — exposing real gaps.

## Workflow

### Step 1: Launch Agent A (Isolated Problem Author)

Launch Agent A using the Agent tool with `isolation: "worktree"` to prevent access to source code.

**Agent A's prompt** (adapt based on user's `$ARGUMENTS`):

---

You are a C++ programming instructor creating practice programs for students. You have NO knowledge of any specific tool or system — you are simply writing real, compilable C++ programs.

**Requirements for each program:**
1. Must compile with `g++ -std=c++17 -o prog prog.cpp` without errors
2. Must produce deterministic stdout output (no random, no user input, no time-dependent)
3. Must be self-contained (single file, standard headers only)
4. Must include a `main()` function
5. Should represent realistic student code at the specified difficulty level

**Difficulty calibration:**

EASY (L0 equivalent):
- Variables, basic arithmetic, simple if/else, while loops
- cout/cin (with hardcoded values instead of cin), endl
- No functions other than main, no arrays, no pointers
- Tricky patterns: operator precedence, dangling else, integer overflow edge

MEDIUM (L1 equivalent):
- Functions with parameters and return values, for loops, nested control flow
- Logical operators (&&, ||, !), compound assignment (+=, -=)
- switch/case, do-while, break/continue in loops
- Tricky patterns: function calling function, shadowed variables, short-circuit evaluation

HARD (L2 equivalent):
- Arrays (declaration, access, iteration), string operations
- Pointers and references, pass-by-reference
- Recursion, multiple functions interacting
- Preprocessor (#include with different headers)
- Tricky patterns: pointer arithmetic, array decay, off-by-one, dangling references

**For each program, output a JSON object:**

```json
{
  "id": "fuzz_{N}",
  "difficulty": "easy|medium|hard",
  "topic": "brief topic description",
  "description": "what this program tests (1 sentence)",
  "code": "the full C++ source code",
  "expected_concepts": ["var_declare", "arithmetic", "if", ...],
  "tricky_aspect": "what makes this program non-trivial (1 sentence)"
}
```

Generate {N} programs covering diverse patterns. Focus on EDGE CASES and TRICKY COMBINATIONS — not textbook hello-world programs. Think about what real students write that breaks tools.

Examples of good tricky programs:
- Nested ternary inside cout
- for loop with comma operator: `for(int i=0,j=10; i<j; i++,j--)`
- Multiple variable declaration: `int a=1, b=2, c=a+b;`
- String with escape sequences in cout
- Chained comparison that doesn't do what students think: `if (1 < x < 10)`
- Empty loop body: `while(arr[i++]);`
- Macro-like patterns that are valid C++

Output ALL programs as a single JSON array.

---

### Step 2: Compile Agent A's Programs

After Agent A returns its programs:

1. Parse the JSON array of programs
2. For each program:
   ```bash
   echo "$CODE" > /tmp/fuzz_{id}.cpp
   g++ -std=c++17 -o /tmp/fuzz_{id} /tmp/fuzz_{id}.cpp 2>/tmp/fuzz_{id}_compile.log
   ```
3. Run programs that compiled successfully:
   ```bash
   timeout 5 /tmp/fuzz_{id} > /tmp/fuzz_{id}_expected.txt 2>&1
   ```
4. Record: compile success/failure, stdout output, stderr

**Discard** programs that don't compile — Agent A made a mistake, not a test failure.

### Step 3: Run Round-Trip Pipeline

For each successfully compiled program, run the Semorphe pipeline:

1. **Lift**: Use the project's lifter to convert C++ → SemanticTree
2. **Generate**: Use the code generator to convert SemanticTree → C++ code
3. **Compile generated code**:
   ```bash
   echo "$GENERATED_CODE" > /tmp/fuzz_{id}_gen.cpp
   g++ -std=c++17 -o /tmp/fuzz_{id}_gen /tmp/fuzz_{id}_gen.cpp 2>/tmp/fuzz_{id}_gen_compile.log
   ```
4. **Run generated code**:
   ```bash
   timeout 5 /tmp/fuzz_{id}_gen > /tmp/fuzz_{id}_actual.txt 2>&1
   ```
5. **Compare outputs**:
   ```bash
   diff /tmp/fuzz_{id}_expected.txt /tmp/fuzz_{id}_actual.txt
   ```

To perform steps 1-2 programmatically, create and run a Node.js script:

```typescript
// /tmp/semorphe-fuzz-runner.ts
import { Lifter } from '../src/core/lift/lifter'
import { PatternLifter } from '../src/core/lift/pattern-lifter'
import { registerCppLifters } from '../src/languages/cpp/lifters'
import { registerCppLanguage } from '../src/languages/cpp/generators'
import { generateCodeWithMapping } from '../src/core/projection/code-generator'
import { renderToBlocklyState } from '../src/core/projection/block-renderer'
// ... initialize parser, lifter, generator
// ... for each program: parse → lift → generate → write output
```

### Step 4: Classify Results

For each program, classify the result:

| Result | Meaning | Action |
|--------|---------|--------|
| **PASS** | Generated code compiles and produces identical output | Record as passing test |
| **SEMANTIC_DIFF** | Generated code compiles but output differs | **BUG** — investigate semantic tree |
| **COMPILE_FAIL** | Generated code doesn't compile | **BUG** — generator produced invalid C++ |
| **LIFT_FAIL** | Lifter crashed or returned null | **LIMITATION** — may need new concept |
| **EXPECTED_DEGRADATION** | Code uses unsupported features, degraded to raw_code | Expected — record coverage gap |
| **TIMEOUT** | Generated code hangs | **BUG** — possible infinite loop in generated code |

### Step 5: Generate Report and Tests

Create a fuzz report at `tests/fuzz-reports/fuzz-{timestamp}.md`:

```markdown
# Fuzz Test Report — {date}

## Summary
- Programs generated: N
- Compiled successfully: N
- Round-trip PASS: N
- SEMANTIC_DIFF (bugs): N
- COMPILE_FAIL (bugs): N
- LIFT_FAIL (limitations): N
- EXPECTED_DEGRADATION: N

## Bugs Found

### Bug 1: {description}
- **Input**: ```cpp {original code} ```
- **Expected output**: {expected stdout}
- **Actual output**: {actual stdout}
- **Semantic tree**: {JSON dump of lifted tree}
- **Generated code**: ```cpp {generated code} ```
- **Root cause hypothesis**: {analysis}

## Coverage Gaps
{concepts used by Agent A that Semorphe doesn't support yet}

## Regression Tests Generated
{list of test files created}
```

For each **BUG** found, generate a regression test in `tests/integration/fuzz/`:

```typescript
// tests/integration/fuzz/fuzz_{id}.test.ts
import { describe, it, expect } from 'vitest'
// ... imports

describe('fuzz_{id}: {description}', () => {
  const originalCode = `{code}`
  const expectedOutput = `{expected stdout}`

  it('should round-trip correctly', () => {
    // lift → generate → compare
  })

  it('should produce equivalent compiler output', () => {
    // compile both → run both → compare stdout
  })
})
```

### Step 6: Summary to User

Present:
1. How many programs were tested
2. How many bugs were found (with severity)
3. How many coverage gaps were identified
4. What regression tests were created
5. Recommendation: which bugs to fix first

## Configuration

- Default program count: 10
- Compiler: `g++` (fallback to `clang++`)
- C++ standard: C++17
- Timeout per program: 5 seconds
- Temp directory: `/tmp/semorphe-fuzz/`

## Tips for Effective Fuzzing

- Run multiple times — each run generates different programs
- Start with `easy` to verify basic pipeline, then escalate to `hard`
- Focus on specific topics when investigating known weak areas
- The most valuable bugs come from `SEMANTIC_DIFF` — the code compiles but does the wrong thing
