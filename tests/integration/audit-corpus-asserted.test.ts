/**
 * **第四十八條護欄：分母要有人看**——基線記了「我掃了多少」，就必須斷言它。
 *
 * ## 它防的是什麼
 *
 * 一條護欄失效的方式**不是說錯話，是輸入悄悄乾掉**。而 2026-08-21 量了一次：
 *
 * ```
 * 記了掃描／語料規模的基線      9 條
 * 有斷言那個數字的              0 條（four-independences 只有下限 `> 20`）
 * ```
 *
 * 裝上語料棘輪之後，**八條當場紅**，而且全部是「變大」：
 *
 * ```
 * anchor-rot          護欄檔數 35 → 54      真實身分數 176 → 257
 * shared-file-husks   共用檔   157 → 217    export     359 → 513
 * declaration-assembly 測試檔  256 → 345
 * declared-props      語料段   416 → 456    節點      9324 → 9961
 * projection-residual 完整段   488 → 515    殘缺段     378 → 487
 * silent-fallback     掃描檔   176 → 244    return    127 → 163
 * ```
 *
 * 沒有一條是壞的。而**沒有一條的基線是準的**，有些差了 46%。
 * 那些數字被記下來的用途正是「掃描規模不得悄悄改變」，而它們悄悄改變了幾個月。
 *
 * > **一個記在基線裡而不被斷言的數字，是一個看起來有人在看的數字。**
 *
 * ## 為什麼要一條 meta 護欄，而不是「記得加就好」
 *
 * 因為九條裡有八條沒加。**「記得」在這件事上的實測成功率是 1/9。**
 * 而下一條記了 `scanned` 卻不斷言它的護欄，會與這八條一樣安靜。
 *
 * ## ⚠️ 自我否證聲明（寫在量測邏輯之前）
 *
 * > **如果「注入」那一節合成的假違規（一份記了 `scanned` 而護欄沒有
 * > `assertCorpus` 的組合）沒有被報出來，代表這條護欄壞了，不是大家都乖。**
 *
 * 錨在合成輸入上，不錨在「今天違規有幾條」——後者正是這條要推向零的東西
 * （`build-guardrail` 第 2 步）。
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT } from '../helpers/guardrail'

/** 一個基線的鍵長得像「我掃了多少」嗎——**只認這三個**，不做模糊比對。 */
const SIZE_KEYS = ['scanned', 'corpus', 'totals'] as const

/**
 * ⚠️ **豁免要具名附理由**（`history/018`：靠路徑規則順便放過＝用宣告刷數字）。
 * 今天一筆都沒有。加一筆之前先問：**這個分母縮水的話，會有別的東西出聲嗎？**
 */
const exemptions: { guard: string; why: string }[] = []

interface pair { guard: string; sizeKeys: string[]; testFile: string | null }

/** 找出每個基線的「規模欄」，以及哪支護欄擁有它。 */
function survey(): pair[] {
  const baselineDir = path.join(REPO_ROOT, 'tests/baselines')
  const auditFiles = fs
    .readdirSync(path.join(REPO_ROOT, 'tests/integration'))
    .filter((f) => f.startsWith('audit-') && f.endsWith('.test.ts'))
    .map((f) => path.join(REPO_ROOT, 'tests/integration', f))

  const out: pair[] = []
  for (const f of fs.readdirSync(baselineDir).filter((x) => x.endsWith('.json'))) {
    const guard = f.slice(0, -5)
    const b = JSON.parse(fs.readFileSync(path.join(baselineDir, f), 'utf8')) as unknown
    if (typeof b !== 'object' || b === null || Array.isArray(b)) continue
    const sizeKeys = SIZE_KEYS.filter((k) => {
      const v = (b as Record<string, unknown>)[k]
      return typeof v === 'object' && v !== null && !Array.isArray(v)
    })
    if (sizeKeys.length === 0) continue
    // 擁有者＝原始碼裡出現這個護欄名字的那支 audit 測試
    const owner = auditFiles.find((a) => fs.readFileSync(a, 'utf8').includes(`'${guard}'`)) ?? null
    out.push({ guard, sizeKeys, testFile: owner })
  }
  return out
}

/** 判斷一支護欄有沒有斷言它的分母。**與 survey 分開，注入才餵得進來。** */
function unasserted(pairs: readonly pair[], read: (f: string) => string): string[] {
  const exempt = new Set(exemptions.map((x) => x.guard))
  return pairs
    .filter((p) => !exempt.has(p.guard))
    .filter((p) => p.testFile === null || !read(p.testFile).includes('assertCorpus('))
    .map((p) => `${p.guard}（記了 ${p.sizeKeys.join('/')}）${p.testFile === null ? ' ← 找不到擁有它的護欄' : ''}`)
}

describe('第四十八條護欄：分母要有人看', () => {
  it('★ 健康檢查：真的掃到基線與護欄檔了', () => {
    const pairs = survey()
    expect(pairs.length, '一個記了規模欄的基線都沒找到 → 掃描器壞了').toBeGreaterThan(5)
    expect(
      pairs.filter((p) => p.testFile !== null).length,
      '每個規模欄都找不到擁有者 → 擁有者的比對方式壞了',
    ).toBeGreaterThan(5)
  })

  it('★ 注入①：記了 scanned 而沒有 assertCorpus 的組合【必須】被報出', () => {
    const fake: pair[] = [{ guard: 'fake-guard', sizeKeys: ['scanned'], testFile: '/fake.ts' }]
    expect(unasserted(fake, () => 'assertRatchet([[…]])')).toEqual([
      'fake-guard（記了 scanned）',
    ])
  })

  it('★ 注入②：有 assertCorpus 的不得被誤報', () => {
    const fake: pair[] = [{ guard: 'fake-guard', sizeKeys: ['corpus'], testFile: '/fake.ts' }]
    expect(unasserted(fake, () => 'assertCorpus([[…]])')).toEqual([])
  })

  it('★ 注入③：找不到擁有者也算違規——一個沒有人在跑的基線更糟', () => {
    const fake: pair[] = [{ guard: 'orphan', sizeKeys: ['totals'], testFile: null }]
    expect(unasserted(fake, () => '')).toEqual(['orphan（記了 totals） ← 找不到擁有它的護欄'])
  })

  it('每個記了掃描／語料規模的基線，其護欄都必須斷言它（硬性零）', () => {
    const missing = unasserted(survey(), (f) => fs.readFileSync(f, 'utf8'))
    expect(
      missing,
      '這些護欄記了「我掃了多少」而沒有人看那個數字——' +
        '它們的語料乾掉時會全綠。修法：呼叫 `assertCorpus`（見 tests/helpers/guardrail.ts）\n  ' +
        missing.join('\n  '),
    ).toEqual([])
  })
})
