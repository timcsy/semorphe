---
name: concept-generate
description: >
  Generate BlockSpec JSON, code generator, lifter, and render mapping for concepts
  defined in a concept discovery report. Produces all artifacts needed to support
  new concepts in Semorphe's semantic tree pipeline.
  Use after /concept.discover to create implementation artifacts.
user-invocable: true
---

# Concept Generation

## User Input

```text
$ARGUMENTS
```

The argument should be a path to a concept discovery report (from `/concept.discover`), or a specific concept name to generate.

## Context

You are generating the full implementation artifacts for new Semorphe concepts. Each concept needs 5 artifacts to work end-to-end:

1. **BlockSpec JSON** — defines how the concept renders as a Blockly block
2. **Code Generator** — converts SemanticNode → C++ source code
3. **Lifter** — converts C++ AST → SemanticNode (via tree-sitter)
4. **Render Mapping** — maps SemanticNode properties → block fields/inputs
5. **Test stubs** — basic round-trip tests

## Pre-flight

Before generating, read these files to understand existing patterns:

- `src/core/types.ts` — SemanticNode structure, existing concepts
- `src/languages/cpp/blocks/basic.json` — existing BlockSpec examples
- `src/languages/cpp/core/generators/` — existing generator patterns
- `src/languages/cpp/core/lifters/` — existing lifter patterns
- `src/core/projection/pattern-renderer.ts` — how render mappings work
- `docs/first-principles.md` — P2 (Concept Algebra) for property structure rules

## Workflow

### Step 1: Parse Concept Definition

From the discovery report or user input, extract for each concept:
- Concept name (snake_case)
- Cognitive level (0/1/2)
- C++ syntax pattern
- Properties (fields on the block)
- Children (input slots for sub-expressions/statements)
- Category for toolbox placement

### Step 2: Generate BlockSpec JSON

Create or append to the appropriate block JSON file.

```json
{
  "type": "c_{concept_name}",
  "conceptId": "{concept_name}",
  "category": "{category}",
  "level": {0|1|2},
  "message0": "{block label with %1 %2 placeholders}",
  "args0": [
    { "type": "field_input", "name": "FIELD_NAME", "text": "default" },
    { "type": "input_value", "name": "INPUT_NAME" }
  ],
  "output": null,
  "previousStatement": null,
  "nextStatement": null,
  "colour": "{category_colour}",
  "renderMapping": {
    "fields": { "FIELD_NAME": "property_name" },
    "inputs": { "INPUT_NAME": "child_slot" }
  }
}
```

Rules:
- `type` prefix: `c_` for C++ blocks, `u_` for universal blocks
- `message0` should be as human-readable as possible in the target locale
- Minimize the number of args — cognitive load principle
- Statement blocks: set `previousStatement`/`nextStatement`
- Expression blocks: set `output` (type or null for any)
- If a concept has both statement and expression forms, generate both with `expressionCounterpart`

### Step 3: Generate Code Generator

Add a generator function to the appropriate file in `src/languages/cpp/core/generators/`.

```typescript
generators.set('{concept_name}', (node, ctx) => {
  // Extract properties
  const prop = node.properties.prop_name
  // Generate children
  const child = generateExpression(node.children.child_slot?.[0], ctx)
  // Return formatted C++ code
  return `${indent(ctx)}${formatted_code};\n`
})
```

Rules:
- Use `indent(ctx)` for statement-level output
- Use `generateExpression()` for child expressions
- Use `generateBody()` for child statement lists
- Handle missing children gracefully (empty string or default)
- Respect `ctx.style` for formatting preferences

### Step 4: Generate Lifter

Add a lifter registration to the appropriate file in `src/languages/cpp/core/lifters/`.

```typescript
lifter.register('{tree_sitter_node_type}', (node, context) => {
  // Extract from AST node
  const prop = node.childForFieldName('field')?.text ?? ''
  // Build semantic node
  return createNode('{concept_name}', { prop }, {
    child_slot: context.liftChildren(node, 'body_field'),
  })
})
```

Rules:
- The first argument is the **tree-sitter node type** (not the concept name)
- Use `context.liftChildren()` for child nodes
- Use `node.childForFieldName()` for named fields
- Handle optional fields with `?? defaultValue`
- Multiple tree-sitter types can map to the same concept

### Step 5: Generate Tests

Create test files following the pattern in `tests/`:

```typescript
// tests/unit/languages/cpp/{concept_name}.test.ts
describe('{concept_name}', () => {
  it('should lift {description}', () => {
    const code = `{minimal C++ example}`
    // ... lift and verify semantic tree
  })

  it('should generate {description}', () => {
    const node = createNode('{concept_name}', { ... }, { ... })
    // ... generate and verify C++ output
  })

  it('should round-trip {description}', () => {
    const code = `{C++ code}`
    // ... lift → generate → compare
  })
})
```

### Step 6: Update Registrations

Identify where the new concept needs to be registered:
- Toolbox category in `src/languages/cpp/toolbox-categories.ts`
- Cognitive level availability in block JSON (`level` field)
- Any concept definition in concept registry

### Step 7: Output Summary

Report what was generated:

```
## Generated Artifacts for {concept_name}

- [ ] BlockSpec: `src/languages/cpp/blocks/{file}.json`
- [ ] Generator: `src/languages/cpp/core/generators/{file}.ts`
- [ ] Lifter: `src/languages/cpp/core/lifters/{file}.ts`
- [ ] Render mapping: embedded in BlockSpec
- [ ] Tests: `tests/unit/languages/cpp/{concept_name}.test.ts`
- [ ] Registration: {where it was added}

### Verification
Run `npm test` to verify all tests pass.
Run `npx tsc --noEmit` to verify no type errors.
```

## Guidelines

- **One concept at a time** — generate all artifacts for one concept before moving to the next
- **Follow existing patterns** — match the code style of neighboring files
- **Minimal changes** — don't refactor existing code while generating new concepts
- **Test first** — write the test before the implementation where possible
- **Block UX** — preview the block mentally: would a student understand it at first glance?
