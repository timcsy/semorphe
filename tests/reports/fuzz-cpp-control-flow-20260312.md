# Fuzz Test Report -- C++ Control Flow -- 2026-03-12

## Summary
- Language: C++
- Total programs generated: 20 (Round 1: 10, Round 2: 10)
- Successful execution: 20
- Round-trip PASS: 16
- COMPILE_FAIL: 2 (switch fall-through + char literal in switch)
- SEMANTIC_DIFF: 2 (array initializer -- Phase 4 scope)

## Round 1 Results (original)

| # | Program | Status | Notes |
|---|---------|--------|-------|
| 1 | Nested for with break | PASS | |
| 2 | Do-while compound condition | PASS | |
| 3 | Continue in for loop | PASS | |
| 4 | Function with loop | PASS | |
| 5 | While with break+continue | PASS | |
| 6 | Nested loops with continue | PASS | |
| 7 | Switch fall-through | COMPILE_FAIL | Empty case body fall-through not supported |
| 8 | Char literals in switch | COMPILE_FAIL | Char literal case labels not lifted correctly |
| 9 | Array initializer lists | SEMANTIC_DIFF | Phase 4 scope |
| 10 | Array initializer lists | SEMANTIC_DIFF | Phase 4 scope |

## Round 2 Results (edge cases + tricky combinations)

| # | Program | Status | Notes |
|---|---------|--------|-------|
| 1 | Operator precedence (&&/\|\|) | PASS | Mixed && and \|\| without parens |
| 2 | Integer division edge cases | PASS | Division truncation in loop conditions |
| 3 | Nested loops, break inner only | PASS | Break only affects innermost loop |
| 4 | Switch with many cases + default | PASS | 5 cases + default in loop |
| 5 | Do-while single iteration + break | PASS | Condition false from start; break in do-while |
| 6 | Complex else-if with nested if | PASS | Nested if inside else-if branch |
| 7 | For countdown + Collatz sequence | PASS | Decrementing for loop; Collatz (111 steps) |
| 8 | Nested for, continue in outer | PASS | Continue skips outer iteration |
| 9 | Multiple sequential while loops | PASS | Three sequential loops |
| 10 | GCD + Fibonacci algorithms | PASS | Classic algorithms with while/for |

## Bugs Found and Fixed (Round 1)

### Bug 1: switch-case value leaking into body (fixed)
- **Program**: roundtrip test #8
- **Original**: `case 1: cout << "Mon" << endl; break;`
- **Bad output**: `case 1:\n1            cout << "Mon" << endl;`
- **Root cause**: web-tree-sitter node `===` reference comparison failed, `filter(c => c !== valueNode)` ineffective
- **Fix**: Use `startPosition` coordinate comparison
- **Fix location**: `src/languages/cpp/core/lifters/statements.ts`

## Known Limitations

### COMPILE_FAIL: switch fall-through
- Empty case body fall-through pattern (`case 0: case 1:`) code generation has issues
- **Scope**: Phase 2

### COMPILE_FAIL: char literal in switch
- Switch case char literal `'A'` generated as string literal `"A"`
- **Scope**: Phase 1 char literal + switch interaction

### SEMANTIC_DIFF: array initializer lists
- `int arr[] = {1, 2, 3}` initializer list lost in roundtrip
- **Scope**: Phase 4 arrays & pointers

## Generated Regression Tests
- `tests/integration/fuzz-cpp-control-flow.test.ts` (16 PASS tests + 3 todo/skip)
