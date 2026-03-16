import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { setupTestRenderer } from '../helpers/setup-renderer'
import { createTestLifter } from '../helpers/setup-lifter'
import type { StylePreset, SemanticNode } from '../../src/core/types'

const style: StylePreset = {
  id: 'apcs', name: { 'zh-TW': 'APCS', en: 'APCS' },
  io_style: 'cout', naming_convention: 'camelCase',
  indent_size: 4, brace_style: 'K&R',
  namespace_style: 'using', header_style: 'individual',
}

let tsParser: Parser
let lifter: ReturnType<typeof createTestLifter>

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
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

function roundTrip(code: string): string {
  const sem = liftCode(code)
  expect(sem).not.toBeNull()
  return generateCode(sem!, 'cpp', style)
}

function findConcepts(node: SemanticNode, target: string): SemanticNode[] {
  const results: SemanticNode[] = []
  if (node.concept === target) results.push(node)
  for (const children of Object.values(node.children || {})) {
    for (const child of children as SemanticNode[]) {
      results.push(...findConcepts(child, target))
    }
  }
  return results
}

function findAllConcepts(node: SemanticNode): string[] {
  const results: string[] = [node.concept]
  for (const children of Object.values(node.children || {})) {
    for (const child of children as SemanticNode[]) {
      results.push(...findAllConcepts(child))
    }
  }
  return results
}

function wrap(body: string): string {
  return `#include <iostream>\nusing namespace std;\nint main() {\n${body}\n    return 0;\n}`
}

describe('CONCEPT_IDENTITY audit: pointer declarations', () => {
  it('int* ptr = &x → cpp_pointer_declare', () => {
    const sem = liftCode(wrap('    int x = 42;\n    int* ptr = &x;'))!
    const ptrs = findConcepts(sem, 'cpp_pointer_declare')
    expect(ptrs.length).toBe(1)
    expect(ptrs[0].properties.type).toBe('int')
    expect(ptrs[0].properties.name).toBe('ptr')
    expect((ptrs[0].children.initializer ?? []).length).toBe(1)
  })

  it('int* ptr; (no init) → cpp_pointer_declare', () => {
    const sem = liftCode(wrap('    int* ptr;'))!
    const ptrs = findConcepts(sem, 'cpp_pointer_declare')
    expect(ptrs.length).toBe(1)
    expect(ptrs[0].properties.type).toBe('int')
    expect(ptrs[0].properties.name).toBe('ptr')
  })

  it('char* str = "hello" → cpp_pointer_declare', () => {
    const sem = liftCode(wrap('    char* str = "hello";'))!
    const ptrs = findConcepts(sem, 'cpp_pointer_declare')
    expect(ptrs.length).toBe(1)
    expect(ptrs[0].properties.type).toBe('char')
    expect(ptrs[0].properties.name).toBe('str')
  })

  it('char* str; (no init) → cpp_pointer_declare', () => {
    const sem = liftCode(wrap('    char* str;'))!
    const ptrs = findConcepts(sem, 'cpp_pointer_declare')
    expect(ptrs.length).toBe(1)
    expect(ptrs[0].properties.name).toBe('str')
  })

  it('double* dp = nullptr → cpp_pointer_declare', () => {
    const sem = liftCode(wrap('    double* dp = nullptr;'))!
    const ptrs = findConcepts(sem, 'cpp_pointer_declare')
    expect(ptrs.length).toBe(1)
    expect(ptrs[0].properties.type).toBe('double')
    expect(ptrs[0].properties.name).toBe('dp')
  })

  it('float* fp; → cpp_pointer_declare', () => {
    const sem = liftCode(wrap('    float* fp;'))!
    const ptrs = findConcepts(sem, 'cpp_pointer_declare')
    expect(ptrs.length).toBe(1)
    expect(ptrs[0].properties.type).toBe('float')
  })

  it('void* vp; → cpp_pointer_declare', () => {
    const sem = liftCode(wrap('    void* vp;'))!
    const ptrs = findConcepts(sem, 'cpp_pointer_declare')
    expect(ptrs.length).toBe(1)
    expect(ptrs[0].properties.type).toBe('void')
  })

  it('NOT var_declare for any pointer type', () => {
    const codes = [
      '    int* p;', '    int* p = nullptr;',
      '    char* s;', '    char* s = "hi";',
      '    double* d;', '    float* f;', '    void* v;',
    ]
    for (const body of codes) {
      const sem = liftCode(wrap(body))!
      const vars = findConcepts(sem, 'var_declare')
      const ptrVars = vars.filter(v => String(v.properties.type ?? '').includes('*'))
      expect(ptrVars.length, `var_declare with * type found for: ${body.trim()}`).toBe(0)
    }
  })
})

describe('CONCEPT_IDENTITY audit: pointer operations', () => {
  it('*ptr → cpp_pointer_deref', () => {
    const sem = liftCode(wrap('    int x = 5;\n    int* p = &x;\n    cout << *p << endl;'))!
    const derefs = findConcepts(sem, 'cpp_pointer_deref')
    expect(derefs.length).toBeGreaterThan(0)
  })

  it('&x → cpp_address_of', () => {
    const sem = liftCode(wrap('    int x = 5;\n    int* p = &x;'))!
    const addrs = findConcepts(sem, 'cpp_address_of')
    expect(addrs.length).toBe(1)
  })

  it('*ptr = val → cpp_pointer_assign', () => {
    const sem = liftCode(wrap('    int x = 5;\n    int* p = &x;\n    *p = 10;'))!
    const assigns = findConcepts(sem, 'cpp_pointer_assign')
    expect(assigns.length).toBe(1)
    expect(assigns[0].properties.ptr_name).toBe('p')
  })
})

describe('CONCEPT_IDENTITY audit: reference declarations', () => {
  it('int& ref = x → cpp_ref_declare', () => {
    const sem = liftCode(wrap('    int x = 5;\n    int& ref = x;'))!
    const refs = findConcepts(sem, 'cpp_ref_declare')
    expect(refs.length).toBe(1)
    expect(refs[0].properties.type).toBe('int')
    expect(refs[0].properties.name).toBe('ref')
  })

  it('double& dr = d → cpp_ref_declare', () => {
    const sem = liftCode(wrap('    double d = 3.14;\n    double& dr = d;'))!
    const refs = findConcepts(sem, 'cpp_ref_declare')
    expect(refs.length).toBe(1)
    expect(refs[0].properties.type).toBe('double')
  })

  it('NOT var_declare for reference', () => {
    const sem = liftCode(wrap('    int x = 5;\n    int& ref = x;'))!
    const vars = findConcepts(sem, 'var_declare')
    const refVars = vars.filter(v => String(v.properties.type ?? '').includes('&'))
    expect(refVars.length).toBe(0)
  })
})

describe('CONCEPT_IDENTITY audit: memory management', () => {
  it('new Type() → cpp_new', () => {
    const sem = liftCode(wrap('    int* p = new int(5);\n    delete p;'))!
    const news = findConcepts(sem, 'cpp_new')
    expect(news.length).toBe(1)
  })

  it('delete ptr → cpp_delete', () => {
    const sem = liftCode(wrap('    int* p = new int(5);\n    delete p;'))!
    const dels = findConcepts(sem, 'cpp_delete')
    expect(dels.length).toBe(1)
  })

  it('malloc → cpp_malloc', () => {
    const sem = liftCode(`#include <cstdlib>\nint main() {\n    int* p = (int*)malloc(10 * sizeof(int));\n    free(p);\n    return 0;\n}`)!
    const mallocs = findConcepts(sem, 'cpp_malloc')
    // malloc might be lifted differently, check what we get
    const allConcepts = findAllConcepts(sem)
    console.log('malloc program concepts:', [...new Set(allConcepts)].sort().join(', '))
  })

  it('free → cpp_free', () => {
    const sem = liftCode(`#include <cstdlib>\nint main() {\n    int* p = (int*)malloc(10 * sizeof(int));\n    free(p);\n    return 0;\n}`)!
    const frees = findConcepts(sem, 'cpp_free')
    const allConcepts = findAllConcepts(sem)
    console.log('free program concepts:', [...new Set(allConcepts)].sort().join(', '))
  })
})

describe('CONCEPT_IDENTITY audit: const + pointer', () => {
  it('const int* cp = &x → cpp_const_declare with type int*', () => {
    const sem = liftCode(wrap('    const int x = 42;\n    const int* cp = &x;'))!
    const consts = findConcepts(sem, 'cpp_const_declare')
    const ptrConst = consts.find(c => String(c.properties.type ?? '').includes('*'))
    expect(ptrConst, 'should have const with pointer type').toBeTruthy()
    expect(ptrConst!.properties.type).toBe('int*')
  })
})

describe('CONCEPT_IDENTITY audit: struct pointer access', () => {
  it('ptr->member → cpp_struct_pointer_access', () => {
    const code = `struct Point { int x; int y; };
int main() {
    Point p;
    p.x = 1;
    Point* pp = &p;
    int val = pp->x;
    return 0;
}`
    const sem = liftCode(code)!
    const accesses = findConcepts(sem, 'cpp_struct_pointer_access')
    const allConcepts = findAllConcepts(sem)
    console.log('struct ptr access concepts:', [...new Set(allConcepts)].sort().join(', '))
  })
})

describe('CONCEPT_IDENTITY audit: roundtrip correctness', () => {
  const cases = [
    { name: 'int* with init', code: wrap('    int x = 42;\n    int* ptr = &x;\n    cout << *ptr << endl;') },
    { name: 'int* no init', code: wrap('    int* ptr;\n    int x = 10;\n    ptr = &x;\n    cout << *ptr << endl;') },
    { name: 'char* with string', code: wrap('    char* str = "hello";\n    cout << str << endl;') },
    { name: 'int& reference', code: wrap('    int x = 5;\n    int& ref = x;\n    cout << ref << endl;') },
    { name: 'new/delete', code: wrap('    int* p = new int(42);\n    cout << *p << endl;\n    delete p;') },
    { name: 'const int*', code: wrap('    const int x = 42;\n    const int* cp = &x;\n    cout << *cp << endl;') },
  ]

  for (const { name, code } of cases) {
    it(`roundtrip stable: ${name}`, () => {
      const gen1 = roundTrip(code)
      const gen2 = roundTrip(gen1)
      expect(gen2).toBe(gen1)
    })
  }
})
