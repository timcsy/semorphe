/**
 * CONCEPT IDENTITY AUDIT
 *
 * Verifies that every concept defined in the Semorphe C++ language support
 * is correctly identified by the lifter — i.e. when we write C++ code that
 * uses a specific concept, the lifter produces the correct componentId in the
 * semantic tree (not a generic fallback like var_declare).
 *
 * Motivation: we discovered that `int* p = &x;` was being lifted as
 * `var_declare` instead of `cpp_pointer_declare`. The code roundtripped
 * correctly but blocks wouldn't render correctly.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import type { Lifter } from '../../src/core/lift/lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { setupTestRenderer } from '../helpers/setup-renderer'
import { createTestLifter } from '../helpers/setup-lifter'
import type { SemanticNode } from '../../src/core/types'

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

// ─── Helpers ───

function liftCode(code: string): SemanticNode | null {
  const tree = tsParser.parse(code)
  return lifter.lift(tree.rootNode as any)
}

/** Recursively find all nodes with the given componentId */
function findConcepts(node: SemanticNode, componentId: string): SemanticNode[] {
  const found: SemanticNode[] = []
  if (node.componentId === componentId) {
    found.push(node)
  }
  for (const children of Object.values(node.children || {})) {
    for (const child of children) {
      found.push(...findConcepts(child, componentId))
    }
  }
  return found
}

/** Assert that lifting the given code produces at least one node with the given componentId */
function assertConceptPresent(code: string, componentId: string) {
  const sem = liftCode(code)
  expect(sem, `Failed to lift code for concept ${componentId}`).not.toBeNull()
  const matches = findConcepts(sem!, componentId)
  expect(
    matches.length,
    `Expected concept '${componentId}' in semantic tree but found none. Top-level concepts: ${JSON.stringify(collectConceptIds(sem!).slice(0, 20))}`
  ).toBeGreaterThan(0)
}

/** Collect all concept IDs in the tree (for diagnostics) */
function collectConceptIds(node: SemanticNode): string[] {
  const ids: string[] = [node.componentId]
  for (const children of Object.values(node.children || {})) {
    for (const child of children) {
      ids.push(...collectConceptIds(child))
    }
  }
  return ids
}

// ═══════════════════════════════════════════════════════════
// UNIVERSAL CONCEPTS
// ═══════════════════════════════════════════════════════════

describe('Universal Concepts', () => {

  // --- Data / Variables ---

  it('cpp:var_declare', () => {
    assertConceptPresent(`int main() { int x = 5; }`, 'cpp:var_declare')
  })

  it('cpp:var_assign', () => {
    assertConceptPresent(`int main() { int x; x = 5; }`, 'cpp:var_assign')
  })

  it('cpp:var_ref', () => {
    assertConceptPresent(`int main() { int x = 5; int y = x; }`, 'cpp:var_ref')
  })

  it('cpp:literal_number', () => {
    assertConceptPresent(`int main() { int x = 42; }`, 'cpp:literal_number')
  })

  it('cpp:literal_string', () => {
    assertConceptPresent(`#include <iostream>
using namespace std;
int main() { cout << "hello"; }`, 'cpp:literal_string')
  })

  // --- Operators ---

  it('arithmetic (+)', () => {
    assertConceptPresent(`int main() { int x = 1 + 2; }`, 'cpp:arithmetic')
  })

  it('compare (==)', () => {
    assertConceptPresent(`int main() { bool b = (1 == 2); }`, 'cpp:compare')
  })

  it('logic (&&)', () => {
    assertConceptPresent(`int main() { bool b = (true && false); }`, 'cpp:logic')
  })

  it('logic_not (!)', () => {
    assertConceptPresent(`int main() { bool b = !true; }`, 'cpp:logic_not')
  })

  it('negate (-)', () => {
    // Note: `-5` is parsed by tree-sitter as a single number_literal, not unary negate.
    // Use a variable negation to trigger the unary_expression AST node.
    assertConceptPresent(`int main() { int x = 1; int y = -x; }`, 'cpp:negate')
  })

  // --- Control Flow ---

  it('cpp:if', () => {
    assertConceptPresent(`int main() { if (true) { int x = 1; } }`, 'cpp:if')
  })

  // ARCHITECTURAL: if_else concept is never produced by the lifter. The lifter always
  // produces 'if' with an else_body child. The block renderer handles both via the same
  // codepath. Verify the 'if' concept is produced with an else_body child present.
  it('if_else — lifter uses if with else_body child (architectural)', () => {
    const sem = liftCode(`int main() { if (true) { int x = 1; } else { int y = 2; } }`)
    expect(sem).not.toBeNull()
    const ifNodes = findConcepts(sem!, 'cpp:if')
    expect(ifNodes.length).toBeGreaterThan(0)
    const hasElse = ifNodes.some(n => (n.children.else_body?.length ?? 0) > 0)
    expect(hasElse, 'Expected if concept with non-empty else_body child').toBe(true)
  })

  it('cpp:loop_count', () => {
    assertConceptPresent(`int main() { for (int i = 0; i < 10; i++) { int x = i; } }`, 'cpp:loop_count')
  })

  it('cpp:loop_while', () => {
    assertConceptPresent(`int main() { while (true) { break; } }`, 'cpp:loop_while')
  })

  it('cpp:break', () => {
    assertConceptPresent(`int main() { while (true) { break; } }`, 'cpp:break')
  })

  it('cpp:continue', () => {
    assertConceptPresent(`int main() { for (int i = 0; i < 10; i++) { continue; } }`, 'cpp:continue')
  })

  // --- Functions ---

  it('cpp:func_def', () => {
    assertConceptPresent(`int add(int a, int b) { return a + b; }`, 'cpp:func_def')
  })

  it('cpp:func_call', () => {
    assertConceptPresent(`int add(int a, int b) { return a + b; }
int main() { add(1, 2); }`, 'cpp:func_call')
  })

  it('cpp:func_call', () => {
    // Function call in expression context (assigned to a variable)
    assertConceptPresent(`int add(int a, int b) { return a + b; }
int main() { int x = add(1, 2); }`, 'cpp:func_call')
  })

  it('cpp:return', () => {
    assertConceptPresent(`int main() { return 0; }`, 'cpp:return')
  })

  // --- I/O ---

  it('print (cout)', () => {
    assertConceptPresent(`#include <iostream>
using namespace std;
int main() { cout << 42; }`, 'cpp:print')
  })

  it('cpp:endl', () => {
    assertConceptPresent(`#include <iostream>
using namespace std;
int main() { cout << endl; }`, 'cpp:endl')
  })

  it('input (cin)', () => {
    assertConceptPresent(`#include <iostream>
using namespace std;
int main() { int x; cin >> x; }`, 'cpp:input')
  })

  // --- Arrays ---

  it('cpp:array_declare', () => {
    assertConceptPresent(`int main() { int arr[5]; }`, 'cpp:array_declare')
  })

  it('cpp:array_at', () => {
    assertConceptPresent(`int main() { int arr[5]; int x = arr[0]; }`, 'cpp:array_at')
  })

  it('cpp:array_assign', () => {
    assertConceptPresent(`int main() { int arr[5]; arr[0] = 10; }`, 'cpp:array_assign')
  })
})

// ═══════════════════════════════════════════════════════════
// C++ CORE CONCEPTS
// ═══════════════════════════════════════════════════════════

describe('C++ Core Concepts', () => {

  // --- Literals & Constants ---

  it('cpp:literal_char', () => {
    assertConceptPresent(`int main() { char c = 'a'; }`, 'cpp:literal_char')
  })

  // --- Operators ---

  it('cpp_increment (statement)', () => {
    assertConceptPresent(`int main() { int i = 0; i++; }`, 'cpp:increment')
  })

  // ARCHITECTURAL: cpp_increment_expr is only produced during block rendering
  // (expressionCounterpart), not by the lifter. The lifter always produces cpp_increment.
  it('cpp_increment_expr — expression counterpart, verify cpp_increment exists', () => {
    assertConceptPresent(`int main() { int i = 0; int x = i++; }`, 'cpp:increment')
  })

  it('cpp_compound_assign (statement)', () => {
    assertConceptPresent(`int main() { int x = 0; x += 5; }`, 'cpp:var_assign_compound')
  })

  // ARCHITECTURAL: cpp_compound_assign_expr is only produced during block rendering
  // (expressionCounterpart), not by the lifter. Verify cpp_compound_assign exists.
  it('cpp_compound_assign_expr — expression counterpart, verify cpp_compound_assign exists', () => {
    assertConceptPresent(`int main() { int x = 0; x += 5; }`, 'cpp:var_assign_compound')
  })

  it('cpp:ternary', () => {
    assertConceptPresent(`int main() { int x = (1 > 0) ? 1 : 0; }`, 'cpp:ternary')
  })

  it('cpp:cast', () => {
    assertConceptPresent(`int main() { double d = 3.14; int x = (int)d; }`, 'cpp:cast')
  })

  it('cpp:bitwise_not', () => {
    assertConceptPresent(`int main() { int x = ~0; }`, 'cpp:bitwise_not')
  })

  // --- Control Flow ---

  it('cpp:switch', () => {
    assertConceptPresent(`int main() { int x = 1; switch (x) { case 1: break; } }`, 'cpp:switch')
  })

  it('cpp:case', () => {
    assertConceptPresent(`int main() { int x = 1; switch (x) { case 1: break; } }`, 'cpp:case')
  })

  it('cpp:default', () => {
    assertConceptPresent(`int main() { int x = 1; switch (x) { default: break; } }`, 'cpp:default')
  })

  it('cpp:loop_for', () => {
    // A non-counting for loop (uses compound assign, not ++/-- update)
    assertConceptPresent(`int main() { for (int i = 0; i < 100; i += 2) { int x = i; } }`, 'cpp:loop_for')
  })

  it('cpp:loop_do_while', () => {
    assertConceptPresent(`int main() { int x = 0; do { x++; } while (x < 10); }`, 'cpp:loop_do_while')
  })

  it('cpp:loop_range', () => {
    assertConceptPresent(`#include <vector>
int main() { std::vector<int> v; for (int x : v) { int y = x; } }`, 'cpp:loop_range')
  })

  // --- Pointers & References ---

  it('cpp:pointer_declare', () => {
    assertConceptPresent(`int main() { int x = 42; int* p = &x; }`, 'cpp:pointer_declare')
  })

  it('cpp:pointer_deref', () => {
    assertConceptPresent(`int main() { int x = 42; int* p = &x; int y = *p; }`, 'cpp:pointer_deref')
  })

  it('cpp:address_of', () => {
    assertConceptPresent(`int main() { int x = 42; int* p = &x; }`, 'cpp:address_of')
  })

  it('cpp:pointer_assign', () => {
    assertConceptPresent(`int main() { int x = 42; int* p = &x; *p = 100; }`, 'cpp:pointer_assign')
  })

  it('cpp:var_declare_ref', () => {
    assertConceptPresent(`int main() { int x = 42; int& r = x; }`, 'cpp:var_declare_ref')
  })

  it('cpp:new', () => {
    assertConceptPresent(`int main() { int* p = new int; }`, 'cpp:new')
  })

  it('cpp:delete', () => {
    assertConceptPresent(`int main() { int* p = new int; delete p; }`, 'cpp:delete')
  })

  // FIXED: cast_expression liftStrategy now detects (Type*)malloc(...) pattern.
  it('cpp:malloc', () => {
    assertConceptPresent(`#include <cstdlib>
int main() { int* p = (int*)malloc(10 * sizeof(int)); }`, 'cpp:malloc')
  })

  // FIXED: call_expression handler now recognizes free() as cpp_free.
  it('cpp:free', () => {
    assertConceptPresent(`#include <cstdlib>
int main() { int* p = (int*)malloc(sizeof(int)); free(p); }`, 'cpp:free')
  })

  // --- Variable Qualifiers ---

  it('cpp:var_declare_const', () => {
    assertConceptPresent(`int main() { const int x = 42; }`, 'cpp:var_declare_const')
  })

  it('cpp:var_declare_auto', () => {
    assertConceptPresent(`int main() { auto x = 42; }`, 'cpp:var_declare_auto')
  })

  it('cpp:var_declare_static', () => {
    assertConceptPresent(`void foo() { static int x = 0; }`, 'cpp:var_declare_static')
  })

  it('cpp:var_declare_constexpr', () => {
    assertConceptPresent(`int main() { constexpr int x = 42; }`, 'cpp:var_declare_constexpr')
  })

  // ARCHITECTURAL: var_declare_expr is only produced during block rendering
  // (expressionCounterpart). The lifter produces var_declare; the for-loop init
  // slot uses the expression counterpart at render time. Use a non-loop context
  // to verify var_declare is produced correctly.
  it('var_declare_expr — expression counterpart, verify var_declare exists', () => {
    assertConceptPresent(`int main() { int x = 5; }`, 'cpp:var_declare')
  })

  // --- Preprocessor ---

  it('cpp:include', () => {
    assertConceptPresent(`#include <iostream>`, 'cpp:include')
  })

  it('cpp:include_local', () => {
    assertConceptPresent(`#include "myheader.h"`, 'cpp:include_local')
  })

  it('cpp:define', () => {
    assertConceptPresent(`#define MAX 100`, 'cpp:define')
  })

  it('cpp:ifdef', () => {
    assertConceptPresent(`#ifdef DEBUG
int x = 1;
#endif`, 'cpp:ifdef')
  })

  // FIXED: tree-sitter C++ parses both #ifdef and #ifndef as preproc_ifdef node type.
  // The lifter now checks the source text to distinguish them.
  it('cpp:ifndef', () => {
    assertConceptPresent(`#ifndef DEBUG
int x = 1;
#endif`, 'cpp:ifndef')
  })

  // --- Namespace ---

  it('cpp:using_namespace', () => {
    assertConceptPresent(`using namespace std;`, 'cpp:using_namespace')
  })

  // --- Structures ---

  it('cpp:struct_declare', () => {
    assertConceptPresent(`struct Point { int x; int y; };`, 'cpp:struct_declare')
  })

  it('cpp:struct_at_member', () => {
    assertConceptPresent(`struct Point { int x; };
int main() { Point p; int x = p.x; }`, 'cpp:struct_at_member')
  })

  it('cpp:struct_at_ptr', () => {
    assertConceptPresent(`struct Point { int x; };
int main() { Point p; Point* pp = &p; int x = pp->x; }`, 'cpp:struct_at_ptr')
  })

  // --- Classes (advanced) ---

  it('cpp:class_def', () => {
    assertConceptPresent(`class MyClass {
public:
    int x;
};`, 'cpp:class_def')
  })

  // --- Type Operations ---

  it('cpp:sizeof', () => {
    assertConceptPresent(`int main() { int x = sizeof(int); }`, 'cpp:sizeof')
  })

  it('cpp:typedef', () => {
    assertConceptPresent(`typedef int myint;`, 'cpp:typedef')
  })

  it('cpp:using_alias', () => {
    assertConceptPresent(`using myint = int;`, 'cpp:using_alias')
  })

  // --- Enum ---

  it('cpp:enum', () => {
    assertConceptPresent(`enum Color { RED, GREEN, BLUE };`, 'cpp:enum')
  })

  // --- 2D Arrays ---

  it('cpp:array_2d_declare', () => {
    assertConceptPresent(`int main() { int arr[3][4]; }`, 'cpp:array_2d_declare')
  })

  it('cpp:array_2d_at', () => {
    assertConceptPresent(`int main() { int arr[3][4]; int x = arr[0][1]; }`, 'cpp:array_2d_at')
  })

  it('cpp:array_2d_assign', () => {
    assertConceptPresent(`int main() { int arr[3][4]; arr[0][1] = 10; }`, 'cpp:array_2d_assign')
  })

  // --- Exception Handling ---

  it('cpp:try_catch', () => {
    assertConceptPresent(`#include <stdexcept>
int main() { try { int x = 1; } catch (int e) { int y = 2; } }`, 'cpp:try_catch')
  })

  it('cpp:throw', () => {
    assertConceptPresent(`int main() { throw 42; }`, 'cpp:throw')
  })

  // --- OOP (advanced) ---

  it('cpp:constructor', () => {
    assertConceptPresent(`class Foo {
public:
    int x;
    Foo(int a) : x(a) {}
};`, 'cpp:constructor')
  })

  it('cpp:destructor', () => {
    assertConceptPresent(`class Foo {
public:
    ~Foo() {}
};`, 'cpp:destructor')
  })

  it('cpp:method_virtual', () => {
    assertConceptPresent(`class Base {
public:
    virtual void foo() {}
};`, 'cpp:method_virtual')
  })

  it('cpp:method_virtual_pure', () => {
    assertConceptPresent(`class Base {
public:
    virtual void foo() = 0;
};`, 'cpp:method_virtual_pure')
  })

  it('cpp:method_override', () => {
    assertConceptPresent(`class Base {
public:
    virtual void foo() {}
};
class Derived : public Base {
public:
    void foo() override {}
};`, 'cpp:method_override')
  })

  it('cpp:operator_overload', () => {
    assertConceptPresent(`class Vec {
public:
    int x;
    Vec operator+(const Vec& other) { Vec r; r.x = x + other.x; return r; }
};`, 'cpp:operator_overload')
  })

  // --- Lambda ---

  it('cpp:lambda', () => {
    assertConceptPresent(`#include <algorithm>
#include <vector>
int main() { auto f = [](int x) { return x + 1; }; }`, 'cpp:lambda')
  })

  // --- Namespace ---

  it('cpp:namespace_def', () => {
    assertConceptPresent(`namespace myns { int x = 1; }`, 'cpp:namespace_def')
  })

  // --- C++ Casts ---

  it('cpp:cast_static', () => {
    assertConceptPresent(`int main() { double d = 3.14; int x = static_cast<int>(d); }`, 'cpp:cast_static')
  })

  it('cpp:cast_dynamic', () => {
    assertConceptPresent(`class Base { public: virtual ~Base() {} };
class Derived : public Base {};
int main() { Base* b = new Derived(); Derived* d = dynamic_cast<Derived*>(b); }`, 'cpp:cast_dynamic')
  })

  it('cpp:cast_reinterpret', () => {
    assertConceptPresent(`int main() { int x = 42; int* p = &x; long l = reinterpret_cast<long>(p); }`, 'cpp:cast_reinterpret')
  })

  it('cpp:cast_const', () => {
    assertConceptPresent(`int main() { const int x = 42; int* p = const_cast<int*>(&x); }`, 'cpp:cast_const')
  })

  // --- Template ---

  it('cpp:template_function', () => {
    assertConceptPresent(`template <typename T>
T add(T a, T b) { return a + b; }`, 'cpp:template_function')
  })

  // --- Container Generic Operations ---

  it('cpp_container_push_back（vector → 通用版）', () => {
    assertConceptPresent(`#include <vector>
int main() { std::vector<int> v; v.push_back(1); }`, 'cpp:container_append')
  })

  it('cpp:container_pop', () => {
    assertConceptPresent(`#include <stack>
int main() { std::stack<int> s; s.pop(); }`, 'cpp:container_pop')
  })

  it('cpp:container_push', () => {
    assertConceptPresent(`#include <stack>
int main() { std::stack<int> s; s.push(1); }`, 'cpp:container_push')
  })

  it('cpp:container_empty', () => {
    assertConceptPresent(`#include <vector>
int main() { std::vector<int> v; bool b = v.empty(); }`, 'cpp:container_empty')
  })

  it('cpp_container_clear（vector → 通用版）', () => {
    assertConceptPresent(`#include <vector>
int main() { std::vector<int> v; v.clear(); }`, 'cpp:container_clear')
  })

  it('cpp:container_erase', () => {
    assertConceptPresent(`#include <map>
int main() { std::map<int, int> m; m.erase(1); }`, 'cpp:container_erase')
  })

  it('cpp:container_count', () => {
    assertConceptPresent(`#include <map>
int main() { std::map<int, int> m; int c = m.count(1); }`, 'cpp:container_count')
  })

  // --- Generic Method Call ---

  // ARCHITECTURAL: expression_statement unwraps to expression context, so method
  // calls as statements are lifted as cpp_method_call_expression. The lifter always
  // produces the expr form since call_expression is inherently an expression.
  // ⚠️ 這裡原本標著 `architectural`，說「辨識器產出的是運算式版」——
  // **又一個把「還沒做」寫成「架構上如此」的標籤**（同一天第二個）。
  // 078 讓辨識器看語法樹的父節點決定位置，敘述位置就拿到敘述身分。
  it('cpp_method_call（敘述位置 → 敘述身分）', () => {
    assertConceptPresent(`#include <vector>
int main() { std::vector<int> v; v.resize(10); }`, 'cpp:method_call')
  })

  // ⚠️ 這一支原本用**與上面完全相同的樣本**（敘述位置）——也就是說
  // 它從來沒有測到運算式位置。**兩支測試斷言同一件事，看起來像涵蓋了兩種。**
  it('cpp_method_call_expression（運算式位置 → 運算式身分）', () => {
    assertConceptPresent(`#include <vector>
int main() { std::vector<int> v; int n = v.at(0); }`, 'cpp:method_call')
  })

  // --- Forward Declaration ---

  it('cpp:forward_decl', () => {
    assertConceptPresent(`int add(int a, int b);
int add(int a, int b) { return a + b; }`, 'cpp:forward_decl')
  })

  // --- Static Member ---

  // FIXED: liftClassMember now checks for static storage_class_specifier in field_declaration.
  it('cpp:member_static', () => {
    assertConceptPresent(`class Foo {
public:
    static int count;
};`, 'cpp:member_static')
  })
})

// ═══════════════════════════════════════════════════════════
// STD MODULE CONCEPTS — cstdio
// ═══════════════════════════════════════════════════════════

describe('STD: cstdio', () => {
  it('cpp:print_formatted', () => {
    assertConceptPresent(`#include <cstdio>
int main() { printf("hello %d\\n", 42); }`, 'cpp:print_formatted')
  })

  it('cpp:input_formatted', () => {
    assertConceptPresent(`#include <cstdio>
int main() { int x; scanf("%d", &x); }`, 'cpp:input_formatted')
  })

  // ARCHITECTURAL: cpp_scanf_expr is only produced during block rendering
  // (expressionCounterpart). The lifter produces cpp_scanf.
  it('cpp_scanf_expr — expression counterpart, verify cpp_scanf exists', () => {
    assertConceptPresent(`#include <cstdio>
int main() { int x; scanf("%d", &x); }`, 'cpp:input_formatted')
  })
})

// ═══════════════════════════════════════════════════════════
// STD MODULE CONCEPTS — cmath
// ═══════════════════════════════════════════════════════════

describe('STD: cmath', () => {
  it('cpp:math_pow', () => {
    assertConceptPresent(`#include <cmath>
int main() { double x = pow(2.0, 3.0); }`, 'cpp:math_pow')
  })

  it('cpp:math_unary (sqrt)', () => {
    assertConceptPresent(`#include <cmath>
int main() { double x = sqrt(4.0); }`, 'cpp:math_unary')
  })

  it('cpp:math_binary (fmod)', () => {
    assertConceptPresent(`#include <cmath>
int main() { double x = fmod(5.0, 3.0); }`, 'cpp:math_binary')
  })
})

// ═══════════════════════════════════════════════════════════
// STD MODULE CONCEPTS — string
// ═══════════════════════════════════════════════════════════

describe('STD: string', () => {
  // FIXED: liftDeclaration now detects string type_identifier in qualified_identifier.
  it('cpp:string_declare', () => {
    assertConceptPresent(`#include <string>
int main() { std::string s; }`, 'cpp:string_declare')
  })

  it('cpp:string_size', () => {
    assertConceptPresent(`#include <string>
int main() { std::string s; int n = s.length(); }`, 'cpp:string_size')
  })

  it('cpp:string_substr', () => {
    assertConceptPresent(`#include <string>
int main() { std::string s = "hello"; std::string t = s.substr(0, 3); }`, 'cpp:string_substr')
  })

  it('cpp:string_find', () => {
    assertConceptPresent(`#include <string>
int main() { std::string s = "hello"; int pos = s.find("ll"); }`, 'cpp:string_find')
  })

  it('cpp:string_append', () => {
    assertConceptPresent(`#include <string>
int main() { std::string s; s.append("hi"); }`, 'cpp:string_append')
  })

  it('cpp:string_as_cstring', () => {
    assertConceptPresent(`#include <string>
#include <cstdio>
int main() { std::string s = "hello"; printf("%s", s.c_str()); }`, 'cpp:string_as_cstring')
  })

  it('cpp:input_line', () => {
    assertConceptPresent(`#include <iostream>
#include <string>
using namespace std;
int main() { string s; getline(cin, s); }`, 'cpp:input_line')
  })

  it('cpp:string_make', () => {
    assertConceptPresent(`#include <string>
int main() { std::string s = std::to_string(42); }`, 'cpp:string_make')
  })

  it('cpp:string_as_int', () => {
    assertConceptPresent(`#include <string>
int main() { int x = std::stoi("42"); }`, 'cpp:string_as_int')
  })

  it('cpp:string_as_double', () => {
    assertConceptPresent(`#include <string>
int main() { double x = std::stod("3.14"); }`, 'cpp:string_as_double')
  })

  // ARCHITECTURAL: s.empty() on string is lifted as cpp_container_empty (generic)
  // because the lifter has no type information to distinguish string.empty() from
  // vector.empty(). This is correct behavior for a syntax-only lifter.
  it('cpp_string_empty — lifter uses generic cpp_container_empty (no type info)', () => {
    assertConceptPresent(`#include <string>
int main() { std::string s; bool b = s.empty(); }`, 'cpp:container_empty')
  })

  it('cpp:string_erase', () => {
    assertConceptPresent(`#include <string>
int main() { std::string s = "hello"; s.erase(0, 1); }`, 'cpp:string_erase')
  })

  it('cpp:string_insert', () => {
    assertConceptPresent(`#include <string>
int main() { std::string s = "hllo"; s.insert(1, "e"); }`, 'cpp:string_insert')
  })

  it('cpp:string_replace', () => {
    assertConceptPresent(`#include <string>
int main() { std::string s = "hello"; s.replace(0, 1, "H"); }`, 'cpp:string_replace')
  })

  // ⚠️ 這裡原本標著 `ARCHITECTURAL`，說「辨識器沒有型別資訊，所以只能用
  // 通用版」——**那句話從來不是真的**。辨識脈絡一直有作用域與型別追蹤，
  // 只是零呼叫者（076 接上了）。
  //
  // `ARCHITECTURAL` 這個標籤讀起來像「這是架構上的必然」，而它其實是
  // 「還沒接上」。見 knowledge/concepts/執行機構.md「註解把『沒插電』寫成
  // 『做不到』」。
  it('cpp_string_append_char（string 宣告在前 → 專屬身分）', () => {
    assertConceptPresent(`#include <string>
int main() { std::string s; s.push_back('a'); }`, 'cpp:string_append_char')
  })

  // 同上——原本的 `ARCHITECTURAL` 標籤是假的
  it('cpp_string_clear（string 宣告在前 → 專屬身分）', () => {
    assertConceptPresent(`#include <string>
int main() { std::string s; s.clear(); }`, 'cpp:string_clear')
  })
})

// ═══════════════════════════════════════════════════════════
// STD MODULE CONCEPTS — cctype
// ═══════════════════════════════════════════════════════════

describe('STD: cctype', () => {
  it('cpp:char_is_alpha', () => {
    assertConceptPresent(`#include <cctype>
int main() { bool b = isalpha('a'); }`, 'cpp:char_is_alpha')
  })

  it('cpp:char_is_digit', () => {
    assertConceptPresent(`#include <cctype>
int main() { bool b = isdigit('1'); }`, 'cpp:char_is_digit')
  })

  it('cpp:char_to_upper', () => {
    assertConceptPresent(`#include <cctype>
int main() { char c = toupper('a'); }`, 'cpp:char_to_upper')
  })

  it('cpp:char_to_lower', () => {
    assertConceptPresent(`#include <cctype>
int main() { char c = tolower('A'); }`, 'cpp:char_to_lower')
  })
})

// ═══════════════════════════════════════════════════════════
// STD MODULE CONCEPTS — algorithm
// ═══════════════════════════════════════════════════════════

describe('STD: algorithm', () => {
  it('cpp:range_sort', () => {
    assertConceptPresent(`#include <algorithm>
#include <vector>
int main() { std::vector<int> v; sort(v.begin(), v.end()); }`, 'cpp:range_sort')
  })

  it('cpp:range_reverse', () => {
    assertConceptPresent(`#include <algorithm>
#include <vector>
int main() { std::vector<int> v; reverse(v.begin(), v.end()); }`, 'cpp:range_reverse')
  })

  it('cpp:range_fill', () => {
    assertConceptPresent(`#include <algorithm>
#include <vector>
int main() { std::vector<int> v(10); fill(v.begin(), v.end(), 0); }`, 'cpp:range_fill')
  })

  it('cpp:math_min', () => {
    assertConceptPresent(`#include <algorithm>
int main() { int x = min(1, 2); }`, 'cpp:math_min')
  })

  it('cpp:math_max', () => {
    assertConceptPresent(`#include <algorithm>
int main() { int x = max(1, 2); }`, 'cpp:math_max')
  })

  it('cpp:var_swap', () => {
    assertConceptPresent(`#include <algorithm>
int main() { int a = 1; int b = 2; swap(a, b); }`, 'cpp:var_swap')
  })
})

// ═══════════════════════════════════════════════════════════
// STD MODULE CONCEPTS — cstdlib
// ═══════════════════════════════════════════════════════════

describe('STD: cstdlib', () => {
  it('cpp:random_next', () => {
    assertConceptPresent(`#include <cstdlib>
int main() { int x = rand(); }`, 'cpp:random_next')
  })

  it('cpp:random_seed', () => {
    assertConceptPresent(`#include <cstdlib>
int main() { srand(42); }`, 'cpp:random_seed')
  })

  it('cpp:math_abs', () => {
    assertConceptPresent(`#include <cstdlib>
int main() { int x = abs(-5); }`, 'cpp:math_abs')
  })

  it('cpp:program_exit', () => {
    assertConceptPresent(`#include <cstdlib>
int main() { exit(0); }`, 'cpp:program_exit')
  })

  it('cpp:cstring_as_int', () => {
    assertConceptPresent(`#include <cstdlib>
int main() { int x = atoi("42"); }`, 'cpp:cstring_as_int')
  })

  it('cpp:cstring_as_double', () => {
    assertConceptPresent(`#include <cstdlib>
int main() { double x = atof("3.14"); }`, 'cpp:cstring_as_double')
  })
})

// ═══════════════════════════════════════════════════════════
// STD MODULE CONCEPTS — cstring
// ═══════════════════════════════════════════════════════════

describe('STD: cstring', () => {
  it('cpp:cstring_size', () => {
    assertConceptPresent(`#include <cstring>
int main() { int n = strlen("hello"); }`, 'cpp:cstring_size')
  })

  it('cpp:cstring_compare', () => {
    assertConceptPresent(`#include <cstring>
int main() { int r = strcmp("abc", "def"); }`, 'cpp:cstring_compare')
  })

  it('cpp:cstring_copy', () => {
    assertConceptPresent(`#include <cstring>
int main() { char dest[10]; strcpy(dest, "hi"); }`, 'cpp:cstring_copy')
  })

  it('cpp:cstring_append', () => {
    assertConceptPresent(`#include <cstring>
int main() { char dest[20]; strcpy(dest, "hello"); strcat(dest, " world"); }`, 'cpp:cstring_append')
  })

  it('cpp:cstring_copy_bounded', () => {
    assertConceptPresent(`#include <cstring>
int main() { char dest[10]; strncpy(dest, "hello", 3); }`, 'cpp:cstring_copy_bounded')
  })

  it('cpp:cstring_compare_bounded', () => {
    assertConceptPresent(`#include <cstring>
int main() { int r = strncmp("abc", "abd", 2); }`, 'cpp:cstring_compare_bounded')
  })

  it('cpp:cstring_find_char', () => {
    assertConceptPresent(`#include <cstring>
int main() { const char* p = strchr("hello", 'l'); }`, 'cpp:cstring_find_char')
  })

  it('cpp:cstring_find', () => {
    assertConceptPresent(`#include <cstring>
int main() { const char* p = strstr("hello world", "world"); }`, 'cpp:cstring_find')
  })

  it('cpp:memory_fill', () => {
    assertConceptPresent(`#include <cstring>
int main() { int arr[10]; memset(arr, 0, sizeof(arr)); }`, 'cpp:memory_fill')
  })

  it('cpp:memory_copy', () => {
    assertConceptPresent(`#include <cstring>
int main() { int src[3]; int dest[3]; memcpy(dest, src, sizeof(src)); }`, 'cpp:memory_copy')
  })
})

// ═══════════════════════════════════════════════════════════
// STD MODULE CONCEPTS — numeric
// ═══════════════════════════════════════════════════════════

describe('STD: numeric', () => {
  it('cpp:range_sum', () => {
    assertConceptPresent(`#include <numeric>
#include <vector>
int main() { std::vector<int> v; int sum = accumulate(v.begin(), v.end(), 0); }`, 'cpp:range_sum')
  })

  it('cpp:range_fill_sequence', () => {
    assertConceptPresent(`#include <numeric>
#include <vector>
int main() { std::vector<int> v(10); iota(v.begin(), v.end(), 0); }`, 'cpp:range_fill_sequence')
  })

  it('cpp:range_sum_partial', () => {
    assertConceptPresent(`#include <numeric>
#include <vector>
int main() { std::vector<int> v(10); std::vector<int> r(10); partial_sum(v.begin(), v.end(), r.begin()); }`, 'cpp:range_sum_partial')
  })

  it('cpp:math_gcd', () => {
    assertConceptPresent(`#include <numeric>
int main() { int g = __gcd(12, 8); }`, 'cpp:math_gcd')
  })

  it('cpp:math_lcm', () => {
    // Note: lcm might need C++17; lifter may or may not support it
    assertConceptPresent(`#include <numeric>
int main() { int l = lcm(12, 8); }`, 'cpp:math_lcm')
  })
})

// ═══════════════════════════════════════════════════════════
// STD MODULE CONCEPTS — vector
// ═══════════════════════════════════════════════════════════

describe('STD: vector', () => {
  // FIXED: liftDeclaration now finds template_type inside qualified_identifier (std::vector<int>).
  it('cpp:vector_declare', () => {
    assertConceptPresent(`#include <vector>
int main() { std::vector<int> v; }`, 'cpp:vector_declare')
  })

  it('cpp:vector_size', () => {
    assertConceptPresent(`#include <vector>
int main() { std::vector<int> v; int n = v.size(); }`, 'cpp:vector_size')
  })

  it('cpp:vector_pop', () => {
    assertConceptPresent(`#include <vector>
int main() { std::vector<int> v; v.pop_back(); }`, 'cpp:vector_pop')
  })

  it('cpp:vector_back', () => {
    assertConceptPresent(`#include <vector>
int main() { std::vector<int> v; int x = v.back(); }`, 'cpp:vector_back')
  })
})

// ═══════════════════════════════════════════════════════════
// STD MODULE CONCEPTS — stack
// ═══════════════════════════════════════════════════════════

describe('STD: stack', () => {
  // FIXED: liftDeclaration now finds template_type inside qualified_identifier.
  it('cpp:stack_declare', () => {
    assertConceptPresent(`#include <stack>
int main() { std::stack<int> s; }`, 'cpp:stack_declare')
  })

  it('cpp:stack_peek', () => {
    assertConceptPresent(`#include <stack>
int main() { std::stack<int> s; s.push(1); int x = s.top(); }`, 'cpp:stack_peek')
  })
})

// ═══════════════════════════════════════════════════════════
// STD MODULE CONCEPTS — queue
// ═══════════════════════════════════════════════════════════

describe('STD: queue', () => {
  // FIXED: liftDeclaration now finds template_type inside qualified_identifier.
  it('cpp:queue_declare', () => {
    assertConceptPresent(`#include <queue>
int main() { std::queue<int> q; }`, 'cpp:queue_declare')
  })

  it('cpp:queue_front', () => {
    assertConceptPresent(`#include <queue>
int main() { std::queue<int> q; q.push(1); int x = q.front(); }`, 'cpp:queue_front')
  })
})

// ═══════════════════════════════════════════════════════════
// STD MODULE CONCEPTS — map
// ═══════════════════════════════════════════════════════════

describe('STD: map', () => {
  // FIXED: liftDeclaration now finds template_type inside qualified_identifier.
  it('cpp:map_declare', () => {
    assertConceptPresent(`#include <map>
int main() { std::map<int, int> m; }`, 'cpp:map_declare')
  })

  // ⚠️ 這一支原本標著 `ARCHITECTURAL`，說「辨識器**沒有型別資訊**可以區分陣列與
  // 對應表」，並斷言 `m[1]` 應該降級成 `array_access`。
  //
  // **那句話是假的。** 型別追蹤（`ctx.data.getType`）在 076 就接上了，095 的
  // istringstream 與 097 的 container_kind 都在用。這支測試把一個假宣稱**編碼成
  // 預期行為**，於是沒有人會去質疑它——比一句註解更難發現。
  //
  // 這是 experience「一句解釋為什麼『只能這樣』的註解，會讓那個限制看起來是本質的」
  // 的第四個實例，而**前三個都在註解裡，這個在測試名稱裡**。
  it('cpp_map_at — 對應表的鍵存取有自己的身分（型別查得到）', () => {
    assertConceptPresent(`#include <map>
int main() { std::map<int, int> m; int x = m[1]; }`, 'cpp:map_at')
  })

  it('負向：真的陣列仍然是 array_access', () => {
    assertConceptPresent(`int main() { int a[3]; int x = a[1]; }`, 'cpp:array_at')
  })
})

// ═══════════════════════════════════════════════════════════
// STD MODULE CONCEPTS — set
// ═══════════════════════════════════════════════════════════

describe('STD: set', () => {
  // FIXED: liftDeclaration now finds template_type inside qualified_identifier.
  it('cpp:set_declare', () => {
    assertConceptPresent(`#include <set>
int main() { std::set<int> s; }`, 'cpp:set_declare')
  })

  it('cpp:set_insert', () => {
    assertConceptPresent(`#include <set>
int main() { std::set<int> s; s.insert(1); }`, 'cpp:set_insert')
  })
})

// ═══════════════════════════════════════════════════════════
// STD MODULE CONCEPTS — fstream
// ═══════════════════════════════════════════════════════════

describe('STD: fstream', () => {
  // FIXED: liftDeclaration now detects stream type_identifiers in qualified_identifier.
  it('cpp:ifstream_declare', () => {
    assertConceptPresent(`#include <fstream>
int main() { std::ifstream fin("input.txt"); }`, 'cpp:ifstream_declare')
  })

  it('cpp:ofstream_declare', () => {
    assertConceptPresent(`#include <fstream>
int main() { std::ofstream fout("output.txt"); }`, 'cpp:ofstream_declare')
  })
})

// ═══════════════════════════════════════════════════════════
// STD MODULE CONCEPTS — sstream
// ═══════════════════════════════════════════════════════════

describe('STD: sstream', () => {
  // FIXED: liftDeclaration now detects stream type_identifiers in qualified_identifier.
  it('cpp:stringstream_declare', () => {
    assertConceptPresent(`#include <sstream>
int main() { std::stringstream ss; }`, 'cpp:stringstream_declare')
  })
})

// ═══════════════════════════════════════════════════════════
// STD MODULE CONCEPTS — utility
// ═══════════════════════════════════════════════════════════

describe('STD: utility', () => {
  // FIXED: liftDeclaration now finds template_type inside qualified_identifier.
  it('cpp:pair_declare', () => {
    assertConceptPresent(`#include <utility>
int main() { std::pair<int, int> p; }`, 'cpp:pair_declare')
  })

  it('cpp:pair_make', () => {
    assertConceptPresent(`#include <utility>
int main() { auto p = make_pair(1, 2); }`, 'cpp:pair_make')
  })
})
