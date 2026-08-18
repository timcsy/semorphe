/**
 * `cpp:pin_attach` 的 **lift** 路——**結構認身分，名字只認標籤**。
 *
 * ## 🔴 為什麼不能靠名字認
 *
 * 同一個資料夾層級的鄰居（Arduino 腳位常數那顆）用名字認人，而第三十二條護欄
 * 當場抓到它把使用者自己宣告的 `enum Level { LOW = -1 }` 搶走：
 *
 * > **一個靠「識別字的名字」認人的樣式，會把使用者自己宣告的名字搶走。**
 *
 * `const int MAX = 100;` 與 `const int ledPin = 13;` **語法完全相同**。
 * 靠名字分的話，一個叫 `pinCount` 的計數器就會變成一根腳位。
 *
 * ## 🟢 判準：它有沒有【被當腳位用】
 *
 * ```
 * const int ledPin = 13;         結構：const ＋ 整數型別 ＋ 整數字面量
 *   ＋ pinMode(ledPin, OUTPUT);  用法：出現在腳位函式的第一個引數
 *   → cpp:pin_attach
 *
 * const int MAX = 100;           結構對，用法沒有 → 回 null，不搶
 * ```
 *
 * 這正是量那張詞根表時用的同一個判準（`tests/probes/device-name-recognition.test.ts`）：
 *
 * > **要問「這是不是一根腳位」，看它【被怎麼用】，不要看它長什麼樣。**
 *
 * ⚠️ 而回 `null` 會**落回下一個 pattern**（`PatternLifter.tryLift` 的迴圈），
 * 也就是既有的常數宣告元件——**不搶就是完整地不搶**，不留半個殘骸。
 *
 * ## 走整支程式：`parent` 一路往上
 *
 * `AstNode` 有 `parent`（`core/lift/types.ts`），所以從這個宣告節點走得到
 * `translation_unit`。⚠️ 核心那個逐節點的後處理掛點（`post-processors.ts`）
 * 拿到的是**語義節點不是 AST**，查不了整支程式——而這顆不需要合併兩個語句，
 * **它只需要查詢**，所以策略這一層就夠。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import type { AstNode } from '../../../core/lift/types'
import { createNode } from '../../../core/semantic-tree'
import { deviceFromName } from '../../../languages/cpp/core/runtime/device-names'

/**
 * 會把第一個引數當腳位的函式。
 *
 * ⚠️ 與探針用的那一組**必須一致**——命中率是照這一組量出來的。
 * 🔴 而 `attach` 在裡面是為了伺服（`myservo.attach(9)`）：那顆概念排在第 2 批，
 * 但**它的腳位現在就該被認出來**，否則同一支程式裡有的腳位認得出有的認不出。
 */
const PIN_FUNCTIONS = new Set([
  'pinMode', 'digitalWrite', 'digitalRead', 'analogRead', 'analogWrite',
  'tone', 'noTone', 'pulseIn', 'attach', 'ledcAttachPin',
])

/** 整數型別——⚠️ `const float` 不是腳位，而它結構上長得一樣。 */
const INT_TYPES = new Set(['int', 'byte', 'uint8_t', 'const int', 'unsigned char', 'short'])

function rootOf(node: AstNode): AstNode {
  let cur = node
  while (cur.parent) cur = cur.parent
  return cur
}

/** `name` 有沒有在這棵樹的某處被當腳位用。 */
function usedAsPin(root: AstNode, name: string): boolean {
  const stack: AstNode[] = [root]
  while (stack.length > 0) {
    const n = stack.pop() as AstNode
    if (n.type === 'call_expression') {
      const fn = n.childForFieldName('function')
      // `myservo.attach(9)` 的 function 是 field_expression，取它的欄位名
      const fnName = fn?.type === 'field_expression'
        ? (fn.childForFieldName('field')?.text ?? '')
        : (fn?.text ?? '')
      if (PIN_FUNCTIONS.has(fnName)) {
        const args = n.childForFieldName('arguments')
        const first = args?.namedChildren[0]
        if (first?.type === 'identifier' && first.text === name) return true
      }
    }
    for (const c of n.namedChildren) stack.push(c)
  }
  return false
}

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('cpp:liftPinAttach', (node) => {
    // ── 結構：整數型別 ＋ 單一 init_declarator ＋ 整數字面量 ──
    //
    // ⚠️ **`const` 從「必要條件」變成「一個記下來的形式」**（2026-08-18 盲測）：
    //    20 段隔離語料裡腳位宣告有 19 筆 `const int`、3 筆裸 `int`。
    //    只認 const 的話那 3 筆轉不成接線積木——🔴 而**擋住誤認的不是 `const`，
    //    是「它有沒有被當腳位用」**。const 從來就不是那道防線。
    const hasConst = node.namedChildren.some(
      (c) => c.type === 'type_qualifier' && c.text === 'const',
    )

    const typeNode = node.childForFieldName('type')
    if (!typeNode || !INT_TYPES.has(typeNode.text)) return null

    const decl = node.namedChildren.find((c) => c.type === 'init_declarator')
    if (!decl) return null

    const nameNode = decl.childForFieldName('declarator')
    if (nameNode?.type !== 'identifier') return null
    const name = nameNode.text

    const valueNode = decl.childForFieldName('value')
    // 🔴 只認**整數字面量**。`const int ledPin = base + 1;` 結構上是腳位，
    //    而它的值不是一個積木上的數字欄位裝得下的東西——⚠️ **認了就會在
    //    round-trip 時把那個算式弄丟**，而那是安靜的資料遺失。不認，讓它
    //    留在既有的常數宣告元件裡。
    if (valueNode?.type !== 'number_literal') return null
    const pin = valueNode.text
    if (!/^\d+$/.test(pin)) return null

    // ── 用法：整支程式裡有沒有人把它當腳位 ──
    if (!usedAsPin(rootOf(node), name)) return null

    // 🔴 名字只到這裡才被用上，而它只決定【標籤】。
    //    認不出來是 `unknown`，而結構已經成立了。
    return createNode(
      'cpp:pin_attach',
      { device: deviceFromName(name), pin, name, style: hasConst ? 'const' : 'plain' },
      {},
    )
  })

  /**
   * `#define LED_PIN 13` —— **同一個判準，不同的 AST 節點**。
   *
   * 盲測語料裡它佔 10/32（31%）——⚠️ 而它是初學教學最常見的寫法之一
   * （`#define` 不佔記憶體這句話在 Arduino 教材裡到處都是）。
   *
   * 🔴 判準與宣告式**完全一樣**：值是整數字面量、而這個名字在整支程式裡
   * 被當腳位用過。**名字仍然只決定標籤。**
   */
  registry.register('cpp:liftPinAttachDefine', (node) => {
    const name = node.childForFieldName('name')?.text
    const value = node.childForFieldName('value')?.text?.trim()
    if (!name || !value || !/^\d+$/.test(value)) return null
    if (!usedAsPin(rootOf(node), name)) return null
    return createNode(
      'cpp:pin_attach',
      { device: deviceFromName(name), pin: value, name, style: 'define' },
      {},
    )
  })
}
