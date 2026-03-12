import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import type { Lifter } from '../../src/core/lift/lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { setupTestRenderer } from '../helpers/setup-renderer'
import type { StylePreset, SemanticNode } from '../../src/core/types'

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

function liftAndGenerate(code: string): { tree: SemanticNode | null; generated: string } {
  const parsed = tsParser.parse(code)
  const tree = lifter.lift(parsed.rootNode as any)
  if (!tree) return { tree: null, generated: '' }
  const generated = generateCode(tree, 'cpp', style)
  return { tree, generated }
}

function treesStructurallyEqual(a: SemanticNode, b: SemanticNode): boolean {
  if (a.concept !== b.concept) return false
  const aKeys = Object.keys(a.properties).sort()
  const bKeys = Object.keys(b.properties).sort()
  if (JSON.stringify(aKeys) !== JSON.stringify(bKeys)) return false
  for (const key of aKeys) {
    if (String(a.properties[key]) !== String(b.properties[key])) return false
  }
  const aChildKeys = Object.keys(a.children).sort()
  const bChildKeys = Object.keys(b.children).sort()
  if (JSON.stringify(aChildKeys) !== JSON.stringify(bChildKeys)) return false
  for (const key of aChildKeys) {
    if (a.children[key].length !== b.children[key].length) return false
    for (let i = 0; i < a.children[key].length; i++) {
      if (!treesStructurallyEqual(a.children[key][i], b.children[key][i])) return false
    }
  }
  return true
}

function countRawCode(node: SemanticNode): number {
  let count = 0
  function walk(n: SemanticNode) {
    if (n.metadata?.confidence === 'raw_code' || n.concept === 'cpp_raw_code' || n.concept === 'cpp_raw_expression') {
      count++
    }
    for (const children of Object.values(n.children)) {
      for (const child of children) walk(child)
    }
  }
  walk(node)
  return count
}

// Fuzz regression tests from concept.fuzz run on 2026-03-12
// These tests verify lift → generate round-trip structural equivalence
describe('cmath fuzz regression', () => {
  describe('easy — basic function calls', () => {
    it('fuzz_1: abs/fabs with int and double arguments', () => {
      const code = `#include <iostream>
#include <cmath>
using namespace std;
int main() {
    int a = -42;
    double b = -3.14;
    cout << abs(a) << endl;
    cout << fabs(b) << endl;
    cout << abs(-100) << endl;
    return 0;
}`
      const { tree, generated } = liftAndGenerate(code)
      expect(tree).not.toBeNull()
      expect(countRawCode(tree!)).toBe(0)
      expect(generated).toContain('abs(')
      // fabs normalizes to abs
      expect(generated).not.toContain('fabs(')

      // Second round-trip: structural equivalence
      const parsed2 = tsParser.parse(generated)
      const tree2 = lifter.lift(parsed2.rootNode as any)
      expect(tree2).not.toBeNull()
      expect(treesStructurallyEqual(tree!, tree2!)).toBe(true)
    })

    it('fuzz_2: ceil/floor/round/trunc on positive and negative', () => {
      const code = `#include <iostream>
#include <cmath>
using namespace std;
int main() {
    double x = 2.7;
    double y = -2.7;
    cout << ceil(x) << endl;
    cout << floor(x) << endl;
    cout << round(x) << endl;
    cout << trunc(x) << endl;
    cout << ceil(y) << endl;
    cout << floor(y) << endl;
    cout << round(y) << endl;
    cout << trunc(y) << endl;
    return 0;
}`
      const { tree, generated } = liftAndGenerate(code)
      expect(tree).not.toBeNull()
      expect(countRawCode(tree!)).toBe(0)
      expect(generated).toContain('ceil(')
      expect(generated).toContain('floor(')
      expect(generated).toContain('round(')
      expect(generated).toContain('trunc(')
    })

    it('fuzz_3: sqrt/cbrt/pow basic', () => {
      const code = `#include <iostream>
#include <cmath>
using namespace std;
int main() {
    cout << sqrt(144.0) << endl;
    cout << cbrt(27.0) << endl;
    cout << cbrt(-8.0) << endl;
    cout << pow(2.0, 10.0) << endl;
    return 0;
}`
      const { tree, generated } = liftAndGenerate(code)
      expect(tree).not.toBeNull()
      expect(countRawCode(tree!)).toBe(0)
      expect(generated).toContain('sqrt(')
      expect(generated).toContain('cbrt(')
      expect(generated).toContain('pow(')
    })
  })

  describe('medium — combined and nested calls', () => {
    it('fuzz_4: trig functions with pi derived from acos(-1)', () => {
      const code = `#include <iostream>
#include <cmath>
using namespace std;
int main() {
    double pi = acos(-1.0);
    double angle1 = pi / 4.0;
    cout << round(sin(angle1) * 1000000) / 1000000 << endl;
    cout << round(cos(angle1) * 1000000) / 1000000 << endl;
    return 0;
}`
      const { tree, generated } = liftAndGenerate(code)
      expect(tree).not.toBeNull()
      expect(countRawCode(tree!)).toBe(0)
      expect(generated).toContain('acos(')
      expect(generated).toContain('sin(')
      expect(generated).toContain('cos(')
      expect(generated).toContain('round(')
    })

    it('fuzz_5: log functions with change-of-base', () => {
      const code = `#include <iostream>
#include <cmath>
using namespace std;
int main() {
    cout << log(exp(1.0)) << endl;
    cout << log2(1024.0) << endl;
    cout << log10(1000.0) << endl;
    double log_base5 = log(125.0) / log(5.0);
    cout << round(log_base5) << endl;
    return 0;
}`
      const { tree, generated } = liftAndGenerate(code)
      expect(tree).not.toBeNull()
      expect(countRawCode(tree!)).toBe(0)
      expect(generated).toContain('log(')
      expect(generated).toContain('exp(')
      expect(generated).toContain('log2(')
      expect(generated).toContain('log10(')
    })

    it('fuzz_6: fmod/fmin/fmax/hypot including negative fmod', () => {
      const code = `#include <iostream>
#include <cmath>
using namespace std;
int main() {
    double a = 3.0, b = 4.0;
    cout << hypot(a, b) << endl;
    cout << fmin(a, b) << endl;
    cout << fmax(a, b) << endl;
    cout << fmod(10.7, 3.0) << endl;
    cout << fmod(-10.7, 3.0) << endl;
    return 0;
}`
      const { tree, generated } = liftAndGenerate(code)
      expect(tree).not.toBeNull()
      expect(countRawCode(tree!)).toBe(0)
      expect(generated).toContain('hypot(')
      expect(generated).toContain('fmin(')
      expect(generated).toContain('fmax(')
      expect(generated).toContain('fmod(')
    })

    it('fuzz_7: atan2 in all four quadrants', () => {
      const code = `#include <iostream>
#include <cmath>
using namespace std;
int main() {
    double pi = acos(-1.0);
    cout << round(atan2(1.0, 1.0) * 180.0 / pi) << endl;
    cout << round(atan2(1.0, -1.0) * 180.0 / pi) << endl;
    cout << round(atan2(-1.0, -1.0) * 180.0 / pi) << endl;
    cout << round(atan2(-1.0, 1.0) * 180.0 / pi) << endl;
    return 0;
}`
      const { tree, generated } = liftAndGenerate(code)
      expect(tree).not.toBeNull()
      expect(countRawCode(tree!)).toBe(0)
      expect(generated).toContain('atan2(')
      expect(generated).toContain('acos(')
      expect(generated).toContain('round(')
    })
  })

  describe('hard — complex nested and edge cases', () => {
    it('fuzz_8: distance formula with nested pow+sqrt+atan2+ceil+floor+static_cast', () => {
      const code = `#include <iostream>
#include <cmath>
using namespace std;
int main() {
    double x1 = 1.0, y1 = 2.0;
    double x2 = 4.0, y2 = 6.0;
    double dist = sqrt(pow(x2 - x1, 2.0) + pow(y2 - y1, 2.0));
    cout << dist << endl;
    double angle = atan2(y2 - y1, x2 - x1);
    double degrees = angle * 180.0 / acos(-1.0);
    cout << round(degrees * 100.0) / 100.0 << endl;
    cout << ceil(dist) << endl;
    cout << floor(dist) << endl;
    return 0;
}`
      const { tree, generated } = liftAndGenerate(code)
      expect(tree).not.toBeNull()
      expect(countRawCode(tree!)).toBe(0)
      expect(generated).toContain('sqrt(')
      expect(generated).toContain('pow(')
      expect(generated).toContain('atan2(')
      expect(generated).toContain('ceil(')
      expect(generated).toContain('floor(')
    })

    it('fuzz_10: integer arguments with implicit promotion', () => {
      const code = `#include <iostream>
#include <cmath>
using namespace std;
int main() {
    int n = 49;
    int base = 2;
    int exponent = 8;
    cout << sqrt(n) << endl;
    cout << pow(base, exponent) << endl;
    cout << cbrt(64) << endl;
    cout << log2(256) << endl;
    cout << abs(-7) << endl;
    cout << fabs(-7) << endl;
    return 0;
}`
      const { tree, generated } = liftAndGenerate(code)
      expect(tree).not.toBeNull()
      expect(countRawCode(tree!)).toBe(0)
      expect(generated).toContain('sqrt(')
      expect(generated).toContain('pow(')
      expect(generated).toContain('cbrt(')
      expect(generated).toContain('log2(')
      expect(generated).toContain('abs(')
    })

    it('fuzz_11: inverse trig round-trip identities with precision control', () => {
      const code = `#include <iostream>
#include <cmath>
using namespace std;
int main() {
    double pi = acos(-1.0);
    cout << pi << endl;
    double val = 0.5;
    double a = asin(val);
    cout << round(sin(a) * 10.0) / 10.0 << endl;
    double b = acos(val);
    cout << round(cos(b) * 10.0) / 10.0 << endl;
    double c = atan(1.0);
    cout << round(tan(c) * 1000.0) / 1000.0 << endl;
    return 0;
}`
      const { tree, generated } = liftAndGenerate(code)
      expect(tree).not.toBeNull()
      expect(countRawCode(tree!)).toBe(0)
      expect(generated).toContain('asin(')
      expect(generated).toContain('acos(')
      expect(generated).toContain('atan(')
      expect(generated).toContain('sin(')
      expect(generated).toContain('cos(')
      expect(generated).toContain('tan(')
    })
  })
})
