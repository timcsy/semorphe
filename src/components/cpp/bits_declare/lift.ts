/**
 * `cpp:bits_declare` 的 **lift** 路——**一筆資料：「`bitset` 這個樣板名屬於我」**
 *
 * ## ⚠️ 而它比同族多一件事：樣板引數是一個【大小】
 *
 * 共用的容器宣告路把樣板引數當型別讀（`vector<int>` → `type: "int"`），
 * 而 `bitset<26>` 的 `26` 是**格數**。
 *
 * 🟢 判別留在共用檔（找 `template_type`、拆樣板引數本來就共用），而它改成
 * **問這顆元件自己宣告了什麼**：有 `size` 接點、沒有 `type` 屬性
 * ⟹ 樣板引數進 `size`。見 `strategies.ts` 的 `templateArgIsSize`。
 *
 * > **同一個身分在不同樣板名下的差別，是【那個名字】的性質。**
 * > 而「我的樣板引數是大小」是**這顆元件**的性質——所以它寫在宣告裡，
 * > 不是寫成登錄表的第四個參數。
 */
import { registerContainerTemplate } from '../../../core/component/container-templates'
import { declareSizedRowType } from '../../../core/component/aggregate-nodes'
import { BIT_ELEM } from './execute'

export function registerLift(): void {
  registerContainerTemplate('bitset', 'cpp:bits_declare', 'cpp/bits_declare')
  /**
   * 🔴 **一陣列的 bitset**（`bitset<26> d[50007];`，語料 `AP325/2/2_7_TLE`）。
   * 那一句走的是**陣列宣告**那一顆，而它每一格用 `defaultValue(元素型別)` 建
   * ——對帶尖括號的型別一律是空容器，於是 `d[0][2] = 1` 說「索引超出範圍」。
   * ⚠️ 登記的是樣板名 `bitset`（不是 `bitset<26>`），長度由型別字串裡的引數決定。
   */
  declareSizedRowType('bitset', BIT_ELEM)
}
