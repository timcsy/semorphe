/**
 * C++ String Operations Roundtrip Tests
 *
 * Verifies that C++ string operation components (cpp_string_size, cpp_string_substr,
 * cpp_string_find, cpp_string_append, cpp_string_as_cstring, cpp_input_line, cpp_string_make,
 * cpp_string_as_int, cpp_string_as_double) survive the full roundtrip:
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
  io_style: 'cout',
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

/** Recursively search for a component in the semantic tree */
function findComponent(node: SemanticNode | null, componentId: string): SemanticNode | null {
  if (!node) return null
  if (node.componentId === componentId) return node
  for (const children of Object.values(node.children ?? {})) {
    for (const child of children as SemanticNode[]) {
      const found = findComponent(child, componentId)
      if (found) return found
    }
  }
  return null
}

/** Collect all component IDs present in a semantic tree */
function collectComponents(node: SemanticNode | null, result: Set<string> = new Set()): Set<string> {
  if (!node) return result
  result.add(node.componentId)
  for (const children of Object.values(node.children ?? {})) {
    for (const child of children as SemanticNode[]) {
      collectComponents(child, result)
    }
  }
  return result
}

describe('C++ String Operations Roundtrip', () => {
  // ─── 1. cpp_string_size ──────────────────────────────────

  describe('cpp:string_size', () => {
    const code = 'string s = "hello";\nint n = s.length();'

    it('should lift to cpp_string_size component', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const node = findComponent(tree, 'cpp:string_size')
      expect(node).not.toBeNull()
      expect(node!.properties.obj).toBe('s')
    })

    it('should generate code containing .length()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('.length()')
    })

    it('should survive P1 structural equivalence on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      const node2 = findComponent(tree2, 'cpp:string_size')
      expect(node2).not.toBeNull()
      expect(node2!.properties.obj).toBe('s')
    })
  })

  // ─── 2. cpp_string_substr ─────────────────────────────────

  describe('cpp:string_substr', () => {
    const code = 'string s = "hello world";\nstring sub = s.substr(0, 5);'

    it('should lift to cpp_string_substr component', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const node = findComponent(tree, 'cpp:string_substr')
      expect(node).not.toBeNull()
      expect(node!.properties.obj).toBe('s')
      expect(node!.children.pos).toHaveLength(1)
      expect(node!.children.len).toHaveLength(1)
    })

    it('should generate code containing .substr()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('.substr(')
    })

    it('should survive P1 structural equivalence on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      const node2 = findComponent(tree2, 'cpp:string_substr')
      expect(node2).not.toBeNull()
      expect(node2!.properties.obj).toBe('s')
      expect(node2!.children.pos).toHaveLength(1)
      expect(node2!.children.len).toHaveLength(1)
    })
  })

  // ─── 3. cpp_string_find ───────────────────────────────────

  describe('cpp:string_find', () => {
    const code = 'string s = "hello";\nint pos = s.find("ll");'

    it('should lift to cpp_string_find component', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const node = findComponent(tree, 'cpp:string_find')
      expect(node).not.toBeNull()
      expect(node!.properties.obj).toBe('s')
      expect(node!.children.arg).toHaveLength(1)
    })

    it('should generate code containing .find()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('.find(')
    })

    it('should survive P1 structural equivalence on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      const node2 = findComponent(tree2, 'cpp:string_find')
      expect(node2).not.toBeNull()
      expect(node2!.properties.obj).toBe('s')
    })
  })

  // ─── 4. cpp_string_append ─────────────────────────────────

  describe('cpp:string_append', () => {
    const code = 'string s = "hello";\ns.append(" world");'

    it('should lift to cpp_string_append component', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const node = findComponent(tree, 'cpp:string_append')
      expect(node).not.toBeNull()
      expect(node!.properties.obj).toBe('s')
      expect(node!.children.value).toHaveLength(1)
    })

    it('should generate code containing .append()', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const output = generateCode(tree!, 'cpp', style)
      expect(output).toContain('.append(')
    })

    it('should survive P1 structural equivalence on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      const node2 = findComponent(tree2, 'cpp:string_append')
      expect(node2).not.toBeNull()
      expect(node2!.properties.obj).toBe('s')
    })
  })

  // ─── 5. cpp_string_as_cstring ──────────────────────────────────

  describe('cpp:string_as_cstring', () => {
    const code = 'string s = "hello";\nprintf("%s", s.c_str());'

    it('should lift to cpp_string_as_cstring component', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const node = findComponent(tree, 'cpp:string_as_cstring')
      expect(node).not.toBeNull()
      expect(node!.properties.obj).toBe('s')
    })

    it('should generate code containing .c_str()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('.c_str()')
    })

    it('should survive P1 structural equivalence on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      const node2 = findComponent(tree2, 'cpp:string_as_cstring')
      expect(node2).not.toBeNull()
      expect(node2!.properties.obj).toBe('s')
    })
  })

  // ─── 6. cpp_input_line ───────────────────────────────────────

  describe('cpp:input_line', () => {
    const code = 'string line;\ngetline(cin, line);'

    it('should lift to cpp_input_line component', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const node = findComponent(tree, 'cpp:input_line')
      expect(node).not.toBeNull()
      expect(node!.properties.name).toBe('line')
    })

    it('should generate code containing getline()', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const output = generateCode(tree!, 'cpp', style)
      expect(output).toContain('getline(')
    })

    it('should survive P1 structural equivalence on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      const node2 = findComponent(tree2, 'cpp:input_line')
      expect(node2).not.toBeNull()
      expect(node2!.properties.name).toBe('line')
    })
  })

  // ─── 7. cpp_string_make ─────────────────────────────────────

  describe('cpp:string_make', () => {
    const code = 'int n = 42;\nstring s = to_string(n);'

    it('should lift to cpp_string_make component', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const node = findComponent(tree, 'cpp:string_make')
      expect(node).not.toBeNull()
      expect(node!.children.value).toHaveLength(1)
    })

    it('should generate code containing to_string()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('to_string(')
    })

    it('should survive P1 structural equivalence on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      const node2 = findComponent(tree2, 'cpp:string_make')
      expect(node2).not.toBeNull()
      expect(node2!.children.value).toHaveLength(1)
    })
  })

  // ─── 8. cpp_string_as_int ──────────────────────────────────────────

  describe('cpp:string_as_int', () => {
    const code = 'string s = "42";\nint n = stoi(s);'

    it('should lift to cpp_string_as_int component', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const node = findComponent(tree, 'cpp:string_as_int')
      expect(node).not.toBeNull()
      expect(node!.children.value).toHaveLength(1)
    })

    it('should generate code containing stoi()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('stoi(')
    })

    it('should survive P1 structural equivalence on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      const node2 = findComponent(tree2, 'cpp:string_as_int')
      expect(node2).not.toBeNull()
      expect(node2!.children.value).toHaveLength(1)
    })
  })

  // ─── 9. cpp_string_as_double ──────────────────────────────────────────

  describe('cpp:string_as_double', () => {
    const code = 'string s = "3.14";\ndouble d = stod(s);'

    it('should lift to cpp_string_as_double component', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const node = findComponent(tree, 'cpp:string_as_double')
      expect(node).not.toBeNull()
      expect(node!.children.value).toHaveLength(1)
    })

    it('should generate code containing stod()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('stod(')
    })

    it('should survive P1 structural equivalence on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      const node2 = findComponent(tree2, 'cpp:string_as_double')
      expect(node2).not.toBeNull()
      expect(node2!.children.value).toHaveLength(1)
    })
  })

  // ─── 10. cpp_string_empty (shared method → lifts as cpp_container_empty) ───

  describe('cpp:string_empty', () => {
    const code = 'string s = "";\nbool b = s.empty();'

    it('should lift to cpp_container_empty component（型別已知時的專屬身分）', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      // empty() is a shared method — without type info, lifts as generic container component
      const node = findComponent(tree, 'cpp:container_empty')
      expect(node).not.toBeNull()
      expect(node!.properties.obj).toBe('s')
    })

    it('should generate code containing .empty()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('.empty()')
    })

    it('should survive P1 structural equivalence on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      const node2 = findComponent(tree2, 'cpp:container_empty')
      expect(node2).not.toBeNull()
      expect(node2!.properties.obj).toBe('s')
    })
  })

  // ─── 11. cpp_string_erase ─────────────────────────────────

  describe('cpp:string_erase', () => {
    const code = 'string s = "hello world";\ns.erase(5, 6);'

    it('should lift to cpp_string_erase component', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const node = findComponent(tree, 'cpp:string_erase')
      expect(node).not.toBeNull()
      expect(node!.properties.obj).toBe('s')
    })

    it('should generate code containing .erase()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('.erase(')
    })

    it('should survive P1 structural equivalence on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      const node2 = findComponent(tree2, 'cpp:string_erase')
      expect(node2).not.toBeNull()
      expect(node2!.properties.obj).toBe('s')
    })
  })

  // ─── 12. cpp_string_insert ────────────────────────────────

  describe('cpp:string_insert', () => {
    const code = 'string s = "helo";\ns.insert(3, "l");'

    it('should lift to cpp_string_insert component', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const node = findComponent(tree, 'cpp:string_insert')
      expect(node).not.toBeNull()
      expect(node!.properties.obj).toBe('s')
    })

    it('should generate code containing .insert()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('.insert(')
    })

    it('should survive P1 structural equivalence on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      const node2 = findComponent(tree2, 'cpp:string_insert')
      expect(node2).not.toBeNull()
      expect(node2!.properties.obj).toBe('s')
    })
  })

  // ─── 13. cpp_string_replace ───────────────────────────────

  describe('cpp:string_replace', () => {
    const code = 'string s = "hello world";\ns.replace(0, 5, "hi");'

    it('should lift to cpp_string_replace component', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const node = findComponent(tree, 'cpp:string_replace')
      expect(node).not.toBeNull()
      expect(node!.properties.obj).toBe('s')
    })

    it('should generate code containing .replace()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('.replace(')
    })

    it('should survive P1 structural equivalence on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      const node2 = findComponent(tree2, 'cpp:string_replace')
      expect(node2).not.toBeNull()
      expect(node2!.properties.obj).toBe('s')
    })
  })

  // ⚠️ 這裡原本斷言的是**降級後**的通用容器概念，標題還寫著「shared method」
  // ——那是把一個限制寫進了測試。076 接上辨識脈絡的型別追蹤之後，
  // `s` 宣告成 string 就辨識得出專屬身分了。
  //
  // 舊註解說降級是「為了避免型別消歧問題」，讀起來像做不到；實際上消歧的
  // 機制一直都在，只是零呼叫者。見 knowledge/concepts/執行機構.md。
  // ─── 14. cpp_string_append_char （型別已知 → 專屬身分） ───

  describe('cpp:string_append_char', () => {
    const code = "string s = \"abc\";\ns.push_back('d');"

    it('should lift to cpp_string_append_char component（型別已知時的專屬身分）', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      // push_back() is a shared method — without type info, lifts as generic container component
      const node = findComponent(tree, 'cpp:string_append_char')
      expect(node).not.toBeNull()
      expect(node!.properties.obj).toBe('s')
    })

    it('should generate code containing .push_back()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('.push_back(')
    })

    it('should survive P1 structural equivalence on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      const node2 = findComponent(tree2, 'cpp:string_append_char')
      expect(node2).not.toBeNull()
      expect(node2!.properties.obj).toBe('s')
    })
  })

  // ─── 15. cpp_string_clear （型別已知 → 專屬身分） ───

  describe('cpp:string_clear', () => {
    const code = 'string s = "hello";\ns.clear();'

    it('should lift to cpp_string_clear component（型別已知時的專屬身分）', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      // clear() is a shared method — without type info, lifts as generic container component
      const node = findComponent(tree, 'cpp:string_clear')
      expect(node).not.toBeNull()
      expect(node!.properties.obj).toBe('s')
    })

    it('should generate code containing .clear()', () => {
      const output = roundTripCode(code)
      expect(output).toContain('.clear()')
    })

    it('should survive P1 structural equivalence on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()
      const node2 = findComponent(tree2, 'cpp:string_clear')
      expect(node2).not.toBeNull()
      expect(node2!.properties.obj).toBe('s')
    })
  })

  // ─── 16. Mixed: multiple string ops combined ──────────────

  describe('mixed string operations', () => {
    const code = [
      'string s = "hello world";',
      'int len = s.length();',
      'string sub = s.substr(0, 5);',
      'int pos = s.find("world");',
      's.append("!");',
      'string line;',
      'getline(cin, line);',
      'int n = 42;',
      'string numStr = to_string(n);',
      'int parsed = stoi(numStr);',
      'double pi = stod("3.14");',
      's.erase(5, 1);',
      's.insert(5, " ");',
      's.replace(0, 5, "hi");',
      "s.push_back('!');",
    ].join('\n')

    it('should lift all string components from mixed program', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()

      const components = collectComponents(tree)
      expect(components.has('cpp:string_size')).toBe(true)
      expect(components.has('cpp:string_substr')).toBe(true)
      expect(components.has('cpp:string_find')).toBe(true)
      expect(components.has('cpp:string_append')).toBe(true)
      expect(components.has('cpp:input_line')).toBe(true)
      expect(components.has('cpp:string_make')).toBe(true)
      expect(components.has('cpp:string_as_int')).toBe(true)
      expect(components.has('cpp:string_as_double')).toBe(true)
      expect(components.has('cpp:string_erase')).toBe(true)
      expect(components.has('cpp:string_insert')).toBe(true)
      expect(components.has('cpp:string_replace')).toBe(true)
      // Shared methods lift as vector components (no type info available)
      expect(components.has('cpp:string_append_char')).toBe(true)
    })

    it('should generate code preserving all string operations', () => {
      const output = roundTripCode(code)
      expect(output).toContain('.length()')
      expect(output).toContain('.substr(')
      expect(output).toContain('.find(')
      expect(output).toContain('to_string(')
      expect(output).toContain('stoi(')
      expect(output).toContain('stod(')
      expect(output).toContain('.append(')
      expect(output).toContain('getline(')
      expect(output).toContain('.erase(')
      expect(output).toContain('.insert(')
      expect(output).toContain('.replace(')
      expect(output).toContain('.push_back(')
    })

    it('should survive P1 structural equivalence on re-lift', () => {
      const output = roundTripCode(code)
      const tree2 = liftCode(output)
      expect(tree2).not.toBeNull()

      const components2 = collectComponents(tree2)
      expect(components2.has('cpp:string_size')).toBe(true)
      expect(components2.has('cpp:string_substr')).toBe(true)
      expect(components2.has('cpp:string_find')).toBe(true)
      expect(components2.has('cpp:string_make')).toBe(true)
      expect(components2.has('cpp:string_as_int')).toBe(true)
      expect(components2.has('cpp:string_as_double')).toBe(true)
      expect(components2.has('cpp:string_append')).toBe(true)
      expect(components2.has('cpp:input_line')).toBe(true)
      expect(components2.has('cpp:string_erase')).toBe(true)
      expect(components2.has('cpp:string_insert')).toBe(true)
      expect(components2.has('cpp:string_replace')).toBe(true)
      // Shared methods lift as vector components (no type info available)
      expect(components2.has('cpp:string_append_char')).toBe(true)
    })
  })
})
