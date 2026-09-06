/**
 * **一份帶得走的作品**——原始碼是第一級的檔案，其餘的是它的側檔。
 *
 * ## 🔴 它解的是「我匯出的東西只有你打得開」
 *
 * 在此之前匯出是**一份 `.json`**，而 13 個欄位混在同一層：
 *
 * ```
 * code                                   ← 原始碼，唯一真實
 * blocklyState · flowLayout · codeHash   ← side-car
 * topicId · language · styleId · …        ← 使用者與教學情境
 * ```
 *
 * 🔴 而 P1「**唯一真實，各式投影**」的唯一真實**是程式碼**。
 *
 * > **一份匯出如果程式碼不是第一級的檔案，那份匯出把投影當成了真相。**
 *
 * ⚠️ **歸屬那一半早就做完了**（`FIELD_OWNERSHIP`，2026-08-24）——
 * 這一支只是把那份宣告**投影成檔案的樣子**。
 *
 * ## ⚠️ 這裡不知道 zip，也不知道任何語言
 *
 * ```
 * 核心說   「這份作品拆成哪幾個檔」        ← 這一支
 * 宿主說   「怎麼把幾個檔變成一個下載」    ← UI 那一側
 * ```
 *
 * 🔴 而那是**宿主獨立性的第四個實例**（前三個：儲存、程式碼視圖、控制項）。
 * 同一個形狀第四次出現，表示它是對的：**宿主提供能力，核心只認得埠。**
 *
 * 副檔名同理——「C++ 的檔案叫 `.cpp`」由語言套件宣告（`fileExtensionOf`），
 * 這一支只收一個字串。
 */
import type { SavedState } from './storage'

/** 側檔住的地方。⚠️ 一個點開頭的資料夾——解開之後它不擋路。 */
export const SIDECAR_DIR = '.semorphe'

/**
 * 一份作品拆成的檔案。key 是**容器裡的路徑**，value 是內容。
 *
 * ⚠️ 都是字串——這一層不碰位元組，壓縮那一側才碰。
 */
export type PortableFiles = Record<string, string>

/**
 * **拆開**：一份存檔 → 兩個檔案。
 *
 * ```
 * <name><ext>                        原始碼——任何編輯器打得開
 * .semorphe/<name><ext>.json         其餘全部
 * ```
 *
 * 🔴 **`code` 不會同時出現在兩邊。** 它在側檔裡留一份的話，
 * 有人手改了原始碼之後就有兩份說法——而那正是 side-car 一直在避免的事。
 *
 * > **一份資料如果在容器裡出現兩次，那個容器就有兩個真相
 * > ——而它們只在有人編輯過其中一份之後才會不一樣。**
 *
 * ⚠️ `language` **留在側檔裡**，即使副檔名已經暗示了它。
 * 🔴 因為**反推是錯的**（`traits.ts:60`：「從產出的形狀反推它是什麼的判準，
 * 會安靜地做錯事」）——`.cpp` 對得到四個教學語言。
 *
 * @param name 作品名（不含副檔名）
 * @param ext  副檔名，帶點。由語言宣告，見 `fileExtensionOf`
 */
export function toPortable(state: SavedState, name: string, ext: string): PortableFiles {
  const filename = `${name}${ext}`
  const { code, ...rest } = state
  return {
    [filename]: code ?? '',
    [`${SIDECAR_DIR}/${filename}.json`]: JSON.stringify(rest, null, 2),
  }
}

/**
 * **組回來**：一組檔案 → 一份存檔的原料。
 *
 * ⚠️ **它不做版本升級**——那要走與自動載入**同一套** `judgeJSON` ＋ `upgrade`，
 * 而那一套住在 `storage.ts`。這裡只負責「哪個檔是原始碼、哪個是側檔」。
 *
 * > **走同一個 `judgeJSON`——與自動載入不得有第二種鬆緊度。**
 * > （`storage.ts:252` 的既有教訓。在此之前那裡只檢查 `version` 存在，
 * > 於是 `version: 99` 通過。）
 *
 * ## 🔴 側檔可以不在，而那時**不是壞掉**
 *
 * 只有原始碼的容器（有人在別的編輯器改過、把側檔刪了）
 * → 回一份**只有 `code`** 的原料，讓上層照常走「重排版」那條路。
 *
 * @returns `null` 表示**這組檔案裡沒有原始碼**——那不是一份作品
 */
export function fromPortable(files: PortableFiles): { code: string; sideCar: string | null } | null {
  const paths = Object.keys(files)
  // 原始碼 ＝ 不在側檔資料夾裡的那一個
  const codePath = paths.find((p) => !p.startsWith(`${SIDECAR_DIR}/`) && !p.endsWith('/'))
  if (codePath === undefined) return null

  // ⚠️ 側檔用**檔名**配對，不是「側檔資料夾裡的第一個」
  // ——多檔案那天這裡不必重寫。
  const wanted = `${SIDECAR_DIR}/${codePath}.json`
  const sideCarPath = paths.includes(wanted)
    ? wanted
    : paths.find((p) => p.startsWith(`${SIDECAR_DIR}/`) && p.endsWith('.json'))

  return {
    code: files[codePath] ?? '',
    sideCar: sideCarPath ? (files[sideCarPath] ?? null) : null,
  }
}

/**
 * 作品的預設名字——⚠️ **用現有的資訊，不發明一個檔名欄位**。
 *
 * 🔴 「這份作品叫什麼」屬於「**主體是誰**」那一題，而那一題是多檔案那一刀的。
 * 現在發明一個欄位，等那一刀來的時候就要遷移它。
 *
 * > **一個為了讓今天好看而發明的欄位，是明天的一次遷移。**
 */
export function defaultWorkName(topicId?: string): string {
  const stamp = new Date().toISOString().slice(0, 10)
  // ⚠️ 課程 id 可能帶路徑或空白——只留檔名安全的字
  const safe = (topicId ?? '').replace(/[^A-Za-z0-9_-]/g, '')
  return safe ? `${safe}-${stamp}` : `semorphe-${stamp}`
}
