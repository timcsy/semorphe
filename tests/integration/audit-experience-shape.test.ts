/**
 * 護欄：**`experience.md` 的骨架，與它導覽裡的數字。**
 *
 * ## 🔴 它從哪來（2026-09-29 的 `/knowie-judge`）
 *
 * 那一輪的機械掃描全綠（死連結 0、死指名 0、孤兒 0），而骨架是壞的：
 *
 * ```
 * ## 教訓                  底下 ### 150     ✅ 體例
 * ## 關鍵延伸（主題觸發必讀）  底下 ### 476     🔴 教訓住在一張【觸發關鍵字表】底下
 * ## <教訓標題> × 62                        🔴 教訓自己升成 ##
 * # ══ 從 CLAUDE.md 寫回… ══  底下 ### 32     🔴 一個 `#` 級分隔標題再切一刀
 * ```
 *
 * **690 條裡只有 150 條在它該在的地方。**
 *
 * 成因單純：`>>` 一律接在檔尾，而檔尾在「關鍵延伸」後面；
 * 而某一天起追加的標題從 `###` 變成 `##`。**markdown 照樣渲染，沒有人會發現。**
 *
 * > **一個用來分段的標題，在一個【只有一層內容】的檔裡，
 * > 分出來的是它後面所有東西的新家。**
 *
 * ## 而導覽的三個數字全都過期了
 *
 * ```
 * 「這個檔今天有 310 條」        實際 690    2.2 倍
 * 「指到 6500 行檔案開頭」       實際 13967  2.1 倍
 * 「85 條連結裡 65 條只寫 experience」  實際 78 / 56
 * ```
 *
 * ⚠️ 而那一節**自己就引用著這個檔的教訓**：
 * 「一份看起來是索引、而三成的內容不在裡面的表，比沒有索引更糟——它讓人以為找過了。」
 *
 * ⟹ 判準與 `audit-guardrail-count` 那一條同形：
 * **一個數字是不是債，看它宣稱的是【現在】還是【當時】。**
 * 「寫死過一次『310 條』，而半年後是 690」是**紀錄**，不是債。
 *
 * ## ⚠️ 自我否證聲明（寫在量測之前）
 *
 * **如果讀到的教訓數是 0，代表解析壞了，不是這個檔空了。**
 * 錨在**教訓數**（輸入量，它只會長）上——刻意不錨在「有幾條在錯的層級」，
 * 那是這條護欄要推向零的東西。
 *
 * ## 🟢 而「沒有錨點」不一定是缺陷（2026-09-29 逐條判過）
 *
 * ```
 * [experience](../experience.md)「某一條教訓的名字」   ⟹ 單指一條,該有錨點
 * 「四條教訓 → [experience](../experience.md)」        ⟹ 指的是【檔案】,不該有錨點
 * ```
 *
 * 那一輪把 56 條逐條判完：**27 條名字對得上、5 條名字漂了或只住在 memory
 * （兩條因此第一次寫進 experience）、10 條靠上下文的判決句配上**，
 * 剩下 **14 條是複數反流指標**——它們指檔案是對的。
 *
 * > **一個「還沒接上」的讀數，先問那裡面有幾條【本來就不該接】。**
 *
 * ## 本護欄不檢測什麼
 *
 * - **不判一條教訓寫得好不好**，也不管它該不該在。
 * - **不管別的檔**：`principles.md`／`vision.md` 有自己的體例。
 * - 不強制教訓的順序（追加在檔尾是對的）。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * ⚠️ **這一段的理由修正過**（2026-09-29 同一天）：
 * 我原本寫「字面的三反引號讓總數變奇數」，而那個診斷是用一個**含 `{4,400}`
 * 上限的複製品**做的——那個上限正是 `backtick-corpus` 檔頭說它**修掉**的病
 * （真正的實作是先配對、再篩長度）。
 *
 * 🟢 **真正的判準**：`tests/integration/*.test.ts` 的**字串字面值裡不要放反引號**。
 * 七支護欄從這些檔撈反引號區段當 C++ 語料，而字串裡的反引號會與註解裡的
 * 混在一起配對，把**這個檔自己的 TypeScript** 切成一段「語料」。
 * 實測：那讓 `audit-corpus-shapes` 報出 `field_designator`／`ref_qualifier`
 * 兩個「沒有判定的語法形狀」——它們是我的物件字面值被當成 C 的指定初始化解出來的。
 *
 * > **一個從自己這一族的檔案裡取語料的工具，
 * > 會把「描述它自己」的那段文字當成輸入。**
 *
 * 🔴 **而這個檔不能含一個字面的三反引號**——它會讓整個檔的反引號變成奇數，
 * 於是 `backtickSpans`（七支護欄共用）配對錯位，把**這個檔自己的 TypeScript**
 * 當成一段 C++ 語料撈走。
 *
 * 實測（2026-09-29）：那讓 `audit-corpus-shapes` 報出兩個「沒有判定的語法形狀」
 * （`field_designator`／`ref_qualifier`）——而它們是我的物件字面值被當成 C 的
 * 指定初始化去解析出來的。
 *
 * > **一個掃描程式碼圍籬的檔案，自己不能寫出一個圍籬
 * > ——它會被自己那一族的工具吃掉。**
 */
const FENCE = String.fromCharCode(96).repeat(3)

const ROOT = path.resolve(__dirname, '../..')
const EXP = path.join(ROOT, 'knowledge', 'experience.md')
const lines = fs.readFileSync(EXP, 'utf8').split('\n')

/** 這個檔只准有這幾個 `#`／`##` 標題——其餘都該是 `###`（一條教訓）。 */
const ALLOWED_TOP = new Set([
  '# 經驗',
  '## 怎麼在這裡找到一條教訓',
  '## 關鍵延伸（主題觸發必讀）',
  '## 教訓',
])

/**
 * 🔴 **圍籬裡的不算標題。**
 *
 * 這條護欄第一次跑就抓到自己：`history/302` 那一條教訓裡有一段
 * **示範壞掉的骨架**的程式碼框，而框裡就是 `## 教訓` `## 關鍵延伸` 那幾行。
 *
 * ⚠️ 同一條規則 2026-09-29 當天出現**四次**（發號上限 · 指名掃描 · 課文的
 * 「輸入：」· 這裡）。
 *
 * > **一個掃散文的判準，第一件事是把程式碼挖掉
 * > ——而示範「壞掉長什麼樣」的那段文字，一定住在程式碼框裡。**
 */
function proseLines(src: readonly string[]): { line: string; no: number }[] {
  const out: { line: string; no: number }[] = []
  let open = false
  src.forEach((l, i) => {
    if (l.startsWith(FENCE)) { open = !open; return }
    if (!open) out.push({ line: l, no: i + 1 })
  })
  return out
}

const prose = proseLines(lines)
const lessons = prose.filter((x) => x.line.startsWith('### ')).length

describe('護欄：experience.md 的骨架', () => {
  it('★ 入口條件：教訓數不得為零', () => {
    expect(lessons, '🔴 一條 「### 」 都沒讀到 → 解析壞了，下面的零是假的').toBeGreaterThan(300)
  })

  it('🔴 硬性零：只有那四個標題可以是 「#」／「##」，其餘都是教訓（「###」）', () => {
    const bad: string[] = []
    for (const { line, no } of prose) {
      if (!/^#{1,2} /.test(line)) continue
      if (ALLOWED_TOP.has(line.trim())) continue
      bad.push(`experience.md:${no}  ${line.slice(0, 48)}`)
    }
    expect(
      bad,
      '\n🔴 這幾個標題把它們【後面所有的教訓】切到「教訓」那一節外面去了：\n' + bad.join('\n')
        + '\n\n處置：一條教訓用 「### 」；一段說明用引言（「> 」），不要用標題。\n',
    ).toEqual([])
  })

  it('🔴 硬性零：導覽那一節不得寫死會爛的數字', () => {
    // 導覽 ＝ 從「## 怎麼在這裡找到一條教訓」到下一個 `## `
    const s = prose.findIndex((x) => x.line.startsWith('## 怎麼在這裡'))
    const e = prose.findIndex((x, i) => i > s && x.line.startsWith('## '))
    expect(s, '找不到導覽那一節 → 判準的前提不成立').toBeGreaterThan(-1)
    // ⚠️ 「寫死過一次 310 條」是**紀錄**（過去式），不是債
    //    ——判準與 `audit-guardrail-count` 同形：看它宣稱的是【現在】還是【當時】。
    const NOW = /今天|目前|現行|現在/
    const NUM = /\d[\d,]*\s*(條|行)(?!的)/
    const bad: string[] = []
    for (let i = s; i < e; i++) {
      const { line, no } = prose[i]
      if (NUM.test(line) && NOW.test(line)) bad.push(`experience.md:${no}  ${line.slice(0, 56)}`)
    }
    expect(
      bad,
      '\n🔴 導覽裡把數字宣稱成現況（它會在下一次追加時過期）：\n' + bad.join('\n')
        + '\n\n處置：改成「怎麼量」（「grep -c」 …）或指向這條護欄的報表。\n',
    ).toEqual([])
  })

  it('報出今天的讀數（導覽不寫死，數字由這裡出）', () => {
    const hist = path.join(ROOT, 'knowledge', 'history')
    const pat = /\[([^\]]*)\]\([^)]*experience\.md(#[^)]*)?\)/g
    let tot = 0
    let bare = 0
    const walk = (d: string): void => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name)
        if (e.isDirectory()) { walk(p); continue }
        if (!e.name.endsWith('.md')) continue
        for (const m of fs.readFileSync(p, 'utf8').matchAll(pat)) {
          tot++
          if (m[2] === undefined) bare++
        }
      }
    }
    walk(hist)
    console.log(`\n──────────\n  experience.md 的形狀\n──────────`)
    console.log(`教訓 ${lessons} 條｜${lines.length} 行`)
    console.log(`history → experience 的連結 ${tot} 條，其中沒有錨點的 ${bare} 條`)
    console.log(`  ⚠️ 沒有錨點【不一定】是缺陷：一句「四條教訓 → experience」指的是`)
    console.log(`     那個【檔案】，不是某一條——它本來就不該有錨點。`)
    console.log(`     2026-09-29 逐條判過：56 → 14，而剩下的 14 條全是那種複數反流指標。`)
    expect(tot, 'history 指不到 experience → 兩層之間斷了').toBeGreaterThan(20)
  })

  it('★ 注入：三種壞掉的標題都要被認出來', () => {
    for (const l of ['## 一條教訓的標題', '# ══ 分隔 ══', '## 補充']) {
      expect(/^#{1,2} /.test(l) && !ALLOWED_TOP.has(l.trim()), `認不出「${l}」`).toBe(true)
    }
    for (const l of ['### 一條教訓', '> 一段說明', '## 教訓']) {
      expect(/^#{1,2} /.test(l) && !ALLOWED_TOP.has(l.trim()), `誤報「${l}」`).toBe(false)
    }
  })
})
