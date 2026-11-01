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
    // ⚠️ 例子要挑「永遠翻不了」的構造——「還沒對應」的會一直被補上而過期（push_back、map、unordered_map 都曾是這裡的例子，
    //    第 208 刀 unordered_map 也翻得出了）。原樣保留的程式碼（asm）是 P6 的降級：formalize 不猜它的結構
    const t = lift('int main() { asm volatile("nop"); return 0; }')
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

  it('🔴 與產生器同一份寫法：scanf 的引數取址、字串長度是 length（cella 比對判決綁定語料時抓到，第 390 刀）', () => {
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

  it('★ Arduino 課文剩下的五顆：map 是呼叫、Servo／LCD 是方法、EEPROM 是 eConst 接收者（cella 2026-10-31 給的形狀）', () => {
    const src = '#include <Servo.h>\n#include <EEPROM.h>\n#include <LiquidCrystal_I2C.h>\nServo s;\nLiquidCrystal_I2C lcd(0x27, 16, 2);\n' +
      'void setup() { s.attach(9); }\nvoid loop() { int v = map(analogRead(A0), 0, 1023, 0, 180); int a = s.read(); lcd.setCursor(0, 1); EEPROM.write(0, v); int e = EEPROM.read(0); }'
    const r = formalize(lift(src), { board: cellaBoardOf('arduino-uno') })
    expect(r.unknown).toEqual([])
    const j = JSON.stringify(r.program)
    expect(j).toMatch(/"k":"eCall","n":"[^"]+","f":"map"/)
    expect(j).toMatch(/"k":"eMCall".*"f":"read"/)
    expect(j).toContain('"f":"setCursor"')
    expect(j).toMatch(/"k":"eConst","n":"[^"]+\/obj","name":"EEPROM"\},"arrow":false,"f":"write"/)
    expect(j).toMatch(/"name":"EEPROM"\},"arrow":false,"f":"read"/)
  })

  it('🔴 整數字面的進位：0x27 是 39、017 是 15（不是 17）、0b101 是 5、分隔符照算', () => {
    const j = JSON.stringify(formalize(lift("int main() { int a = 0x27; int b = 017; int c = 0b101; int d = 1'000; return 0; }")).program)
    expect([...j.matchAll(/"k":"eNum","n":"[^"]+","v":(\d+)/g)].map((m) => Number(m[1]))).toEqual([39, 15, 5, 1000, 0])
  })

  it('🔴 第 394 刀（Cella 判決量到）：nullptr／NULL 是字面量；字元陣列的字串初值是 iE 不是 iL', () => {
    const j = JSON.stringify(formalize(lift('#include <cstdio>\nint main() { int *p = nullptr; int *q = NULL; char s[20] = "Semorphe"; return 0; }')).program)
    expect(j).toContain('"k":"eNullptr"')
    expect(j).toContain('"k":"eNull"')
    expect(j).not.toMatch(/"name":"(nullptr|NULL)"/)
    expect(j).toMatch(/"k":"iE","e":\{"k":"eStr"/)
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

describe('C 前端的三個缺口（spec 197；cella 問 C 子集時量到）', () => {
  const find = (j: unknown, k: string): any[] => {
    const out: any[] = []
    const walk = (v: unknown): void => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') { if ((v as any).k === k) out.push(v); Object.values(v).forEach(walk) } }
    walk(j)
    return out
  }

  it('🔴 `int main(void)`：沒有參數（C11 6.7.6.3p10），不是一個型別是 void 的參數', () => {
    const r = formalize(lift('int main(void) { return 0; }'), { lang: 'c' })
    expect(r.unknown).toEqual([])
    expect(find(r.program, 'fdef')[0].params).toEqual([])
  })

  it('🔴 物件巨集由前端展開：使用處是值、標籤是使用處的 id；陣列長度也認得', () => {
    const t = lift('#define N 10\nint main(void) { int a[N]; return N; }')
    const r = formalize(t, { lang: 'c' })
    expect(r.unknown).toEqual([])
    const ret = find(r.program, 'sReturn')[0]
    expect(ret.e ?? ret.v ?? ret.value).toMatchObject({ k: 'eNum', v: 10 })
    expect(JSON.stringify(r.program)).not.toMatch(/cpp:define|"name":"N"/)
    // 值不是數字的巨集 → unknown（不猜它展開之後長什麼樣）
    expect(formalize(lift('#define S (1 + 2)\nint main(void) { return S; }'), { lang: 'c' }).unknown.length).toBeGreaterThan(0)
  })

  it('🔴 `extern` 的變數宣告照實降級（在此之前 extern 被悄悄丟掉：宣告變成定義）；函式的 extern 照舊', () => {
    const t = lift('extern int other;\nextern void f(int);\nint main(void) { return 0; }')
    const body = t.slots.body ?? []
    expect(body[0].componentId).toMatch(/raw_code/)
    expect(body[1].componentId).not.toMatch(/raw_code/)
  })
})
