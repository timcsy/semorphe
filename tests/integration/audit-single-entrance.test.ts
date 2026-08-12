/**
 * 第二十條護欄：**唯一入口不得被繞過**
 *
 * ## 自我否證聲明（⚠️ 寫在量測邏輯之前）
 *
 * > **如果這條護欄回報零違規，而下面合成注入的一行「繞過唯一入口的 import」
 * > 沒有被報出來，代表護欄壞了，不是入口乾淨。**
 *
 * 錨點是**合成的一行原始碼**，不是真實世界的檔案清單——真實世界的繞過遲早會被
 * 遷移掉，而錨在它上面的聲明會在那一天變成叫人不要相信一個正確的結果。
 *
 * ## 為什麼需要這一條
 *
 * 2026-08-07：工具箱歸屬改用 `owner` 比對，而 `owner` 是在**組裝處**蓋的章。
 * 我建了 `src/blocks/universal.ts` 當蓋章的唯一入口，**卻只把測試路徑改過去**——
 * `app.ts` 與 `module.ts` 仍然 `import` 原始 JSON。
 *
 * 於是每個 `(universal)` 段落在正式路徑上回傳零筆：
 * **通用積木整批從工具箱消失，學生的起始關卡只剩兩個分類、沒有任何 statement 積木。**
 *
 * **而全套 222 檔全綠**，因為測試走的是蓋過章的那一份。是使用者截圖發現的。
 *
 * 事後量：**還有 21 個測試檔**握著同一扇舊門。所以那不是一次手滑，是系統性的。
 *
 * > **建了「唯一真相」之後，第一個動作是讓舊路徑無法通行，不是改測試。**
 * > 舊路徑還走得通 ＝「唯一」那句話是假的，而它會安靜地假下去。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不檢測「入口本身對不對」**——它只保證大家走同一扇門。門後面錯了，
 *   全體一起錯（而那是好事：至少會有人發現）。
 * - **不檢測用檔案路徑讀取的程式碼**（`fs.readFileSync(...json)`）。那類多半是
 *   **檢查檔案本身**的工具（`verify-concept-paths`、「concepts.json 不得含 blockDef」），
 *   它們要的就是原始檔，不是載入後的狀態。**只擋 `import`。**
 * - **不檢測其他唯一真相機制的採用率**（`block-input-names`、`abstractConcept`…）
 *   ——那是 `audit-annotation-adoption` 與就近性的事。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { listSourceFiles, printReport, REPO_ROOT } from '../helpers/guardrail'

/**
 * 一個「唯一入口」：某份資料只准從 `entrance` 拿，不准直接 import `forbidden` 裡的檔。
 *
 * 加一條規則就是加一列——**不是加一個外掛系統**。
 */
interface Entrance {
  name: string
  /** 唯一入口的模組路徑（repo 相對，不含副檔名） */
  entrance: string
  /** 被它封裝的原始檔（比對 import 字串的結尾） */
  forbidden: string[]
  /** 為什麼繞過它會靜靜地壞掉 */
  why: string
}

const ENTRANCES: Entrance[] = [
  {
    name: '通用概念與積木投影',
    // ⚠️ 路徑在 2026-08-12（spec 117）搬過：`src/blocks/` → `src/languages/`。
    // **檔頭那段敘述沒有跟著改**——它描述的是 2026-08-07 當時的世界，
    // 而那個世界裡入口確實在 `src/blocks/`。
    // （`experience.md`「一次改名要問兩件事：哪些要改，以及**哪些因為描述過去而不能改**」）
    entrance: 'src/core/universal.ts',
    // 同樣串接寫——這個常數本身若寫成完整字面，護欄會報自己（見下方合成注入的註解）
    forbidden: ['core/universal-' + 'concepts.json', 'core/universal-' + 'blocks.json'],
    why:
      '`owner` 是在這個入口蓋的章，而工具箱靠它比對來源段落。繞過去拿到的是**沒蓋章**的資料，' +
      '於是每個 `(universal)` 段落回傳零筆——**不會有錯誤，只會有空的分類**。',
  },
]

/** 只看 `import ... from '...'`／`require('...')`，不看字串路徑（見檔頭「不檢測什麼」） */
const IMPORT_RE = /(?:from|require\()\s*['"]([^'"]+)['"]/g

function importsOf(source: string): string[] {
  return [...source.matchAll(IMPORT_RE)].map((m) => m[1])
}

interface Violation {
  file: string
  imported: string
  entrance: string
}

function scan(extra: { file: string; source: string }[] = []): Violation[] {
  const files: { file: string; source: string }[] = [
    ...['src', 'tests'].flatMap((d) =>
      listSourceFiles(d, ['.ts']).map((rel) => ({
        file: rel,
        source: fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'),
      })),
    ),
    ...extra,
  ]

  const out: Violation[] = []
  for (const { file, source } of files) {
    for (const e of ENTRANCES) {
      if (file === e.entrance) continue // 入口自己當然要 import 它封裝的東西
      for (const imp of importsOf(source)) {
        if (e.forbidden.some((f) => imp.endsWith(f))) {
          out.push({ file, imported: imp, entrance: e.entrance })
        }
      }
    }
  }
  return out.sort((a, b) => a.file.localeCompare(b.file))
}

// ─── 自我驗證：兩個方向都要釘 ─────────────────────────────────────

describe('自我驗證：這條護欄真的量得到東西', () => {
  // ⚠️ **合成輸入裡的路徑刻意用串接寫**，不寫成完整字面。
  //
  // 第一次跑的時候，這條護欄**報了它自己**——注入用的字串就在它的原始碼裡，
  // 而它掃的是原始碼。串接之後那串路徑不再連續出現，於是**排除清單維持在零**。
  //
  // 用「把自己加進排除清單」來解會比較快，但那會在唯一一個負責看門的檔上開一個口。
  // ⚠️ 這個合成路徑要跟著 `ENTRANCES[0].forbidden` 走（2026-08-12 搬過家）。
  // 它與那個常數**不是同一份**，所以搬家時會落單——而落單的症狀是
  // 「注入沒被報出」，看起來像護欄壞了。
  const forbiddenPaths = '../../core/universal-' + 'blocks.json'

  it('★ 注入一行繞過唯一入口的 import → **必須被報出**', () => {
    const hit = scan([
      { file: '合成/繞過.ts', source: `import x from '${forbiddenPaths}'\n` },
    ]).filter((v) => v.file === '合成/繞過.ts')
    expect(hit, '合成的繞過沒有被報出來 → **護欄壞了，不是入口乾淨**').toHaveLength(1)
    expect(hit[0].entrance, '報出來了但指錯入口——修的人會去改錯的地方').toBe('src/core/universal.ts')
  })

  it('★ 注入一行**走唯一入口**的 import → **必須不被報出**', () => {
    // 沒有這一支的話，一個「什麼都報」的掃描器也能通過上一支。
    const hit = scan([
      { file: '合成/正確.ts', source: "import { universalBlocks } from '../../src/core/universal'\n" },
    ]).filter((v) => v.file === '合成/正確.ts')
    expect(hit, '走正門的 import 被報成違規 → 這條護欄會亂叫，而亂叫的護欄很快就被忽略').toEqual([])
  })

  it('★ 注入一個**用檔案路徑讀取**的用法 → **必須不被報出**', () => {
    // 檔頭寫明只擋 import。`verify-concept-paths` 與「concepts.json 不得含 blockDef」
    // 那類工具要的就是原始檔——把它們也擋掉會逼人繞過護欄。
    const hit = scan([
      { file: '合成/讀檔.ts', source: `const p = path.join(root, '${forbiddenPaths}')\n` },
    ]).filter((v) => v.file === '合成/讀檔.ts')
    expect(hit, '字串路徑被當成 import 擋下 → 檔案檢查工具會無法運作').toEqual([])
  })

  it('★ 掃描器有真的掃到東西（第 10 步）', () => {
    // 零違規與「一個檔都沒讀到」產出一模一樣。
    const readValue = ['src', 'tests'].reduce((n, d) => n + listSourceFiles(d, ['.ts']).length, 0)
    expect(readValue, '零個原始檔 → 是掃描壞了，不是專案空了').toBeGreaterThan(200)
  })

  it('★ 入口檔本身存在——它不存在的話這條規則整條是空的', () => {
    for (const e of ENTRANCES) {
      expect(fs.existsSync(path.join(REPO_ROOT, e.entrance)), `唯一入口 ${e.entrance} 不存在`).toBe(true)
    }
  })
})

// ─── 本體 ──────────────────────────────────────────────────────────

describe('唯一入口護欄', () => {
  const violations = scan()

  it('報表', () => {
    printReport('唯一入口', [
      ...ENTRANCES.map((e) => `  ${e.name}：${e.entrance}`),
      '',
      `繞過的 import：${violations.length}`,
      ...violations.map((v) => `  ✘ ${v.file} → ${v.imported}`),
    ])
    expect(true).toBe(true)
  })

  it('★ 沒有任何檔繞過唯一入口', () => {
    // ⚠️ **這裡刻意用硬性零，不用棘輪。**
    //
    // 棘輪的用途是「大量既有違規，慢慢還」。這一條不一樣：舊路徑只要還走得通，
    // 「唯一」那句話就是假的，而下一次有人接上新機制時**還會漏掉同一批檔**。
    // 已經一次遷完 24 個檔，沒有理由再開一個口。
    expect(
      violations.map((v) => `${v.file} → ${v.imported}`),
      ENTRANCES.map((e) => `【${e.name}】${e.why}`).join('\n'),
    ).toEqual([])
  })
})
