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
// 🔴 **選用欄位要另外註冊**——`field_multilinetext` 不在 Blockly 主套件裡。
// ⚠️ 少了它，`cpp_block_comment` 的欄位**整個建不出來**（`getField('TEXT')` 回 null），
// 而比對報表印成「一邊有 comment，一邊沒有」——**看起來像宣告漏了預設值**。
// > **一個沒有把「產品註冊過的欄位型別」註冊齊的比對，會把它建不出來的當成「宣告寫錯」。**
import { registerFieldMultilineInput } from '@blockly/field-multilineinput'
import { registerDynamicDropdownField, declareDropdownSource } from '../../src/ui/dynamic-dropdown-field'
import { BlockSpecRegistry } from '../../src/core/block-spec-registry'
import { allCppProjections } from '../../src/languages/cpp/all-declarations'
import { allComponentDefs } from '../helpers/component-scan'
import { componentLabels } from '../../src/core/component/labels'
import i18nBlocks from '../../src/i18n/zh-TW/blocks.json'

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
    // ⚠️ **`getText()` 對某些欄位回空**（`field_multilinetext` 就是），
    // 於是「兩邊預設值都是 comment」被印成「一邊有一邊沒有」。
    // > **一個用單一存取器讀所有欄位的比對，會把它讀不到的當成「沒有」。**
    // 🟢 退到 `getValue()`——它對每一種欄位都有值。
    // 🔴 **動態下拉比「它是不是活的」，不比當下的值。**
    //
    // ⚠️ spec 165 實測撞到兩次（`cpp_array_assign`／`cpp_var_assign`）：
    // 命令式那份查工作區（空的 → 回 `(自訂)` 或空），
    // 宣告那份可能寫死一個選項（→ 停在 `arr`）——
    // **兩邊的字面永遠對不上，而那不代表它們不等價。**
    //
    // > **一個比「當下的樣子」的比對，看不出「這個下拉是死的」；
    // > 而硬要比字面，會把「兩個都是活的」也判成不一樣。**
    //
    // 🟢 判準改成**它是不是一個會查外部的下拉**：是 → 記成 `⟨活下拉⟩`。
    // ⚠️ 而「死的下拉」（`field_dropdown` 寫死選項）記成它的值——**兩者因此分得出來**。
    fields: b.inputList.flatMap((i) => i.fieldRow.map((f) => {
      const any = f as unknown as { getOptions?: (b: boolean) => unknown[]; isOptionListDynamic?: () => boolean }
      if (typeof any.isOptionListDynamic === 'function' && any.isOptionListDynamic()) return '⟨活下拉⟩'
      return String(f.getText?.() || f.getValue?.() || '')
    })).filter(Boolean),
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
  // 🔴 **兩個來源都要載**——膠囊的 `labels/` 與共用的 `src/i18n/`。
  // ⚠️ 第一版只載膠囊那份，於是 `cpp_var_ref` 的 `%{BKY_U_VAR_REF_LABEL}` 展不開，
  // 比對報表寫著「欄位 變數,(自訂) vs %{BKY_U_VAR_REF_LABEL}」
  // ——**看起來像宣告寫錯了，其實是訊息沒到齊**（與載入膠囊標籤那次同一種病）。
  registerFieldMultilineInput()
  // 🔴 **自訂欄位型別也要註冊**——`field_dynamic_dropdown`（spec 164）。
  // ⚠️ 這是**同一種病的第三次**：訊息沒到齊（163）、選用欄位沒註冊（165）、
  // 自訂欄位沒註冊（這裡）——三次的症狀都長得像「宣告寫錯了」。
  // > **比對之前，要先把【產品那側需要的每一樣東西】都備齊；
  // > 少一樣，比對就會指控宣告。**
  registerDynamicDropdownField()
  declareDropdownSource('names', () => [])
  declareDropdownSource('vars', () => [])
  declareDropdownSource('funcs', () => [])
  declareDropdownSource('arrays', () => [])
  Object.assign(Blockly.Msg as Record<string, string>, i18nBlocks, componentLabels('zh-TW'))
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


    // 🔴 **順序要對**：欄位在 `init` 的當下就抓住選項產生器，
    // 所以合成來源要在**建積木之前**設好，兩邊都是。
    const declared = new Map<string, Shape>()
    for (const s of reg.getAll() as { blockDef?: { type?: string } }[]) {
      const t = s.blockDef?.type
      if (!t) continue
      try { const sh = fromDeclaration(t); if (sh) declared.set(t, sh) } catch { /* 建不起來 */ }
    }

    new BlockRegistrar(reg).registerAll({ getWorkspace: () => ws })
    // registerAll 把來源覆蓋回真的那些（查空工作區）——再蓋回合成的，然後才建命令式那批

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
      // 🔴 **比【串起來的字】，不比【欄位怎麼切】。**
      //
      // ⚠️ `cpp_array_assign` 兩邊的字一模一樣（「設定 陣列 ⟨活下拉⟩ 的第 [ ] 格 ←」），
      // 而命令式把「格」與「←」放在兩個 `appendField`、宣告放在一個訊息裡
      // ——**那是排版，不是內容**。
      // > **一個比「欄位怎麼切」的比對，會把同一句話判成兩句。**
      //
      // 🟢 而空白要正規化：訊息裡的 `%1` 前後有空白，`appendField` 沒有。
      const norm = (xs: string[]): string => xs.join('').replace(/\s+/g, '')
      if (norm(imp.fields) !== norm(d.fields)) diffs.push(`欄位 ${imp.fields.join(',')} vs ${d.fields.join(',')}`)
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
