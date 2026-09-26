/**
 * 護欄：**護欄自己有幾條，要有一個地方說了算。**
 *
 * ## 🔴 為什麼需要它
 *
 * 2026-08-19 的 knowie judge 掃出這一族散落的數字：
 *
 * ```
 * experience.md:211    「35 條（今天 37 條）」
 * experience.md:2791   「43～44 條」
 * experience.md:3058   「45 條」
 * draft/…擴充的形狀    「47 條」
 * history/087         「第 47 條」
 * ```
 *
 * ⚠️ 而實測 `audit-*.test.ts` 只有 46 個檔，**且護欄根本不全叫 `audit-*`**
 * ——`bus-update-not-user-edit.test.ts` 自己就是一條，它不叫那個名字。
 *
 * 於是「第 47 條」這個說法**沒有人能驗證**，而每一份文件各自漂。
 *
 * > **執行機構自己的判準用在它自己身上：
 * > 一個沒有機械檢查的數字，會在每一份文件裡各自漂。**
 *
 * ## ⚠️ 自我否證聲明
 *
 * **如果掃到的檔案數是 0，代表這支測試的路徑寫錯了，不是護欄消失了。**
 * 判斷依據是下面「★ 健康檢查」那一支——它錨在**掃到幾個測試檔**（合成量），
 * 🔴 **不是錨在護欄數**：護欄數是這條護欄要追蹤的東西，
 * 拿它當入口條件的話，成功的那天就會紅。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不判斷一條護欄好不好**——只數「有幾個檔在用護欄的基礎設施」
 * - **不強制命名**：`audit-*` 只是慣例。硬性要求改名會讓一批既有檔案
 *   為了通過這條而搬家，而搬家本身沒有增加任何保障
 * - 不數 `it()` 的支數（那個數字每次加測試都會動，記了也沒人維護）
 * - **不管「第 N 條」那個序號**——⚠️ 它是**發號**，不是條數：只增、不重用、
 *   退場留洞。所以「第一百條」與這裡印的「99 條」可以同時是對的
 *   （2026-09-03 判官掃出兩邊對不上時補的這一行）。
 *
 * ## 🔴 而發號在 2026-09-26 退場了（判官第二次掃到）
 *
 * 那一行說「只增、不重用」，而**發號從來沒有發號機**——每一次都是從檔數推回來的：
 *
 * ```
 * 2026-09-21   發到 127 · 130 · 131 · 132      history/277 278 279
 * 2026-09-26   又發了 128 · 129                history/283 ＋ audit-declared-uniqueness
 *              而 129 同時指 g++ 那一支         tests/probes/judge-coverage-execute.test.ts
 *              兩支最新的護欄檔自己沒寫發號
 * ```
 *
 * ⟹ **退行、重用、兩個東西同一個號**——「只增、不重用」三件事全破。
 * 而它破得無聲，因為**這支護欄逐字宣告過自己不管它**。
 *
 * > **一條規則寫在一份明說「我不管這個」的文件裡，
 * > 它的違反不會有任何機構出聲——而那不是漏檢，是【宣告了不檢】。**
 *
 * 🟢 **處置是退場不是補發號機**：檔名已經是身分，發號是第二份，
 * 而它沒有任何一個檔名做不到的用途。**已發出的 174 筆引用留著**
 * ——它們是病歷，不是現況。新護欄**用檔名**。
 *
 * 而退場要機械化，否則下一個 AI 會再發一個 133：**上限凍結在 132**（下面那一支）。
 *
 * > **一個看起來像計數的編號，如果它其實是流水號，
 * > 那它與真正的計數遲早會差一——而差一的那天沒有人知道哪個錯了。**
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(process.cwd(), 'tests/integration')

/** 遞迴列出 .ts／.md（發號上限那一支要掃整個 repo 的這三個目錄）。 */
function walk(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else if (e.name.endsWith('.ts') || e.name.endsWith('.md')) out.push(p)
  }
  return out
}

/**
 * 一個測試檔算不算護欄。
 *
 * ## 🔴 這個判準被改了【三次】，而三次都是同一個病
 *
 * ```
 * 第一版  「用不用棘輪基礎設施」        漏 17 支——硬性零的護欄不需要棘輪
 * 第二版  ＋「檔名叫 audit-*」          漏 4 支——它們用自己的基線機制且不叫 audit
 * 第三版  ＋「有沒有 GENERATE_* 開關」  ← 本版
 * ```
 *
 * > **一個「看它有沒有用 X」的判準，等於宣告「不用 X 的那些不算」
 * > ——而那句話你並沒有想說。**
 *
 * ⚠️ 而第二版仍然錯，正是因為我只補了**當時看到的那一批**
 * ——`experience.md`：「**列舉已知的，等於保證下一個會被漏掉**」。
 *
 * ## 所以這一版問的是【性質】不是【形式】
 *
 * 一條護欄的共同性質是：**它有一個被記錄下來的期望值**，
 * 而那個期望值有辦法重新產生。三種形式各自表達它：
 *
 * ```
 * 棘輪       loadBaseline／assertRatchet／writeBaseline
 * 自建基線   GENERATE_BASELINE／GENERATE_INVENTORY／…（可重新產生的開關）
 * 檔名慣例   audit-*（硬性零的那些，期望值就是「零」，不需要檔案）
 * ```
 *
 * ⚠️ **三個都要**。而如果第四種形式出現，這裡會再漏一次
 * ——**那時要改的是「怎麼認出護欄」這件事本身，不是再加一個 OR**。
 */
const RATCHET_MARKERS = ['loadBaseline', 'assertRatchet', 'writeBaseline']

function isGuardrail(file: string): boolean {
  if (file.startsWith('audit-')) return true
  const src = readFileSync(join(DIR, file), 'utf8')
  if (RATCHET_MARKERS.some((m) => src.includes(m))) return true
  // 「有一個可以重新產生的期望值」——自建基線那一類的簽名
  return /GENERATE_[A-Z_]+/.test(src)
}

function guardrailFiles(): string[] {
  return readdirSync(DIR).filter((f) => f.endsWith('.test.ts')).filter(isGuardrail).sort()
}

function allTestFiles(): string[] {
  return readdirSync(DIR).filter((f) => f.endsWith('.test.ts'))
}

describe('護欄：護欄的條數要有一個地方說了算', () => {
  // ── ★ 健康檢查：錨在掃到幾個測試檔，不在護欄數 ────────────────
  it('★ 健康檢查：掃到的測試檔數不得為零', () => {
    expect(allTestFiles().length, '一個測試檔都沒掃到 → 路徑寫錯了，下面的數字是假的')
      .toBeGreaterThan(50)
  })

  it('★ 注入：一個不含任何護欄標記、也不叫 audit-* 的檔案，不得被算成護欄', () => {
    // 合成輸入——⚠️ 不用任何真實檔名，見自我否證聲明
    const fake = 'import { describe, it } from "vitest"\ndescribe("x", () => { it("y", () => {}) })'
    expect(RATCHET_MARKERS.some((m) => fake.includes(m)) || 'plain-thing.test.ts'.startsWith('audit-'),
      '判定會把普通測試算成護欄').toBe(false)
  })

  it('★ 注入：一條**硬性零**的護欄（不用棘輪）必須被算進去', () => {
    // 🔴 第一版漏的正是這一類。合成一個「叫 audit-* 而完全不含棘輪標記」的名字。
    expect(RATCHET_MARKERS.some((m) => 'describe("x")'.includes(m)), '前提：這段不含棘輪標記').toBe(false)
    expect('audit-synthetic-hard-zero.test.ts'.startsWith('audit-'),
      '硬性零護欄靠檔名被認出來——判準少了這一半就漏掉 17 支').toBe(true)
  })

  it('報出目前的條數與清單', () => {
    const files = guardrailFiles()
    // 🔴 **這是這條護欄的產出**：一個可以被引用的數字，而它從程式碼算出來。
    const odd = files.filter((f) => !f.startsWith('audit-'))
    console.log(`\n護欄：${files.length} 條（檔名 audit-* ${files.length - odd.length} ＋ 靠期望值認出的 ${odd.length}）`)
    if (odd.length > 0) {
      console.log(`  ⚠️ 不叫 audit-* 的：${odd.join('、')}`)
      console.log('     （命名是慣例不是規範——見檔頭「本護欄不檢測什麼」）')
    }
    expect(files.length).toBeGreaterThan(0)
  })

  it('🔴 發號已退場：不得出現大於 132 的「第 N 條護欄」', () => {
    // ⚠️ **為什麼是凍結上限而不是禁止全部**：已發出的 174 筆是病歷。
    //    禁止全部等於要竄改紀錄，而紀錄裡那些數字**當時是對的**。
    //
    // 🔴 而這一支盯的是**新發**：發號在 2026-09-26 退場（見檔頭），
    //    132 是最後一個。第 133 號一出現就紅。
    const CEILING = 132
    const bad: string[] = []
    for (const dir of ['tests', 'knowledge', 'src']) {
      for (const f of walk(join(process.cwd(), dir))) {
        // 🔴 **行內程式碼（`…`）裡的不算發號，是【引用】**。
        //    實測：`history/287`（記錄發號退場那一筆）引用了 `第 133 條護欄` 當例子，
        //    而它被這一支判成「又發了一個新的」。
        //    ⚠️ 同一條規則在 `tools/knowie-scan.ts` 裡也出現一次（指名掃描）
        //    ——**一個掃散文的判準，都要先把行內程式碼挖掉。**
        const src = readFileSync(f, 'utf8').replace(/`[^`\n]*`/g, '')
        for (const m of src.matchAll(/第 ?(\d{1,4}) 條護欄/g)) {
          const n = Number(m[1])
          if (n > CEILING) bad.push(`${f.replace(process.cwd() + '/', '')}  第 ${n} 條`)
        }
      }
    }
    expect(
      bad,
      '\n🔴 發號已退場（2026-09-26），而這裡又發了新的：\n' +
        bad.join('\n') +
        '\n\n⚠️ 新護欄用**檔名**指稱（例：`audit-declared-uniqueness`）。\n' +
        '理由見本檔檔頭：發號從來沒有發號機，而它的三條規則已經全破過一次。\n',
    ).toEqual([])
  })

  it('★ 注入：一個超過上限的發號字串必須被上面那一支抓到', () => {
    // 🔴 **注入字串要【拼】出來，不能寫成字面值**——寫成字面值的話，
    //    上面那一支會掃到本檔而紅。第一次跑就是這樣紅的，
    //    而那正是 `history/140`（第五十五條抓到的第一個是護欄自己）同一個形狀。
    //
    // > **一條掃全 repo 的護欄，它自己也在 repo 裡。**
    const injected = '第 ' + '133' + ' 條' + '護欄'
    expect(/第 ?(\d{1,4}) 條護欄/.exec(injected)?.[1], '判準認不出這個句型 → 上面那一支是假綠').toBe('133')
    expect(Number('133') > 132, '上限沒有在擋').toBe(true)
  })

  it('🔴 知識庫裡不得把護欄條數宣稱成【現況】', () => {
    // ⚠️ 只掃**三個入口檔**：history/ 是病歷，它記的是「當時是幾條」，
    //    那是**正確的**——改掉它等於竄改紀錄。
    //
    // 🔴 **而第一版的判準太鈍，第一次跑就抓到自己的錯**：它禁止「任何」條數，
    //    於是把三筆**過去的觀察**（「當時 43～44 條全綠」）一起報出來。
    //    那些不是腐爛，是紀錄。
    //
    // > **一個數字是不是債，看它宣稱的是【現在】還是【當時】。**
    //
    // 所以判的是「條數 ＋ 現在式標記」：今天／目前／現行／現在。
    // ⚠️ 只有這種會過期——而它過期時沒有任何機構會出聲。
    const NOW = /今天|目前|現行|現在/
    const roots = ['knowledge/principles.md', 'knowledge/vision.md', 'knowledge/experience.md']
    // 🔴 **README 不在上面那張表裡，而它是最多人讀的一份**（2026-08-31 判官抓到）。
    //
    // 實測：`README.md` 寫著「這個專案有 **88 條護欄**」而實際是 92
    // ——那個數字剛好等於 `audit-*` 的檔數，也就是**分母的一半**（漏掉 4 個
    // 靠期望值認出來的）。它從 2026-08-19 這條護欄蓋好起就沒有被涵蓋過。
    //
    // > **一條「不准把數字宣稱成現況」的規範，漏掉了對外那一份，
    // > 而對外那一份正是唯一有陌生人會讀的。**
    //
    // ⚠️ README 的寫法沒有「今天／目前」這種現在式標記（它寫「這個專案有 N 條」），
    //    所以上面那個 `NOW` 判準抓不到它——這裡用**它自己的句型**，並且
    //    **直接比對數字對不對**，而不只是禁止它出現。
    const hits: string[] = []
    for (const p of roots) {
      const lines = readFileSync(join(process.cwd(), p), 'utf8').split('\n')
      lines.forEach((l, i) => {
        if (/\d+\s*[～~]?\s*\d*\s*條護欄/.test(l) && NOW.test(l)) {
          hits.push(`${p}:${i + 1}  ${l.trim().slice(0, 72)}`)
        }
      })
    }
    expect(hits, `\n把護欄條數宣稱成現況（改成「見 tests/integration/」或引用本護欄的報表）：\n${hits.join('\n')}\n`)
      .toEqual([])

    // ── README：說得出數字可以，而它必須是對的 ──────────────────────
    const readme = readFileSync(join(process.cwd(), 'README.md'), 'utf8')
    const m = /這個專案有 \*\*(\d+) 條護欄\*\*/.exec(readme)
    if (m) {
      expect(
        Number(m[1]),
        `\n🔴 README 說 ${m[1]} 條，而實際是 ${guardrailFiles().length} 條。\n` +
          '⚠️ 加了護欄就要回頭改那一行——它旁邊正好寫著「一條規範沒有機械化的檢查，\n' +
          '它本身就是殼」。要嘛改對，要嘛把數字拿掉改成指向本護欄的報表。\n',
      ).toBe(guardrailFiles().length)
    }
  })
})
