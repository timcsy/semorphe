/**
 * **參數的值，符合它宣告的種類嗎**——`ParamSpec.kind` 的唯一判定處。
 *
 * ## 🔴 它為什麼存在：又一個宣告了而沒有人讀的欄位
 *
 * `ParamKind` 的檔頭逐字寫著：
 *
 * > **每一個種類都以「它能讓什麼失敗」來定義。生不出檢查的種類不該存在。**
 *
 * 而 2026-09-14 量到：97 個參數宣告了 `kind: 'identifier'`，
 * **而沒有任何一處讀 `kind`**（`param-spec.ts` 只端名字出去）。
 *
 * 使用者轉述的症狀：「學生的變數名稱會寫成數字，Semorphe 竟然還可以接受」
 * ——實測產出 `int 123 = 16;`，主控台零錯誤、畫面零標記。
 *
 * ⚠️ 這是同一週**第三個**同族缺陷：`slots` 的 `min`／`max`（讀者 0）、
 * 形態軸 `role`（13 顆宣告全部落回中性）、以及這一個。
 *
 * > **一個宣告了而沒有人讀的型別，與沒有宣告是同一件事。**
 * > （而它在這個 repo 裡一週出現三次，代表那句話該變成一條護欄，不是一句話。）
 *
 * ## ⚠️ 它是報告，不是閘門——而這一格我猶豫過
 *
 * 這個 repo 記著另一句相反方向的話（使用者 2026-08-14）：
 * 「**寫錯還能順利執行就是不合理的**」，而 `int 123;` 是明確的錯。
 *
 * 🔴 而**這一刀刻意不動 `canExecute`**，理由是它會擋到的東西還沒量過：
 * Arduino 的腳位名、C 銜接軌的結構成員、Python 的中文變數名，
 * 每一個都要先確認規則對得上。
 *
 * > **一條會擋下執行的檢查，第一版就上閘門的話，
 * > 它擋錯的那幾種情況會由使用者替你發現。**
 *
 * 所以這一版**紅字看得見、而程式照跑**；閘門是下一刀，而它要先有量測。
 */
import { paramSpecs } from '../param-spec'
import { registeredComponents } from './registry'
import { isLegalIdentifier, whyIllegal, type IllegalNameReason } from '../identifier-syntax'
import { isDynamic } from './slot-check'
import type { SemanticNode } from '../types'

export interface ParamFinding {
  nodeId?: string
  componentId: string
  /** 參數名（`name`／`obj`…），不是它的值 */
  param: string
  reason: IllegalNameReason
  /** 措辭用的結構化欄位——⚠️ 不是一句中文（兩個面板要說不一樣的話） */
  params: Record<string, string>
}

/** 這顆元件宣告的參數規格。 */
function specsOf(componentId: string): { name: string; kind: string }[] {
  const c = registeredComponents().find((x) => x.componentId === componentId)
  if (!c) return []
  return paramSpecs((c.manifest as { properties?: never }).properties)
    .map((p) => ({ name: p.name, kind: String(p.kind) }))
}

/** 這顆元件屬於哪個語言——`cpp:var_declare` → `cpp`。 */
const languageOf = (componentId: string): string => componentId.split(':')[0] ?? ''

/**
 * 走過整棵樹，回報每一個**宣告成識別字而不合法**的參數值。
 *
 * ⚠️ **降級節點跳過**：灰積木裡的東西我們沒有讀懂，
 * 把「不知道」報成「你錯了」會讓每一個貼進真實程式碼的人看到一片紅。
 */
export function checkParams(tree: SemanticNode): ParamFinding[] {
  const out: ParamFinding[] = []
  const walk = (n: SemanticNode): void => {
    if (!isDynamic(n.componentId)) {
      const lang = languageOf(n.componentId)
      for (const spec of specsOf(n.componentId)) {
        // 🔴 今天只驗 `identifier`。其餘種類要各自生得出「它能讓什麼失敗」才進來
        //    ——加一個生不出檢查的種類，就是把這個檔變回一份宣告。
        if (spec.kind !== 'identifier') continue
        const raw = (n.properties as Record<string, unknown> | undefined)?.[spec.name]
        if (typeof raw !== 'string') continue
        // ⚠️ 空字串**不在這一條**：一個還沒填的欄位是「還沒做完」，不是「做錯了」，
        //    而學生拖出一顆積木的那一秒它就是空的。
        if (raw === '') continue
        if (isLegalIdentifier(lang, raw)) continue
        out.push({
          nodeId: n.id,
          componentId: n.componentId,
          param: spec.name,
          reason: whyIllegal(lang, raw) ?? 'bad_char',
          params: { name: raw },
        })
      }
    }
    for (const b of Object.values((n.slots ?? {}) as Record<string, SemanticNode[]>)) {
      for (const c of b ?? []) walk(c)
    }
  }
  walk(tree)
  return out
}
