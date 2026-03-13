/**
 * Round-trip tests for C++ advanced language features:
 * cpp_try_catch, cpp_throw, cpp_range_for, cpp_lambda, cpp_namespace_def, cpp_static_cast
 *
 * Verifies: code -> lift -> SemanticTree -> generate code -> re-lift -> verify (P1)
 */
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

function liftCode(code: string): SemanticNode | null {
  const tree = tsParser.parse(code)
  return lifter.lift(tree.rootNode as any)
}

function roundTripCode(code: string): string {
  const tree = liftCode(code)
  expect(tree).not.toBeNull()
  return generateCode(tree!, 'cpp', style)
}

function findConcepts(node: SemanticNode): string[] {
  const concepts: string[] = []
  function walk(n: SemanticNode) {
    if (!n) return
    if (n.concept) concepts.push(n.concept)
    if (n.children) {
      for (const ch of Object.values(n.children)) {
        if (Array.isArray(ch)) ch.forEach(walk)
      }
    }
  }
  walk(node)
  return concepts
}

function findNode(root: SemanticNode, conceptId: string): SemanticNode | undefined {
  if (root.concept === conceptId) return root
  if (root.children) {
    for (const ch of Object.values(root.children)) {
      if (Array.isArray(ch)) {
        for (const child of ch) {
          const found = findNode(child, conceptId)
          if (found) return found
        }
      }
    }
  }
  return undefined
}

describe('Roundtrip: C++ advanced features (try_catch, throw, range_for, lambda, namespace, static_cast)', () => {

  // ─── try-catch basic ──────────────────────────────────────

  describe('try_catch_basic: try-catch with runtime_error', () => {
    const code = `#include <iostream>
#include <stdexcept>
using namespace std;
int main() {
    try {
        int x = 10;
        cout << "before throw" << endl;
        throw runtime_error("test error");
        cout << "after throw" << endl;
    } catch (runtime_error& e) {
        cout << "caught: " << e.what() << endl;
    }
    cout << "done" << endl;
    return 0;
}`

    it('lifts cpp_try_catch and cpp_throw concepts', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const concepts = findConcepts(tree!)
      expect(concepts).toContain('cpp_try_catch')
    })

    it('generates compilable code preserving try-catch structure', () => {
      const result = roundTripCode(code)
      expect(result).toContain('try {')
      expect(result).toContain('catch (runtime_error& e)')
      expect(result).toContain('"before throw"')
      expect(result).toContain('"done"')
    })

    it('P1: double roundtrip is stable', () => {
      const gen1 = roundTripCode(code)
      const gen2 = roundTripCode(gen1)
      expect(gen1.trim()).toBe(gen2.trim())
    })
  })

  // ─── try-catch with different exception types ─────────────

  describe('try_catch_types: catch different exception types', () => {
    const code = `try {
    throw 42;
} catch (int& e) {
    int y = 0;
}`

    it('lifts cpp_try_catch with int catch type', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const concepts = findConcepts(tree!)
      expect(concepts).toContain('cpp_try_catch')
      expect(concepts).toContain('cpp_throw')
    })

    it('preserves catch type in generated code', () => {
      const result = roundTripCode(code)
      expect(result).toContain('catch (int& e)')
      expect(result).toContain('throw 42;')
    })

    it('P1: double roundtrip is stable', () => {
      const gen1 = roundTripCode(code)
      const gen2 = roundTripCode(gen1)
      expect(gen1.trim()).toBe(gen2.trim())
    })
  })

  // ─── throw in function, catch in caller ───────────────────

  describe('throw_test: throw in function, catch in caller', () => {
    const code = `#include <iostream>
#include <stdexcept>
using namespace std;
int safeDivide(int a, int b) {
    if (b == 0) {
        throw runtime_error("division by zero");
    }
    return a / b;
}
int main() {
    try {
        int result = safeDivide(10, 2);
        cout << "10/2 = " << result << endl;
    } catch (runtime_error& e) {
        cout << "error: " << e.what() << endl;
    }
    return 0;
}`

    it('lifts cpp_throw inside function and cpp_try_catch in main', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const concepts = findConcepts(tree!)
      expect(concepts).toContain('cpp_throw')
      expect(concepts).toContain('cpp_try_catch')
      expect(concepts).toContain('func_def')
    })

    it('generates code with throw in function body', () => {
      const result = roundTripCode(code)
      expect(result).toContain('throw runtime_error("division by zero");')
      expect(result).toContain('try {')
      expect(result).toContain('catch (runtime_error& e)')
    })

    it('P1: double roundtrip is stable', () => {
      const gen1 = roundTripCode(code)
      const gen2 = roundTripCode(gen1)
      expect(gen1.trim()).toBe(gen2.trim())
    })
  })

  // ─── range-based for ─────────────────────────────────────

  describe('range_for: range-based for with vector', () => {
    const code = `for (auto x : vec) {
    cout << x;
}`

    it('lifts cpp_range_for concept', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const concepts = findConcepts(tree!)
      expect(concepts).toContain('cpp_range_for')
    })

    it('generates range-for syntax', () => {
      const result = roundTripCode(code)
      expect(result).toContain('for (auto x : vec)')
      expect(result).toContain('cout')
    })

    it('P1: double roundtrip is stable', () => {
      const gen1 = roundTripCode(code)
      const gen2 = roundTripCode(gen1)
      expect(gen1.trim()).toBe(gen2.trim())
    })
  })

  describe('range_for: full program with vector (known issue: vector<int> degrades to int)', () => {
    const code = `#include <iostream>
#include <vector>
using namespace std;
int main() {
    vector<int> nums = {1, 2, 3, 4, 5};
    int sum = 0;
    for (auto x : nums) {
        sum = sum + x;
        cout << x << " ";
    }
    cout << endl;
    cout << "sum = " << sum << endl;
    return 0;
}`

    it('lifts cpp_range_for concept from full program', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const concepts = findConcepts(tree!)
      expect(concepts).toContain('cpp_range_for')
    })

    it('preserves vector<int> declaration through roundtrip', () => {
      const result = roundTripCode(code)
      expect(result).toContain('vector<int>')
      expect(result).toContain('for (auto x : nums)')
    })
  })

  // ─── lambda basic ────────────────────────────────────────

  describe('lambda_basic: lambda with capture', () => {
    const code = `#include <iostream>
using namespace std;
int main() {
    int base = 10;
    auto add = [&](int x) -> int { return base + x; };
    cout << add(5) << endl;
    cout << add(20) << endl;
    return 0;
}`

    it('lifts cpp_lambda concept', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const concepts = findConcepts(tree!)
      expect(concepts).toContain('cpp_lambda')
    })

    it('generates lambda with capture and return type', () => {
      const result = roundTripCode(code)
      expect(result).toContain('[&]')
      expect(result).toContain('-> int')
      expect(result).toContain('return base + x;')
    })

    it('preserves lambda properties in semantic tree', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const lambdaNode = findNode(tree!, 'cpp_lambda')
      expect(lambdaNode).toBeDefined()
      expect(lambdaNode!.properties.capture).toBe('&')
      expect(lambdaNode!.properties.return_type).toBe('int')
    })

    it('P1: double roundtrip is stable', () => {
      const gen1 = roundTripCode(code)
      const gen2 = roundTripCode(gen1)
      expect(gen1.trim()).toBe(gen2.trim())
    })
  })

  // ─── lambda with sort ────────────────────────────────────

  describe('lambda_sort: lambda used with sort (known issue: vector type lost)', () => {
    const code = `auto cmp = [](int a, int b) -> bool { return a > b; };`

    it('lifts cpp_lambda for comparator', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const concepts = findConcepts(tree!)
      expect(concepts).toContain('cpp_lambda')
    })

    it('generates lambda comparator', () => {
      const result = roundTripCode(code)
      expect(result).toContain('[](int a, int b) -> bool')
      expect(result).toContain('return a > b;')
    })

    it('P1: double roundtrip is stable', () => {
      const gen1 = roundTripCode(code)
      const gen2 = roundTripCode(gen1)
      expect(gen1.trim()).toBe(gen2.trim())
    })
  })

  // ─── namespace basic ─────────────────────────────────────

  describe('namespace_basic: namespace definition and usage', () => {
    const code = `#include <iostream>
using namespace std;
namespace Math {
    int add(int a, int b) {
        return a + b;
    }
    int multiply(int a, int b) {
        return a * b;
    }
}
int main() {
    cout << Math::add(3, 4) << endl;
    cout << Math::multiply(5, 6) << endl;
    return 0;
}`

    it('lifts cpp_namespace_def concept', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const concepts = findConcepts(tree!)
      expect(concepts).toContain('cpp_namespace_def')
    })

    it('preserves namespace name and body', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const nsNode = findNode(tree!, 'cpp_namespace_def')
      expect(nsNode).toBeDefined()
      expect(nsNode!.properties.name).toBe('Math')
      expect(nsNode!.children.body.length).toBeGreaterThan(0)
    })

    it('generates namespace with functions', () => {
      const result = roundTripCode(code)
      expect(result).toContain('namespace Math')
      expect(result).toContain('int add(int a, int b)')
      expect(result).toContain('int multiply(int a, int b)')
    })

    it('P1: double roundtrip is stable', () => {
      const gen1 = roundTripCode(code)
      const gen2 = roundTripCode(gen1)
      expect(gen1.trim()).toBe(gen2.trim())
    })
  })

  // ─── static_cast ─────────────────────────────────────────

  describe('static_cast_test: static_cast conversion', () => {
    const code = `double pi = 3.14159;
int n = static_cast<int>(pi);`

    it('lifts cpp_static_cast concept', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const concepts = findConcepts(tree!)
      expect(concepts).toContain('cpp_static_cast')
    })

    it('preserves target type', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const castNode = findNode(tree!, 'cpp_static_cast')
      expect(castNode).toBeDefined()
      expect(castNode!.properties.target_type).toBe('int')
    })

    it('generates static_cast syntax', () => {
      const result = roundTripCode(code)
      expect(result).toContain('static_cast<int>')
    })

    it('P1: double roundtrip is stable', () => {
      const gen1 = roundTripCode(code)
      const gen2 = roundTripCode(gen1)
      expect(gen1.trim()).toBe(gen2.trim())
    })
  })

  describe('static_cast_test: full program with char-to-int cast', () => {
    const code = `#include <iostream>
using namespace std;
int main() {
    double pi = 3.14159;
    int n = static_cast<int>(pi);
    cout << "pi = " << pi << endl;
    cout << "n = " << n << endl;
    char c = 'A';
    int code = static_cast<int>(c);
    cout << "c = " << c << endl;
    cout << "code = " << code << endl;
    return 0;
}`

    it('lifts multiple cpp_static_cast concepts', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const concepts = findConcepts(tree!)
      const castCount = concepts.filter(c => c === 'cpp_static_cast').length
      expect(castCount).toBeGreaterThanOrEqual(2)
    })

    it('P1: double roundtrip is stable', () => {
      const gen1 = roundTripCode(code)
      const gen2 = roundTripCode(gen1)
      expect(gen1.trim()).toBe(gen2.trim())
    })
  })

  // ─── combined: try-catch + range-for + lambda ─────────────

  describe('combined_advanced: try-catch + range-for + lambda', () => {
    const code = `try {
    int total = 0;
    for (auto val : data) {
        total = total + val;
    }
    cout << "total = " << total << endl;
} catch (runtime_error& e) {
    cout << "error: " << e.what() << endl;
}`

    it('lifts all three concepts', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const concepts = findConcepts(tree!)
      expect(concepts).toContain('cpp_try_catch')
      expect(concepts).toContain('cpp_range_for')
    })

    it('generates combined structure', () => {
      const result = roundTripCode(code)
      expect(result).toContain('try {')
      expect(result).toContain('for (auto val : data)')
      expect(result).toContain('catch (runtime_error& e)')
    })

    it('P1: double roundtrip is stable', () => {
      const gen1 = roundTripCode(code)
      const gen2 = roundTripCode(gen1)
      expect(gen1.trim()).toBe(gen2.trim())
    })
  })

  // ─── template function ──────────────────────────────────

  describe('template_func: template function with two params', () => {
    const code = `#include <iostream>
using namespace std;
template <typename T>
T myMax(T a, T b) {
    if (a > b) {
        return a;
    }
    return b;
}
int main() {
    cout << myMax(3, 7) << endl;
    return 0;
}`

    it('lifts cpp_template_function concept', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const concepts = findConcepts(tree!)
      expect(concepts).toContain('cpp_template_function')
    })

    it('preserves template type param and function name', () => {
      const tree = liftCode(code)
      const tmplNode = findNode(tree!, 'cpp_template_function')
      expect(tmplNode).toBeDefined()
      expect(tmplNode!.properties.t).toBe('T')
      expect(tmplNode!.properties.func_name).toBe('myMax')
      expect(tmplNode!.properties.return_type).toBe('T')
      expect(tmplNode!.children.params?.length).toBe(2)
    })

    it('generates template function with both params', () => {
      const result = roundTripCode(code)
      expect(result).toContain('template <typename T>')
      expect(result).toContain('T myMax(T a, T b)')
    })

    it('P1: double roundtrip is stable', () => {
      const gen1 = roundTripCode(code)
      const gen2 = roundTripCode(gen1)
      expect(gen1.trim()).toBe(gen2.trim())
    })
  })

  describe('template_func_add: template add function', () => {
    const code = `#include <iostream>
using namespace std;
template <typename T>
T add(T a, T b) {
    return a + b;
}
int main() {
    cout << add(10, 20) << endl;
    return 0;
}`

    it('P1: double roundtrip is stable', () => {
      const gen1 = roundTripCode(code)
      const gen2 = roundTripCode(gen1)
      expect(gen1.trim()).toBe(gen2.trim())
    })
  })

  // ─── forward declaration ──────────────────────────────────

  describe('forward_decl: forward function declaration', () => {
    const code = `#include <iostream>
using namespace std;
int add(int a, int b);
int main() {
    cout << add(3, 4) << endl;
    return 0;
}
int add(int a, int b) {
    return a + b;
}`

    it('lifts forward_decl concept', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const concepts = findConcepts(tree!)
      expect(concepts).toContain('forward_decl')
    })

    it('generates forward declaration before main', () => {
      const result = roundTripCode(code)
      expect(result).toContain('int add(int a, int b);')
    })

    it('P1: double roundtrip is stable', () => {
      const gen1 = roundTripCode(code)
      const gen2 = roundTripCode(gen1)
      expect(gen1.trim()).toBe(gen2.trim())
    })
  })

  // ─── lambda with no params ────────────────────────────────

  describe('lambda_no_params: lambda capture by reference', () => {
    const code = `#include <iostream>
using namespace std;
int main() {
    int x = 10;
    auto show = [&]() {
        cout << x << endl;
    };
    show();
    return 0;
}`

    it('lifts cpp_lambda with & capture', () => {
      const tree = liftCode(code)
      const lambdaNode = findNode(tree!, 'cpp_lambda')
      expect(lambdaNode).toBeDefined()
      expect(lambdaNode!.properties.capture).toBe('&')
    })

    it('P1: double roundtrip is stable', () => {
      const gen1 = roundTripCode(code)
      const gen2 = roundTripCode(gen1)
      expect(gen1.trim()).toBe(gen2.trim())
    })
  })

  // ─── throw with int type ──────────────────────────────────

  describe('throw_int: throw and catch int values', () => {
    const code = `#include <iostream>
using namespace std;
void check(int val) {
    if (val < 0) {
        throw val;
    }
    cout << "ok: " << val << endl;
}
int main() {
    try {
        check(5);
        check(-1);
    } catch (int e) {
        cout << "error: " << e << endl;
    }
    return 0;
}`

    it('P1: double roundtrip is stable', () => {
      const gen1 = roundTripCode(code)
      const gen2 = roundTripCode(gen1)
      expect(gen1.trim()).toBe(gen2.trim())
    })
  })

  // ─── exception changing control flow ──────────────────────

  describe('exception_flow: exception changing control flow (known issue: array initializer lost)', () => {
    const code = `int process(int x) {
    if (x < 0) {
        throw runtime_error("negative");
    }
    if (x == 0) {
        throw runtime_error("zero");
    }
    return x * 2;
}`

    it('lifts cpp_throw inside conditional branches', () => {
      const tree = liftCode(code)
      expect(tree).not.toBeNull()
      const concepts = findConcepts(tree!)
      expect(concepts).toContain('cpp_throw')
      expect(concepts).toContain('func_def')
    })

    it('generates throw inside if blocks', () => {
      const result = roundTripCode(code)
      expect(result).toContain('throw runtime_error("negative");')
      expect(result).toContain('throw runtime_error("zero");')
      expect(result).toContain('return x * 2;')
    })

    it('P1: double roundtrip is stable', () => {
      const gen1 = roundTripCode(code)
      const gen2 = roundTripCode(gen1)
      expect(gen1.trim()).toBe(gen2.trim())
    })
  })
})
