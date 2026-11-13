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
import { expectCellaOut, runCella } from '../../helpers/cella-run'

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
  // 🆕 Cella 的新語法（2026-11-14，cella 70aff8aeb「切換第 3 步」）：`@derive(Json)` ＋ `type 名 { 建構子(欄位: 型別, …) … }`，
  //    建構子以換行或逗號分開；欄位是第一層括號裡「名字:」的那些。舊語法抽不到東西時才走這裡——兩種都認，抽到零才是錯
  if (out.size === 0) {
    for (const m of src.matchAll(/@derive\(Json\)[^\n]*\n(?:\s*(?:\/\/[^\n]*|@[^\n]*)\n)*\s*type\s+[\w.]+\s*\{/g)) {
      let i = m.index! + m[0].length, depth = 1, paren = 0, cur = ''
      const parts: string[] = []
      for (; i < src.length && depth > 0; i++) {
        const ch = src[i]
        if (ch === '{') depth++
        if (ch === '}') { depth--; if (depth === 0) break }
        if (ch === '(') paren++
        if (ch === ')') paren--
        if ((ch === '\n' || ch === ',') && paren === 0 && depth === 1) { parts.push(cur); cur = '' } else cur += ch
      }
      parts.push(cur)
      for (const p of parts) {
        const t = p.replace(/\/\/[^\n]*/g, '').trim()
        const name = /^(\w+)/.exec(t)?.[1]
        if (!name) continue
        const fields: string[] = []
        let d = 0, tok = ''
        for (const ch of t.slice(name.length)) {
          if (ch === '(') { d++; if (d === 1) { tok = ''; continue } }
          if (ch === ')') d--
          if (d === 1 && ch === ':') { const f = /(\w+)\s*$/.exec(tok)?.[1]; if (f) fields.push(f); tok = ''; continue }
          if (d === 1 && ch === ',') { tok = ''; continue }
          tok += ch
        }
        out.set(name, fields)
      }
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
    // 名字交給 Cella 解析（eName，cella 0.1.202611052225）：本體裡送的是寫出來的名字，指到哪個宣告由 Cella 依作用域決定
    expect(loop.body.body[0].items[0], '迴圈本體裡的 i 送名字').toMatchObject({ k: 'eName', name: 'i' })
    expect(loop.init.name).toBe('i')
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

describe('第 213 刀：學生語料剩下的形狀（Cella 0.1.202611011759）', () => {
  const H = '#include <bits/stdc++.h>\nusing namespace std;\n'
  const find = (j: unknown, k: string): any[] => {
    const out: any[] = []
    const walk = (v: unknown): void => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') { if ((v as any).k === k) out.push(v); Object.values(v).forEach(walk) } }
    walk(j)
    return out
  }
  const fz = (body: string) => formalize(lift(H + body), { lang: 'cpp' })

  it('★ bitset<N>：tTemplate "bitset" ＋ tVal；方法名照寫的送', () => {
    const r = fz('int main() { bitset<8> b; b.set(1); bitset<26> c[3]; cout << b.count() << b.any() << c[1].count(); }')
    expect(r.unknown).toEqual([])
    const ts = find(r.program, 'tTemplate').filter((t) => t.name === 'bitset')
    expect(ts.map((t) => t.args[0])).toEqual(expect.arrayContaining([{ k: 'tVal', v: 8 }, { k: 'tVal', v: 26 }]))
    expect(find(r.program, 'eMCall').map((m) => m.f)).toEqual(expect.arrayContaining(['set', 'count', 'any']))
  })

  it('🔴 __builtin_popcount 是編譯器內建：照實標 unknown，不送成 count()', () => {
    expect(fz('int main() { int x = 5; cout << __builtin_popcount(x); }').unknown.map((u) => u.construct)).toContain('cpp:bits_count')
  })

  it('★ for 的 init 有兩個宣告：外包一層區塊、init 留空（名字仍只活在迴圈裡）', () => {
    const r = fz('int main() { for (int l = 0, r = 4; l < r; l++, r--) {} }')
    expect(r.unknown).toEqual([])
    const blk = find(r.program, 'sBlock').find((b) => b.body.some((s: any) => s.k === 'sFor'))
    expect(blk.body.map((s: any) => s.k)).toEqual(['sDecl', 'sDecl', 'sFor'])
    expect(blk.body[2].init).toBeNull()
  })

  // 355：對象是運算式（含字面量）時住在接點，照原樣送 eSizeofE——型別由 Cella 算（以前送型別是我們替它推、`a[0]` 靠正規式）
  it('🔴 sizeof 的字面量與 a[0] 都送運算式（eSizeofE），型別名送 eSizeof', () => {
    const r = fz('int main() { int a[10]; cout << sizeof(1) << sizeof(1.0) << sizeof(true) << sizeof(a[0]) << sizeof(int); }')
    expect(r.unknown).toEqual([])
    expect(find(r.program, 'eSizeofE').map((s) => s.e.k)).toEqual(['eNum', 'eFloat', 'eBool', 'eIndex'])
    expect(find(r.program, 'eSizeof').map((s) => s.t.k)).toEqual(['tInt'])
  })

  it('★ 純量的 T() 是零：(T)0；類別的照實標 unknown', () => {
    const r = fz('int main() { int v = int(); }')
    expect(r.unknown).toEqual([])
    expect(find(r.program, 'eCast')[0].a).toMatchObject({ k: 'eNum', v: 0 })
  })

  it('★ 字元字面量的巨集展開成 eChar；struct 裡的 `int x, y;` 兩個欄位都在', () => {
    const r = fz("#define z '0'\nstruct P { int x, y; };\nint main() { char c = z; }")
    expect(r.unknown).toEqual([])
    expect(find(r.program, 'eChar')[0].c).toBe(48)
    expect(find(r.program, 'mbField').map((m) => m.name)).toEqual(['x', 'y'])
  })

  it('🔴 min({…})／max({…}) 只送一個引數：空著的第二槽不得變成 eHole（Cella 因此判不出串列的型別）', () => {
    const r = fz('int main() { cout << min({3, 1, 2}) << max({4, 5}) << min(1, 2); }')
    expect(r.unknown).toEqual([])
    const calls = find(r.program, 'eCall').filter((c) => c.f === 'min' || c.f === 'max')
    expect(calls.map((c) => c.args.map((a: any) => a.k))).toEqual([['eBraced'], ['eBraced'], ['eNum', 'eNum']])
  })

  it('★ stack 的 top、max_element／fill 照 eMCall／eCall 送（後兩者 Cella 還沒有，由它判 unknown）', () => {
    const r = fz('int main() { stack<int> s; s.push(1); int a[3]; fill(a, a + 3, 0); cout << s.top() << *max_element(a, a + 3); }')
    expect(r.unknown).toEqual([])
    expect(find(r.program, 'eMCall').map((m) => m.f)).toContain('top')
    expect(find(r.program, 'eCall').map((m) => m.f)).toEqual(expect.arrayContaining(['fill', 'max_element']))
  })
})

describe('第 214 刀：函式形巨集（`#define rep(i,n) for(…)`）', () => {
  const H = '#include <bits/stdc++.h>\nusing namespace std;\n#define rep(i,n) for(int i=0;i<n;i++)\n'

  it('★ 定義本身不產生程式；使用處 lift 時已展開成迴圈', () => {
    const r = formalize(lift(H + 'int main() { int s = 0; rep(i,3) s += i; cout << s; }'), { lang: 'cpp' })
    expect(r.unknown).toEqual([])
    expect(JSON.stringify(r.program)).not.toContain('rep')
    expect(JSON.stringify(r.program)).toContain('"sFor"')
  })
})

describe('可變長度陣列：長度運算式原樣交給 Cella（tArrE；第 217 刀的 sDeclV 在 316 換掉——「意思歸 Cella」）', () => {
  const H = '#include <bits/stdc++.h>\nusing namespace std;\n'
  const find = (j: unknown, k: string): any[] => {
    const out: any[] = []
    const walk = (v: unknown): void => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') { if ((v as any).k === k) out.push(v); Object.values(v).forEach(walk) } }
    walk(j)
    return out
  }
  const fz = (body: string) => formalize(lift(H + body), { lang: 'cpp' })

  // 316 之前：區域的送 sDeclV、全域或帶初值的我們自己標翻不出——那是在替 Cella 決定「這個長度是不是常數」。
  // Cella 0.1.202611060800 起 tArrE 收任何長度運算式：常數的照定長陣列、不是常數的照 VLA 規則（區塊裡最外層、不帶初值 → 照 g++、帶 gcc:vla 假設）
  it('★ 區域的 int d[n]：tArrE，t 是元素型別、len 是長度運算式；Cella 照 g++ 跑、判決帶 gcc:vla 假設', async () => {
    const r = fz('int main() { int n = 3; int d[n]; d[0] = 1; }')
    expect(r.unknown).toEqual([])
    expect(find(r.program, 'sDeclV')).toEqual([])
    const v = find(r.program, 'tArrE')
    expect(v).toHaveLength(1)
    expect(v[0]).toMatchObject({ t: { k: 'tInt' }, len: { k: 'eName', name: 'n' } })
    const run = await expectCellaOut(H + 'int main() { int n = 3; int d[n]; d[0] = 1; cout << d[0]; }', '1')
    expect(run.assumes).toContainEqual({ implementation: 'gcc', choice: 'vla' })
  })

  it('★ 二維：外層可變、內層固定 → tArrE 包著內層的 tArr', async () => {
    const r = fz('int main() { int n = 3; int g[n][5]; g[0][0] = 1; }')
    expect(r.unknown).toEqual([])
    expect(find(r.program, 'tArrE')[0].t).toMatchObject({ k: 'tArr', n: 5 })
    await expectCellaOut(H + 'int main() { int n = 3; int g[n][5]; g[0][0] = 1; cout << g[0][0]; }', '1')
  })

  it('🔴 for (int i{}; …) 的起始值：{} 送 0、{x} 送 x——不送空的大括號串列（Cella 推不出它的型別）', () => {
    const r = fz('int main() { int s = 0; for (int i{}; i < 3; i++) s += i; for (int j{2}; j < 4; j++) s += j; }')
    expect(r.unknown).toEqual([])
    expect(find(r.program, 'eBraced')).toEqual([])
    const inits = find(r.program, 'sFor').map((x) => x.init.init.e)
    expect(inits).toEqual([expect.objectContaining({ k: 'eNum', v: 0 }), expect.objectContaining({ k: 'eNum', v: 2 })])
  })

  it('🔴 內層也可變、或帶初值：照送，由 Cella 照實說 unsupported（unknown）——不是我們標翻不出', async () => {
    for (const body of ['int main() { int n = 3, m = 2; int g[n][m]; g[1][1] = 4; cout << g[1][1]; }', 'int main() { int n = 3; int d[n] = {1}; }']) {
      expect(fz(body).unknown).toEqual([])
      const r = await runCella(H + body)
      expect(r.verdict, body).toBe('unknown')
      expect(r.problems.map((p) => p.kind), body).toContain('unsupported')
    }
  })

  it('🔴 全域的 int d[n]（n 不是常數）：照送，Cella 不收（全域的長度一定要是常數）', async () => {
    const body = 'int n = 3;\nint d[n];\nint main() {}'
    expect(fz(body).unknown).toEqual([])
    const r = await runCella(H + body)
    expect(r.verdict).toBe('reject')
    expect(r.problems.map((p) => p.reason ?? '').join('；')).toMatch(/static storage duration/)
  })
})
