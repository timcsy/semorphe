/**
 * **瀏覽器本地的存放實作**——`KeyValueStore` 的網頁版那一個。
 *
 * 🔴 **它住在 `src/ui/`，不住在 `src/core/`**，而那是這一刀的重點：
 * `localStorage` 是宿主的東西，而**知道宿主的那一層是 UI**。
 * 核心只宣告它要什麼（`core/host/key-value-store.ts`）。
 *
 * ⚠️ 第一百零七條護欄擋著回頭路：`src/core/` 裡再出現一次
 * `localStorage` 就紅。
 */
import { MemoryKeyValueStore, type KeyValueStore } from '../core/host/key-value-store'

/**
 * `localStorage` 到底能不能用。
 *
 * 🔴 **不是「它存不存在」**——無痕模式下它**存在而且叫得到**，
 * 而 `setItem` 會拋。所以判準是**真的寫一次**。
 *
 * > **一個能力偵測如果只問「那個東西在不在」，
 * > 它在「在但不給用」的那些環境會給出錯的答案。**
 */
function usable(): boolean {
  try {
    const probe = '__semorphe_probe__'
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}

/** `localStorage` 那一個。⚠️ 每一個操作都包 `try`——它會在配額滿時拋。 */
class LocalKeyValueStore implements KeyValueStore {
  read(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  }

  write(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value)
      return true
    } catch {
      // 🔴 **配額滿是一個【失敗】，不是一個例外**——回 `false` 讓呼叫端看得到。
      //    ⚠️ 在此之前這個 catch 住在 `StorageService.save` 裡，而它把
      //    「寫不進去」與「存檔格式不對」吞進同一個 `return false`。
      return false
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch {
      // 刪不掉就算了——⚠️ 而**不要在這裡拋**：呼叫端多半是在清理，
      //    而一個清理路徑上的例外會把它上面那件真正的事一起打斷。
    }
  }
}

/**
 * **這個瀏覽器該用哪一個**。
 *
 * 🟢 `localStorage` 用不了 → **退回記憶體**，於是「沒有 storage」
 * 變成「**記不住**」而不是「崩掉」。
 *
 * ⚠️ 而它**不出聲**：那不是錯誤，是一個合法的環境
 * （使用者自己關掉的、或一個還沒有儲存的宿主）。
 */
export function createBrowserStore(): KeyValueStore {
  return usable() ? new LocalKeyValueStore() : new MemoryKeyValueStore()
}
