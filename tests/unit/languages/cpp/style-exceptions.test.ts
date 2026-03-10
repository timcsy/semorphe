import { describe, it, expect } from 'vitest'
import { detectStyleExceptions, applyStyleConversions, analyzeIoConformance } from '../../../../src/languages/cpp/style-exceptions'
import { createNode } from '../../../../src/core/semantic-tree'
import type { CodingStyle } from '../../../../src/languages/style'
import { STYLE_PRESETS } from '../../../../src/languages/style'
import { createPopulatedRegistry } from '../../../../src/languages/cpp/std'

const apcs = STYLE_PRESETS.apcs
const competitive = STYLE_PRESETS.competitive

function makeProgram(body: ReturnType<typeof createNode>[]) {
  return createNode('program', {}, { body })
}

describe('Style Exception Detection', () => {
  describe('Header exceptions', () => {
    it('should detect bits/stdc++.h in APCS mode', () => {
      const tree = makeProgram([
        createNode('cpp_include', { header: 'bits/stdc++.h', local: false }),
        createNode('func_def', { name: 'main', return_type: 'int', params: [] }, { body: [] }),
      ])
      const exceptions = detectStyleExceptions(tree, apcs)
      expect(exceptions).toHaveLength(1)
      expect(exceptions[0].label).toContain('bits/stdc++.h')
      expect(exceptions[0].suggestion).toContain('iostream')
    })

    it('should NOT detect bits/stdc++.h in competitive mode', () => {
      const tree = makeProgram([
        createNode('cpp_include', { header: 'bits/stdc++.h', local: false }),
      ])
      const exceptions = detectStyleExceptions(tree, competitive)
      expect(exceptions).toHaveLength(0)
    })

    it('should detect cstdio in APCS (iostream-preferred) mode', () => {
      const tree = makeProgram([
        createNode('cpp_include', { header: 'cstdio', local: false }),
      ])
      const exceptions = detectStyleExceptions(tree, apcs)
      expect(exceptions).toHaveLength(1)
      expect(exceptions[0].label).toContain('cstdio')
      expect(exceptions[0].suggestion).toContain('iostream')
    })

    it('should detect iostream in competitive (cstdio-preferred) mode', () => {
      const tree = makeProgram([
        createNode('cpp_include', { header: 'iostream', local: false }),
      ])
      const exceptions = detectStyleExceptions(tree, competitive)
      expect(exceptions).toHaveLength(1)
      expect(exceptions[0].label).toContain('iostream')
      expect(exceptions[0].suggestion).toContain('cstdio')
    })

    it('should NOT flag matching headers (iostream in APCS)', () => {
      const tree = makeProgram([
        createNode('cpp_include', { header: 'iostream', local: false }),
      ])
      const exceptions = detectStyleExceptions(tree, apcs)
      expect(exceptions).toHaveLength(0)
    })
  })

  describe('I/O block exceptions (from toolbox blocks)', () => {
    it('should detect cpp_printf in APCS (iostream) mode', () => {
      const tree = makeProgram([
        createNode('cpp_printf', { format: '%d\\n', args: '' }),
      ])
      const exceptions = detectStyleExceptions(tree, apcs)
      expect(exceptions).toHaveLength(1)
      expect(exceptions[0].label).toContain('printf')
      expect(exceptions[0].suggestion).toContain('cout')
    })

    it('should detect cpp_scanf in APCS mode', () => {
      const tree = makeProgram([
        createNode('cpp_scanf', { format: '%d', args: '' }),
      ])
      const exceptions = detectStyleExceptions(tree, apcs)
      expect(exceptions).toHaveLength(1)
      expect(exceptions[0].label).toContain('scanf')
      expect(exceptions[0].suggestion).toContain('cin')
    })

    it('should NOT detect cpp_printf in competitive mode', () => {
      const tree = makeProgram([
        createNode('cpp_printf', { format: '%d\\n' }),
      ])
      const exceptions = detectStyleExceptions(tree, competitive)
      expect(exceptions).toHaveLength(0)
    })
  })

  describe('Multiple exceptions', () => {
    it('should detect all exceptions in a mixed tree', () => {
      const tree = makeProgram([
        createNode('cpp_include', { header: 'bits/stdc++.h', local: false }),
        createNode('func_def', { name: 'main', return_type: 'int', params: [] }, {
          body: [
            createNode('cpp_printf', { format: 'hello\\n' }),
            createNode('cpp_scanf', { format: '%d' }),
          ],
        }),
      ])
      const exceptions = detectStyleExceptions(tree, apcs)
      expect(exceptions).toHaveLength(3)
    })
  })

  describe('Reverse I/O block exceptions (iostream blocks in cstdio preset)', () => {
    it('should detect print (cout-origin) in competitive (cstdio) mode', () => {
      const tree = makeProgram([
        createNode('print', {}, { values: [createNode('var_ref', { name: 'x' })] }),
      ])
      const exceptions = detectStyleExceptions(tree, competitive)
      expect(exceptions).toHaveLength(1)
      expect(exceptions[0].label).toContain('cout')
      expect(exceptions[0].suggestion).toContain('printf')
    })

    it('should detect input (cin-origin) in competitive (cstdio) mode', () => {
      const tree = makeProgram([
        createNode('input', {}, { values: [createNode('var_ref', { name: 'n' })] }),
      ])
      const exceptions = detectStyleExceptions(tree, competitive)
      expect(exceptions).toHaveLength(1)
      expect(exceptions[0].label).toContain('cin')
      expect(exceptions[0].suggestion).toContain('scanf')
    })

    it('should NOT detect print in APCS (iostream) mode', () => {
      const tree = makeProgram([
        createNode('print', {}, { values: [createNode('var_ref', { name: 'x' })] }),
      ])
      const exceptions = detectStyleExceptions(tree, apcs)
      expect(exceptions).toHaveLength(0)
    })

    it('should NOT detect input in APCS (iostream) mode', () => {
      const tree = makeProgram([
        createNode('input', {}, { values: [createNode('var_ref', { name: 'n' })] }),
      ])
      const exceptions = detectStyleExceptions(tree, apcs)
      expect(exceptions).toHaveLength(0)
    })
  })

  describe('No exceptions for clean code', () => {
    it('should return empty for style-conforming APCS code', () => {
      const tree = makeProgram([
        createNode('cpp_include', { header: 'iostream', local: false }),
        createNode('cpp_using_namespace', { namespace: 'std' }),
        createNode('func_def', { name: 'main', return_type: 'int', params: [] }, {
          body: [
            createNode('print', {}, { values: [createNode('string', { value: 'hello' })] }),
          ],
        }),
      ])
      const exceptions = detectStyleExceptions(tree, apcs)
      expect(exceptions).toHaveLength(0)
    })
  })
})

describe('Style Exception Conversion', () => {
  it('should convert bits/stdc++.h to iostream in APCS mode', () => {
    const tree = makeProgram([
      createNode('cpp_include', { header: 'bits/stdc++.h', local: false }),
      createNode('func_def', { name: 'main', return_type: 'int', params: [] }, { body: [] }),
    ])
    const exceptions = detectStyleExceptions(tree, apcs)
    const converted = applyStyleConversions(tree, exceptions)

    // bits/stdc++.h should be replaced with iostream
    const includes = converted.children.body.filter(n => n.concept === 'cpp_include')
    expect(includes).toHaveLength(1)
    expect(includes[0].properties.header).toBe('iostream')
  })

  it('should convert cstdio to iostream in APCS mode', () => {
    const tree = makeProgram([
      createNode('cpp_include', { header: 'cstdio', local: false }),
    ])
    const exceptions = detectStyleExceptions(tree, apcs)
    const converted = applyStyleConversions(tree, exceptions)

    const includes = converted.children.body.filter(n => n.concept === 'cpp_include')
    expect(includes).toHaveLength(1)
    expect(includes[0].properties.header).toBe('iostream')
  })

  it('should convert iostream to cstdio in competitive mode', () => {
    const tree = makeProgram([
      createNode('cpp_include', { header: 'iostream', local: false }),
    ])
    const exceptions = detectStyleExceptions(tree, competitive)
    const converted = applyStyleConversions(tree, exceptions)

    const includes = converted.children.body.filter(n => n.concept === 'cpp_include')
    expect(includes).toHaveLength(1)
    expect(includes[0].properties.header).toBe('cstdio')
  })

  it('should convert cpp_printf to print in APCS mode', () => {
    const varRef = createNode('var_ref', { name: 'x' })
    const tree = makeProgram([
      createNode('cpp_printf', { format: '%d\\n' }, { args: [varRef] }),
    ])
    const exceptions = detectStyleExceptions(tree, apcs)
    const converted = applyStyleConversions(tree, exceptions)

    const prints = converted.children.body.filter(n => n.concept === 'print')
    expect(prints).toHaveLength(1)
    expect(prints[0].children.values).toHaveLength(1)
    expect(prints[0].children.values[0].concept).toBe('var_ref')
  })

  it('should convert cpp_scanf to input in APCS mode', () => {
    const varRef = createNode('var_ref', { name: 'n' })
    const tree = makeProgram([
      createNode('cpp_scanf', { format: '%d' }, { args: [varRef] }),
    ])
    const exceptions = detectStyleExceptions(tree, apcs)
    const converted = applyStyleConversions(tree, exceptions)

    const inputs = converted.children.body.filter(n => n.concept === 'input')
    expect(inputs).toHaveLength(1)
    expect(inputs[0].children.values[0].properties.name).toBe('n')
  })

  it('should convert print to cpp_printf in competitive mode', () => {
    const tree = makeProgram([
      createNode('print', {}, {
        values: [
          createNode('var_ref', { name: 'x' }),
          createNode('endl', {}),
        ],
      }),
    ])
    const exceptions = detectStyleExceptions(tree, competitive)
    const converted = applyStyleConversions(tree, exceptions)

    const printfs = converted.children.body.filter(n => n.concept === 'cpp_printf')
    expect(printfs).toHaveLength(1)
    expect(printfs[0].properties.format).toContain('%d')
    expect(printfs[0].properties.format).toContain('\\n')
    expect(printfs[0].children.args).toHaveLength(1)
    expect(printfs[0].children.args[0].properties.name).toBe('x')
  })

  it('should convert input to cpp_scanf in competitive mode', () => {
    const tree = makeProgram([
      createNode('input', {}, {
        values: [
          createNode('var_ref', { name: 'n' }),
          createNode('var_ref', { name: 'm' }),
        ],
      }),
    ])
    const exceptions = detectStyleExceptions(tree, competitive)
    const converted = applyStyleConversions(tree, exceptions)

    const scanfs = converted.children.body.filter(n => n.concept === 'cpp_scanf')
    expect(scanfs).toHaveLength(1)
    expect(scanfs[0].properties.format).toBe('%d %d')
    expect(scanfs[0].children.args).toHaveLength(2)
  })

  it('should convert print with string_literal to cpp_printf with %s', () => {
    const tree = makeProgram([
      createNode('print', {}, {
        values: [
          createNode('string_literal', { value: 'hello' }),
          createNode('var_ref', { name: 'x' }),
        ],
      }),
    ])
    const exceptions = detectStyleExceptions(tree, competitive)
    const converted = applyStyleConversions(tree, exceptions)

    const printfs = converted.children.body.filter(n => n.concept === 'cpp_printf')
    expect(printfs).toHaveLength(1)
    // string_literal "hello" embedded directly in format, var uses %d
    expect(printfs[0].properties.format).toBe('hello%d')
    // Only the var_ref should remain as an arg (string is in format)
    expect(printfs[0].children.args).toHaveLength(1)
    expect(printfs[0].children.args[0].concept).toBe('var_ref')
  })

  it('should preserve non-exception nodes unchanged', () => {
    const tree = makeProgram([
      createNode('cpp_include', { header: 'bits/stdc++.h', local: false }),
      createNode('cpp_using_namespace', { namespace: 'std' }),
      createNode('var_declare', { name: 'x', type: 'int' }),
    ])
    const exceptions = detectStyleExceptions(tree, apcs)
    const converted = applyStyleConversions(tree, exceptions)

    expect(converted.children.body).toHaveLength(3) // include replaced, namespace + var kept
    expect(converted.children.body[0].concept).toBe('cpp_include')
    expect(converted.children.body[0].properties.header).toBe('iostream')
    expect(converted.children.body[1].concept).toBe('cpp_using_namespace')
    expect(converted.children.body[2].concept).toBe('var_declare')
  })
})

describe('I/O Style Conformance Analysis (code-level)', () => {

  describe('counting', () => {
    it('should count iostream calls', () => {
      const code = `cout << x << endl; cin >> y;`
      const result = analyzeIoConformance(code, 'iostream')
      expect(result.iostreamCount).toBe(3) // cout, endl, cin
      expect(result.cstdioCount).toBe(0)
    })

    it('should count cstdio calls', () => {
      const code = `printf("hello"); scanf("%d", &x); fprintf(fp, "ok");`
      const result = analyzeIoConformance(code, 'iostream')
      expect(result.cstdioCount).toBe(3) // printf, scanf, fprintf
    })

    it('should count both when mixed', () => {
      const code = `cout << x; scanf("%d", &y); printf("%d", z);`
      const result = analyzeIoConformance(code, 'iostream')
      expect(result.iostreamCount).toBe(1) // cout
      expect(result.cstdioCount).toBe(2) // scanf, printf
    })

    it('should return 0 for code without I/O', () => {
      const code = `int main() { int x = 5; return 0; }`
      const result = analyzeIoConformance(code, 'iostream')
      expect(result.iostreamCount).toBe(0)
      expect(result.cstdioCount).toBe(0)
      expect(result.verdict).toBe('conforming')
    })
  })

  describe('verdict with iostream preset', () => {
    it('should be conforming when all I/O is iostream', () => {
      const code = `cout << "hello" << endl; cin >> x;`
      const result = analyzeIoConformance(code, 'iostream')
      expect(result.verdict).toBe('conforming')
    })

    it('should be minor_exception when mostly iostream with one cstdio', () => {
      const code = `cout << x << endl; cin >> y; cout << z; scanf("%d", &w);`
      // iostream=4 (cout, endl, cin, cout), cstdio=1 (scanf) → minor exception
      const result = analyzeIoConformance(code, 'iostream')
      expect(result.verdict).toBe('minor_exception')
    })

    it('should be bulk_deviation when mostly cstdio in iostream preset', () => {
      const code = `printf("hello"); scanf("%d", &x); printf("%d", y); cout << z;`
      // iostream=1 (cout), cstdio=3 (printf, scanf, printf) → bulk deviation
      const result = analyzeIoConformance(code, 'iostream')
      expect(result.verdict).toBe('bulk_deviation')
    })

    it('should be bulk_deviation when ALL cstdio in iostream preset', () => {
      const code = `printf("hello"); scanf("%d", &x);`
      const result = analyzeIoConformance(code, 'iostream')
      expect(result.verdict).toBe('bulk_deviation')
    })
  })

  describe('verdict with cstdio preset', () => {
    it('should be conforming when all I/O is cstdio', () => {
      const code = `printf("hello"); scanf("%d", &x);`
      const result = analyzeIoConformance(code, 'cstdio')
      expect(result.verdict).toBe('conforming')
    })

    it('should be minor_exception when mostly cstdio with one iostream', () => {
      const code = `printf("a"); printf("b"); scanf("%d", &x); cout << y;`
      // cstdio=3, iostream=1 → minor exception
      const result = analyzeIoConformance(code, 'cstdio')
      expect(result.verdict).toBe('minor_exception')
    })

    it('should be bulk_deviation when mostly iostream in cstdio preset', () => {
      const code = `cout << x << endl; cin >> y; printf("z");`
      // iostream=3 (cout, endl, cin), cstdio=1 (printf) → bulk deviation
      const result = analyzeIoConformance(code, 'cstdio')
      expect(result.verdict).toBe('bulk_deviation')
    })
  })

  describe('edge cases', () => {
    it('should detect getline as iostream', () => {
      const code = `getline(cin, s);`
      const result = analyzeIoConformance(code, 'cstdio')
      expect(result.iostreamCount).toBeGreaterThanOrEqual(1)
    })

    it('should detect puts as cstdio', () => {
      const code = `puts("hello");`
      const result = analyzeIoConformance(code, 'iostream')
      expect(result.cstdioCount).toBe(1)
    })

    it('should detect cerr as iostream', () => {
      const code = `cerr << "error";`
      const result = analyzeIoConformance(code, 'iostream')
      expect(result.iostreamCount).toBe(1)
      expect(result.verdict).toBe('conforming')
    })

    it('should be conforming when no I/O at all', () => {
      const code = `int x = 5;`
      const result = analyzeIoConformance(code, 'iostream')
      expect(result.verdict).toBe('conforming')
    })
  })
})

describe('Module-based Borrowing Detection (with ModuleRegistry)', () => {
  const registry = createPopulatedRegistry()

  describe('APCS (iostream-preferred) + cstdio concepts = borrowing', () => {
    it('should detect cpp_printf as borrowing via registry', () => {
      const tree = makeProgram([
        createNode('cpp_printf', { format: '%d\\n' }, { args: [createNode('var_ref', { name: 'x' })] }),
      ])
      const exceptions = detectStyleExceptions(tree, apcs, registry)
      expect(exceptions.length).toBeGreaterThanOrEqual(1)
      const printfEx = exceptions.find(e => e.node.concept === 'cpp_printf')
      expect(printfEx).toBeDefined()
    })

    it('should detect cpp_scanf as borrowing via registry', () => {
      const tree = makeProgram([
        createNode('cpp_scanf', { format: '%d' }, { args: [createNode('var_ref', { name: 'n' })] }),
      ])
      const exceptions = detectStyleExceptions(tree, apcs, registry)
      expect(exceptions.length).toBeGreaterThanOrEqual(1)
      const scanfEx = exceptions.find(e => e.node.concept === 'cpp_scanf')
      expect(scanfEx).toBeDefined()
    })
  })

  describe('Competitive (cstdio-preferred) + iostream concepts = borrowing', () => {
    it('should detect print (cout-origin) as borrowing via registry', () => {
      const tree = makeProgram([
        createNode('print', {}, { values: [createNode('var_ref', { name: 'x' })] }),
      ])
      const exceptions = detectStyleExceptions(tree, competitive, registry)
      expect(exceptions.length).toBeGreaterThanOrEqual(1)
      const printEx = exceptions.find(e => e.node.concept === 'print')
      expect(printEx).toBeDefined()
    })

    it('should detect input (cin-origin) as borrowing via registry', () => {
      const tree = makeProgram([
        createNode('input', {}, { values: [createNode('var_ref', { name: 'n' })] }),
      ])
      const exceptions = detectStyleExceptions(tree, competitive, registry)
      expect(exceptions.length).toBeGreaterThanOrEqual(1)
      const inputEx = exceptions.find(e => e.node.concept === 'input')
      expect(inputEx).toBeDefined()
    })

    it('should detect endl as borrowing in cstdio-preferred style', () => {
      const tree = makeProgram([
        createNode('print', {}, {
          values: [createNode('var_ref', { name: 'x' }), createNode('endl', {})],
        }),
      ])
      const exceptions = detectStyleExceptions(tree, competitive, registry)
      // print itself is caught by hardcoded rule; endl is a child — not visited as top-level
      // but it IS visited via recursion
      const endlEx = exceptions.find(e => e.node.concept === 'endl')
      // endl inside print's values should be detected via registry
      expect(endlEx).toBeDefined()
    })
  })

  describe('No false positives', () => {
    it('should NOT flag print in APCS (iostream-preferred) with registry', () => {
      const tree = makeProgram([
        createNode('print', {}, { values: [createNode('var_ref', { name: 'x' })] }),
      ])
      const exceptions = detectStyleExceptions(tree, apcs, registry)
      expect(exceptions).toHaveLength(0)
    })

    it('should NOT flag cpp_printf in competitive (cstdio-preferred) with registry', () => {
      const tree = makeProgram([
        createNode('cpp_printf', { format: '%d\\n' }),
      ])
      const exceptions = detectStyleExceptions(tree, competitive, registry)
      expect(exceptions).toHaveLength(0)
    })

    it('should NOT flag non-IO concepts (var_declare) with registry', () => {
      const tree = makeProgram([
        createNode('var_declare', { name: 'x', type: 'int' }),
      ])
      const exceptions = detectStyleExceptions(tree, apcs, registry)
      expect(exceptions).toHaveLength(0)
    })

    it('should NOT flag vector concepts (non-IO module) with registry', () => {
      const tree = makeProgram([
        createNode('cpp_vector_declare', { type: 'int', name: 'v' }),
      ])
      const exceptions = detectStyleExceptions(tree, apcs, registry)
      expect(exceptions).toHaveLength(0)
    })
  })

  describe('Registry concept→header mappings', () => {
    it('should map print to <iostream>', () => {
      expect(registry.getHeaderForConcept('print')).toBe('<iostream>')
    })

    it('should map input to <iostream>', () => {
      expect(registry.getHeaderForConcept('input')).toBe('<iostream>')
    })

    it('should map endl to <iostream>', () => {
      expect(registry.getHeaderForConcept('endl')).toBe('<iostream>')
    })

    it('should map cpp_printf to <cstdio>', () => {
      expect(registry.getHeaderForConcept('cpp_printf')).toBe('<cstdio>')
    })

    it('should map cpp_scanf to <cstdio>', () => {
      expect(registry.getHeaderForConcept('cpp_scanf')).toBe('<cstdio>')
    })

    it('should map cpp_vector_declare to <vector>', () => {
      expect(registry.getHeaderForConcept('cpp_vector_declare')).toBe('<vector>')
    })

    it('should return null for core concepts (no header)', () => {
      expect(registry.getHeaderForConcept('var_declare')).toBeNull()
    })
  })
})
