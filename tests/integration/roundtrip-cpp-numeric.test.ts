/**
 * C++ numeric Roundtrip Tests
 *
 * Verifies that C++ <numeric> concepts (cpp_accumulate, cpp_iota, cpp_partial_sum, cpp_gcd, cpp_lcm)
 * survive the full roundtrip: code → lift → generate → re-lift → structural equivalence.
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

function countRawCode(node: SemanticNode): number {
  let count = 0
  if (node.concept === 'raw_code' || node.concept === 'cpp_raw_code') count++
  for (const children of Object.values(node.children ?? {})) {
    for (const child of children as SemanticNode[]) count += countRawCode(child)
  }
  return count
}

function treesStructurallyEqual(a: SemanticNode, b: SemanticNode): boolean {
  if (a.concept !== b.concept) return false
  const aKeys = Object.keys(a.children ?? {}).sort()
  const bKeys = Object.keys(b.children ?? {}).sort()
  if (aKeys.length !== bKeys.length) return false
  for (let i = 0; i < aKeys.length; i++) {
    if (aKeys[i] !== bKeys[i]) return false
    const ac = (a.children?.[aKeys[i]] ?? []) as SemanticNode[]
    const bc = (b.children?.[bKeys[i]] ?? []) as SemanticNode[]
    if (ac.length !== bc.length) return false
    for (let j = 0; j < ac.length; j++) {
      if (!treesStructurallyEqual(ac[j], bc[j])) return false
    }
  }
  return true
}

describe('C++ numeric Roundtrip', () => {

  describe('cpp_accumulate', () => {
    it('should lift and roundtrip accumulate with vector', () => {
      const code = `#include <iostream>
#include <numeric>
#include <vector>
using namespace std;
int main() {
    vector<int> v = {1, 2, 3, 4, 5};
    int sum = accumulate(v.begin(), v.end(), 0);
    cout << "Sum: " << sum << endl;
    return 0;
}`
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      expect(findConcept(tree, 'cpp_accumulate')).not.toBeNull()
      expect(countRawCode(tree!)).toBe(0)
      const generated = roundTripCode(code)
      expect(generated).toContain('accumulate(')
      const tree2 = liftCode(generated)
      expect(treesStructurallyEqual(tree!, tree2!)).toBe(true)
    })

    it('should lift accumulate with non-zero init', () => {
      const code = `#include <iostream>
#include <numeric>
#include <vector>
using namespace std;
int main() {
    vector<int> nums = {10, 20, 30};
    int total = accumulate(nums.begin(), nums.end(), 100);
    cout << total << endl;
    return 0;
}`
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      expect(findConcept(tree, 'cpp_accumulate')).not.toBeNull()
      expect(countRawCode(tree!)).toBe(0)
      const generated = roundTripCode(code)
      const tree2 = liftCode(generated)
      expect(treesStructurallyEqual(tree!, tree2!)).toBe(true)
    })
  })

  describe('cpp_gcd', () => {
    it('should lift __gcd call', () => {
      const code = `#include <iostream>
using namespace std;
int main() {
    int a = 12, b = 8;
    int g = __gcd(a, b);
    cout << "GCD: " << g << endl;
    return 0;
}`
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      expect(findConcept(tree, 'cpp_gcd')).not.toBeNull()
      expect(countRawCode(tree!)).toBe(0)
      const generated = roundTripCode(code)
      expect(generated).toContain('__gcd(')
      const tree2 = liftCode(generated)
      expect(treesStructurallyEqual(tree!, tree2!)).toBe(true)
    })

    it('should lift chained __gcd calls', () => {
      const code = `#include <iostream>
using namespace std;
int main() {
    int result = __gcd(12, 18);
    result = __gcd(result, 24);
    cout << "GCD: " << result << endl;
    return 0;
}`
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      expect(findConcept(tree, 'cpp_gcd')).not.toBeNull()
      expect(countRawCode(tree!)).toBe(0)
      const generated = roundTripCode(code)
      const tree2 = liftCode(generated)
      expect(treesStructurallyEqual(tree!, tree2!)).toBe(true)
    })
  })

  describe('cpp_lcm', () => {
    it('should lift lcm call', () => {
      const code = `#include <iostream>
#include <numeric>
using namespace std;
int main() {
    int a = 4, b = 6;
    int l = lcm(a, b);
    cout << "LCM: " << l << endl;
    return 0;
}`
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      expect(findConcept(tree, 'cpp_lcm')).not.toBeNull()
      expect(countRawCode(tree!)).toBe(0)
      const generated = roundTripCode(code)
      expect(generated).toContain('lcm(')
      const tree2 = liftCode(generated)
      expect(treesStructurallyEqual(tree!, tree2!)).toBe(true)
    })
  })

  describe('cpp_iota', () => {
    it('should lift iota with vector', () => {
      const code = `#include <iostream>
#include <numeric>
#include <vector>
using namespace std;
int main() {
    vector<int> v(5);
    iota(v.begin(), v.end(), 1);
    for (int i = 0; i < 5; i++) {
        cout << v[i] << " ";
    }
    cout << endl;
    return 0;
}`
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      expect(findConcept(tree, 'cpp_iota')).not.toBeNull()
      expect(countRawCode(tree!)).toBe(0)
      const generated = roundTripCode(code)
      expect(generated).toContain('iota(')
      const tree2 = liftCode(generated)
      expect(treesStructurallyEqual(tree!, tree2!)).toBe(true)
    })

    it('should lift iota with raw array', () => {
      const code = `#include <iostream>
#include <numeric>
using namespace std;
int main() {
    int arr[5];
    iota(arr, arr + 5, 10);
    for (int i = 0; i < 5; i++) {
        cout << arr[i] << " ";
    }
    cout << endl;
}`
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      expect(findConcept(tree, 'cpp_iota')).not.toBeNull()
      expect(countRawCode(tree!)).toBe(0)
      const generated = roundTripCode(code)
      const tree2 = liftCode(generated)
      expect(treesStructurallyEqual(tree!, tree2!)).toBe(true)
    })
  })

  describe('cpp_partial_sum', () => {
    it('should lift partial_sum call', () => {
      const code = `#include <iostream>
#include <numeric>
#include <vector>
using namespace std;
int main() {
    vector<int> v = {1, 2, 3, 4, 5};
    vector<int> result(5);
    partial_sum(v.begin(), v.end(), result.begin());
    for (int i = 0; i < 5; i++) {
        cout << result[i] << " ";
    }
    cout << endl;
    return 0;
}`
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      expect(findConcept(tree, 'cpp_partial_sum')).not.toBeNull()
      expect(countRawCode(tree!)).toBe(0)
      const generated = roundTripCode(code)
      expect(generated).toContain('partial_sum(')
      const tree2 = liftCode(generated)
      expect(treesStructurallyEqual(tree!, tree2!)).toBe(true)
    })
  })

  describe('combined: all numeric concepts', () => {
    it('should lift and roundtrip all 5 numeric concepts together', () => {
      const code = `#include <iostream>
#include <numeric>
#include <vector>
using namespace std;
int main() {
    vector<int> v(5);
    iota(v.begin(), v.end(), 1);
    int sum = accumulate(v.begin(), v.end(), 0);
    cout << "Sum: " << sum << endl;
    cout << "GCD: " << __gcd(12, 8) << endl;
    cout << "LCM: " << lcm(4, 6) << endl;
    vector<int> ps(5);
    partial_sum(v.begin(), v.end(), ps.begin());
    cout << "Prefix: " << ps[4] << endl;
    return 0;
}`
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      expect(findConcept(tree, 'cpp_accumulate')).not.toBeNull()
      expect(findConcept(tree, 'cpp_gcd')).not.toBeNull()
      expect(findConcept(tree, 'cpp_lcm')).not.toBeNull()
      expect(findConcept(tree, 'cpp_iota')).not.toBeNull()
      expect(findConcept(tree, 'cpp_partial_sum')).not.toBeNull()
      expect(countRawCode(tree!)).toBe(0)
      const generated = roundTripCode(code)
      const tree2 = liftCode(generated)
      expect(treesStructurallyEqual(tree!, tree2!)).toBe(true)
    })

    it('should roundtrip gcd + lcm combination', () => {
      const code = `#include <iostream>
#include <numeric>
using namespace std;
int main() {
    int x = 15, y = 20;
    cout << "GCD: " << __gcd(x, y) << endl;
    cout << "LCM: " << lcm(x, y) << endl;
    return 0;
}`
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      expect(findConcept(tree, 'cpp_gcd')).not.toBeNull()
      expect(findConcept(tree, 'cpp_lcm')).not.toBeNull()
      expect(countRawCode(tree!)).toBe(0)
      const generated = roundTripCode(code)
      const tree2 = liftCode(generated)
      expect(treesStructurallyEqual(tree!, tree2!)).toBe(true)
    })
  })
})
