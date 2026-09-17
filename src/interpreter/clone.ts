/**
 * **聚合值的深複製——「傳值」真的要是一份新的。**
 *
 * ## 🔴 它從哪來（2026-09-16，模糊測試抓到的）
 *
 * ```
 * int drain(deque<int> d){ while(!d.empty()){ d.pop_front(); } return …; }
 * deque<int> dq; dq.push_back(1); dq.push_back(2);
 * drain(dq);   cout << dq.size();     g++ 印 2 ／ 我們印 0
 * ```
 *
 * 參數綁定寫的是 `scope.declare(param.name, val)`，而 `val` 是**呼叫端那一個
 * 物件本身**。於是被呼叫端把它清空，呼叫者的容器跟著空了。
 *
 * ⚠️ 它壞得很安靜：程式跑完、印出數字、而那個數字是錯的。
 *
 * > **「傳值」與「傳參考」的差別，在解譯器裡就是「有沒有複製」這一個動作
 * > ——少了它，兩者的行為完全相同，而語言的宣告變成一句空話。**
 *
 * ## ⚠️ 只複製聚合，不複製純量
 *
 * 純量是不可變的（每次運算都產生新的 `RuntimeValue`），複製它只是浪費。
 * 而陣列與物件是**可變的容器**——它們是這件事的全部。
 */
import type { RuntimeValue } from './types'

/**
 * 深複製一個執行期的值。
 *
 * ⚠️ **純量也給一個新的外殼**（`{ ...v }`）。理論上純量是不可變的，
 * 而實測把它改成「原樣回傳」之後，模糊測試裡一支本來通過的程式當場退步
 * ——代表**有人在原地改 `.value`**，而那個人是誰還沒查出來。
 *
 * > **一個「理論上不會有人這樣做」的最佳化，要先證明沒有人這樣做。**
 */
export function cloneValue(v: RuntimeValue): RuntimeValue {
  if (v.type === 'array' && Array.isArray(v.value)) {
    return { ...v, value: (v.value as RuntimeValue[]).map(cloneValue) }
  }
  if (v.type === 'object' && v.value instanceof Map) {
    const m = new Map<string, RuntimeValue>()
    for (const [k, x] of v.value as Map<string, RuntimeValue>) m.set(k, cloneValue(x))
    return { ...v, value: m }
  }
  /**
   * 🔴 **一段文字的「字元格子」是個快取，而 `{ ...v }` 複製的是【那個陣列的參考】**
   *    （2026-09-17，第二輪盲測抓到的）。
   *
   * ```cpp
   * string squeeze(string s, char drop) {            // ← 傳【值】
   *   string::iterator it = s.begin();
   *   while (it != s.end()) { if (*it == drop) it = s.erase(it); else ++it; }
   *   return s;
   * }
   * squeeze(base, 'a');
   * cout << base;                    🟢 對的——`value` 那個字串沒被動到
   * for (auto it = base.begin(); …)  🔴 走出來少了所有的 'a'
   * ```
   *
   * `begin()` 會把格子攤出來**存回那個值身上**（`v.charCells ??= …`），
   * 而字串走的是下面這條純量路——外殼是新的，格子是同一個陣列。
   * 於是被呼叫端的 `erase` 在呼叫者的格子上 splice。
   *
   * ⚠️ **症狀分裂成兩半**，而那是它活下來的原因：印出來是對的（印的是 `value`），
   * 走訪是錯的（走的是格子）。**同一個變數的兩個讀法，只有一個壞了。**
   *
   * > **一份從別的欄位推導出來的快取，複製時要丟掉而不是帶走
   * > ——帶走的話它就不再是那一份的快取了。**
   */
  if (v.charCells) {
    const copy = { ...v }
    delete copy.charCells
    return copy
  }
  return { ...v }
}
