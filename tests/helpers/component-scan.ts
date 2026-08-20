/**
 * 元件身分的列舉與掃描（中立性護欄與就近性護欄共用）
 *
 * ## 判定規則（spec FR-012／FR-042 要求定義並記錄）
 *
 * 一個檔案「提到」某個 componentId，指的是**該 id 以完整的字串字面出現**：
 * `'print'`、`"cpp_string_at"`、`` `print` ``。
 *
 * 為什麼是字串字面而不是單純的字邊界比對：
 *
 * 1. **這才是實際的耦合形狀**。componentId 在執行期是字串，硬編一定長成
 *    `case 'cpp_string_at':`、`generators.set('print', ...)`、`register('if', ...)`。
 * 2. **單純字邊界會災難性誤報**。universal 概念包含 `if`／`return`／`break`／
 *    `continue`／`print`／`input` 這些常見英文字與 TypeScript 關鍵字——字邊界
 *    比對會把每一個 if 陳述都算成違規，護欄的可信度會立刻歸零。
 *
 * 已知限制（刻意不追）：`id.startsWith('cpp_')` 這類**前綴耦合**不會被抓到。
 * 它是另一種耦合，不是本護欄的目標。
 *
 * 註解中的引用**另外計數、不計入基線**——`// cpp_string_at — character access`
 * 是說明不是耦合，為了降數字去刪有用的註解是反效果。
 */
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT } from './guardrail'
import { deriveBlockType } from '../../src/core/component/derive-block-type'
import type { ConceptDefJSON } from '../../src/core/types'
import { allCppConcepts } from '../../src/languages/cpp/all-declarations'

/**
 * 全部已註冊的元件定義。
 *
 * ⚠️ **必須走 `allCppConcepts()`，不得在這裡自己組一份。**
 *
 * 這個函式原本自己 import `universalConcepts` ＋ `coreConcepts` ＋ `allStdModules`
 * 再串起來——而 `all-declarations.ts` 的存在理由就是要消滅這種第二份組裝，
 * 它的檔頭寫著：
 *
 * > 在此之前，`app.ts`、`module.ts` 與測試 helper **各自組裝一次**同一份清單。
 * > 三份看起來一樣，而其中兩份載入的是**沒有蓋 `owner` 章的原始 JSON**。
 *
 * **測試 helper 那一份當時沒有被改掉。** 元件膠囊進來時它才現形：
 * 膠囊接上了正式組裝點，而孤兒實作護欄走的是這裡，於是回報
 * 「`cpp:vector_declare` 有實作卻沒有宣告」——**一顆剛搬好的元件，看起來像孤兒。**
 */
export function allComponentDefs(): ConceptDefJSON[] {
  return allCppConcepts()
}

/**
 * **全部**元件身分。
 *
 * 中立性護欄用這一組，因為 P9 談的是**語言獨立性**
 * ——「拔掉 C++，只裝 Python stub → 所有視圖仍啟動」。
 *
 * 🔄 **spec 152 拿掉了 `universal` 豁免。**
 *
 * 舊的分法是「lang-core／lang-library 算違規，universal 不算」，理由逐字：
 * 「universal 概念**拔掉 C++ 後依然存在**」。
 *
 * 🔴 **而那個理由是假的**——233 顆元件全是 `cpp:` scope，
 * `cpp:if` 拔掉 C++ 之後不會依然存在。
 *
 * 🟢 動它的時機是「它豁免了 0 筆」的今天：**沒有數字要調**。
 * ⚠️ 而護欄因此**變嚴**：將來任何元件身分出現在中立範圍都會被算到。
 */
/**
 * 全部元件的**積木型別**（`cpp:print` → `cpp_print`）。
 *
 * 🔴 **spec 153 新增的那一維。**
 *
 * 中立性護欄原本只掃**概念身分**，而中立範圍裡硬編的是**積木型別**
 * ——於是 44 筆耦合對它**不存在**，護欄報 0。
 *
 * > **一條護欄如果只掃一種拼法，另一種拼法的耦合就對它不存在。**
 *
 * ⚠️ 而這與 `history/015`（「語言無關性從尚未驗證到已知是破的」）
 * 是**同一個病的第二次**：那次也是「因為第一次真的去量了」。
 */
export function allComponentBlockTypes(): string[] {
  return [...new Set(allComponentDefs().map((c) => deriveBlockType(c.conceptId)))].sort()
}

export function allComponentIds(): string[] {
  return [...new Set(allComponentDefs().map((c) => c.conceptId))].sort()
}

/**
 * 把原始碼拆成「程式碼」與「註解」兩份文字。
 * 逐字元處理並追蹤字串狀態，避免把 `'http://x'` 裡的 `//` 誤判為註解。
 */
/**
 * 把 `"abstractConcept": "x"` 的**值**遮掉。
 *
 * 那不是 `x` 的實作足跡，而是**別人在指向 x**——把它算進 `x` 的擴散度，
 * 等於「越多概念認 var_declare 當父概念，var_declare 就越碎裂」，那是反的。
 *
 * 這與註解剝離是同一條紀律：**掃描要分得出「這裡實作了它」與「這裡提到它」**。
 * 見 specs/056-abstract-concept-integrity
 */
export function maskAbstractTargets(src: string): string {
  return src.replace(/("abstractConcept"\s*:\s*)"[^"]*"/g, '$1""')
}

/**
 * 把「拼法像元件身分、實際不是」的位置遮掉。
 *
 * ## 為什麼需要這個
 *
 * 判定是純文字比對——只匹配完整的引號字串字面。於是**任何與元件身分撞名的
 * 普通英文單字**都被計為違規。`comment` 是最明顯的一個：它同時是概念身分、
 * 語法樹的節點型別、一個標註列舉的成員，還是使用者在積木上看到的提示文字。
 *
 * 這是「量測工具會安靜地量錯」的第七個實例，而機制是新的——前六個是入口用錯／
 * 粒度太粗／詞義錯／從事實推錯嚴重性／判準對但自動化錯／測試沒測到東西。
 * 見 `knowledge/experience.md`、`specs/059-concept-id-vs-lookalike/research.md`。
 *
 * ## 紀律
 *
 * 與 `maskAbstractTargets`、`splitCodeAndComments` 同一條：**掃描要分得出
 * 「這裡實作了它」與「這裡提到它」。**
 *
 * 每個遮罩的判準必須是**語言規則**，不是統計傾向。判不出來的一律**留著算違規**
 * ——為了讓數字好看而樂觀歸類，比沒有護欄更糟。
 *
 * ## ⚠️ 被否決的第三個遮罩：`.type === 'x'`
 *
 * 直覺上它該被遮——`node.type === 'comment'` 比的是語法樹的節點型別，不是身分。
 *
 * **但實測它會遮掉 14 筆真違規。** `block.type === 'cpp_string_declare'` 比的是
 * Blockly 的積木型別，而積木型別直接對應概念身分。兩者在文字上**完全相同**，
 * 想靠變數名（`node` vs `block`）分辨是啟發式——而 `build-guardrail` 第 6 步明講
 * 「靜態判斷不能下結論，只能排順序」。
 *
 * 後果：`src/core/lift/lifter.ts` 的 `node.type === 'comment'` **仍然被計為違規**。
 * 這是正確的保守結果，而且**那個檔留在清單上是對的**——它第 152 行在核心層剝
 * `//` 與 `/* *​/`，那是比帳面上更嚴重的耦合，而本護欄看不見它（它只找身分字串，
 * 不找語法）。遮掉之後那個檔會看起來乾淨，而它不是。
 *
 * 有人想補上這個遮罩的話，`tests/unit/helpers/mask-non-identity.test.ts` 會擋住。
 */
export function maskNonIdentityPositions(src: string): string {
  let out = maskAbstractTargets(src)

  // ── 遮罩 A：型別位置
  // `type X = 'a' | 'b'` 與 `prop: 'a' | 'b' | 'c'`。
  // 判準是語言規則而非啟發式：**型別位置的字串在編譯後不存在**，
  // 不可能是執行期的身分引用。
  // 要求 ≥2 個成員才算聯集——只有一個的話，`x: 'foo'` 與物件字面
  // `{ x: 'foo' }` 在文字上分不開，而後者可能是真的身分引用。
  out = out.replace(
    /([:=]\s*)('[^'\n]*'(?:\s*\|\s*'[^'\n]*')+)/g,
    (_m, lead: string, union: string) => lead + union.replace(/'/g, '«'),
  )

  // ── 遮罩 C：UI 欄位的預設值
  // `new Field*(...)` 的第一個引數是**值**，不是識別碼——那是使用者在積木上
  // 看到的提示文字（`new Blockly.FieldTextInput('comment')` 顯示「comment」）。
  out = out.replace(
    /(new\s+(?:Blockly\.)?Field\w*\(\s*)'[^'\n]*'/g,
    (_m, lead: string) => lead + '«»',
  )

  // ── 遮罩 D：`import.meta.glob(...)` 的路徑樣式
  // 判準同樣是語言規則：那個引數**必須是字面常數**（Vite 在建置時展開它），
  // 而它是**檔案路徑樣式**，不是身分也不是語法記號。
  //
  // ⚠️ 這一條是被咬出來的：`'/src/components/*/*/component.json'` 裡的 `*/`
  // 被語法耦合護欄判成「C 家族的區塊註解結尾」。而那個記號的入選理由寫著
  // 「在 TypeScript 的字串字面裡，它還可能是什麼？」——**答案是 glob 萬用字元
  // 後面接分隔符**，只是提問的時候還沒有人在核心裡寫過 glob。
  //
  // 不把 `*/` 降級成「無法確定」，是因為那會讓真正的註解剝除程式碼也一起變隱形；
  // 遮掉**位置**才是對的刀口（與遮罩 A 同一條紀律）。
  out = out.replace(
    /(import\.meta\.glob\(\s*)(['"`])[^'"`\n]*\2/g,
    (_m, lead: string) => lead + '«»',
  )

  return out
}

export function splitCodeAndComments(src: string): { code: string; comments: string } {
  let code = ''
  let comments = ''
  let i = 0
  const n = src.length
  let quote: string | null = null

  while (i < n) {
    const c = src[i]
    const next = src[i + 1]

    if (quote) {
      code += c
      if (c === '\\') {
        code += next ?? ''
        i += 2
        continue
      }
      if (c === quote) quote = null
      i++
      continue
    }

    if (c === "'" || c === '"' || c === '`') {
      quote = c
      code += c
      i++
      continue
    }

    if (c === '/' && next === '/') {
      const end = src.indexOf('\n', i)
      const stop = end === -1 ? n : end
      comments += src.slice(i, stop) + '\n'
      // 不補換行：stop 停在 '\n' 上，該換行會在下一輪以一般字元進入 code，
      // 補了會讓行號往下位移一行。
      i = stop
      continue
    }

    if (c === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2)
      const stop = end === -1 ? n : end + 2
      const chunk = src.slice(i, stop)
      comments += chunk + '\n'
      // 保留換行，讓行號不位移
      code += chunk.replace(/[^\n]/g, '')
      i = stop
      continue
    }

    code += c
    i++
  }

  return { code, comments }
}

/** 建立「id → 偵測用 regex」的表。只匹配完整的引號字串字面。 */
function literalPattern(id: string): RegExp {
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(['"\`])${esc}\\1`)
}

/**
 * 元件身分寫成**裸的物件鍵**——`cpp_char_is_alpha: (c) => …`，沒有引號。
 *
 * ⚠️ **這個形式原本完全看不見。** 判定只比對引號字串字面，於是核心層那四個
 * 字元分類函式一筆都沒被數到——中立性報「0」的時候，它們還在核心裡。
 *
 * 不只**維度**（身分 vs 語法）會消失在數字裡，**同一維度的不同書寫形式也會**。
 * 見 `knowledge/concepts/執行機構.md`、`specs/082-stale-blockers`。
 *
 * 判準：識別字後面接冒號，而前面不是引號也不是識別字字元。
 * 型別註記（`foo: string`）不會誤中，因為那裡的識別字不是元件身分。
 */
function barePropertyKey(id: string): RegExp {
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^'"\`\\w.])${esc}\\s*:`, 'm')
}

export interface FileHits {
  /** 出現在程式碼中的 componentId（計入基線） */
  code: string[]
  /** 只出現在註解中的 componentId（列報表、不計基線） */
  commentOnly: string[]
  /** 程式碼命中的行號，key 為 componentId */
  lines: Record<string, number[]>
}

/** 掃單一檔案，回傳它提到的 componentId */
export function scanFile(relPath: string, ids: readonly string[]): FileHits {
  return scanText(fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8'), ids)
}

/**
 * 掃一段**文字**，回傳它提到的 componentId。
 *
 * 這是 `scanFile` 的純函式核心。分出來是為了讓遮罩的注入測試能餵合成字串——
 * 錨在真實檔案上的測試，會在那些檔案被修好的那天失效（本專案這週為此翻車兩次）。
 */
export function scanText(rawSrc: string, ids: readonly string[]): FileHits {
  const src = maskNonIdentityPositions(rawSrc)
  const { code, comments } = splitCodeAndComments(src)
  const codeLines = code.split('\n')

  const hitsInCode: string[] = []
  const hitsInComments: string[] = []
  const lines: Record<string, number[]> = {}

  for (const id of ids) {
    const re = literalPattern(id)
    if (re.test(code) || barePropertyKey(id).test(code)) {
      hitsInCode.push(id)
      const at: number[] = []
      codeLines.forEach((l, idx) => {
        if (literalPattern(id).test(l) || barePropertyKey(id).test(l)) at.push(idx + 1)
      })
      lines[id] = at
    } else if (re.test(comments) || new RegExp(`(^|[^A-Za-z0-9_])${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z0-9_]|$)`).test(comments)) {
      hitsInComments.push(id)
    }
  }

  return { code: hitsInCode.sort(), commentOnly: hitsInComments.sort(), lines }
}

/**
 * 掃一組目錄，回傳每個有命中的檔案。
 *
 * `exts` 預設只有 `.ts`（中立性護欄用——核心層不該有元件 JSON）。
 * 就近性護欄要加上 `.json`：一個元件的 `concepts.json`／`blocks.json`
 * **本來就是它的實作**，不算進去會低估擴散度。
 */
export function scanDirs(
  relDirs: readonly string[],
  ids: readonly string[],
  exts: readonly string[] = ['.ts'],
): Map<string, FileHits> {
  const result = new Map<string, FileHits>()
  for (const dir of relDirs) {
    const abs = path.join(REPO_ROOT, dir)
    if (!fs.existsSync(abs)) continue
    const walk = (d: string): void => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const f = path.join(d, e.name)
        if (e.isDirectory()) {
          if (e.name === 'node_modules') continue
          walk(f)
          continue
        }
        if (!exts.some((x) => e.name.endsWith(x)) || e.name.endsWith('.d.ts')) continue
        const rel = path.relative(REPO_ROOT, f)
        const hits = scanFile(rel, ids)
        if (hits.code.length > 0 || hits.commentOnly.length > 0) result.set(rel, hits)
      }
    }
    walk(abs)
  }
  return result
}
