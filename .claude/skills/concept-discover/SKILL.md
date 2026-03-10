---
name: concept-discover
description: >
  Research a C++ library, standard header, or language feature from documentation and web resources.
  Discover function signatures, common usage patterns, classify by cognitive level (L0/L1/L2),
  and propose concept names following Semorphe conventions.
  Use when adding support for a new C++ library, header, or language feature set.
user-invocable: true
---

# Concept Discovery

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding. The argument is the target library, header, or language feature to research (e.g., `<algorithm>`, `<string>`, `pointer arithmetic`, `STL containers`).

## Context

You are researching a C++ library or language feature to prepare it for integration into **Semorphe** — a semantic-tree-driven programming education tool. Your job is to discover what concepts exist, how they're commonly used, and how to classify them for learners.

**CRITICAL**: Read the project's first principles before starting:
- `docs/first-principles.md` — especially P2 (Concept Algebra) and P4 (Progressive Disclosure)
- `src/core/types.ts` — existing UniversalConcept and LanguageSpecificConcept types

## Workflow

### Phase 1: Research

1. **Web Search** the target library/feature:
   - Search for official cppreference documentation
   - Search for common usage patterns and tutorials
   - Search for "most commonly used functions in [library]"
   - Search for "beginner vs advanced [library] features"

2. **Fetch Documentation**:
   - Fetch the cppreference page for each relevant header/feature
   - Extract function signatures, parameter types, return types
   - Note which functions are most commonly used in education

### Phase 2: Concept Extraction

For each discovered function/feature, extract:

| Field | Description |
|-------|-------------|
| **C++ Syntax** | The actual C++ syntax (e.g., `sort(v.begin(), v.end())`) |
| **Semantic Meaning** | What it does conceptually (e.g., "sort a range") |
| **Parameters** | What the learner needs to provide |
| **Common Patterns** | How it's typically used in real code |
| **Prerequisites** | What concepts the learner must already know |
| **Error Patterns** | Common mistakes beginners make |

### Phase 3: Cognitive Level Classification

Classify each concept into cognitive levels using these criteria:

**L0 (Beginner)** — Minimal prerequisite knowledge:
- Can be explained without understanding types, memory, or advanced control flow
- Used in first-week programming exercises
- Cognitive load: 1-2 inputs on the block

**L1 (Intermediate)** — Requires basic programming understanding:
- Needs understanding of functions, return values, or basic data structures
- Used in typical homework assignments
- Cognitive load: 2-4 inputs on the block

**L2 (Advanced)** — Requires deeper understanding:
- Involves templates, iterators, pointers, or complex type systems
- Used in competitions or advanced coursework
- Cognitive load: 4+ inputs or requires understanding hidden concepts

### Phase 4: Naming

Propose concept names following Semorphe conventions:

- **Universal concepts** (language-agnostic): `snake_case` (e.g., `sort_range`, `find_element`)
- **Language-specific concepts**: `cpp_snake_case` (e.g., `cpp_vector_push`, `cpp_iterator_advance`)
- Names should describe the **semantic action**, not the C++ syntax
- Prefer short, descriptive names (2-3 words max)

Check `src/core/types.ts` for existing names to avoid conflicts.

### Phase 5: Output

Generate a structured report at `specs/concept-discovery-{topic}.md`:

```markdown
# Concept Discovery: {Topic}

## Summary
- Target: {library/feature}
- Total concepts found: N
- L0: N, L1: N, L2: N

## Concept Catalog

### L0 — Beginner

| Concept Name | C++ Syntax | Semantic Meaning | Block Inputs | Notes |
|---|---|---|---|---|

### L1 — Intermediate

| Concept Name | C++ Syntax | Semantic Meaning | Block Inputs | Notes |
|---|---|---|---|---|

### L2 — Advanced

| Concept Name | C++ Syntax | Semantic Meaning | Block Inputs | Notes |
|---|---|---|---|---|

## Dependency Graph
{which concepts depend on which}

## Recommended Implementation Order
{ordered by dependency + cognitive level}

## Edge Cases to Watch
{tricky syntax, ambiguous semantics, common pitfalls}
```

Also check existing concepts to identify:
- Overlap with already-supported concepts
- Concepts that could be generalized (universal vs language-specific)
- Gaps in the current concept coverage

## Guidelines

- **Prioritize by educational value** — not all C++ features need blocks
- **Minimize cognitive load** — if a concept needs 6 inputs, consider splitting it
- **Think in semantic actions** — `sort(v.begin(), v.end())` is semantically "sort this container", not "call sort with two iterator arguments"
- **Consider block UX** — would a learner understand this block without reading documentation?
