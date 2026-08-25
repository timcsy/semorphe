/**
 * @vitest-environment happy-dom
 *
 * ⚠️ **預設環境是 `node`**（`vitest.config.ts`）——這個檔碰 DOM，所以顯式加回來。
 */
/**
 * **「宣告表達得出那個鍵」不等於「那個插槽真的會出現」。**
 *
 * ## 🔴 它問的是什麼
 *
 * 有一族積木的插槽是**依 `extraState` 開關的**：`a[i] += 2` 的
 * `cpp:var_assign_compound` 要多一格 `INDEX`，而 `a[i] += 2` 與 `a += 2`
 * 用的是**同一顆積木**。命令式那份用 `loadExtraState` 重建插槽做到它。
 *
 * 而宣告那側有 `extraStateFlags`——⚠️ **它只管渲染器要不要吐出
 * `extraState.hasIndex`，不管積木要不要長出那一格**。
 *
 * > **一個鍵存得下來，不代表有人會照著它把插槽建出來
 * > ——而兩者在第五維（extraState 的鍵）看起來一模一樣。**
 *
 * 🔴 這一維是 2026-08-25 加的，起因是要退 `cpp_increment` 時發現
 * **它的先例 `cpp_var_assign_compound` 可能在 spec 166 退場時就壞了**
 * ——那顆的宣告裡**沒有 `INDEX` 這格**。
 *
 * ## 🔴 自我否證
 *
 * > **如果「合成注入」那一段裡，一顆明明宣告了 `INDEX` 的積木也被報成
 * > 「沒有那一格」，代表探測寫錯了，不是世界長這樣。**
 *
 * ## 本護欄不檢測什麼
 *
 * - ❌ **不驗那一格接得對不對**（那是 lift／render 的事）
 * - ❌ **不驗載入之後的外觀**——只問「宣告裡表達得出這一格嗎」
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { allCppProjections } from '../../src/languages/cpp/all-declarations'
import { allComponentDefs } from '../helpers/component-scan'

interface Layout { args0?: { name?: string }[]; args1?: { name?: string }[]; args2?: { name?: string }[] }
interface Spec {
  blockDef?: Layout & { altLayout?: Layout }
  renderMapping?: { extraStateFlags?: Record<string, string>; inputs?: Record<string, string> }
}

let reg: BlockSpecRegistry

beforeAll(() => {
  reg = new BlockSpecRegistry()
  reg.loadFromSplit(allComponentDefs(), allCppProjections())
})

/**
 * 這份宣告表達得出哪些**具名的插槽／欄位**。
 *
 * ⚠️ **要把 `altLayout` 也算進來**——那一格正是「旗標為真時才出現」的佈局。
 * 🔴 只讀主佈局的話，這條護欄會指控一個**已經表達得出**的宣告
 * ——`retire-imperative-block` 第 2.5 步那條規矩的同一族（第六次）。
 */
function declaredNames(spec: Spec): Set<string> {
  const out = new Set<string>()
  const collect = (l?: Layout): void => {
    for (const key of ['args0', 'args1', 'args2'] as const) {
      for (const a of l?.[key] ?? []) if (a.name) out.add(a.name)
    }
  }
  collect(spec.blockDef)
  collect(spec.blockDef?.altLayout)
  return out
}

/**
 * 宣告了「這一格由 `extraState` 開關」而**那一格根本不在宣告裡**的。
 *
 * 🔴 判準：`extraStateFlags` 的值是一個接點名（`index`），
 * 而 `renderMapping.inputs` 說那個接點對到哪個插槽（`INDEX`）。
 * **那個插槽必須在宣告裡找得到。**
 */
export function slotlessFlags(specs: Spec[]): string[] {
  const bad: string[] = []
  for (const s of specs) {
    const flags = s.renderMapping?.extraStateFlags
    if (!flags) continue
    const names = declaredNames(s)
    for (const [flag, slot] of Object.entries(flags)) {
      const input = Object.entries(s.renderMapping?.inputs ?? {}).find(([, v]) => v === slot)?.[0]
      if (!input) continue                      // 那個接點沒有對到插槽——不是這一維的事
      if (!names.has(input)) bad.push(`${(s as { id?: string }).id ?? '?'} → ${flag} 要開 ${input}，而宣告裡沒有這一格`)
    }
  }
  return bad
}

describe('依 extraState 開關的插槽，宣告裡必須真的有那一格', () => {
  it('入口條件：真的有人用 `extraStateFlags`（否則下面在比空集合）', () => {
    const users = (reg.getAll() as Spec[]).filter((s) => s.renderMapping?.extraStateFlags)
    // ⚠️ 錨在**有幾顆用了這個機制**上——它不會因為缺陷被修好而變小。
    expect(users.length, '🔴 一顆都沒有＝登錄表沒載進來，或這個機制已經退場').toBeGreaterThan(0)
  })

  it('★ 注入①：宣告裡沒有那一格 → 必須被報出', () => {
    expect(slotlessFlags([{
      blockDef: { args0: [{ name: 'NAME' }, { name: 'VALUE' }] },
      renderMapping: { extraStateFlags: { hasIndex: 'index' }, inputs: { INDEX: 'index' } },
    } as Spec])).toHaveLength(1)
  })

  it('★ 注入②：宣告裡有那一格 → 不得被誤報', () => {
    // 🔴 自我否證錨在這裡：這一顆**明明宣告了 `INDEX`**，被報出來就是探測壞了。
    expect(slotlessFlags([{
      blockDef: { args0: [{ name: 'NAME' }, { name: 'INDEX' }, { name: 'VALUE' }] },
      renderMapping: { extraStateFlags: { hasIndex: 'index' }, inputs: { INDEX: 'index' } },
    } as Spec])).toEqual([])
  })

  it('★ 注入③：那一格在 `altLayout` 裡也算數——**它正是旗標要開的那一份**', () => {
    expect(slotlessFlags([{
      blockDef: {
        args0: [{ name: 'NAME' }, { name: 'VALUE' }],
        altLayout: { args0: [{ name: 'NAME' }, { name: 'INDEX' }, { name: 'VALUE' }] },
      },
      renderMapping: { extraStateFlags: { hasIndex: 'index' }, inputs: { INDEX: 'index' } },
    } as Spec])).toEqual([])
  })

  it('🔴 硬性零：每一顆用了 `extraStateFlags` 的，那一格都要在宣告裡', () => {
    expect(slotlessFlags(reg.getAll() as Spec[]),
      '🔴 這一格由 extraState 開關，而宣告裡根本沒有它——載入時那一格會安靜地消失')
      .toEqual([])
  })
})
