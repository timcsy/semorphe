import { describe, it, expect, beforeAll } from 'vitest'
import { CppParser } from '../../src/languages/cpp/parser'

describe('CppParser', () => {
  let parser: CppParser

  beforeAll(async () => {
    parser = new CppParser()
    await parser.init()
  })

  describe('初始化', () => {
    it('should have language id cpp', () => {
      expect(parser.getLanguageId()).toBe('cpp')
    })

    it('should be initialized after init()', () => {
      expect(parser.isInitialized()).toBe(true)
    })
  })

  describe('解析簡單程式碼', () => {
    it('should parse empty program', async () => {
      const tree = await parser.parse('')
      expect(tree).toBeDefined()
      expect(tree.rootNode).toBeDefined()
      expect(tree.rootNode.type).toBe('translation_unit')
    })

    it('should parse hello world', async () => {
      const code = '#include <stdio.h>\nint main() {\n    printf("Hello\\n");\n    return 0;\n}'
      const tree = await parser.parse(code)
      expect(tree.rootNode.type).toBe('translation_unit')
      expect(tree.rootNode.childCount).toBeGreaterThan(0)
    })

    it('should parse variable declaration', async () => {
      const tree = await parser.parse('int x = 10;')
      const decl = tree.rootNode.firstChild
      expect(decl).toBeDefined()
      expect(decl!.type).toBe('declaration')
    })

    it('should parse for loop', async () => {
      const code = 'void f() { for (int i = 0; i < 10; i++) { } }'
      const tree = await parser.parse(code)
      const funcDef = tree.rootNode.firstChild
      expect(funcDef!.type).toBe('function_definition')
      // compound_statement's firstChild is '{', use namedChildren
      const body = funcDef!.childForFieldName('body')
      const forStmt = body?.namedChildren[0]
      expect(forStmt?.type).toBe('for_statement')
    })

    it('should parse if-else statement', async () => {
      const code = 'void f() { if (x > 0) { y = 1; } else { y = 0; } }'
      const tree = await parser.parse(code)
      const funcDef = tree.rootNode.firstChild
      const body = funcDef!.childForFieldName('body')
      const ifStmt = body?.namedChildren[0]
      expect(ifStmt?.type).toBe('if_statement')
    })

    it('should parse function definition', async () => {
      const code = 'int add(int a, int b) { return a + b; }'
      const tree = await parser.parse(code)
      const funcDef = tree.rootNode.firstChild
      expect(funcDef!.type).toBe('function_definition')
    })

    it('should parse preprocessor include', async () => {
      const code = '#include <stdio.h>'
      const tree = await parser.parse(code)
      const include = tree.rootNode.firstChild
      expect(include!.type).toBe('preproc_include')
    })

    it('should parse struct definition', async () => {
      const code = 'struct Point { int x; int y; };'
      const tree = await parser.parse(code)
      const typeDecl = tree.rootNode.firstChild
      expect(typeDecl).toBeDefined()
    })
  })

  describe('CST 節點屬性', () => {
    it('should provide node text', async () => {
      const tree = await parser.parse('int x = 42;')
      expect(tree.rootNode.text).toContain('int x = 42')
    })

    it('should provide child nodes', async () => {
      const tree = await parser.parse('int x = 42;')
      const decl = tree.rootNode.firstChild!
      expect(decl.childCount).toBeGreaterThan(0)
    })

    it('should support named fields', async () => {
      const code = 'void f() { for (int i = 0; i < 10; i++) {} }'
      const tree = await parser.parse(code)
      const funcDef = tree.rootNode.firstChild!
      const body = funcDef.childForFieldName('body')!
      const forStmt = body.namedChildren[0]!
      expect(forStmt.childForFieldName('condition')).toBeDefined()
    })
  })
})
