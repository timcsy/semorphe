# Round-Trip Test Report -- C++ Control Flow -- 2026-03-12

## Summary
- Language: C++
- Test programs: 10
- PASS: 10
- FAIL: 0
- P1 stability (lift -> gen -> lift -> gen idempotence): 10/10 PASS
- Execution correctness (g++ compile + output diff): 10/10 PASS

## Previously Fixed Bugs

### Bug 1: switch-case value leaking into body (fixed)
- **Issue**: `liftCaseStatement` used `c !== valueNode` to filter body children, but web-tree-sitter creates new wrapper objects on each access, so `===` was always false
- **Symptom**: `case 1:` body's first line appeared as `1            cout << ...`
- **Fix**: Use `startPosition` comparison instead of `===` reference equality
- **Location**: `src/languages/cpp/core/lifters/statements.ts`
- **Related fix**: `src/languages/cpp/core/lifters/strategies.ts` (typedef lifter)

## Test Results

| # | Program | Concepts | Lift | Generate | P1 Stable | Compile | Output Match |
|---|---------|----------|------|----------|-----------|---------|--------------|
| 1 | basic_if | if, compare | PASS | PASS | PASS | PASS | PASS |
| 2 | if_else | if, else if, else, compare | PASS | PASS | PASS | PASS | PASS |
| 3 | while_loop | while, arithmetic, assign | PASS | PASS | PASS | PASS | PASS |
| 4 | count_loop | count_loop (for i++), cout | PASS | PASS | PASS | PASS | PASS |
| 5 | cpp_for_loop | cpp_for_loop (general), arithmetic | PASS | PASS | PASS | PASS | PASS |
| 6 | break_continue | for, if, break, continue | PASS | PASS | PASS | PASS | PASS |
| 7 | cpp_do_while | do-while, arithmetic | PASS | PASS | PASS | PASS | PASS |
| 8 | cpp_switch | switch, case, default, break | PASS | PASS | PASS | PASS | PASS |
| 9 | nested_control | nested for/if combinations | PASS | PASS | PASS | PASS | PASS |
| 10 | complex_control | all control flow concepts combined | PASS | PASS | PASS | PASS | PASS |

## Test Programs

1. **basic_if.cpp** - Simple if statement with comparison
2. **if_else.cpp** - If-else-if chain (grade classification)
3. **while_loop.cpp** - While loop summing 1..10
4. **count_loop.cpp** - Counting for loop (i++ pattern)
5. **cpp_for_loop.cpp** - General for loop (i = i + 2 step)
6. **break_continue.cpp** - Break and continue in for loop
7. **cpp_do_while.cpp** - Do-while loop doubling values
8. **cpp_switch.cpp** - Switch with 3 cases and default
9. **nested_control.cpp** - Nested for loops with if-else (identity matrix)
10. **complex_control.cpp** - Combined: for, while, do-while, switch, break, continue

## Regression Tests
- `tests/integration/roundtrip-control-flow.test.ts` (20 tests: 10 execution + 10 stability)
