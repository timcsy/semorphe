/**
 * **護欄：降級會不會把學生的格子弄丟。**
 *
 * ## 🔴 它從哪來（2026-09-18，瀏覽器驗收抓到）
 *
 * 一顆元件如果**宣告了抽象父**，而它**不在某一軌的課程清單裡**，
 * `downgradeComponentsForLevel` 會把它換成那個父——那是漸進揭露的設計。
 *
 * 而如果它比父**多幾格**，那幾格就沒有地方放：
 *
 * ```cpp
 * auto[pt, d] = BFS.front();      在沒有收這顆的那一軌 →  int x;
 * ```
 *
 * **兩個名字沒了，而畫面上那一行看起來只是「一個很普通的宣告」。**
 *
 * ⚠️ 而它**不是「不在課程清單就會降級」的通則**：`cpp:container_find`／
 * `cpp:container_iter` 同樣只在進階那一軌的清單裡，而它們在初級軌
 * **畫得出來**——因為它們**沒有宣告抽象父**。
 *
 * > **降級只咬得到「宣告了自己屬於誰」的那些元件
 * > ——而那正是最該被完整保留的那些（它們有更多格）。**
 *
 * ## ⚠️ 這條護欄量的是「暴露」，不是「已經壞掉」
 *
 * 一筆命中只有在**學生真的在那一軌寫出那個概念**時才會發作。
 * 所以 `c-beginner` 上的 C++ 容器是**合理的**（C 沒有它們），
 * 而 `cpp-beginner` 上的硬體元件也是。
 *
 * 🔴 **棘輪盯的是總數**：它只准下降。新增一顆「有父、掉格子、又漏了某一軌」的
 * 元件時，這條會指名它——而那正是 2026-09-18 那一次**測試全綠而使用者一看就發現**的形狀。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { printReport, loadBaseline, writeBaseline, assertRatchet, assertCorpus } from '../helpers/guardrail'

const ROOT = process.cwd()
const GUARD = 'silent-downgrade'

interface Manifest {
  componentId: string
  abstractComponent?: string | null
  properties?: { name: string }[]
  slots?: Record<string, unknown>
  children?: Record<string, unknown>
}

/** 每一顆膠囊的宣告。 */
function manifests(): Map<string, Manifest> {
  const out = new Map<string, Manifest>()
  const base = path.join(ROOT, 'src/components')
  for (const scope of readdirSync(base)) {
    const dir = path.join(base, scope)
    // ⚠️ `src/components/` 底下有一個 `README.md`——掃目錄要先問它是不是目錄。
    if (!statSync(dir).isDirectory()) continue
    for (const name of readdirSync(dir)) {
      const f = path.join(dir, name, 'component.json')
      if (!existsSync(f)) continue
      const d = JSON.parse(readFileSync(f, 'utf8')) as Manifest
      out.set(d.componentId, d)
    }
  }
  return out
}

/** 一顆元件有哪些「格子」——屬性 ＋ 接點。 */
function cells(m: Manifest): Set<string> {
  return new Set([
    ...(m.properties ?? []).map((p) => p.name),
    ...Object.keys(m.slots ?? m.children ?? {}),
  ])
}

/** 每一軌的課程清單收了哪些元件。 */
function tracks(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  const langs = path.join(ROOT, 'src/languages')
  for (const lang of readdirSync(langs)) {
    const dir = path.join(langs, lang, 'topics')
    if (!existsSync(dir)) continue
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.json')) continue
      // 🪦 2026-09-20 之前這裡走的是 `levelTree` 那棵樹——它退場之後清單是平的。
      const d = JSON.parse(readFileSync(path.join(dir, file), 'utf8')) as { components?: string[] }
      out.set(file, new Set(d.components ?? []))
    }
  }
  return out
}

interface Finding { component: string; parent: string; track: string; lost: string[] }

function scan(): { findings: Finding[]; scanned: { components: number; tracks: number } } {
  const ms = manifests()
  const ts = tracks()
  const findings: Finding[] = []
  for (const [id, m] of ms) {
    const parentId = m.abstractComponent
    if (!parentId) continue
    const parent = ms.get(parentId)
    if (!parent) continue // 父不存在由 `abstract-integrity` 那條管
    const lost = [...cells(m)].filter((c) => !cells(parent).has(c)).sort()
    if (lost.length === 0) continue
    for (const [track, set] of ts) {
      if (set.has(parentId) && !set.has(id)) findings.push({ component: id, parent: parentId, track, lost })
    }
  }
  findings.sort((a, b) => `${a.component}${a.track}`.localeCompare(`${b.component}${b.track}`))
  return { findings, scanned: { components: ms.size, tracks: ts.size } }
}

describe('護欄：降級會不會把學生的格子弄丟', () => {
  /**
   * ⚠️ **入口條件**——少了它，一個「什麼都掃不到」的實作也會全綠，
   * 而那與「一個問題都沒有」長得一模一樣。
   */
  it('★ 入口條件：真的掃到元件與課程清單了', () => {
    const { scanned } = scan()
    expect(scanned.components, '🔴 一顆元件都沒掃到 → 量測壞了，不是世界長這樣').toBeGreaterThan(100)
    expect(scanned.tracks, '🔴 一軌課程清單都沒掃到').toBeGreaterThan(2)
  })

  /**
   * ⚠️ **注入**：判準認得出「有父、多格子、而某一軌只收了父」這個形狀嗎。
   */
  it('★ 注入：判準認得出那個形狀', () => {
    const ms = manifests()
    // 找一顆真的有父又有多餘格子的，確認它的「掉的格子」算得出來
    const withParent = [...ms.values()].filter((m) => {
      const p = m.abstractComponent ? ms.get(m.abstractComponent) : undefined
      return p && [...cells(m)].some((c) => !cells(p).has(c))
    })
    expect(withParent.length, '🔴 一顆「比父多格子」的元件都找不到 → 判準沒有在算東西').toBeGreaterThan(3)
  })

  it('棘輪：會掉格子的降級只准下降', () => {
    const { findings, scanned } = scan()
    printReport('降級會不會把格子弄丟', [
      `掃描   ${scanned.components} 顆元件｜${scanned.tracks} 軌課程清單`,
      `暴露   ${findings.length} 筆（棘輪）`,
      '⚠️ 一筆只有在【學生真的在那一軌寫出那個概念】時才會發作',
      ...findings.slice(0, 30).map((f) => `  ${f.component} 在 ${f.track} 會掉 ${f.lost.join('、')}`),
    ])

    if (!existsSync(path.join(ROOT, 'tests/baselines', `${GUARD}.json`))) {
      writeBaseline(GUARD, {
        _meta: {
          note: '有抽象父、比父多格子、而某一軌只收了父——那一軌上這顆會被降級，多的格子沒有地方放。',
          ratchet: '數字只准下降。調整此檔即為顯式下調，須在 commit 訊息說明原因。',
        },
        scanned,
        exposure: findings.length,
        details: findings.map((f) => `${f.component}@${f.track}: ${f.lost.join(',')}`),
      })
      return
    }
    const base = loadBaseline<{ scanned: { components: number; tracks: number }; exposure: number }>(GUARD)
    assertCorpus([
      ['掃描的元件數', scanned.components, base.scanned.components],
      ['掃描的課程清單數', scanned.tracks, base.scanned.tracks],
    ])
    assertRatchet([['會掉格子的降級', findings.length, base.exposure]])
  })
})
