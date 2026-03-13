/**
 * C++ cstdio Roundtrip Tests
 *
 * Verifies that C++ cstdio concepts (cpp_printf, cpp_scanf, cpp_scanf_expr)
 * survive the full roundtrip:
 *
 *   C++ code → (tree-sitter parse) → AST → (lift) → SemanticTree
 *     → (generate) → C++ code → (re-lift) → SemanticTree  [P1 structural equivalence]
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import type { Lifter } from '../../src/core/lift/lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { setupTestRenderer } from '../helpers/setup-renderer'
import type { StylePreset } from '../../src/core/types'
import type { SemanticNode } from '../../src/core/semantic-tree'

const style: StylePreset = {
  id: 'apcs',
  name: { 'zh-TW': 'APCS', en: 'APCS' },
  io_style: 'printf',
  naming_convention: 'camelCase',
  indent_size: 4,
  brace_style: 'K&R',
  namespace_style: 'using',
  header_style: 'individual',
}

let tsParser: Parser
let lifter: Lifter

beforeAll(async () => {
  await Parser.init({
    locateFile: (scriptName: string) => `${process.cwd()}/public/${scriptName}`,
  })
  tsParser = new Parser()
  const lang = await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`)
  tsParser.setLanguage(lang)
  lifter = createTestLifter()
  registerCppLanguage()
  setupTestRenderer()
})

function liftCode(code: string): SemanticNode | null {
  const tree = tsParser.parse(code)
  return lifter.lift(tree.rootNode as any)
}

function roundTripCode(code: string): string {
  const tree = liftCode(code)
  expect(tree).not.toBeNull()
  return generateCode(tree!, 'cpp', style)
}

function findConcept(node: SemanticNode | null, conceptId: string): SemanticNode | null {
  if (!node) return null
  if (node.concept === conceptId) return node
  for (const children of Object.values(node.children ?? {})) {
    for (const child of children as SemanticNode[]) {
      const found = findConcept(child, conceptId)
      if (found) return found
    }
  }
  return null
}

describe('C++ cstdio Roundtrip', () => {
  // ─── 1. cpp_printf basic ────────────────────────────────
  describe('cpp_printf basic', () => {
    const code = '#include <cstdio>\nint main() {\n    int x = 42;\n    printf("%d\\n", x);\n    return 0;\n}'

    it('should lift to cpp_printf concept', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const node = findConcept(tree, 'cpp_printf')
      expect(node).not.toBeNull()
      expect(node!.properties.format).toContain('%d')
    })

    it('should generate code containing printf()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('printf(')
    })

    it('should survive P1 structural equivalence on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      const node2 = findConcept(tree2, 'cpp_printf')
      expect(node2).not.toBeNull()
      expect(node2!.properties.format).toContain('%d')
    })
  })

  // ─── 2. cpp_printf multiple args ────────────────────────
  describe('cpp_printf multiple args', () => {
    const code = '#include <cstdio>\nint main() {\n    int a = 10;\n    int b = 20;\n    printf("%d + %d = %d\\n", a, b, a + b);\n    return 0;\n}'

    it('should lift with multiple args as children', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const node = findConcept(tree, 'cpp_printf')
      expect(node).not.toBeNull()
      expect(node!.children.args).toBeDefined()
      expect(node!.children.args.length).toBeGreaterThanOrEqual(3)
    })

    it('should survive P1 structural equivalence on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      const node2 = findConcept(tree2, 'cpp_printf')
      expect(node2).not.toBeNull()
      expect(node2!.children.args.length).toBeGreaterThanOrEqual(3)
    })
  })

  // ─── 3. cpp_printf no args (string only) ────────────────
  describe('cpp_printf string only', () => {
    const code = '#include <cstdio>\nint main() {\n    printf("hello world\\n");\n    return 0;\n}'

    it('should lift to cpp_printf with no args', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const node = findConcept(tree, 'cpp_printf')
      expect(node).not.toBeNull()
    })

    it('should generate code containing printf("hello world")', () => {
      const output = roundTripCode(code)
      expect(output).toContain('printf("hello world')
    })

    it('should survive P1 on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      expect(findConcept(tree2, 'cpp_printf')).not.toBeNull()
    })
  })

  // ─── 4. cpp_printf with float format ────────────────────
  describe('cpp_printf float', () => {
    const code = '#include <cstdio>\nint main() {\n    double pi = 3.14159;\n    printf("%.2f\\n", pi);\n    return 0;\n}'

    it('should lift with float format string', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const node = findConcept(tree, 'cpp_printf')
      expect(node).not.toBeNull()
      expect(node!.properties.format).toContain('%.2f')
    })

    it('should survive P1 on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      const node2 = findConcept(tree2, 'cpp_printf')
      expect(node2).not.toBeNull()
      expect(node2!.properties.format).toContain('%.2f')
    })
  })

  // ─── 5. cpp_scanf basic ─────────────────────────────────
  describe('cpp_scanf basic', () => {
    const code = '#include <cstdio>\nint main() {\n    int x;\n    scanf("%d", &x);\n    printf("%d\\n", x);\n    return 0;\n}'

    it('should lift to cpp_scanf concept', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const node = findConcept(tree, 'cpp_scanf')
      expect(node).not.toBeNull()
      expect(node!.properties.format).toContain('%d')
    })

    it('should generate code containing scanf()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('scanf(')
    })

    it('should survive P1 structural equivalence on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      const node2 = findConcept(tree2, 'cpp_scanf')
      expect(node2).not.toBeNull()
      expect(node2!.properties.format).toContain('%d')
    })
  })

  // ─── 6. cpp_scanf multiple vars ─────────────────────────
  describe('cpp_scanf multiple vars', () => {
    const code = '#include <cstdio>\nint main() {\n    int a, b;\n    scanf("%d %d", &a, &b);\n    printf("%d\\n", a + b);\n    return 0;\n}'

    it('should lift with multiple var_ref children', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const node = findConcept(tree, 'cpp_scanf')
      expect(node).not.toBeNull()
      expect(node!.children.args.length).toBe(2)
    })

    it('should survive P1 on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      const node2 = findConcept(tree2, 'cpp_scanf')
      expect(node2).not.toBeNull()
      expect(node2!.children.args.length).toBe(2)
    })
  })

  // ─── 7. cpp_printf with char format ─────────────────────
  describe('cpp_printf char', () => {
    const code = "#include <cstdio>\nint main() {\n    char c = 'A';\n    printf(\"%c\\n\", c);\n    return 0;\n}"

    it('should lift with char format', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const node = findConcept(tree, 'cpp_printf')
      expect(node).not.toBeNull()
      expect(node!.properties.format).toContain('%c')
    })

    it('should survive P1 on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      expect(findConcept(tree2, 'cpp_printf')).not.toBeNull()
    })
  })

  // ─── 8. cpp_printf in loop ──────────────────────────────
  describe('cpp_printf in loop', () => {
    const code = '#include <cstdio>\nint main() {\n    for (int i = 1; i <= 3; i++) {\n        printf("i=%d\\n", i);\n    }\n    return 0;\n}'

    it('should lift printf inside loop body', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const node = findConcept(tree, 'cpp_printf')
      expect(node).not.toBeNull()
    })

    it('should generate printf inside for loop', () => {
      const output = roundTripCode(code)
      expect(output).toContain('printf(')
      expect(output).toContain('for')
    })

    it('should survive P1 on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      expect(findConcept(tree2, 'cpp_printf')).not.toBeNull()
    })
  })
})
