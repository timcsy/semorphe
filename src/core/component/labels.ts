/**
 * 把各膠囊的標籤合回 loader 要的那份扁平字典
 *
 * ## 為什麼是「一個語言一個檔」而不是「一個檔內含所有語言」
 *
 * 膠囊契約 §二的判準直接給出答案：
 *
 * > 差別是它長成 **N 個新檔、各在明顯位置**（可以看、可以刪、可以數），
 * > 還是 **N 次對既有共用檔的編輯**。
 *
 * `labels.json` 內含所有語言的話，「加一個語言」＝編輯全部 177 個既有檔。
 * 一個語言一個檔的話，加語言＝每個膠囊**新增**一個檔，零編輯。
 *
 * ## ⚠️ 鍵撞了要爆，不得後者覆蓋前者
 *
 * 靜默覆蓋的症狀是「某顆積木顯示別人的字」——**使用者看得到，護欄看不到**。
 * 這個專案已經有一個同型的教訓：`all-declarations.ts` 的檔頭記著
 * 「通用積木整批從工具箱消失，而全套測試是綠的」。
 */
import type { ComponentRegistration } from './types'
import { registeredComponents } from './registry'

// ⚠️ 樣式必須字面常數（同 registry.ts 的理由）。
const LABEL_FILES = import.meta.glob('/src/components/*/*/labels/*.json', { eager: true }) as Record<
  string,
  { default: Record<string, string> }
>

function parseKey(globKey: string): { sourceDir: string; locale: string } | null {
  // 用 split 不用正則，理由同 `registry.ts` 的 `pathToDir`。
  const parts = globKey.split('/').filter(Boolean) // src, components, <scope>, <name>, labels, <locale>.json
  const i = parts.indexOf('components')
  if (i < 0 || parts.length !== i + 5 || parts[i + 3] !== 'labels') return null
  const file = parts[i + 4]
  if (!file.endsWith('.json')) return null
  return { sourceDir: `${parts[i + 1]}/${parts[i + 2]}`, locale: file.slice(0, -'.json'.length) }
}

/**
 * 某個語言的全部膠囊標籤。
 *
 * @throws 兩顆膠囊宣告了同一個標籤鍵
 */
export function componentLabels(locale: string): Record<string, string> {
  const out: Record<string, string> = {}
  const source = new Map<string, string>()

  for (const [key, mod] of Object.entries(LABEL_FILES)) {
    const parsed = parseKey(key)
    if (!parsed || parsed.locale !== locale) continue
    for (const [k, v] of Object.entries(mod.default)) {
      const existing = source.get(k)
      if (existing !== undefined) {
        throw new Error(
          `標籤鍵「${k}」被兩顆膠囊同時宣告：${existing} 與 ${parsed.sourceDir}。\n` +
            `不自動取其一，是因為靜默覆蓋的症狀是「某顆積木顯示別人的字」——` +
            `使用者看得到，護欄看不到。`,
        )
      }
      source.set(k, parsed.sourceDir)
      out[k] = v
    }
  }
  return out
}

/**
 * 膠囊化的元件所擁有的全部標籤鍵（不分語言）。
 *
 * 護欄用它問反方向：**這些鍵還留在共用 i18n 檔裡嗎？**
 */
export function componentOwnedLabelKeys(): Set<string> {
  const keys = new Set<string>()
  for (const [key, mod] of Object.entries(LABEL_FILES)) {
    if (!parseKey(key)) continue
    for (const k of Object.keys(mod.default)) keys.add(k)
  }
  return keys
}

/** 除錯／護欄用：這顆膠囊擁有哪些標籤鍵。 */
export function labelKeysOf(c: ComponentRegistration): string[] {
  const out: string[] = []
  for (const [key, mod] of Object.entries(LABEL_FILES)) {
    const parsed = parseKey(key)
    if (parsed?.sourceDir === c.sourceDir) out.push(...Object.keys(mod.default))
  }
  return [...new Set(out)].sort()
}

/** 目前有哪些語言的膠囊標籤檔。 */
export function componentLocales(): string[] {
  const s = new Set<string>()
  for (const key of Object.keys(LABEL_FILES)) {
    const p = parseKey(key)
    if (p) s.add(p.locale)
  }
  return [...s].sort()
}

// 讓 registeredComponents() 的驗證在標籤合併之前先跑過（載入順序的保險）。
void registeredComponents
