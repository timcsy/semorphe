/**
 * C++ utility Roundtrip Tests
 *
 * Verifies that C++ <utility> concepts (cpp_pair_declare, cpp_make_pair)
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

function liftAndGenerate(code: string) {
  const parsed = tsParser.parse(code)
  const tree = lifter.lift(parsed.rootNode as any)
  const generated = tree ? generateCode(tree, 'cpp', style) : ''
  return { tree, generated }
}

describe('C++ utility Roundtrip', () => {
  it('pair_declare: basic pair declaration', () => {
    const code = `#include <iostream>
#include <utility>
using namespace std;
int main() {
    pair<int, int> p;
    p.first = 1;
    p.second = 2;
    cout << p.first << " " << p.second << endl;
    return 0;
}`
    const { tree, generated } = liftAndGenerate(code)
    expect(tree).not.toBeNull()
    expect(countRawCode(tree!)).toBe(0)
    expect(generated).toContain('pair<')
    const tree2 = lifter.lift(tsParser.parse(generated).rootNode as any)
    expect(treesStructurallyEqual(tree!, tree2!)).toBe(true)
  })

  it('make_pair: in variable declaration', () => {
    const code = `#include <iostream>
#include <utility>
using namespace std;
int main() {
    pair<int, string> p = make_pair(42, "hello");
    cout << p.first << " " << p.second << endl;
    return 0;
}`
    const { tree, generated } = liftAndGenerate(code)
    expect(tree).not.toBeNull()
    expect(countRawCode(tree!)).toBe(0)
    const tree2 = lifter.lift(tsParser.parse(generated).rootNode as any)
    expect(treesStructurallyEqual(tree!, tree2!)).toBe(true)
  })

  it('pair in function return with make_pair', () => {
    const code = `#include <iostream>
#include <utility>
using namespace std;
pair<int, int> minmax(int a, int b) {
    if (a < b) return make_pair(a, b);
    return make_pair(b, a);
}
int main() {
    pair<int, int> result = minmax(5, 3);
    cout << result.first << " " << result.second << endl;
    return 0;
}`
    const { tree, generated } = liftAndGenerate(code)
    expect(tree).not.toBeNull()
    expect(countRawCode(tree!)).toBe(0)
    expect(generated).toContain('make_pair(')
    const tree2 = lifter.lift(tsParser.parse(generated).rootNode as any)
    expect(treesStructurallyEqual(tree!, tree2!)).toBe(true)
  })

  it('make_pair with vector of pairs', () => {
    const code = `#include <iostream>
#include <vector>
#include <utility>
using namespace std;
int main() {
    vector<pair<int, int>> v;
    v.push_back(make_pair(1, 10));
    v.push_back(make_pair(2, 20));
    for (int i = 0; i < 2; i++) {
        cout << v[i].first << "," << v[i].second << endl;
    }
    return 0;
}`
    const { tree, generated } = liftAndGenerate(code)
    expect(tree).not.toBeNull()
    expect(countRawCode(tree!)).toBe(0)
    const tree2 = lifter.lift(tsParser.parse(generated).rootNode as any)
    expect(treesStructurallyEqual(tree!, tree2!)).toBe(true)
  })

  it('pair_declare with string type', () => {
    const code = `#include <iostream>
#include <utility>
using namespace std;
int main() {
    pair<string, double> item;
    item.first = "apple";
    item.second = 3.5;
    cout << item.first << " costs " << item.second << endl;
    return 0;
}`
    const { tree, generated } = liftAndGenerate(code)
    expect(tree).not.toBeNull()
    expect(countRawCode(tree!)).toBe(0)
    const tree2 = lifter.lift(tsParser.parse(generated).rootNode as any)
    expect(treesStructurallyEqual(tree!, tree2!)).toBe(true)
  })
})
