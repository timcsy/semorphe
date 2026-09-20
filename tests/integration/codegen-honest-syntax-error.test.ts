/**
 * 產出不得比使用者寫的少——「這一段我看不懂」的節點要把原文交回去
 *
 * ## 這支測試在防什麼
 *
 * 2026-09-20 拿七種「解不乾淨」的形狀去量產生器，讀數分成兩族：
 *
 * ```
 * 漏分號（下一行是宣告）  int x = 1            → int x = 1;                 🟢 順手補回去
 * 漏右大括號              …                    → 補上 }                     🟢 順手補回去
 * 語句位置的亂碼          @@                   → x @@ ⏎ 2;                  🟢 字都在
 * 引數位置的亂碼          max(x, @@)           → max(x, , @@)               🟢 字都在
 * ──
 * 括號運算式裡的亂碼      (x @@ 2)             → (x)                        🔴 弄丟
 * 宣告初值是亂碼          int x = @@@;         → int x;                     🔴 弄丟
 * 漏分號（下一行是 cout） int x = 1⏎cout<<x;   → int x = cout << x;         🔴🔴【另一支程式】
 * ```
 *
 * 🔴 **最後那一支是這支測試存在的理由**：它不是「少印了幾個字」，
 * 是把兩行併成**一句別的程式**——`x` 被初始化成一個串流的值，
 * 而使用者寫的那個 `1` 與那句輸出**都不見了**。
 *
 * ## 判準不是「有沒有語法錯誤」
 *
 * 前兩行也有語法錯誤，而它們的產出是**對的**——補一個分號是在幫忙。
 * 所以判準換成「**產出有沒有比使用者寫的少**」：
 *
 * > **一個「這一段我看不懂」的節點，產出可以比原文【多】（補一個分號），
 * > 不可以比原文【少】——少掉的那幾個字是使用者打的。**
 *
 * 量法是**非空白字元的多重集合包含**（見 `code-generator.ts` 的
 * `keepsEveryCharacter`）：它比「字串相等」寬（容得下換行與空白的重排、
 * 容得下補進來的字），比「長度相等」嚴（少一個 `@` 就抓得到）。
 *
 * ## ⚠️ 這把尺**只能**對 `degradationCause === 'syntax_error'` 的節點用
 *
 * 正常的節點本來就會正規化——`1e9` → `1000000000`、`(a)` → `a`、
 * `int x=1` → `int x = 1`。拿這把尺去量它們會**全部誤判**。
 * 下面「★ 錨點：合法的程式照舊正規化」那一段就是在守這條界線。
 *
 * ## 本檔不檢測什麼
 *
 * - **不檢測「跑起來對不對」**——這七種全部被 `canExecute` 擋在按下去之前
 *  （`metadata.degradationCause` 那一路），執行那一側本來就是誠實的。
 *   這支測的是**程式碼那一側**，而在這一刀之前只有它在說謊。
 * - **不檢測積木長什麼樣**——積木那一側是一顆「看不懂的程式碼」，
 *   它帶著原文，那是既有的行為。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { Parser, Language } from 'web-tree-sitter'
import { createTestLifter } from '../helpers/setup-lifter'
import type { Lifter } from '../../src/core/lift/lifter'
import { registerCppLanguage } from '../../src/languages/cpp/generators'
import { generateCode } from '../../src/core/projection/code-generator'
import { setupTestRenderer } from '../helpers/setup-renderer'
import type { SemanticNode, StylePreset } from '../../src/core/types'

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
  await Parser.init({ locateFile: (s: string) => `${process.cwd()}/public/${s}` })
  tsParser = new Parser()
  tsParser.setLanguage(await Language.load(`${process.cwd()}/public/tree-sitter-cpp.wasm`))
  lifter = createTestLifter()
  registerCppLanguage()
  setupTestRenderer()
})

function roundtrip(code: string): { tree: SemanticNode; out: string } {
  const tree = lifter.lift(tsParser.parse(code)!.rootNode as never)
  if (!tree) throw new Error('lift 回 null——那是另一個病，不是這支在量的')
  return { tree, out: generateCode(tree, 'cpp', style) }
}

/** 原文有、而產出沒有的那些字（非空白，計次）。空陣列＝一個字都沒少。 */
function charsLost(out: string, raw: string): string[] {
  const bag = new Map<string, number>()
  for (const ch of out) if (!/\s/.test(ch)) bag.set(ch, (bag.get(ch) ?? 0) + 1)
  const lost: string[] = []
  for (const ch of raw) {
    if (/\s/.test(ch)) continue
    const n = bag.get(ch) ?? 0
    if (n === 0) lost.push(ch)
    else bag.set(ch, n - 1)
  }
  return lost
}

/** 樹裡標成「這一段我看不懂」的節點數——**負向斷言的前置錨點**。 */
function syntaxErrorNodes(node: SemanticNode, acc: SemanticNode[] = []): SemanticNode[] {
  if (node.metadata?.degradationCause === 'syntax_error') acc.push(node)
  for (const kids of Object.values(node.slots ?? {})) {
    for (const k of kids ?? []) syntaxErrorNodes(k, acc)
  }
  return acc
}

/**
 * 七種形狀，**每一種都是量出來的**（不是想出來的）。
 * `lost` 欄位記的是**這一刀之前**弄丟了什麼——留著是為了讓下一個讀的人
 * 知道這幾支各自在守哪一個洞，而不是七支長得一樣的測試。
 */
const SHAPES: { name: string; code: string; wasLosing: string }[] = [
  {
    name: '漏分號（下一行是宣告）',
    code: 'int main() {\n  int x = 1\n  int y = 2;\n  return x + y;\n}\n',
    wasLosing: '（沒弄丟——自動補上分號，那是幫忙）',
  },
  {
    name: '漏右大括號',
    code: 'int main() {\n  int x = 1;\n  return x;\n',
    wasLosing: '（沒弄丟——自動補上 }）',
  },
  {
    name: '語句位置的亂碼',
    code: 'int main() {\n  int x = 1;\n  x @@ 2;\n  return x;\n}\n',
    wasLosing: '（沒弄丟）',
  },
  {
    name: '引數位置的亂碼',
    code: 'int f(int a, int b) { return a; }\nint main() {\n  int x = 1;\n  return f(x, @@);\n}\n',
    wasLosing: '（沒弄丟）',
  },
  {
    name: '🔴 漏分號（下一行是 cout）',
    code: 'int main() {\n  int x = 1\n  cout << x;\n  return 0;\n}\n',
    wasLosing: '兩行被併成 `int x = cout << x;`——**一支別的程式**',
  },
  {
    name: '🔴 括號運算式裡的亂碼',
    code: 'int main() {\n  int x = 1;\n  int y = (x @@ 2);\n  return y;\n}\n',
    wasLosing: '`@@ 2` 整段蒸發，產出 `int y = (x);`',
  },
  {
    name: '🔴 宣告初值是亂碼',
    code: 'int main() {\n  int x = @@@;\n  return 0;\n}\n',
    wasLosing: '初值整段蒸發，產出 `int x;`',
  },
]

describe('「這一段我看不懂」的產出不得比原文少', () => {
  for (const shape of SHAPES) {
    describe(shape.name, () => {
      it('★ 錨點：它真的被判成「看不懂」了——否則下一條是空過的', () => {
        const { tree } = roundtrip(shape.code)
        expect(
          syntaxErrorNodes(tree).length,
          '沒有任何節點標成 syntax_error → 這一支量到的不是它要量的東西',
        ).toBeGreaterThan(0)
      })

      it(`一個字都不得少（這一刀之前：${shape.wasLosing}）`, () => {
        const { out } = roundtrip(shape.code)
        expect(charsLost(out, shape.code), `產出：\n${out}`).toEqual([])
      })
    })
  }

  it('🔴 漏分號那一支不得把兩行併成【另一支程式】', () => {
    const { out } = roundtrip(SHAPES[4].code)
    // 併起來的症狀是那個宣告的初值變成了串流運算式
    expect(out, `產出：\n${out}`).not.toMatch(/int\s+x\s*=\s*cout/)
    expect(out).toMatch(/int\s+x\s*=\s*1/)
  })

  it('括號裡的亂碼照抄原文，而**不得多包一對括號**', () => {
    // ⚠️ `generateExpression` 的 `parenthesized` 分支會替使用者的括號補回去，
    //    而照抄的原文【自己就帶著那對括號】——兩處都加就變成 `((x @@ 2))`。
    const { out } = roundtrip(SHAPES[5].code)
    expect(out, `產出：\n${out}`).toContain('(x @@ 2)')
    expect(out, `產出：\n${out}`).not.toContain('((x @@ 2))')
  })
})

describe('🔴 而走一趟積木回來，這把尺沒有依據', () => {
  /**
   * 🔴 **誠實閘只守住【一條】路**（2026-09-20 瀏覽器驗收量到，第 210 刀記下）。
   *
   * ```
   * lift → 產碼          metadata.rawCode 還在 → honestly 有依據 → 🟢 誠實
   * lift → render → extract → 產碼   metadata 整個不見 → 🔴 int x = cout << x;
   * ```
   *
   * 積木上**存不下** `rawCode` 與 `degradationCause`，所以 extract 回來的樹
   * 沒有那兩格。而積木本身顯示的就已經是**錯的語義**
   *（「宣告 int 變數 x ＝ 直接寫運算式 cout << x」），程式碼只是忠實地跟著它。
   *
   * ✅ **2026-09-21 修好了（第 211 刀），而修法是 B 的一個變形。**
   *
   * 當時列了三個方向：A 讓積木存得下 metadata（新的存檔契約）·
   * B lift 時就整段降級成 raw_code · C 維持現狀。
   * B 卡在「什麼時候降級」那個判準上，而上面檔頭記了五種試過的、**每一種都誤傷**。
   *
   * 🟢 **而第六種成立，因為它問的不是「弄丟了嗎」，是「脫下原文還站得住嗎」**：
   *
   * ```
   * 把節點的 rawCode 與 degradationCause 拿掉，再產一次碼
   *   還原得出使用者寫的字  → 站得住 → 不動它（漏一個分號那種）
   *   還原不出              → 它本來就不該假裝自己是那個東西 → 換成 raw_code
   * ```
   *
   * ⚠️ 而「脫下原文」**正是走一趟積木回來的處境**——所以這一問問的，
   * 恰好就是那條路上會發生什麼。見 `core/lift/honest-degradation.ts`。
   *
   * ⚠️ 風格投影那個反例（`cout << x` → `printf`）**在 lift 那一側仍然存在**
   *（我當時猜它不存在，猜錯了）——所以那邊也要「換一個風格再問一次」。
   */
  it('🪦 已拔釘：extract 回來再產碼，字不得不見', async () => {
    const { renderToBlocklyState } = await import('../../src/core/projection/block-renderer')
    const { PatternExtractor } = await import('../../src/core/projection/pattern-extractor')
    const { BlockSpecRegistry } = await import('../../src/core/blocks/block-spec-registry')
    const { registerCppExtractStrategies } = await import('../../src/languages/cpp/extractors/extract-strategies')
    const { allCppProjections, allCppComponents } = await import('../../src/languages/cpp/all-declarations')

    const src = SHAPES[4].code
    const tree = roundtrip(src).tree
    // ★ 錨點：**產碼那一路是誠實的**——否則下面紅的是別的東西
    expect(charsLost(roundtrip(src).out, src), '產碼那一路就已經弄丟了 → 這一支量的不是它要量的').toEqual([])

    const reg = new BlockSpecRegistry()
    reg.loadFromSplit(allCppComponents() as never, allCppProjections() as never)
    const ex = new PatternExtractor()
    ex.loadBlockSpecs(reg.getAll())
    registerCppExtractStrategies(ex)

    const st = renderToBlocklyState(tree) as { blocks: { blocks: unknown[] } }
    const back = st.blocks.blocks.map((b) => ex.extract(b as never)).filter(Boolean) as SemanticNode[]
    expect(back.length, '一塊積木都抽不回來 → 那是另一個病').toBeGreaterThan(0)
    const rebuilt = { ...tree, slots: { body: back } } as SemanticNode
    const again = generateCode(rebuilt, 'cpp', style)
    expect(charsLost(again, src), `走一趟積木回來之後：\n${again}`).toEqual([])
  })
})

describe('★ 錨點：這把尺不得漏到【乾淨的】節點上', () => {
  /**
   * 🔴 這一段守的是 `honestly` 的**適用範圍**，而它要證的是兩件事**同時**成立：
   *
   * ```
   * ① 這一支真的【少字】了       否則它證不出「尺沒有套上去」——沒套與套了都會綠
   * ② 而它【沒有】被換成原文     這才是要守的那一條
   * ```
   *
   * ⚠️ **而合格的例子比想像中難找**（2026-09-20 掃了十個候選）：
   * 「int main(void)」· printf · 冗餘的 else · `x += 1` · struct ·
   * ⚠️ 前四個**刻意不加反引號**：`audit-behavior-error` 的語料掃描器
   *   會把含 `int main` 的反引號片語收進母體，而「int main(void)」這幾個字
   *   編不過、也不是語料——**用雜訊撐大的分母會讓誤差率自己下降**。
   * 三元運算 · `0x2A` · `'A'` · `while (1)`——**九個一個字都沒少**。
   *
   * 🟢 那本身是一個值得記住的讀數：**這個產生器幾乎不正規化**
   *（`0x2A` 不變成 42、`x += 1` 不拆開、括號與 `1e9` 有 `layoutHints` 守著）
   * ——「唯一真實，各式投影」在這裡的意思是**拼法也是真相的一部分**。
   *
   * 🟢 唯一少字的那一個是 `std::vector` → `vector`，而它少的正是
   * `namespace_style: 'using'` 這個**風格選擇**拿掉的那三個字。
   * 這把尺若漏出去，這條投影會當場被換回原文——而那個錯
   * **在上面七支負向測試上看起來完全正常**。
   */
  const src = '#include <vector>\nint main() {\n  std::vector<int> v = {1, 2};\n  return v[0];\n}\n'

  it('★ 它真的是乾淨的——一個 syntax_error 都沒有', () => {
    expect(syntaxErrorNodes(roundtrip(src).tree).length).toBe(0)
  })

  it('★ 它真的【少字】了——否則下一條是空過的', () => {
    const { out } = roundtrip(src)
    // 少掉的正是 `std::` 那四個字——不寫死整串，寫死的是【哪幾個字】為什麼會少
    expect(charsLost(out, src), `產出：\n${out}`).toEqual(expect.arrayContaining(['s', ':', ':', 'd']))
  })

  it('★ 而它沒有被換成原文——風格投影照舊做它的事', () => {
    const { out } = roundtrip(src)
    expect(out, `產出：\n${out}`).toContain('vector<int> v')
    expect(out, `產出：\n${out}`).not.toContain('std::vector')
  })
})
