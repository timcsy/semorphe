/**
 * **「這個容器型別的空實例長什麼樣」——由宣告那顆元件自己說。**
 *
 * ## 🔴 它從哪來（2026-09-18，資訊隔離的盲測）
 *
 * 一個容器**不一定經過宣告就會被建出來**：
 *
 * ```cpp
 * map<string, set<int>> buckets;  buckets[k].insert(i);   // m[k] 自動建一格
 * vector<set<int>> bins(4);       bins[i].insert(x);      // 建構子填 4 格
 * ```
 *
 * 那兩格的形狀原本是「一個空陣列」——**沒有種類的性質**。
 * 於是內層的集合不知道自己不留重複，`insert` 只好出聲：
 * 「這不是集合或對照表」。
 *
 * ## ⚠️ 為什麼不是在那兩個地方各補一段
 *
 * 「`set` 的執行期表示要帶 `allowsDuplicates: false`」是**宣告那顆元件的知識**
 * ——它今天寫在 `cpp:set_declare` 的 `execute.ts` 裡，從 `unique` 這個屬性讀。
 * 在 `map_at` 與 `vector_declare` 各抄一份的話，那是**第三份與第四份真相**，
 * 而它們會在下一個容器加進來的那天各自過期。
 *
 * > **一個「不經過宣告也會被建出來」的東西，
 * > 它的形狀仍然屬於宣告它的那顆元件——只是需要一個問得到的地方。**
 *
 * ⚠️ 這張表**只答得出樣板名**（`set`／`map`／`vector`…）。
 * 認不得的型別回 `null`，由呼叫端走原本的純量預設值——**不猜**。
 */
import type { RuntimeValue } from '../../../../interpreter/types'

type Make = (innerType: string) => RuntimeValue

const table = new Map<string, Make>()

/**
 * @param templateName 樣板名（`set`／`multiset`／`map`…）
 * @param make 給定**元素型別**（`set<pair<int,int>>` 的 `pair<int,int>`）造一個空的
 */
export function registerContainerDefault(templateName: string, make: Make): void {
  table.set(templateName, make)
}

/**
 * `set<int>` → 一個空的集合；`int` → `null`（不是容器）。
 *
 * ⚠️ **只剝一層**：`map<int, set<int>>` 的內層由 `map_at` 再問一次
 * （那時它手上的型別是 `set<int>`）。
 */
export function containerDefaultFor(declaredType: string): RuntimeValue | null {
  const t = declaredType.trim()
  const lt = t.indexOf('<')
  const base = (lt === -1 ? t : t.slice(0, lt)).trim()
  const make = table.get(base)
  if (!make) return null
  const inner = lt === -1 ? '' : t.slice(lt + 1, t.lastIndexOf('>')).trim()
  return make(inner)
}
