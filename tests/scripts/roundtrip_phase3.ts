/**
 * Phase 3 Roundtrip Runner: Functions & I/O
 * Lifts C++ code → semantic tree → generates C++ code → verifies stability
 */
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import type { StylePreset, SemanticNode } from '../../src/core/types'
import { writeFileSync, mkdirSync } from 'fs'

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

const testPrograms: Record<string, string> = {
  t01_simple_function: `#include <iostream>
using namespace std;
int add(int a, int b) {
    return a + b;
}
int main() {
    cout << add(3, 4) << endl;
    return 0;
}`,
  t02_void_function: `#include <iostream>
using namespace std;
void greet() {
    cout << "hello" << endl;
}
int main() {
    greet();
    return 0;
}`,
  t03_function_calling_function: `#include <iostream>
using namespace std;
int square(int x) {
    return x * x;
}
int sumOfSquares(int a, int b) {
    return square(a) + square(b);
}
int main() {
    cout << sumOfSquares(3, 4) << endl;
    return 0;
}`,
  t04_recursive_function: `#include <iostream>
using namespace std;
int factorial(int n) {
    if (n <= 1) {
        return 1;
    }
    return n * factorial(n - 1);
}
int main() {
    cout << factorial(5) << endl;
    return 0;
}`,
  t05_multiple_prints: `#include <iostream>
using namespace std;
int main() {
    cout << "x = " << 42 << endl;
    cout << "y = " << 3.14 << endl;
    return 0;
}`,
  t06_multiple_returns: `#include <iostream>
using namespace std;
int abs_val(int x) {
    if (x < 0) {
        return -x;
    }
    return x;
}
int main() {
    cout << abs_val(-5) << endl;
    cout << abs_val(3) << endl;
    return 0;
}`,
  t07_comment: `#include <iostream>
using namespace std;
// This is a comment
int main() {
    // Another comment
    cout << "ok" << endl;
    return 0;
}`,
  t08_multiple_includes: `#include <iostream>
#include <string>
using namespace std;
int main() {
    string s = "test";
    cout << s << endl;
    return 0;
}`,
  t09_function_no_args: `#include <iostream>
using namespace std;
int getAnswer() {
    return 42;
}
int main() {
    int x = getAnswer();
    cout << x << endl;
    return 0;
}`,
  t10_nested_function_calls: `#include <iostream>
using namespace std;
int max2(int a, int b) {
    if (a > b) {
        return a;
    }
    return b;
}
int main() {
    int result = max2(max2(1, 5), max2(3, 2));
    cout << result << endl;
    return 0;
}`,
}

function countNodes(node: SemanticNode): { total: number; raw: number } {
  let total = 1
  let raw = 0
  if (node.concept === 'cpp_raw_code' || node.concept === 'cpp_raw_expression' || node.concept === 'unresolved') {
    raw++
  }
  for (const children of Object.values(node.children || {})) {
    for (const child of children) {
      const c = countNodes(child)
      total += c.total
      raw += c.raw
    }
  }
  return { total, raw }
}

async function main() {
  await Parser.init({
    locateFile: (scriptName: string) => `${process.cwd()}/public/${scriptName}`,
  })
  const parser = new Parser()
  const lang = await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`)
  parser.setLanguage(lang)

  const lifter = createTestLifter()
  registerCppLanguage()

  mkdirSync('/tmp/semorphe-roundtrip', { recursive: true })

  const results: { id: string; status: string; detail: string }[] = []

  for (const [id, code] of Object.entries(testPrograms)) {
    try {
      const tree = parser.parse(code)
      const sem = lifter.lift(tree.rootNode as any)
      if (!sem) {
        results.push({ id, status: 'LIFT_FAIL', detail: 'Lifter returned null' })
        continue
      }

      const { total, raw } = countNodes(sem)
      const generated = generateCode(sem, 'cpp', style)

      writeFileSync(`/tmp/semorphe-roundtrip/${id}_original.cpp`, code)
      writeFileSync(`/tmp/semorphe-roundtrip/${id}_generated.cpp`, generated)

      // Second roundtrip: lift generated code again
      const tree2 = parser.parse(generated)
      const sem2 = lifter.lift(tree2.rootNode as any)
      if (!sem2) {
        results.push({ id, status: 'ROUNDTRIP_DRIFT', detail: 'Second lift returned null' })
        continue
      }
      const generated2 = generateCode(sem2, 'cpp', style)
      writeFileSync(`/tmp/semorphe-roundtrip/${id}_generated2.cpp`, generated2)

      const drift = generated !== generated2

      if (raw > 0) {
        results.push({ id, status: 'DEGRADED', detail: `${raw}/${total} raw/unresolved nodes` })
      } else if (drift) {
        results.push({ id, status: 'ROUNDTRIP_DRIFT', detail: `Code differs after 2nd roundtrip` })
      } else {
        results.push({ id, status: 'PASS', detail: `${total} nodes, clean tree, stable` })
      }
    } catch (e: any) {
      results.push({ id, status: 'ERROR', detail: e.message?.substring(0, 100) })
    }
  }

  console.log('\n## Round-Trip Results (C++ Functions & I/O)\n')
  console.log('| # | Program | Result | Detail |')
  console.log('|---|---------|--------|--------|')
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    const sym = r.status === 'PASS' ? 'PASS' : r.status === 'DEGRADED' ? 'DEGRADED' : 'FAIL'
    console.log(`| ${i + 1} | ${r.id} | ${sym} ${r.status} | ${r.detail} |`)
  }

  const passCount = results.filter(r => r.status === 'PASS').length
  const degradedCount = results.filter(r => r.status === 'DEGRADED').length
  console.log(`\nSummary: ${passCount}/${results.length} PASS, ${degradedCount} DEGRADED`)
  writeFileSync('/tmp/semorphe-roundtrip/phase3_results.json', JSON.stringify(results, null, 2))
}

main().catch(console.error)
