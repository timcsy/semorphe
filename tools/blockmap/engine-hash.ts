/**
 * **積木引擎的指紋**——一張「程式碼 ↔ 積木」對照圖是用哪一版的積木畫出來的。
 *
 * ## 🔴 它補的洞：`codeHash` 錨在【輸入】，而過期的是【輸出】
 *
 * 2026-09-05 使用者在課文頁上發現：
 *
 * ```
 * 課文左半   long long big = 1000000LL * 1000000LL;
 * 圖上右半   宣告 long long 變數 big = ( 0 × 0 )        🔴
 * ```
 *
 * 而**產品當下是對的**（實測積木上寫著 `1000000LL × 1000000LL`）。錯的是那張圖：
 * 它是在 `field_number` 改成 `field_input` **之前**產的
 * （`field_number` 會把 `1000000LL` 轉成 JS number ⟹ `0`）。
 *
 * 🔴 而第一百零二條護欄一聲不吭，因為它比的是 `codeHash`
 * ——**那一課的課文一個字都沒改**。
 *
 * > **一份產物的過期，有兩種來源：輸入變了，或者【產它的那台機器變了】。
 * > 只錨住前者的檢查，會在後者發生時保持全綠。**
 *
 * ## ⚠️ 為什麼是一格全域，不是「只算這張圖用到的積木」
 *
 * 精準版（每張圖只算它用得到的那幾個型別）試過了，而它需要一份
 * **積木型別 → 膠囊目錄**的對應——那 177 顆膠囊今天沒有這樣一張表，
 * 而為了一條護欄生一張表，那張表自己就會是下一個會爛的東西。
 *
 * ## ⚠️ 為什麼住在 `tools/`，不住在 `src/`
 *
 * 它讀檔案系統（`node:fs`）。`src/` 是**瀏覽器那一側**，那裡沒有 `node:fs`
 * ——放進去 `tsc` 當場就紅（實測）。而它的兩個使用者（產生器與護欄）都在 node 上。
 *
 * ⚠️ 代價是**改任何一顆積木，68 張圖全部要重產**（約六分鐘）。
 * 那個代價可以接受，因為圖真的會變；不能接受的是它變成一個
 * **習慣性動作**——所以護欄報的訊息裡直接寫著重產指令，而不是「請重產」。
 */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 把定義變成積木的那幾支——⚠️ **改了它們，每一張圖都要重產**。
 *
 * 🔴 這份清單是**手寫的**，而那是一個已知的弱點：漏掉一支，它造成的偏移就不會出聲。
 * 沒有把它改成「掃整個 `src/ui`」是因為那樣的話任何一次無關的改動都會讓 68 張圖變紅
 * ——而那會把這條護欄的訊號淹掉。
 *
 * > **判準是「這支改了，積木看起來會不會不一樣」。**
 */
export const ENGINE_FILES = [
  'src/ui/block-registrar.ts',
  'src/core/projection/pattern-renderer.ts',
  'src/core/projection/block-renderer.ts',
  'src/core/universal-blocks.json',
  'src/languages/cpp/core/blocks.json',
] as const

/** 膠囊裡的積木定義都叫這個名字，都住在 `forms/` 底下。 */
const CAPSULE_DEFS = 'blocks.json'

const short = (s: string): string => createHash('sha256').update(s).digest('hex').slice(0, 16)

/** `src/components` 底下每一份 `forms/blocks.json`，路徑排序過。 */
export function capsuleDefFiles(repoRoot: string): string[] {
  const out: string[] = []
  const walk = (dir: string): void => {
    let entries: string[]
    try { entries = readdirSync(dir) } catch { return }
    for (const e of entries) {
      const p = join(dir, e)
      if (statSync(p).isDirectory()) walk(p)
      else if (e === CAPSULE_DEFS) out.push(p.slice(repoRoot.length + 1))
    }
  }
  walk(join(repoRoot, 'src/components'))
  return out.sort()
}

/**
 * 引擎指紋。⚠️ **缺檔就丟錯**——靜默略過一個檔等於這條護欄少驗一塊，
 * 而它會在那個檔改名的那天無聲地退化成「只驗剩下的」。
 */
export function engineHash(repoRoot: string): string {
  const files = [...ENGINE_FILES, ...capsuleDefFiles(repoRoot)]
  return short(files.map((f) => `${f}\n${readFileSync(join(repoRoot, f), 'utf8')}`).join('\n \n'))
}
