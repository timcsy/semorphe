/**
 * **第四十九條護欄：每條護欄都要被證明過會說話**
 *
 * ## 錨點與注入不是同一件事，不能互相代替
 *
 * ```
 * 錨點   問「我有沒有吃到東西」        → 防【空語料】
 * 注入   問「我的偵測器認得出違規嗎」  → 防【壞掉的偵測器】
 * ```
 *
 * 一條讀了 500 個檔、而正則寫錯的護欄——**錨點會過，違規計數永遠 0，全綠**。
 * 這個專案有過那個形狀：`textIn` 不是合法的 constraint 鍵，而它被**靜默忽略**。
 *
 * 2026-08-21 量：九條護欄沒有注入，其中**六條是掃描型**，包括
 * `audit-locality`——**膠囊化整個階段的驗收依據，而它從沒被證明過會說話**。
 *
 * ## ⚠️ 而「每支護欄都要有注入」是一個錯的規則
 *
 * 注入防的是「偵測器空過」，而空過只可能發生在**掃描／數數型**護欄上
 * （結論是「有幾筆違規」，而 0 筆與「什麼都沒掃到」長得一樣）。
 *
 * **案例型**護欄不一樣：`it('int* ptr = &x → cpp_pointer_declare')` 這種，
 * 每一支的斷言都是**正向**的（`toBe(1)`、`toBeGreaterThan(0)`）——
 * lift 回 null 就直接紅，**它不可能空過**。要求它「加一支注入」是儀式。
 *
 * > **一條規則如果對它涵蓋的一半對象是儀式，那一半就會被敷衍，
 * > 而敷衍的樣子與遵守長得一樣。**
 *
 * 所以這條護欄的判準是「掃描型必須有注入」，而**案例型要具名豁免並附理由**。
 *
 * ## ⚠️ 為什麼要求注入寫在【本檔】
 *
 * `syntax-coupling` 的注入寫在 `tests/unit/helpers/syntax-tokens.test.ts`（十二支），
 * 而那是合理的——純函式在它自己的地方測。但它有一個代價：
 *
 * > **打開那支護欄的人看不到它被證明過。**
 *
 * 而「看不到」正是這一整條護欄要治的東西。所以規則是本檔要有一支，
 * 哪怕它只釘住「護欄 → 掃描器」這個接縫；helper 那邊的十二支照樣值得留。
 *
 * ## ⚠️ 自我否證聲明
 *
 * > **如果「注入」那一節合成的假違規（一支沒有注入的掃描型護欄）沒有被報出來，
 * > 代表這條護欄壞了，不是大家都有寫。**
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT } from '../helpers/guardrail'

/**
 * **案例型**護欄——每支斷言一個具體的正向結果，不可能空過。
 * ⚠️ 豁免要具名附理由（`history/018`：靠規則順便放過＝用宣告刷數字）。
 */
const exemptions: { file: string; why: string }[] = [
  {
    file: 'audit-component-identity.test.ts',
    why: '案例型：每支都走 `assertComponentPresent`，它先 `expect(sem).not.toBeNull()` 再 `toBeGreaterThan(0)`——lift 壞掉直接紅，空過不了。',
  },
  {
    file: 'audit-ptr-components.test.ts',
    why: '案例型：每支都 `expect(ptrs.length).toBe(1)` 並逐項比對 properties。正向斷言即錨。',
  },
  {
    file: 'audit-cin-fail-state.test.ts',
    why: '案例型 ＋ 外部 oracle：每條都跟參照編譯器對答案，而「參照輸出不得是空的」是它的錨。合成注入答不出「g++ 到底怎麼做」，那正是這條護欄存在的理由。',
  },
  {
    file: 'audit-corpus-asserted.test.ts',
    why: '它自己就是 meta 護欄，注入寫在裡面（★ 注入①②③），只是不叫這個名字——這一筆是為了避免兩條 meta 護欄互相要求對方。',
  },
]

/** 一支護欄是不是「掃描／數數型」——結論是「有幾筆」，於是 0 筆會空過。 */
function isScanning(src: string): boolean {
  // 掃檔案、走登錄表、或與基線比數字——三者任一即是
  return /listSourceFiles|readdirSync|loadBaseline|assertRatchet|assertCorpus/.test(src)
}

/**
 * ⚠️ **這個樣式我第一版寫太窄**（只認 `★ 注入`），於是十支**有**注入的護欄
 * 被報成沒有——其中最常見的寫法是 `★ 合成注入`。
 *
 * > **一個偵測器如果只認得自己作者的用字，它量的是文風不是事實。**
 *
 * 🔴 而它的錯誤方向值得記：這次是**過度報**，所以我當場就看見了。
 * 反過來（樣式太寬）會**漏報**，而漏報的樣子與「大家都有寫」一模一樣。
 * 所以放寬到「標題含『注入』」為止——**`對照組`（負向的那一半）不算**，
 * 因為只有對照組的護欄還是沒有證明過它會說話。
 */
const hasInjection = (src: string): boolean => /it\(\s*['"`][^'"`]*注入/.test(src)

/**
 * **提前跳出的注入**——比「沒有注入」更糟，因為它不會變紅。
 *
 * 🔴 實例（`audit-identity-namespace`，2026-08-21 找到）：
 *
 * ```ts
 * it('★ 注入一處舊格式引用 → **必須被計入**', () => {
 *   const old = [...allIdentities].filter((id) => !isNamespaced(id))
 *   if (old.length === 0) return   // ← 遷移完成後這一支自然不適用
 *   …
 * })
 * ```
 *
 * 遷移完成的那天，這支注入**無條件通過**，而它看起來與健康的一模一樣。
 *
 * > **一支錨在缺陷上的斷言，會在成功那天【變紅】——吵，但看得見。
 * > 一支在缺陷消失時【return】的注入，會在成功那天變成空的——安靜，看不見。**
 *
 * 第三十五條（`anchor-rot`）看的是前者。這一維看後者。
 *
 * 判準：`it` 的標題含「注入」，而 body 裡**第一個 `expect` 之前**有一句
 * **行首的 `return` 敘述**（允許 `if (…) return` 這種單行形式）。
 *
 * ⚠️ **這個判準收了三次，每一次都是誤報**：
 *
 * | 版本 | 誤報來源 |
 * |---|---|
 * | `\breturn\b` | 注入素材裡的 C++ 片段 `int main(){ … return 0; }` ＋ 這份 JSDoc 自己的範例 |
 * | ＋跳過註解、要求行首 | 合成實作物件裡的 `return true`（`audit-storage-integrity`） |
 * | ＋要求**恰好四格縮排** | ✅ 測試本體的敘述在四格，巢狀函式裡的在八格 |
 *
 * > **一個在原始碼上做語意判斷的正則，必須先分得出【程式】與【資料】，
 * > 然後還要分得出【這一層】與【裡面那一層】。**
 *
 * 🔴 而三次收緊都是往**變窄**的方向——那個方向的錯誤會**漏報**，
 * 而漏報的樣子與「大家都沒犯」一模一樣。所以下面三支注入把兩個方向都釘住。
 */
export function earlyReturnInjections(src: string): string[] {
  const out: string[] = []
  const re = /it\(\s*['"`]([^'"`]*注入[^'"`]*)['"`]\s*,\s*(?:async\s*)?\(\)\s*=>\s*\{/g
  for (let m = re.exec(src); m !== null; m = re.exec(src)) {
    // 取到這支 it 的結尾：往後找第一個「行首兩格 `})`」
    const from = m.index + m[0].length
    const end = src.indexOf('\n  })', from)
    const body = src.slice(from, end === -1 ? src.length : end)
    const firstExpect = body.indexOf('expect(')
    const head = firstExpect === -1 ? body : body.slice(0, firstExpect)
    // 恰好四格＝`it` 本體這一層（`  it(` 在兩格）。八格是巢狀函式裡的，不算。
    const early = head.split('\n').some((l) => /^ {4}(return\b|if\s*\(.*\)\s*return\b)/.test(l))
    if (early) out.push(m[1])
  }
  return out
}

interface row { file: string; scanning: boolean; injected: boolean }

function survey(read: (f: string) => string = (f) => fs.readFileSync(f, 'utf8')): row[] {
  const dir = path.join(REPO_ROOT, 'tests/integration')
  return fs
    .readdirSync(dir)
    .filter((f) => f.startsWith('audit-') && f.endsWith('.test.ts'))
    .map((f) => {
      const src = read(path.join(dir, f))
      return { file: f, scanning: isScanning(src), injected: hasInjection(src) }
    })
}

/** 掃描型而沒有注入的——豁免的除外。 */
function unproven(rows: readonly row[]): string[] {
  const exempt = new Set(exemptions.map((x) => x.file))
  return rows.filter((r) => r.scanning && !r.injected && !exempt.has(r.file)).map((r) => r.file)
}

describe('第四十九條護欄：每條護欄都要被證明過會說話', () => {
  it('★ 健康檢查：真的掃到護欄檔了', () => {
    const rows = survey()
    expect(rows.length, '一支 audit 護欄都沒找到 → 掃描器壞了').toBeGreaterThan(40)
    expect(rows.filter((r) => r.scanning).length, '一支掃描型都認不出來 → 分類器壞了').toBeGreaterThan(10)
    expect(rows.filter((r) => r.injected).length, '一支有注入的都認不出來 → 偵測器壞了').toBeGreaterThan(10)
  })

  it('★ 注入①：掃描型而沒有注入的【必須】被報出', () => {
    expect(unproven([{ file: 'fake.test.ts', scanning: true, injected: false }])).toEqual(['fake.test.ts'])
  })

  it('★ 注入②：有注入的、與案例型的，都不得被誤報', () => {
    expect(unproven([{ file: 'fake.test.ts', scanning: true, injected: true }])).toEqual([])
    expect(unproven([{ file: 'fake.test.ts', scanning: false, injected: false }])).toEqual([])
  })

  it('★ 注入③：分類器要認得出掃描型的三種寫法，而純案例型不得被誤判', () => {
    expect(isScanning("const files = listSourceFiles('src')")).toBe(true)
    expect(isScanning("const b = loadBaseline<X>('g')")).toBe(true)
    expect(isScanning('assertRatchet([[…]])')).toBe(true)
    expect(isScanning("const sem = liftCode('int x;'); expect(sem).not.toBeNull()")).toBe(false)
  })

  it('每個豁免都要有理由，而且指向真的存在的檔', () => {
    const dir = path.join(REPO_ROOT, 'tests/integration')
    for (const e of exemptions) {
      expect(e.why.length, `${e.file} 的豁免沒有理由——「懶得寫」與「不需要」長得一樣`).toBeGreaterThan(20)
      expect(fs.existsSync(path.join(dir, e.file)), `豁免指向不存在的檔：${e.file}`).toBe(true)
    }
  })

  it('★ 豁免不得涵蓋掃描型——那會把真的漏洞放過去', () => {
    const rows = survey()
    const wrong = exemptions
      .filter((e) => rows.find((r) => r.file === e.file)?.scanning === true)
      .filter((e) => !rows.find((r) => r.file === e.file)?.injected)
      .map((e) => e.file)
    expect(
      wrong,
      '這些被豁免的其實是掃描型（會空過）——豁免的理由寫錯了，或那支護欄變了形',
    ).toEqual([])
  })

  it('★ 注入④：在第一個 expect 之前 return 的注入【必須】被報出', () => {
    const bad = [
      "  it('★ 注入①：壞的會報', () => {",
      '    const old = list.filter(x => !ok(x))',
      '    if (old.length === 0) return',
      "    expect(detect(old[0])).toBe(1)",
      '  })',
    ].join('\n')
    expect(earlyReturnInjections(bad)).toEqual(['★ 注入①：壞的會報'])
  })

  it('★ 注入⑤：`expect` 之後才 return 的不得被誤報', () => {
    const ok = [
      "  it('★ 注入：壞的會報', () => {",
      '    expect(detect(合成)).toBe(1)',
      '    return',
      '  })',
    ].join('\n')
    expect(earlyReturnInjections(ok)).toEqual([])
  })

  it('★ 注入⑥：合成實作【裡面】的 return 不得被誤報', () => {
    const nested = [
      "  it('★ 注入：壞的實作要被報出', () => {",
      '    const broken = {',
      '      save(s) {',
      '        return true',
      '      },',
      '    }',
      '    expect(measure(broken)).toHaveLength(1)',
      '  })',
    ].join('\n')
    expect(earlyReturnInjections(nested)).toEqual([])
  })

  it('注入不得在缺陷消失時提前跳出（硬性零）', () => {
    const dir = path.join(REPO_ROOT, 'tests/integration')
    const bad = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith('audit-') && f.endsWith('.test.ts'))
      .flatMap((f) => earlyReturnInjections(fs.readFileSync(path.join(dir, f), 'utf8')).map((t) => `${f} → ${t}`))
    expect(
      bad,
      '這些注入在缺陷消失時就 `return`——**成功那天它們變成空的，而且不會變紅**。' +
        '修法：改用合成素材（見 audit-anchor-rot 的 `zz:合成的假身分`），' +
        '或者那條規則已經結構性成立了，就把整支退休並記一筆\n  ' +
        bad.join('\n  '),
    ).toEqual([])
  })

  it('每支掃描型護欄都必須有注入測試（硬性零）', () => {
    const missing = unproven(survey())
    expect(
      missing,
      '這些護欄會掃東西、會數數，而**沒有人證明過它的偵測器認得出違規**。' +
        '偵測器壞掉時它們全綠。修法：加一支 `it(\'★ 注入…\')`，' +
        '把合成的假違規餵進偵測函式（見 audit-locality 的 `overLimit`）\n  ' +
        missing.join('\n  '),
    ).toEqual([])
  })
})
