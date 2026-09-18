/**
 * **範圍演算法的執行期輔助** —— 與身分無關的演算法
 *
 * ⚠️ **這一份原本有兩個逐字相同的複本**：`std/algorithm/executors.ts` 與
 * `std/numeric/executors.ts`。不同的膠囊各 import 一份
 * （`range_reverse` 用前者、`range_sum_partial` 用後者）。
 *
 * > **兩份真相會漂移**——而它們在 F 之前看不出來：
 * > 那時它們是各自模組的內部實作，只有自己的註冊函式在用。
 * > 膠囊化把它們變成**跨膠囊的 import**，「同一個東西有兩個進入點」才現形。
 *
 * 第三十八條護欄（共用檔的殼與重複）第一次跑就抓到這一組。
 *
 * ## 🪦 這裡本來有一個【寫在執行器裡的 parser】（2026-09-18 拆掉）
 *
 * 在此之前 `begin`／`end` 是兩個**字串屬性**，裝著原始碼的片段文字，
 * 而這個檔用一條 regex 把它們解析回「哪個陣列、從哪到哪」：
 *
 * ```
 * /^([A-Za-z_]\w*)\s*(?:\.\s*(begin|end)\s*\(\s*\))?\s*(?:\+\s*(.+))?$/
 * ```
 *
 * 那條 regex 只認得**一個裸識別字**開頭的東西，於是學生真的寫的這些全部斷在這裡：
 *
 * ```cpp
 * sort(begin(array), end(array));       // basic/14_array_2.cpp
 * sort(d2[i].begin(), d2[i].end());     // tioj .../17_toj575.cpp
 * fill(d2[0], d2[0]+105, 1000000);      // w/APCS/e287.cpp
 * ```
 *
 * > **一個用 regex 認左值的執行器，它支援的形狀是「我想得到的那幾種」，
 * > 不是「這個語言長得出來的那些」。**
 *
 * 而這個檔的舊檔頭**自己寫著要拆**：「⚠️ 技術債：範圍本來就該是結構化的
 * （`{ array, from, to }`）……**這裡先解析，型別結構化另外排。**」
 *
 * ## 🔴 拆掉之後才發現：**結構早就在了，只是沒有人接上去**
 *
 * `src/interpreter/pointer.ts` 的 `isCellPointer` 註解逐字：
 *
 * > 「判準是 `type === 'array'` ＋ `value` 真的是一串格子。
 * > **容器本身也長這樣，而那是對的**：`v` 退化成指標時就是「指著第 0 格」。」
 *
 * 所以三件事**一件都不用發明**：
 *
 * | | 誰做 |
 * |---|---|
 * | 裸陣列名 → 第 0 格 | `cpp:var_ref` 求值出來就是那串格子（`offset` 未定義 ＝ 0） |
 * | `A+n` → 第 n 格 | **`cpp:arithmetic`** 的位置分支（`positionIn`） |
 * | `v.begin()`／`d2[i].begin()` | **`cpp:container_iter`**（接收者 2026-09-18 起是接點） |
 *
 * > **那條 regex 解析的東西，執行期早就會算了
 * > ——它不是在補一個缺口，它是在【繞過】一個已經存在的機制。**
 */
import { RuntimeError, RUNTIME_ERRORS } from '../../../../interpreter/errors'
import { offsetOf, sameCells } from '../../../../interpreter/pointer'
import type { RuntimeValue } from '../../../../interpreter/types'
import type { SemanticNode } from '../../../../core/types'

/** 求值一個端點，並且堅持它是**一串格子**。 */
async function endpoint(
  node: SemanticNode | undefined,
  ctx: { evaluate(n: SemanticNode): Promise<RuntimeValue> },
  which: string,
): Promise<RuntimeValue> {
  if (!node) {
    // 接不到東西時**出聲**——「沒有接上」與「接了一個空容器」在畫面上長得一樣
    //（兩者的迴圈都跑零次），而前者是學生少接了一顆積木。
    throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, { '%1': `這個範圍的「${which}」沒有接上` })
  }
  const v = await ctx.evaluate(node)
  if (v.type !== 'array' || !Array.isArray(v.value)) {
    throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, {
      '%1': `範圍的「${which}」不是一個位置（它要是一個容器、一個陣列，或它們上面的某一格）`,
    })
  }
  return v
}

/**
 * 把兩個**接點**求值成「哪一串格子、從哪到哪」。
 *
 * ⚠️ **用 `offsetOf` 而不是 `.offset`**——抹除紀錄（`era`）要被套用，
 *    否則一個在 `erase` 之前拿到的位置會指到隔壁那一格（見 `pointer.ts`）。
 *
 * ⚠️ **「尾端之後一格」是合法的**：`to === arr.length` 正是 `end()`，只有**解參考**
 *    才是錯的。這條性質在換成接點之前就成立，換完要保住。
 *    🔴 而**再往後就不合法**（`to > arr.length`）——底下那一段說明它抓的是什麼。
 */
export async function resolveRange(
  ctx: { evaluate(n: SemanticNode): Promise<RuntimeValue> },
  beginNode: SemanticNode | undefined,
  endNode: SemanticNode | undefined,
): Promise<{ arr: RuntimeValue[]; from: number; to: number }> {
  const b = await endpoint(beginNode, ctx, '開頭')
  const e = await endpoint(endNode, ctx, '結尾')
  /**
   * 🔴 **兩端必須在同一串格子上**。跨容器的範圍在 C++ 是**未定義行為**
   * ——而判準裡不得放未定義行為，所以這裡**出聲**而不是挑一邊。
   *
   * ⚠️ 判準是 `sameCells`（比的是**同一個陣列物件**），不是比名字：
   * 換成接點之後這裡已經沒有名字了，而「同一個東西」本來就該用身分比。
   */
  if (!sameCells(b, e)) {
    throw new RuntimeError(RUNTIME_ERRORS.TYPE_MISMATCH, {
      '%1': '這個範圍的兩端不在同一個容器裡',
    })
  }
  const arr = b.value as RuntimeValue[]
  const from = offsetOf(b)
  const to = offsetOf(e)
  /**
   * 🔴 **走過整串格子的盡頭要出聲**（2026-09-18）。
   *
   * ⚠️ `to === arr.length` 是**對的**——那正是 `end()`，C++ 允許位置指到
   *    「尾端之後一格」。這裡擋的是 `to > arr.length`。
   *
   * 而它真正抓的是**二維陣列的攤平慣用法**：
   *
   * ```cpp
   * int d2[10005][105];
   * fill(d2[0], d2[0] + 10005*105, 1000000);   // 一次填完整塊
   * ```
   *
   * C++ 的列是**連續的**，所以 `d2[0]+N` 會走進第二列。而這個直譯器的
   * 二維陣列是**巢狀**的（每一列是自己的一串格子），走不過那個邊界。
   *
   * > **一個能表達「第 i 列」的模型，不一定能表達「跨過列的邊界」
   * > ——而 C++ 的二維陣列兩件事是同一塊記憶體。**
   *
   * 🔴 **在此之前這裡什麼都不檢查，而填充那一路直接 `arr[i] = v`
   *    ——JS 的陣列會自己長，於是那個容器被撐成一百萬格而沒有人出聲。**
   *
   * 🔴 何時該拿掉這個限制：**二維陣列從巢狀改成「一塊連續的格子 ＋ 每列一個位置」
   *    的那一刀**。那一刀也會同時解決同族那兩支「讀進來的東西不知道要放哪裡」嗎？
   *    **不會**——那兩支是左值的問題，是另一族。
   */
  if (to > arr.length) {
    throw new RuntimeError(RUNTIME_ERRORS.INDEX_OUT_OF_RANGE, {
      '%1': `這個範圍走過了容器的盡頭（${to} > ${arr.length}）`
        + '。二維陣列在這裡是一列一串格子，跨過列的邊界走不過去',
    })
  }
  return { arr, from, to }
}

export const numOf = (x: unknown): number => Number((x as { value?: unknown })?.value ?? x) || 0
