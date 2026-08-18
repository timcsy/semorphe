/**
 * 護欄：**伴生積木的宣告，接得上真的積木嗎。**
 *
 * ## 🔴 這條守的是「宣告了卻接不上」——而它會安靜地什麼都不做
 *
 * 伴生機制（使用者拉一顆接線積木 → `setup` 裡長出一顆 `pinMode`）靠一份宣告
 * 驅動：積木型別、欄位名、輸入名。⚠️ **任何一個名字打錯，UI 只會什麼都不長**
 * ——沒有錯誤、沒有紅字，使用者看到的是「這個功能有時候不會動」。
 *
 * > **一份宣告如果沒有人驗它接不接得上，它與一份被註解掉的宣告表現一致。**
 *
 * 專案記過同一個病的好幾個實例（`SAMPLE_CONTEXT` 的「脈絡有了、接不上」是第三、
 * 第四個）。這一條是**在宣告這一側**攔它。
 */
import { describe, it, expect } from 'vitest'
import { registeredComponents, componentBlocks } from '../../src/core/component/registry'
import type { CompanionSpec } from '../../src/core/component/companion-blocks'

interface BlockDefLike {
  type: string
  args0?: { name?: string; type?: string }[]
  /**
   * ⚠️ **`statement input` 住在 `args1`**（`message1` 那一行）——
   * 🔴 第一版只看 `args0`，於是把 `cpp_func_def` 的 `BODY` 判成不存在。
   * 那正是這支護欄要防的病的**鏡像**：檢查本身也會「看漏」。
   */
  args1?: { name?: string; type?: string }[]
  message0?: string
}

const specs = (): { owner: string; spec: CompanionSpec }[] =>
  registeredComponents()
    .map((c) => ({ owner: c.conceptId, spec: (c.manifest as { companion?: CompanionSpec }).companion }))
    .filter((x): x is { owner: string; spec: CompanionSpec } => x.spec !== undefined)

const defs = (): Map<string, BlockDefLike> =>
  new Map(
    (componentBlocks() as { blockDef: BlockDefLike }[]).map((b) => [b.blockDef.type, b.blockDef]),
  )

const argNames = (d: BlockDefLike | undefined): Set<string> =>
  new Set(
    [...(d?.args0 ?? []), ...(d?.args1 ?? [])]
      .map((a) => a.name)
      .filter((n): n is string => !!n),
  )

describe('護欄：伴生積木的宣告接得上', () => {
  it('⚠️ 入口條件：真的有人宣告了伴生積木（否則整支測試空過）', () => {
    expect(specs().length).toBeGreaterThan(0)
  })

  it('🔴 宣告裡提到的每一個【積木型別】都真的存在', () => {
    const d = defs()
    const missing: string[] = []
    for (const { owner, spec } of specs()) {
      for (const t of [
        spec.trigger,
        spec.companion,
        spec.bind.refBlock,
        spec.intoFunction.blockType,
        ...Object.values(spec.constants).map((k) => k.blockType),
      ]) {
        if (!d.has(t)) missing.push(`${owner} → ${t}`)
      }
    }
    expect(d.size, '一個積木定義都沒載到').toBeGreaterThan(50)   // ← 正向錨點
    expect(missing, `宣告了不存在的積木型別：${missing.join('、')}`).toEqual([])
  })

  it('🔴 宣告裡提到的每一個【欄位／輸入】都真的在那顆積木上', () => {
    const d = defs()
    const bad: string[] = []
    for (const { owner, spec } of specs()) {
      const check = (blockType: string, names: string[], what: string): void => {
        const names0 = argNames(d.get(blockType))
        for (const n of names) if (!names0.has(n)) bad.push(`${owner}: ${blockType} 沒有 ${what} ${n}`)
      }
      check(spec.trigger, [spec.bind.fromField], '欄位')
      check(spec.companion, [spec.bind.toInput, ...Object.keys(spec.constants)], '輸入')
      check(spec.bind.refBlock, [spec.bind.refField], '欄位')
      check(spec.intoFunction.blockType, [spec.intoFunction.nameField, spec.intoFunction.bodyInput], '欄位／輸入')
      for (const k of Object.values(spec.constants)) check(k.blockType, [k.field], '欄位')
    }
    // ← 正向錨點：先證明真的檢查到了東西
    expect(specs().flatMap((s) => Object.keys(s.spec.constants)).length).toBeGreaterThan(0)
    expect(bad, `接不上：${bad.join('、')}`).toEqual([])
  })

  it('🔴 常數積木的值必須在它自己宣告的可選值裡', () => {
    const d = defs()
    const bad: string[] = []
    for (const { owner, spec } of specs()) {
      for (const k of Object.values(spec.constants)) {
        const arg = (d.get(k.blockType)?.args0 ?? []).find((a) => a.name === k.field)
        const opts = (arg as { options?: [string, string][] } | undefined)?.options
        if (!opts) continue
        if (!opts.some(([, v]) => v === k.value)) {
          bad.push(`${owner}: ${k.blockType}.${k.field} 沒有 "${k.value}" 這個選項`)
        }
      }
    }
    expect(bad, `值不在選單裡：${bad.join('、')}`).toEqual([])
  })
})
