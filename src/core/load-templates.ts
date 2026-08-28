/**
 * 把 `templates/` 底下的每一份模板載進來。
 *
 * 🔴 **程式碼是獨立檔案（`code.*`），不是 JSON 裡的字串。**
 *
 * ```
 * 獨立檔     語法高亮 · grep 得到 · 護欄可以真的餵給編輯器跑
 * JSON 字串  每一行都要 \n 跳脫，而沒有人讀得下去
 * ```
 *
 * ⚠️ 與 `lessons/` 的「程式碼只寫在課文裡一份」是**同一條規矩的兩個實例**：
 * **程式碼住在一個地方，而那個地方要人讀得下去。**
 */
import { parseTemplate, type Template } from './template'

const META = import.meta.glob('/templates/*/template.json', { eager: true }) as Record<
  string, { default: unknown }
>
// ⚠️ `?raw` 讓 Vite 把檔案當**字串**進來，而不是試著解析它
const CODE = import.meta.glob('/templates/*/code.*', { eager: true, query: '?raw', import: 'default' }) as Record<
  string, string
>

let cache: Map<string, Template> | null = null

export function allTemplates(): ReadonlyMap<string, Template> {
  if (cache) return cache
  const rows: Template[] = []
  for (const [path, mod] of Object.entries(META)) {
    const id = path.replace(/^\/templates\//, '').replace(/\/template\.json$/, '')
    const codePath = Object.keys(CODE).find((p) => p.startsWith(`/templates/${id}/code.`))
    if (codePath === undefined) {
      console.error(`[templates] ${id} 沒有 code.* ——一份沒有程式碼的模板不是模板`)
      continue
    }
    // 🔴 一份壞掉的宣告要出聲，而不能讓其餘的一起掛掉
    try { rows.push(parseTemplate(id, mod.default, CODE[codePath])) } catch (e) {
      console.error(`[templates] ${id} 載不起來：`, e)
    }
  }
  // 🔴 glob 的鍵順序不保證，而選單順序是設計出來的
  // 🔴 **組間照宣告的順序，組內照 `order`**——與目標選單同一招。
  const GROUP_ORDER = ['基本', '輸入輸出', '硬體']
  const rank = (g?: string): number => {
    const i = GROUP_ORDER.indexOf(g ?? '')
    return i < 0 ? GROUP_ORDER.length : i
  }
  rows.sort((a, b) =>
    rank(a.group) - rank(b.group) || a.order - b.order || a.id.localeCompare(b.id))
  cache = new Map(rows.map((t) => [t.id, t]))
  return cache
}

export function templateById(id: string): Template | undefined {
  return allTemplates().get(id)
}
