/**
 * **第一百一十五條護欄：一個宣告寫成什麼樣，轉一圈回來還是那個樣。**
 *
 * ## 🔴 它從哪裡來：一份不是我們寫的語料
 *
 * 2026-09-09，使用者拿他學生的練習 repo 當語料（218 個 `.cpp`、7327 行，
 * 內容是 AP325、TIOJ、zeroJudge、APCS 的競賽題）。
 *
 * 量到的第一個數字很好看：**解析失敗 0、lift 失敗 0、殘差 0.0%**。
 * 而第二個數字不是——**218 支裡 144 支轉一圈回來不是同一棵樹**：
 *
 * ```
 * string A[100];               →  string x;                 🔴 陣列、大小、名字一起蒸發
 * string s, t, u;              →  string s;                 🔴 第二、三個變數蒸發
 * string* p;                   →  string x;                 🔴 指標與名字蒸發
 * int a[10], b[20];            →  int a, b;                 🔴 兩個大小蒸發
 * vector<int> v(n);            →  vector<int> x;            🔴 名字與大小蒸發
 * ios::sync_with_stdio(0),…    →  …(0);⏎,  cin.tie(0);      🔴 編不過（136/218 支）
 * max({ans, f(l), f(r)})       →  max({…}, 0)               🔴 編不過
 * ```
 *
 * ⚠️ **而它們全部不出聲。** 殘差是 0、積木長得很正常、多數產出編得過
 * ——只是**它是另一支程式**。
 *
 * > **一份自己造的語料，量的是「我們想到的那些輸入」。**
 *
 * ## 為什麼是這一條護欄，而不是把那份語料收進來
 *
 * 那個 repo 是別人的。🟢 而**形狀是我們的**——這裡釘住的每一行都是
 * 從那份語料抽出來的**寫法**，不是它的內容。
 *
 * ## ⚠️ 它比對的是「程式碼」與「身分」兩樣
 *
 * 只比字串會漏掉一種缺陷：`stack<int> inbox, outbox;` 讓開走通用路徑之後
 * **字串是對的而 `cpp:stack_declare` 不見了**——學生看到的不再是那顆積木。
 *
 * > **一個為了修正確性而放棄身分的修法，是把一個缺陷換成另一個缺陷。**
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import apcs from '../../src/languages/cpp/styles/apcs.json'
import type { SemanticNode, StylePreset } from '../../src/core/types'

const S = apcs as unknown as StylePreset
let parser: Parser

beforeAll(async () => {
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  parser = new Parser()
  parser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  registerCppLanguage()
}, 120_000)

/** 產出函式體裡的那幾行（去掉骨架與縮排）。 */
function bodyOf(code: string): string {
  const tree = parser.parse(code)
  if (!tree) return '🔴 解析不了'
  const root = createTestLifter().lift(tree.rootNode as never) as SemanticNode
  if (!root) return '🔴 lift 不了'
  return generateCode(root, 'cpp', S)
    .split('\n')
    .filter((l) => l.trim() && !/^(int n, M, N;|int main|\})/.test(l.trim()))
    .map((l) => l.trim())
    .join(' ')
}

function identities(n: SemanticNode | null | undefined, out = new Set<string>()): Set<string> {
  if (!n) return out
  if (n.componentId) out.add(n.componentId)
  for (const b of Object.values(n.children ?? {})) for (const c of b ?? []) identities(c, out)
  return out
}

function idsOf(code: string): Set<string> {
  const tree = parser.parse(code)
  if (!tree) return new Set()
  return identities(createTestLifter().lift(tree.rootNode as never) as SemanticNode)
}

const wrap = (body: string): string => `int n, M, N;\nint main() {\n${body}\n}`

/**
 * 每一行都出自那份語料。
 *
 * ⚠️ **產出必須逐字等於輸入**——所以這裡寫的是**產出的排版**
 * （`int a = 1` 而不是 `int a=1`）。那不是在遷就實作：
 * 一個「轉一圈回來一模一樣」的斷言，是不動點最強的形式。
 */
const SHAPES: readonly string[] = [
  // ─── 具體型別 × 宣告子形狀 ───
  'string s;',
  'string s = "a";',
  'string s, t, u;',
  'string A[100];',
  'string A[100], ans;',
  'string* p;',
  'string g[3] = {"a"};',
  'stringstream ss;',
  'stack<int> inbox, outbox;',
  // ─── 陣列 ───
  'int a[10];',
  'int a[10], b[20];',
  'vector<int> v[10];',
  // ─── 容器的建構式（最令人困惑的解析）───
  'vector<int> v(n);',
  'vector<int> v(5);',
  'vector<int> v(n, 0);',
  'vector<pair<int, int>> td(n);',
  'vector<vector<int>> grid(M, vector<int>(N));',
  'vector<vector<int>> grid(M, vector<int>(N, -1));',
  'vector<vector<bool>> d(M, vector<bool>(N, false));',
  // ─── 競賽模板：逗號運算式（語料裡 136/218 支的第一行）───
  'ios::sync_with_stdio(0), cin.tie(0);',
  // ─── `max`／`min` 的大括號多載 ───
  'int x = max({1, 2, 3});',
  'int x = min({1, 2});',
  'int x = max(1, 2);',
]

describe('第一百一十五條護欄：宣告的形狀轉一圈回來還是它自己', () => {
  it('★ 入口條件——語料真的跑得動', () => {
    expect(bodyOf(wrap('    int x = 1;'))).toBe('int x = 1;')
  })

  it.each(SHAPES)('🔴 %s', (shape) => {
    expect(
      bodyOf(wrap(`    ${shape}`)),
      `🔴 這個宣告轉一圈回來變了樣。\n`
        + '   ⚠️ 先問「掉的是【資料】還是【排版】」——掉資料的那一種，\n'
        + '   使用者的程式會【編不過或跑出另一個答案】，而系統全綠。',
    ).toBe(shape)
  })

  /**
   * 🔴 **身分不得為了正確性被犧牲。**
   *
   * `stack<int> inbox, outbox;` 原本產出 `stack<int> inbox;`（第二個蒸發）。
   * 「讓開走通用路徑」能修好字串，**而那會讓堆疊積木變成一顆普通的變數宣告**。
   */
  it.each([
    ['stack<int> inbox, outbox;', 'cpp:stack_declare'],
    ['string s, t, u;', 'cpp:string_declare'],
    ['string s;', 'cpp:string_declare'],
    ['vector<int> v(n);', 'cpp:vector_declare'],
    ['stringstream ss;', 'cpp:stringstream_declare'],
  ])('🔴 身分：%s 仍然是 %s', (shape, id) => {
    expect(
      [...idsOf(wrap(`    ${shape}`))],
      `🔴 這個宣告的身分掉了——產出的程式碼也許還是對的，\n`
        + '   而**學生看到的不再是那顆積木**。',
    ).toContain(id)
  })

  // ─── 注入（第四十九條）───

  it('★ 注入：一個真的走樣的宣告 → 抓得到', () => {
    // 刻意寫錯的期望——證明這條護欄不是永遠綠
    expect(bodyOf(wrap('    string A[100];'))).not.toBe('string x;')
  })

  /**
   * ★ **不動點要跑兩圈**——第一圈對而第二圈變的東西，
   * 在使用者連按兩次「切換檢視」時才會現形。
   */
  it.each(SHAPES)('★ 第二圈也不變：%s', (shape) => {
    const once = bodyOf(wrap(`    ${shape}`))
    expect(bodyOf(wrap(`    ${once}`))).toBe(once)
  })
})
