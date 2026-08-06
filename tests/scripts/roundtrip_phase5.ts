/**
 * Phase 5 Roundtrip Runner: Type System & Advanced Ops
 * Lifts C++ code -> semantic tree -> generates C++ code -> verifies stability
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
  t01_const_declare: `#include <iostream>
using namespace std;
int main() {
    const int MAX = 100;
    cout << MAX << endl;
    return 0;
}`,
  t02_auto_declare: `#include <iostream>
using namespace std;
int main() {
    auto x = 42;
    auto y = 3.14;
    cout << x << endl;
    return 0;
}`,
  t03_typedef: `#include <iostream>
using namespace std;
typedef long long ll;
int main() {
    ll x = 1000000000;
    cout << x << endl;
    return 0;
}`,
  t04_sizeof: `#include <iostream>
using namespace std;
int main() {
    cout << sizeof(int) << endl;
    cout << sizeof(double) << endl;
    return 0;
}`,
  t05_ternary: `#include <iostream>
using namespace std;
int main() {
    int x = 5;
    int y = x > 3 ? 10 : 20;
    cout << y << endl;
    return 0;
}`,
  t06_cast: `#include <iostream>
using namespace std;
int main() {
    double d = 3.14;
    int n = (int)d;
    cout << n << endl;
    return 0;
}`,
  t07_increment: `#include <iostream>
using namespace std;
int main() {
    int x = 5;
    x++;
    cout << x << endl;
    int y = 10;
    y--;
    cout << y << endl;
    return 0;
}`,
  t08_compound_assign: `#include <iostream>
using namespace std;
int main() {
    int x = 10;
    x += 5;
    x -= 3;
    x *= 2;
    cout << x << endl;
    return 0;
}`,
  t09_enum: `#include <iostream>
using namespace std;
enum Color { RED, GREEN, BLUE };
int main() {
    Color c = GREEN;
    cout << c << endl;
    return 0;
}`,
  t10_constexpr: `#include <iostream>
using namespace std;
int main() {
    constexpr int SIZE = 10;
    int arr[SIZE];
    arr[0] = 42;
    cout << arr[0] << endl;
    return 0;
}`,
}

function countNodes(node: SemanticNode): { total: number; raw: number } {
  let total = 1
  let raw = 0
  if (node.conceptId === 'cpp_raw_code' || node.conceptId === 'cpp_raw_expression' || node.conceptId === 'unresolved') {
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

  console.log('\n## Round-Trip Test Results (C++ Type System & Advanced Ops)\n')
  console.log('| # | Program | Result | Detail |')
  console.log('|---|---------|--------|--------|')
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    const sym = r.status === 'PASS' ? 'PASS' : r.status === 'DEGRADED' ? 'DEGRADED' : 'FAIL'
    console.log(`| ${i + 1} | ${r.id} | ${sym} ${r.status} | ${r.detail} |`)
  }

  const passCount = results.filter(r => r.status === 'PASS').length
  console.log(`\nSummary: ${passCount}/${results.length} PASS`)
  writeFileSync('/tmp/semorphe-roundtrip/phase5_results.json', JSON.stringify(results, null, 2))
}

main().catch(console.error)
