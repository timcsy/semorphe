/**
 * **「排回去」那種題**——把一段解答打散，讓學生排回去。
 *
 * 🪦 這個檔原本叫 `parsons.ts`（研究文獻裡的名字），而那是**一個人的姓**：
 * 寫教案的老師打開 `lesson.json` 看到 `kind: "parsons"`，零資訊。
 *
 * > **一個字如果它的意思要靠一篇論文才解釋得通，
 * > 那它是【註解】，不是【識別字】。**
 *
 * ⚠️ 而 **Parsons 這個名字留在下面**——它是**出處**，出處該待在註解裡。
 *
 * ## 🔴 為什麼是它（外部證據，2026-09-05）
 *
 * Ericson 等人：
 *
 * > **把打散的程式碼排回去，學習成效與「自己寫程式」相同，而只花 70% 的時間。**
 *
 * 而在這個專案裡它幾乎是免費的——那些研究全部在用「文字行卡片」，
 * 而**我們的卡片本來就會卡榫、會拒絕接錯**。
 *
 * > **一個為了教學而發明的載體（打散的卡片），
 * > 在這裡本來就是產品的主體。**
 *
 * 證據與出處：`concepts/認知鷹架.md`〈三條外部證據〉。
 *
 * ## 🔴 打散必須是【確定性】的
 *
 * 同一題每次打散成一樣的順序，理由有三個，而它們一個比一個硬：
 *
 * ```
 * 教學   學生重整理頁面不該換一題（他會以為自己記錯了）
 * 支援   老師說「第三塊拖到最上面」時，兩個人看到的要是同一個畫面
 * 護欄   🔴 一個每次都不一樣的東西，測試只能驗「它有動」，驗不了「它對」
 * ```
 *
 * 所以種子是**題目的身分**，不是時間也不是亂數。
 *
 * ## ⚠️ 這個模組不做什麼
 *
 * - **不判對錯**——排完之後按執行，由既有的裁判（`compareOutput`）說話。
 *   ⚠️ 而它的語氣那一條照舊：**排錯不得說「你錯了」**。
 * - **不碰積木**——它只回一個順序，怎麼擺是視圖的事（P9）。
 */

/**
 * 一個**確定性**的雜湊（FNV-1a 32 位元）。
 *
 * ⚠️ 不用 `Math.random`，也不用時間——見檔頭。
 * ⚠️ 也不用 `String.prototype.hashCode` 那種各家不同的東西：
 * 這一支要在**瀏覽器與 Node 上算出同一個數**，測試才驗得了。
 */
function hash32(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/** 由種子長出來的下一個亂數（xorshift32）——**同一個種子永遠同一串**。 */
function nextRandom(state: number): number {
  let x = state
  x ^= x << 13; x >>>= 0
  x ^= x >>> 17
  x ^= x << 5; x >>>= 0
  return x >>> 0
}

/**
 * 把 `0..n-1` 打散成一個**確定性**的順序。
 *
 * @param seed 種子——**用題目的身分**（`<課程 id>#<題目 id>`）
 * @returns 長度 n 的排列。⚠️ `n <= 1` 時原樣回傳（沒有東西可以打散）
 *
 * 🔴 **而它保證「不會剛好等於原本的順序」**（n >= 2 時）：
 * 一題打散完等於沒打散，學生會以為壞了，而**護欄也驗不出它有沒有跑**。
 */
export function scatterOrder(seed: string, n: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i)
  if (n <= 1) return order
  // Fisher–Yates，而亂數來自種子
  let state = hash32(seed) || 1
  for (let i = n - 1; i > 0; i--) {
    state = nextRandom(state)
    const j = state % (i + 1)
    const t = order[i]; order[i] = order[j]; order[j] = t
  }
  // ⚠️ 打散完剛好等於原順序 ⟹ 換一下頭兩個。**機率很低而不是零**，
  //    而「很低」在 66 課乘上每次載入是會發生的。
  if (order.every((v, i) => v === i)) {
    const t = order[0]; order[0] = order[1]; order[1] = t
  }
  return order
}
