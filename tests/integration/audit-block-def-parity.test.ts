/**
 * spec 163：**兩份定義，逐項比對——比對得過的那份命令式才准刪。**
 *
 * ## 為什麼有這一支
 *
 * 33 顆積木**同時**有膠囊裡的 `blockDef` 與 `block-registrar` 裡的命令式定義。
 * 而命令式那份**沒有守衛**（`Blockly.Blocks['x'] = {...}` 直接賦值），
 * 宣告式那份有（`if (Blockly.Blocks[type]) continue`）且**先跑**
 * ——**於是今天每一顆都是命令式贏，宣告只是躺著。**
 *
 * `CLAUDE.md` 逐字點名過這個坑：
 *
 * > **雙重真相來源**：`universal.json` blockDef 和 `app.ts` 動態註冊定義相同積木的
 * > input names。修改任一方時**必須同步另一方**。
 *
 * 🎯 這一刀是把「必須同步」變成「**只有一份**」。
 *
 * ## ⚠️ 而刪之前必須先證明它們一樣
 *
 * `CLAUDE.md` 的第二條逐字：
 *
 * > **PatternRenderer fallback**：若 JSON 名稱錯誤，
 * > **只在 Block Style 切換（serialize→deserialize）時才暴露**。
 *
 * 所以這一支**建兩次積木、逐項比**：插槽名、欄位文字、output／statement、顏色。
 * **比對不過的不准刪**——而比對過的，刪掉才是安全的。
 */
import { describe, it, expect, beforeAll } from 'vitest'
import * as Blockly from 'blockly'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { allCppProjections } from '../../src/languages/cpp/all-declarations'
import { allComponentDefs } from '../helpers/component-scan'
import { componentLabels } from '../../src/core/component/labels'

/** 一顆積木「長什麼樣」的可比對摘要。 */
interface Shape {
  inputs: string[]
  fields: string[]
  output: unknown
  prev: boolean
  next: boolean
  colour: string
}

function shapeOf(b: Blockly.Block): Shape {
  return {
    inputs: b.inputList.map((i) => i.name).filter(Boolean),
    fields: b.inputList.flatMap((i) => i.fieldRow.map((f) => (f.getText?.() ?? ''))).filter(Boolean),
    output: b.outputConnection ? (b.outputConnection.getCheck() ?? true) : null,
    prev: Boolean(b.previousConnection),
    next: Boolean(b.nextConnection),
    colour: b.getColour(),
  }
}

let reg: BlockSpecRegistry
let ws: Blockly.Workspace

beforeAll(() => {
  // 🔴 **先把標籤載進 `Blockly.Msg`**——`jsonInit` 會把 `%{BKY_X}` 展開成訊息文字，
  // 而**訊息沒載入時它展不開**，於是「訊息裡沒有 %1」→ 一堆假的失敗。
  // ⚠️ 第一版沒載，11 顆裡有 8 顆報 `Message does not reference all N args`
  // ——**看起來像宣告不完整，其實是測試環境少了一步**。
  Object.assign(Blockly.Msg as Record<string, string>, componentLabels('zh-TW'))
  reg = new BlockSpecRegistry()
  reg.loadFromSplit(allComponentDefs(), allCppProjections())
  ws = new Blockly.Workspace()
})

/** 用膠囊的 `blockDef` 建一顆（`jsonInit` 那條路）。 */
function fromDeclaration(type: string): Shape | null {
  const spec = reg.getByBlockType(type) as { blockDef?: Record<string, unknown> } | undefined
  const def = spec?.blockDef
  if (!def || !def.message0) return null
  const probe = `__decl_${type}`
  Blockly.Blocks[probe] = { init: function (this: Blockly.Block) { (this as unknown as { jsonInit: (d: unknown) => void }).jsonInit({ ...def, type: probe }) } }
  const b = ws.newBlock(probe)
  const s = shapeOf(b)
  b.dispose(false)
  delete Blockly.Blocks[probe]
  return s
}

describe('spec 163 · 宣告與命令式，逐項比對', () => {
  it('★ 錨點：登錄表真的載到了（否則下面在比空集合）', () => {
    expect(reg.getAll().length, '零筆 → 是載入壞了').toBeGreaterThan(100)
  })

  /**
   * 🎯 **本體：命令式與宣告式，逐項比。**
   *
   * ⚠️ 這一支跑 `BlockRegistrar.registerAll()` ——**第一支真的跑它的測試**
   * （在此之前所有 `block-registrar` 的測試都只掃檔案文字）。
   */
  it('🎯 報表：命令式定義的積木，宣告式建得出【一樣的形狀】嗎', async () => {
    const { BlockRegistrar, setLanguageInputNames } = await import('../../src/ui/block-registrar')
    const n = await import('../../src/languages/cpp/block-input-names')
    setLanguageInputNames({
      compoundAssign: n.C_COMPOUND_ASSIGN_INPUTS, compoundAssignExpr: n.C_COMPOUND_ASSIGN_EXPR_INPUTS,
      varDeclareExpr: n.C_VAR_DECLARE_EXPR_INPUTS, ifBlock: n.IF_INPUTS, whileBlock: n.WHILE_INPUTS,
      countLoop: n.COUNT_LOOP_INPUTS, funcDef: n.FUNDEF_INPUTS, returnBlock: n.RETURN_INPUTS,
      arrayAccess: n.ARRAY_ACCESS_INPUTS, arrayAssign: n.ARRAY_ASSIGN_INPUTS, varAssign: n.VAR_ASSIGN_INPUTS,
    })
    // 🔴 先把宣告式的都建起來（`registerAll` 會先跑 `registerBlocksFromSpecs`）
    const declared = new Map<string, Shape>()
    for (const s of reg.getAll() as { blockDef?: { type?: string } }[]) {
      const t = s.blockDef?.type
      if (!t) continue
      try { const sh = fromDeclaration(t); if (sh) declared.set(t, sh) } catch { /* 建不起來 */ }
    }

    new BlockRegistrar(reg).registerAll({ getWorkspace: () => ws })

    // 🔴 **只比【真的有命令式定義】的那群。**
    //
    // ⚠️ 第一版比了全部 229 顆，報「207 顆一模一樣」——**而那是灌水的**：
    // 其中 200 多顆根本不在 `block-registrar` 裡，`Blockly.Blocks[t]` 就是
    // 宣告式自己建的那顆，**等於拿它跟自己比**。
    //
    // > **一個把「沒有對照組」也算進「一致」的比對，數字會漂亮而且沒有意義。**
    //
    // 這裡用檔案掃描**挑出母體**（那是選擇，不是判斷）——
    // 判斷仍然是**真的建兩次積木逐項比**。
    const fs = await import('node:fs/promises')
    const pathMod = await import('node:path')
    const regSrc = await fs.readFile(pathMod.resolve(process.cwd(), 'src/ui/block-registrar.ts'), 'utf8')
    const imperativeTypes = new Set([...regSrc.matchAll(/Blockly\.Blocks\['((?:cpp|u)_[a-z_0-9]+)'\] = \{/g)].map((m) => m[1]))
    expect(imperativeTypes.size, '命令式母體是空的 → 掃描壞了，不是清乾淨了').toBeGreaterThan(20)

    const same: string[] = []
    const differ: { t: string; why: string }[] = []
    for (const [t, d] of declared) {
      if (!Blockly.Blocks[t]) continue
      if (!imperativeTypes.has(t)) continue
      let imp: Shape
      try { const b = ws.newBlock(t); imp = shapeOf(b); b.dispose(false) } catch { continue }
      const diffs: string[] = []
      if (imp.inputs.join(',') !== d.inputs.join(',')) diffs.push(`插槽 ${imp.inputs.join(',')} vs ${d.inputs.join(',')}`)
      if (imp.fields.join(',') !== d.fields.join(',')) diffs.push(`欄位 ${imp.fields.join(',')} vs ${d.fields.join(',')}`)
      if (String(imp.output) !== String(d.output)) diffs.push(`output ${imp.output} vs ${d.output}`)
      if (imp.prev !== d.prev || imp.next !== d.next) diffs.push(`statement ${imp.prev}/${imp.next} vs ${d.prev}/${d.next}`)
      if (imp.colour !== d.colour) diffs.push(`顏色 ${imp.colour} vs ${d.colour}`)
      if (diffs.length === 0) same.push(t)
      else differ.push({ t, why: diffs.join(' ｜ ') })
    }
    // eslint-disable-next-line no-console
    console.log(`\n  🟢 一模一樣（可刪）${same.length} 顆：\n    ${same.join(' ')}\n`
      + `  🔴 有差異（不准刪）${differ.length} 顆：\n`
      + differ.map((x) => `    ${x.t}\n      ${x.why}`).join('\n'))
    expect(same.length + differ.length, '一顆都沒比到 → registerAll 沒跑起來').toBeGreaterThan(10)

    // 🔴 **棘輪：差異只准下降。**
    //
    // 這 19 筆**每一筆都是一個真的落差**——宣告與命令式對同一顆積木說了不同的話，
    // 而**今天使用者看到的是命令式那份**（它沒有守衛、後跑、直接覆寫）。
    //
    // ⚠️ 所以每一筆都有兩種可能，而**要逐筆判**：
    // ```
    // 宣告寫錯了     → 修宣告（多數是這種：標籤字不同、少了 nextStatement）
    // 命令式才是對的  → 那顆的形狀宣告表達不完，留著並寫下理由
    // ```
    // 🔴 **不准用「把宣告改成跟命令式一樣」來刷數字**——那是在假設命令式是對的，
    // 而其中有幾筆（`cpp_break` 少了 `nextStatement`）**命令式才是錯的**。
    const baseline = JSON.parse(await fs.readFile(
      pathMod.resolve(process.cwd(), 'tests/baselines/block-def-parity.json'), 'utf8')) as { differ: number }
    expect(differ.length,
      '⚠️ 宣告與命令式的落差變多了 → 有人改了一邊沒改另一邊，'
      + '而使用者看到的是命令式那份（CLAUDE.md 的「雙重真相來源」）')
      .toBeLessThanOrEqual(baseline.differ)
  })

  it('★ 報表：哪些積木的宣告【建得起來】', () => {
    const buildable: string[] = []
    const noDecl: string[] = []
    for (const s of reg.getAll() as { blockDef?: { type?: string; message0?: string } }[]) {
      const t = s.blockDef?.type
      if (!t) continue
      if (!s.blockDef?.message0) { noDecl.push(t); continue }
      try { if (fromDeclaration(t)) buildable.push(t) } catch { noDecl.push(t + '(建不起來)') }
    }
    // eslint-disable-next-line no-console
    console.log(`\n  宣告建得起來 ${buildable.length} 顆｜沒有 message0 或建不起來 ${noDecl.length} 顆`)
    expect(buildable.length, '一顆都建不起來 → 是 jsonInit 那條路壞了').toBeGreaterThan(50)
  })
})
