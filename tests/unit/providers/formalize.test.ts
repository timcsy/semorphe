/**
 * formalize：語義樹 → Cella 程式 JSON（spec 180，重構階段 4 第一批：最小子集）。
 *
 * 判定者是 Cella 自己的語法定義 `packages/cfamily/src/syntax.cella`——做法照 Cella 的
 * `tools/cfamily/cpp_to_tree.py`：從 `data … deriving Json` 抽每個建構子的欄位，輸出的每個節點
 * 建構子要存在、欄位一個不多一個不少。姊妹 repo 不在時這一支跳過（CI 上沒有它；升級 Cella 套件後改讀套件）。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Parser, Language } from 'web-tree-sitter'
import { registerCppLanguage } from '../../../src/languages/cpp/generators'
import { createTestLifter } from '../../helpers/setup-lifter'
import { formalize, cellaBoardOf, type CellaJson } from '../../../src/providers/cella/formalize'
import type { SemanticNode } from '../../../src/core/types'
import { createNode } from '../../../src/core/semantic-tree'

const SYNTAX = path.resolve(process.cwd(), '../cella/packages/cfamily/src/syntax.cella')
const hasSyntax = fs.existsSync(SYNTAX)

let parser: Parser
beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
})
const lift = (c: string): SemanticNode => createTestLifter().lift(parser.parse(c)!.rootNode as never) as SemanticNode

/** 照 cpp_to_tree.py 的 constructor_fields：每個建構子 → 欄位名（依序）。 */
function constructorFields(src: string): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const m of src.matchAll(/data\s+(\w+)\s*=([\s\S]*?)deriving\s+Json/g)) {
    const body = m[2].replace(/--[^\n]*/g, '')
    // 頂層的 `|` 切開各建構子（括號裡的不算）
    let depth = 0, cur = ''
    const parts: string[] = []
    for (const ch of body) {
      if (ch === '(') depth++
      if (ch === ')') depth--
      if (ch === '|' && depth === 0) { parts.push(cur); cur = '' } else cur += ch
    }
    parts.push(cur)
    for (const p of parts) {
      const s = p.trim().replace(/\s+/g, ' ')
      if (!s) continue
      const name = s.split(' ')[0]
      out.set(name, [...s.matchAll(/\((\w+)\s*:/g)].map((g) => g[1]))
    }
  }
  return out
}

function checkShape(j: unknown, fields: Map<string, string[]>, at: string, errs: string[]): void {
  if (Array.isArray(j)) { j.forEach((x, i) => checkShape(x, fields, `${at}[${i}]`, errs)); return }
  if (!j || typeof j !== 'object') return
  const o = j as CellaJson
  if (typeof o.k === 'string') {
    const want = fields.get(o.k)
    if (!want) { errs.push(`${at}：沒有建構子 ${o.k}`); return }
    const have = Object.keys(o).filter((x) => x !== 'k')
    const missing = want.filter((f) => !have.includes(f))
    const extra = have.filter((f) => !want.includes(f))
    if (missing.length || extra.length) errs.push(`${at}：${o.k} 少 [${missing}] 多 [${extra}]`)
  }
  for (const [key, v] of Object.entries(o)) if (key !== 'k') checkShape(v, fields, `${at}.${key}`, errs)
}

const SAMPLE = '#include <iostream>\nusing namespace std;\nint g = 2;\nint add(int a, int b) { return a + b; }\n' +
  'int main() { int n; cin >> n; int s = 0, i = 0; while (i < n && s >= 0) { s += i; i++; }\n' +
  '  for (int k = 0; k < 3; k++) { s = s * 2; }\n' +
  '  if (!(s > 10)) { cout << "small\\n" << endl; } else { cout << s - 1 << \'\\n\'; }\n' +
  '  bool ok = true; double d = 1.5; cout << add(g, 2) % 3 << -n << ok << d; return 0; }'

describe('formalize：最小子集', () => {
  it('★ 範例程式翻得出來，而且每個節點都帶語義樹的 id', () => {
    const t = lift(SAMPLE)
    const r = formalize(t)
    expect(r.unknown).toEqual([])
    expect(r.program?.k).toBe('prog')
    expect(r.program?.n).toBe(t.id)
    expect(r.program?.lang).toEqual({ k: 'langCpp' })
  })

  it.skipIf(!hasSyntax)('★ 形狀對得上 Cella 的語法定義（建構子存在、欄位一個不多一個不少）', () => {
    const fields = constructorFields(fs.readFileSync(SYNTAX, 'utf8'))
    expect(fields.size, '一個建構子都沒抽到 → 下面的零是假的').toBeGreaterThan(100)
    const errs: string[] = []
    checkShape(formalize(lift(SAMPLE)).program, fields, '$', errs)
    expect(errs).toEqual([])
  })

  it('🔴 翻不了的不送：說出節點與元件，不擲例外', () => {
    // ⚠️ 例子要挑「還沒對應」的構造——第二批補了 push_back 之後，原本的例子變成翻得出來
    const t = lift('#include <map>\nusing namespace std;\nint main() { map<int, int> m; m[1] = 2; }')
    const r = formalize(t)
    expect(r.program).toBeNull()
    expect(r.unknown.length).toBeGreaterThan(0)
    expect(r.unknown.every((u) => u.nodeId && u.construct && u.reason)).toBe(true)
  })

  it('★ 字串與字元字面送的是值，不是寫法', () => {
    const r = formalize(lift('int main() { cout << "a\\tb" << \'\\n\'; }'))
    const s = JSON.stringify(r.program)
    expect(s).toContain('"s":"a\\tb"')
    expect(s).toContain('"c":10')
  })

  it('🔴 與產生器同一份寫法：scanf 的引數取址、字串長度是 length（cella 比對 C18 時抓到，第 390 刀）', () => {
    const j = JSON.stringify(formalize(lift('#include <cstdio>\n#include <string>\nusing namespace std;\nint main() { int n; int a[3]; scanf("%d %d", &n, &a[1]); string s; int m = s.length(); return 0; }')).program)
    expect(j).toMatch(/"k":"sScanf".*"args":\[\{"k":"eAddr"[^\]]*"k":"eAddr"/)
    expect(j).toContain('"f":"length"')
    expect(j).not.toContain('"f":"size"')
  })

  it('★ 計數迴圈展開成 for，迴圈變數以那顆積木為宣告', () => {
    const t = lift('int main() { for (int i = 0; i < 3; i++) { cout << i; } }')
    const s = JSON.stringify(formalize(t).program)
    expect(s).toContain('"k":"sFor"')
    const loop = JSON.parse(s).items[0].f.body.body[0]
    expect(loop.init.x).toBe(loop.n)
    expect(loop.body.body[0].items[0].x, '迴圈本體裡的 i 指到同一個宣告').toBe(loop.n)
  })

  it('★ C++ 的 struct 一律是 tClass（cella 2026-10-31：tStruct 只給 C）；定義是 iClass', () => {
    const s = JSON.stringify(formalize(lift('struct Node { int v; };\nint main() { Node a; struct Node b; Node* p = &a; }')).program)
    expect(s).not.toContain('tStruct')
    expect(s.match(/"k":"tClass","name":"Node"/g)?.length).toBeGreaterThanOrEqual(3)
    expect(s).toContain('"k":"iClass"')
  })

  it('★ 數字後綴：只在字面型別與「值決定的型別」不同時才包 eCast（cella 的規則）', () => {
    const s = JSON.stringify(formalize(lift('int main() { long long a = 1000000LL; long b = 5000000000L; long c = 100L; }')).program)
    expect(s, '1000000LL：值是 int、字面是 long long → 包').toContain('"k":"eCast","n"')
    const casts = (s.match(/"k":"eCast"/g) ?? []).length
    expect(casts, '5000000000L：值本身就是 long → 不包；100L 要包').toBe(2)
  })

  it('★ Arduino：帶板子；核心函式是呼叫、常數是 eConst、Serial 是板子的物件', () => {
    const src = 'void setup() { pinMode(LED_BUILTIN, OUTPUT); Serial.begin(9600); }\nvoid loop() { digitalWrite(LED_BUILTIN, HIGH); delay(1000); Serial.println(1); }'
    const r = formalize(lift(src), { board: cellaBoardOf('arduino-uno') })
    expect(r.unknown).toEqual([])
    const s = JSON.stringify(r.program)
    expect(r.program?.board).toBe('uno')
    expect(s).toContain('"f":"pinMode"')
    expect(s).toContain('"k":"eConst","n"')
    expect(s).toMatch(/"k":"eMCall".*"name":"Serial".*"f":"begin"/)
  })

  it('★ 目標 id 對到 Cella 的板名；不是板子的目標沒有板名', () => {
    expect(cellaBoardOf('esp32s3-cam')).toBe('esp32s3Cam')
    expect(cellaBoardOf('nodemcu-esp8266')).toBe('nodemcuEsp8266')
    expect(cellaBoardOf('cpp')).toBeUndefined()
  })

  it.skipIf(!hasSyntax)('★ Arduino 的 sketch 形狀也對得上語法定義', () => {
    const fields = constructorFields(fs.readFileSync(SYNTAX, 'utf8'))
    const errs: string[] = []
    checkShape(formalize(lift('#include <DHT.h>\nDHT dht(2, DHT11);\nvoid setup() { dht.begin(); }\nvoid loop() { float t = dht.readTemperature(); }'), { board: 'uno' }).program, fields, '$', errs)
    expect(errs).toEqual([])
  })

  it.skipIf(!hasSyntax)('★ C 程式：langC，struct 用 tStruct／iStruct（cella：tStruct 只給 C），形狀對得上', () => {
    const r = formalize(lift('#include <stdio.h>\nstruct P { int x; };\nint main() { struct P a; a.x = 1; printf("%d\\n", a.x); return 0; }'), { lang: 'c' })
    expect(r.unknown).toEqual([])
    const s = JSON.stringify(r.program)
    expect(r.program?.lang).toEqual({ k: 'langC' })
    expect(s).toContain('"k":"iStruct"')
    expect(s).toContain('"k":"tStruct","name":"P"')
    expect(s).not.toContain('tClass')
    const errs: string[] = []
    checkShape(r.program, constructorFields(fs.readFileSync(SYNTAX, 'utf8')), '$', errs)
    expect(errs).toEqual([])
  })

  it('★ 積木上空著的槽翻成洞：eHole，標籤 `<節點>#<槽名>`（型別查詢靠它）', () => {
    const cond = createNode('cpp:if', {}, { condition: [], then_body: [], else_body: [] })
    const assign = createNode('cpp:var_assign', {}, { target: [], value: [] })
    const main = createNode('cpp:func_def', { name: 'main', return_type: 'int' }, { params: [], body: [cond, assign] })
    const r = formalize(createNode('cpp:program', {}, { body: [main] }))
    expect(r.unknown).toEqual([])
    const s = JSON.stringify(r.program)
    expect(s).toContain(`"k":"eHole","n":"${cond.id}#condition"`)
    expect(s).toContain(`"k":"eHole","n":"${assign.id}#target"`)
    expect(s).toContain(`"k":"eHole","n":"${assign.id}#value"`)
  })

  /**
   * 讀數（不是護欄）：課文的 C／C++／Arduino 解答，最小子集今天翻得出幾份，缺的元件依次數排。
   * 這是對照表下一批要補誰的依據；覆蓋的棘輪等對照表成形後再立。
   */
  it('讀數：課文解答的覆蓋', () => {
    const files: string[] = []
    for (const track of ['cpp-beginner', 'cpp-advanced', 'c-bridge', 'arduino']) {
      const walk = (d: string): void => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const p = path.join(d, e.name)
          if (e.isDirectory()) walk(p)
          else if (/solutions\/.*\.(cpp|c|ino)$/.test(p)) files.push(p)
        }
      }
      walk(path.join('lessons', track))
    }
    let ok = 0
    const missing = new Map<string, number>()
    for (const f of files) {
      const r = formalize(lift(fs.readFileSync(f, 'utf8')))
      if (r.program) ok++
      for (const u of r.unknown) missing.set(u.construct, (missing.get(u.construct) ?? 0) + 1)
    }
    console.log(`formalize 最小子集：${ok} / ${files.length} 份解答翻得出\n缺：` +
      [...missing].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c}×${n}`).join(' '))
    expect(files.length).toBeGreaterThan(80)
  })
})
