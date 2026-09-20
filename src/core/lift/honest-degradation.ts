/**
 * **脫下原文之後站不住的節點，整段換成「看不懂的程式碼」**
 *
 * ## 🔴 它從哪來
 *
 * 第 208 刀讓產生器誠實了（`code-generator.ts` 的 `honestly`）：
 * 一個標成 `syntax_error` 的節點，產出比原文少字時就照抄原文。
 * **而那只守住一條路**（2026-09-21 瀏覽器驗收量到）：
 *
 * ```
 * lift → 產碼                        metadata.rawCode 還在 → 🟢 誠實
 * lift → render → extract → 產碼     rawCode【存不進積木】 → 🔴 int x = cout << x;
 * ```
 *
 * 積木上存不下 `rawCode`，所以走一趟積木回來的樹沒有那一格，
 * 誠實閘**沒有依據**。而積木本身顯示的就已經是錯的語義
 *（「宣告 int 變數 x ＝ 直接寫運算式 cout << x」），程式碼只是忠實地跟著它。
 *
 * ## 判準：**脫下原文，還站得住嗎**
 *
 * > **一個「這一段我看不懂」的節點，脫下原文之後如果還原不出使用者寫的字，
 * > 那它就不該假裝自己是那個東西。**
 *
 * 「脫下原文」正是**走一趟積木回來的處境**——所以這個判準問的，
 * 恰好就是那條路上會發生什麼。
 *
 * ⚠️ 而它**不是**「有沒有語法錯誤」（2026-09-20 量了七種形狀）：
 *
 * ```
 * 漏分號（下一行是宣告）  int x = 1            → int x = 1;          🟢 站得住（補一個分號）
 * 漏右大括號              int main(){ …        → 補上 }              🟢 站得住
 * ──
 * 漏分號（下一行是 cout） int x = 1 ⏎ cout<<x; → int x = cout << x;  🔴 那個 1 還原不出來
 * 括號運算式裡的亂碼      (x @@ 2)             → (x)                 🔴 站不住
 * 宣告初值是亂碼          int x = @@@;         → int x;              🔴 站不住
 * ```
 *
 * ## ⚠️ 兩個保守條款，缺一個就會誤傷
 *
 * **① 兩種 I/O 風格都要問。** 風格投影**本來就會換掉使用者寫的字**
 *（`cout << x` → `printf("%d", x)`），而那與「弄丟」在字面上長得一模一樣。
 * 頂層裸片段 `cout << x;` 會被標成 `syntax_error`（它確實不是一份合法的翻譯單元）
 * 而它**完全被理解了**——只問一種風格的話它會被誤判。
 *
 * > **少掉的字如果換一個風格就回來了，那它是投影，不是弄丟。**
 *
 * **② 語句路與運算式路都要問。** 一個語句節點走運算式路會少一個分號
 * ——那不是弄丟，是問錯了路。
 *
 * ## 🟢 而「不確定就不動」是預設
 *
 * 與 `ast-repairs.ts` 的契約①同一條：產生器還沒註冊、產碼丟例外、
 * 沒有 `rawCode`——**一律讓開**。
 * ⚠️ 少了這一條，一個「產生器忘了 install」的組裝點會讓**每一個**節點降級。
 */
import type { SemanticNode, StylePreset } from '../types'

/**
 * 產出有沒有把原文的每一個非空白字元都留下來。
 *
 * ⚠️ 與 `code-generator.ts` 的 `keepsEveryCharacter` **是同一把尺**，
 * 而兩邊各留一份是刻意的：核心的辨識層不該去 import 投影層的私有函式，
 * 而這把尺只有十行。🔴 **改一邊要改兩邊**——它們量的是同一件事。
 */
function keepsEveryCharacter(out: string, raw: string): boolean {
  const bag = new Map<string, number>()
  for (const ch of out) { if (!/\s/.test(ch)) bag.set(ch, (bag.get(ch) ?? 0) + 1) }
  for (const ch of raw) {
    if (/\s/.test(ch)) continue
    const n = bag.get(ch) ?? 0
    if (n === 0) return false
    bag.set(ch, n - 1)
  }
  return true
}

/** 這個節點今天就已經是「看不懂的程式碼」了嗎——是的話不必再換一次。 */
function alreadyRaw(componentId: string): boolean {
  const bare = componentId.split(':').pop() ?? componentId
  return bare === 'raw_code' || bare === 'raw_expression' || bare === 'unresolved'
}

/**
 * 產碼那一側要提供的東西——**由組裝點推進來**。
 *
 * 🔴 核心的辨識層**不 import 投影層**：那會在 `core/lift` 與 `core/projection`
 * 之間長出一條新的邊，而這裡需要的只是「幫我產一次碼」這個能力。
 */
export interface Reproducer {
  /** 以語句的身分產一次碼。丟例外或產不出來時回 `null`。 */
  asStatement(node: SemanticNode, style: StylePreset): string | null
  /** 以運算式的身分產一次碼。同上。 */
  asExpression(node: SemanticNode, style: StylePreset): string | null
  /** 要問哪幾種風格——**至少兩種 I/O 風格**，見檔頭保守條款①。 */
  styles(): readonly StylePreset[]
}

let reproducer: Reproducer | null = null

/** 組裝點呼叫一次。⚠️ 沒有呼叫的話這一路**整個讓開**（不是報錯）。 */
export function provideReproducer(r: Reproducer | null): void {
  reproducer = r
}

/** 脫下原文的那一份——模擬走一趟積木回來之後的樣子。 */
function stripped(node: SemanticNode): SemanticNode {
  const meta = { ...(node.metadata ?? {}) } as Record<string, unknown>
  delete meta.rawCode
  delete meta.degradationCause
  return { ...node, metadata: meta as SemanticNode['metadata'] }
}

/**
 * 這個節點脫下原文之後還站得住嗎。
 *
 * **判不出來一律回 `true`**（站得住 ＝ 不動它）——見檔頭「不確定就不動」。
 */
function standsWithoutRawCode(node: SemanticNode): boolean {
  if (reproducer == null) return true
  const raw = node.metadata?.rawCode
  if (raw == null) return true
  const text = String(raw)
  const bare = stripped(node)
  let asked = 0
  for (const style of reproducer.styles()) {
    for (const produced of [reproducer.asStatement(bare, style), reproducer.asExpression(bare, style)]) {
      if (produced == null) continue
      asked++
      if (keepsEveryCharacter(produced, text)) return true
    }
  }
  // ⚠️ **一次都問不出來 ＝ 產生器沒接上**，那不是「站不住」。
  return asked === 0
}

/**
 * 把站不住的那些換成「看不懂的程式碼」——**回一棵新的樹，不改原來那一棵**。
 *
 * `rawComponentId` 由語言套件給（`cpp:raw_code`／`python:raw_code`）
 * ——核心不知道任何語言的身分。
 */
export function degradeWhatCannotStand(tree: SemanticNode, rawComponentId: string): SemanticNode {
  function walk(node: SemanticNode): SemanticNode {
    const slots: Record<string, SemanticNode[]> = {}
    let changed = false
    for (const [name, kids] of Object.entries(node.slots ?? {})) {
      const next = (kids ?? []).map(walk)
      slots[name] = next
      if (next.some((n, i) => n !== (kids ?? [])[i])) changed = true
    }
    const self = changed ? { ...node, slots } : node

    if (node.metadata?.degradationCause !== 'syntax_error') return self
    if (alreadyRaw(node.componentId)) return self
    if (standsWithoutRawCode(node)) return self

    // 🔴 換成「這一段我看不懂」，而**原文一個字都不動**。
    // ⚠️ 形狀照 `lifter.ts` 的 Level 4（原文在 `metadata.rawCode`，不是 properties）
    //    ——兩處產出的 raw_code 必須長得一樣，否則下游要認兩種。
    return {
      ...self,
      componentId: rawComponentId,
      properties: {},
      slots: {},
      metadata: { ...node.metadata, confidence: 'raw_code', degradedFrom: node.componentId },
    }
  }
  return walk(tree)
}
