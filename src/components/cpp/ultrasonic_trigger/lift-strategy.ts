/**
 * `cpp:ultrasonic_trigger` 的 **lift** 路——**把一串連續語句摺成一顆**。
 *
 * ## 🔴 為什麼這一顆要動到整個 `compound_statement`
 *
 * 其他所有元件認的都是**一個** AST 節點。這顆認的是**五個相鄰的語句**：
 *
 * ```cpp
 * digitalWrite(T, LOW);
 * delayMicroseconds(2);
 * digitalWrite(T, HIGH);
 * delayMicroseconds(10);
 * digitalWrite(T, LOW);
 * ```
 *
 * 一串語句沒有自己的 AST 節點——**它們的共同父節點是整個大括號區塊**。
 * 所以策略掛在 `compound_statement` 上，自己走訪子節點、把命中的那一段換掉、
 * 其餘照常 `ctx.lift`，最後回傳同樣的 `_compound`。
 *
 * ### ⚠️ 而它有【兩個】掛點：`compound_statement` 與 `translation_unit`
 *
 * 完整的 sketch 裡那五句一定在 `setup`／`loop`／某個函式裡（大括號區塊）。
 * 🔴 **而學生貼進來的常常是【片段】**——沒有函式包著，那五句直接在頂層。
 * 殘差報告一直把語料分成「語法完整」與「片段」兩欄，就是因為後者是真實的。
 *
 * > **一個只認得完整程式的辨識器，會在最需要它的時候（貼上一段）不認得。**
 *
 * 兩個掛點跑的是同一支策略——差別只在「子節點在哪裡」，而那兩處都是
 * `namedChildren`。
 *
 * ## ⚠️ 而它跑在【每一個】大括號上，所以第一件事是快速退出
 *
 * 沒有 `delayMicroseconds` 的區塊立刻回 `null`，落回既有的通用樣式。
 * 🔴 這一段的代價是**全語言共用的**：一個 bug 不只壞掉超音波，會壞掉所有程式。
 * 所以判斷寫得比一般的窄——**寧可漏認，不可誤認**。
 *
 * ## 摺什麼、不摺什麼，是數出來的
 *
 * ```
 * 觸發序列        14/14 = 100%   🟢 摺
 * 觸發 ＋ 換算緊鄰  9/14 =  64%   🔴 不摺（5 段被 if 守衛隔開）
 * ```
 *
 * > **「都齊」與「緊鄰」是兩個不同的問題，而只有後者決定摺不摺得起來。**
 *
 * 換算留給既有的積木——🟢 而那讓 14 段**全部**轉得動：不變的摺、變的留。
 */
import type { LiftStrategyRegistry } from '../../../core/registry/lift-strategy-registry'
import type { AstNode, LiftContext } from '../../../core/lift/types'
import type { SemanticNode } from '../../../core/types'
import { createNode } from '../../../core/semantic-tree'

/** `f(a, b)` 拆成 `['f', 'a', 'b']`；不是呼叫就回 `null`。 */
function callOf(stmt: AstNode): { name: string; args: AstNode[] } | null {
  if (stmt.type !== 'expression_statement') return null
  const expr = stmt.namedChildren[0]
  if (expr?.type !== 'call_expression') return null
  const fn = expr.childForFieldName('function')
  if (fn?.type !== 'identifier') return null
  return { name: fn.text, args: expr.childForFieldName('arguments')?.namedChildren ?? [] }
}

/** `digitalWrite(<pin>, LOW|HIGH)` —— 回傳那根腳的節點。 */
function digitalWriteOf(stmt: AstNode, level: 'LOW' | 'HIGH'): AstNode | null {
  const c = callOf(stmt)
  if (!c || c.name !== 'digitalWrite' || c.args.length !== 2) return null
  if (c.args[1].text !== level) return null
  return c.args[0]
}

/** `delayMicroseconds(<us>)` —— 引數必須**正好**是這個數字。 */
function isDelayMicros(stmt: AstNode, us: string): boolean {
  const c = callOf(stmt)
  return !!c && c.name === 'delayMicroseconds' && c.args.length === 1 && c.args[0].text === us
}

/**
 * 從第 `i` 個語句起，是不是那五句觸發序列。是的話回傳觸發腳的節點。
 *
 * ⚠️ **三次 `digitalWrite` 必須是同一根腳**——不同腳的話那不是一次觸發，
 * 而是兩件事湊巧排在一起。
 */
function matchTrigger(stmts: AstNode[], i: number): AstNode | null {
  if (i + 4 >= stmts.length) return null
  const pin = digitalWriteOf(stmts[i], 'LOW')
  if (!pin) return null
  if (!isDelayMicros(stmts[i + 1], '2')) return null
  const high = digitalWriteOf(stmts[i + 2], 'HIGH')
  if (!high || high.text !== pin.text) return null
  if (!isDelayMicros(stmts[i + 3], '10')) return null
  const low2 = digitalWriteOf(stmts[i + 4], 'LOW')
  if (!low2 || low2.text !== pin.text) return null
  return pin
}

export function registerLiftStrategy(registry: LiftStrategyRegistry): void {
  registry.register('cpp:liftUltrasonicTrigger', (node: AstNode, ctx: LiftContext) => {
    const stmts = node.namedChildren
    // 🔴 **快速退出**：這支策略跑在每一個大括號上。
    //    沒有 `delayMicroseconds` 就不可能是觸發序列——立刻讓路。
    if (!stmts.some((s) => s.text.includes('delayMicroseconds('))) return null

    const body: SemanticNode[] = []
    let matched = false
    for (let i = 0; i < stmts.length; i++) {
      const pin = matchTrigger(stmts, i)
      if (pin) {
        const pinNode = ctx.lift(pin)
        // 觸發腳提不起來就不摺——⚠️ 摺了會把那個運算式弄丟，
        // 而那是安靜的資料遺失（第三十三條護欄在看）。
        if (pinNode) {
          body.push(createNode('cpp:ultrasonic_trigger', {}, { pin: [pinNode] }))
          matched = true
          i += 4
          continue
        }
      }
      const lifted = ctx.lift(stmts[i])
      if (lifted) body.push(lifted)
    }
    // 一句都沒摺到就**完全讓路**——回 `null` 落到既有的通用樣式，
    // ⚠️ 不要回一個「我自己走訪過一遍」的等價結果：那等於把整個語言的
    // 區塊辨識搬進這顆膠囊，而它只想管超音波。
    if (!matched) return null
    return createNode('_compound', {}, { body })
  })
}
