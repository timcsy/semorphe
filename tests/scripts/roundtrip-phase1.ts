/**
 * Phase 1 Roundtrip Runner: Variables & Operators
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
  t01_number_literal: `#include <iostream>
using namespace std;
int main() {
    int x = 42;
    double pi = 3.14;
    cout << x << endl;
    cout << pi << endl;
    return 0;
}`,
  t02_string_literal: `#include <iostream>
using namespace std;
int main() {
    cout << "hello world" << endl;
    cout << "test 123" << endl;
    return 0;
}`,
  t03_builtin_constant: `#include <iostream>
using namespace std;
int main() {
    bool a = true;
    bool b = false;
    if (a) cout << "true works" << endl;
    if (!b) cout << "false works" << endl;
    return 0;
}`,
  t04_variables: `#include <iostream>
using namespace std;
int main() {
    int a = 10;
    int b;
    b = 20;
    int c = a;
    cout << a << endl;
    cout << b << endl;
    cout << c << endl;
    return 0;
}`,
  t05_arithmetic: `#include <iostream>
using namespace std;
int main() {
    int a = 15;
    int b = 4;
    cout << a + b << endl;
    cout << a - b << endl;
    cout << a * b << endl;
    cout << a / b << endl;
    cout << a % b << endl;
    return 0;
}`,
  t06_compare: `#include <iostream>
using namespace std;
int main() {
    int x = 5;
    if (x < 10) cout << "lt" << endl;
    if (x > 3) cout << "gt" << endl;
    if (x <= 5) cout << "le" << endl;
    if (x >= 5) cout << "ge" << endl;
    if (x == 5) cout << "eq" << endl;
    if (x != 4) cout << "ne" << endl;
    return 0;
}`,
  t07_logic: `#include <iostream>
using namespace std;
int main() {
    int x = 5;
    if (x > 0 && x < 10) cout << "and" << endl;
    if (x < 0 || x > 3) cout << "or" << endl;
    if (!(x == 0)) cout << "not" << endl;
    return 0;
}`,
  t08_negate: `#include <iostream>
using namespace std;
int main() {
    int x = 5;
    cout << -x << endl;
    int y = -10;
    cout << -y << endl;
    return 0;
}`,
  t09_combined: `#include <iostream>
using namespace std;
int main() {
    int a = 10;
    int b = 3;
    int sum = a + b;
    int diff = a - b;
    bool big = a > 5 && b < 10;
    cout << sum << endl;
    cout << diff << endl;
    if (big) cout << "big" << endl;
    if (!false) cout << "ok" << endl;
    cout << -(a + b) << endl;
    return 0;
}`,
  t10_precedence: `#include <iostream>
using namespace std;
int main() {
    int x = 2 + 3 * 4;
    int y = (2 + 3) * 4;
    cout << x << endl;
    cout << y << endl;
    return 0;
}`,
}

function countNodes(node: SemanticNode): { total: number; raw: number } {
  let total = 1
  let raw = 0
  if (node.conceptId === 'cpp:raw_code' || node.conceptId === 'cpp:raw_expression' || node.conceptId === 'unresolved') {
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

  console.log('\n## Round-Trip 測試結果（C++ Variables & Operators）\n')
  console.log('| # | 程式 | 結果 | 細節 |')
  console.log('|---|------|------|------|')
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    const sym = r.status === 'PASS' ? '✅' : r.status === 'DEGRADED' ? '🟡' : '❌'
    console.log(`| ${i + 1} | ${r.id} | ${sym} ${r.status} | ${r.detail} |`)
  }

  const passCount = results.filter(r => r.status === 'PASS').length
  console.log(`\n摘要：${passCount}/${results.length} PASS`)
  writeFileSync('/tmp/semorphe-roundtrip/phase1_results.json', JSON.stringify(results, null, 2))
}

main().catch(console.error)
