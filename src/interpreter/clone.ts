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
  /**
   * 🔴 **一個「位置」不是一個容器——它不複製**（2026-09-18，盲測 fuzz_8 抓到）。
   *
   * ```cpp
   * long long parseExpr(TIt &it, TIt end);      // end 是【傳值】的迭代器
   * parseExpr(it, ts.end());
   * ```
   *
   * 位置與容器在執行期**長得一模一樣**（都是 `type: 'array'`），於是傳值那一路
   * 把 `end` 底下那串格子整個複製了一份。`it != end` 的判準是
   * `sameCells`（同一個 JS 陣列參考）——複製過的永遠不相等，於是
   * **那個迴圈的結束條件永遠不成立**，最後在結尾之後解參考：
   * `RUNTIME_ERR_INDEX_OUT_OF_RANGE: 7`。
   *
   * > **兩種東西如果在執行期長得一樣，那麼每一條「對其中一種做什麼」的規則
   * > 都會靜默地套到另一種身上。**
   *
   * 🟢 分得出來的地方是 `offset`：容器本身從來不設它，而每一個位置都設
   *（`positionIn` 一律蓋章）。而 C++ 的迭代器複製出來本來就**指著同一串格子**。
   */
  if (v.offset !== undefined) return { ...v }
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
