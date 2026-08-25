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
import { attachBranchList } from '../../src/ui/branch-list-block'
import { attachParamList } from '../../src/ui/param-list-block'
import { attachAltLayout } from '../../src/ui/alt-layout-block'
import { attachVariadic, defineVariadicBlock } from '../../src/ui/variadic-block'
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

/**
 * 🔴 **命令式那顆的 `saveExtraState` 會吐出哪些鍵。**
 *
 * ## 為什麼要這一維
 *
 * spec 165 裡 `cpp_raw_code` 的比對報告「一模一樣，可刪」——**而它不能刪**：
 * `loadExtraState` 會依 `degradationCause` 換顏色與 tooltip。
 *
 * ⚠️ **而我發現它的方式是 `tsc` 抱怨那個常數變成未用的 import**——不是護欄告訴我的。
 *
 * > **一次靠運氣攔下的迴歸，下一次不會有那個運氣。**
 *
 * ## 為什麼讀函式的原始碼，而不是呼叫它
 *
 * 剛建好的積木多半吐出**空的** extraState（`hasIndex_` 是 false、`unresolved_` 是
 * undefined），**於是呼叫它什麼也量不到**。而它**會**吐出什麼是寫在函式裡的。
 *
 * 🟢 `fn.toString()` 讀的是**執行期真的註冊的那個函式**——不是掃檔案文字，
 * 所以那段程式碼搬家不會讓這條失效（`component-rename` 第 6 步的教訓）。
 */
function extraStateKeys(def: Record<string, unknown> | undefined): string[] {
  // ⚠️ **包裝過的要拆回原本那一份**（2026-08-23）：`preserveForeignExtraState`
  //    在每顆有 mutation 的積木外面包了一層（讓別人的鍵原樣帶著走），
  //    而**一個包裝函式的原始碼裡一個鍵都沒有**——不拆的話這一維會整個瞎掉。
  //    🔴 那正是這條護欄下面那一則在盯的事。
  const raw = def?.saveExtraState as { __semorpheInner?: unknown } | undefined
  const fn = (raw?.__semorpheInner ?? raw) as unknown
  if (typeof fn !== 'function') return []
  const src = String(fn)
  const keys = new Set<string>()
  for (const m of src.matchAll(/return\s*\{\s*([a-zA-Z_][\w]*)\s*:/g)) keys.add(m[1])
  for (const m of src.matchAll(/state\.([a-zA-Z_][\w]*)\s*=/g)) keys.add(m[1])
  return [...keys].sort()
}

/** 宣告**表達得出**哪些 extraState 鍵。 */
function declarableKeys(spec: unknown): string[] {
  const sp = spec as {
    renderMapping?: { dynamicRules?: { countSource?: string }[]; extraStateFlags?: Record<string, string> }
    blockDef?: Record<string, unknown>
  }
  const rm = sp?.renderMapping
  const keys = new Set<string>()
  for (const r of rm?.dynamicRules ?? []) if (r.countSource) keys.add(r.countSource)
  for (const k of Object.keys(rm?.extraStateFlags ?? {})) keys.add(k)
  // 🔴 **宣告式建構子自己就存得住那些鍵**（2026-08-24）——`branchList` 實作了
  //    `save/loadExtraState`，鍵與命令式那份**一字不差**（那是刻意的，見
  //    `branch-list-block.ts` 的檔頭）。不算進來的話，一顆已經表達得出的積木
  //    會永遠掛在「宣告表達不出」那一欄——**而那是比對器在說謊**。
  const def = sp?.blockDef
  if (def?.branchList) { keys.add('elseifCount'); keys.add('hasElse') }
  if (def?.paramList) keys.add('paramCount')
  // ⚠️ **要用它【實際會用】的那個鍵**，不是兩個都加。
  //    🔴 兩個都加 = 這一維變成「超集合檢查」，於是
  //    「命令式存 `argCount`、建構子存 `itemCount`」被判成一模一樣
  //    ——而使用者看到的是**一片空白的工作區**（2026-08-24 開瀏覽器撞到）。
  if (def?.builder === 'variadic') keys.add((def.countKey as string) ?? 'itemCount')
  return [...keys].sort()
}

/** 一顆積木「長什麼樣」的可比對摘要。 */
interface Shape {
  /**
   * 🔴 **2026-08-24 補的第六維：`inputsInline`。**
   *
   * 那天 `cpp_func_def` 的宣告漏了它，而護欄說「一模一樣」——因為它**沒在看**。
   * 症狀是每一格參數各佔一列（命令式是一整列），**而測試全綠**，
   * 開瀏覽器才看得到。
   *
   * > **一個維度沒有被記進 shape，它的差異就不存在——而不是不重要。**
   */
  inline: boolean
  inputs: string[]
  fields: string[]
  output: unknown
  prev: boolean
  next: boolean
  colour: string
}

function shapeOf(b: Blockly.Block): Shape {
  return {
    // ⚠️ Blockly 的預設是 `null`（自動）——`!== false` 讀成「不是明確關掉」
    inline: (b as unknown as { inputsInline?: boolean }).inputsInline === true,
    // ⚠️ **空的啞插槽不算數**（2026-08-24）：沒有欄位、也沒有接點的那一列
    //    **使用者看不到、序列化也不留它**——它是實作細節。
    //    🔴 實例：命令式的函式定義**永遠**建一個 `PARAMS_LABEL`（`（參數` 那幾個字
    //    是有參數時才加上去的），而宣告式的建構子是有參數時才建那一列。
    //    兩邊在畫面上一模一樣，而不正規化的話它們永遠比不平
    //    ——於是那顆命令式定義**退不了場**。
    //
    // > **比對要比「使用者看得到的」與「存檔留得住的」；
    // > 一個兩者皆非的東西，比它只會擋路。**
    //
    // ⚠️ 而**有欄位的那些一格都不會被吃掉**（`LABEL`／`TAIL` 都有欄位），
    //    所以這一條漏不掉「宣告少了一列」那種真差異。
    inputs: b.inputList
      .filter((i) => i.fieldRow.length > 0 || i.connection !== null)
      .map((i) => i.name).filter(Boolean),
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
/** 上一支比對建起來的宣告——讓「載入時的狀態」那支指名得出母體。 */
const declaredCache = new Map<string, Shape>()

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
  // 🔴 **語言套件宣告的來源也要備齊**（2026-08-24，第四次同一種病）。
  //    這四個是「工作區長出來的」（核心宣告），而型別清單是**語言的**
  //    ——它住在 `languages/cpp/pack.ts`。少了它，用那個下拉的積木
  //    **建不起來 → 從比對母體裡消失**：報表上既不是「一模一樣」也不是「有差異」，
  //    **它就只是不見了**，而那比誤報更難發現。
  //
  // > **一個從母體裡消失的項目，看起來與「沒有問題」一模一樣。**
  declareDropdownSource('cpp_param_types', () => [['int', 'int']])
  declareDropdownSource('cpp_return_types', () => [['void', 'void']])
  Object.assign(Blockly.Msg as Record<string, string>, i18nBlocks, componentLabels('zh-TW'))
  reg = new BlockSpecRegistry()
  reg.loadFromSplit(allComponentDefs(), allCppProjections())
  ws = new Blockly.Workspace()
})

/**
 * 用膠囊的 `blockDef` 建一顆——**走產品那條路，不是只有 `jsonInit`**。
 *
 * 🔴 **2026-08-24 修的量測缺口**：這裡原本只跑 `jsonInit`，而三個宣告式建構子
 * （`branchList`／`paramList`／`variadic`）是**接在 `jsonInit` 之後**才長出
 * 插槽與 `extraState` 的。於是每一顆用建構子的積木，比對器都說
 * 「宣告少了插槽、宣告表達不出 extraState」——**而那是比對器自己沒接上**。
 *
 * > **比對之前，要先把【產品那側需要的每一樣東西】都備齊；
 * > 少一樣，比對就會指控宣告。**（`retire-imperative-block` 第 2.5 步，
 * > 那條規矩自己記著它被撞過四次——這是第五次。）
 *
 * ⚠️ 而它的代價是方向性的：它會讓人以為「宣告式那條路走不通」，
 * 於是那顆命令式定義永遠退不了場。
 */
function fromDeclaration(type: string): Shape | null {
  const spec = reg.getByBlockType(type) as { blockDef?: Record<string, unknown>; renderMapping?: unknown } | undefined
  const def = spec?.blockDef
  // 🔴 **一個用建構子的宣告【沒有 `message0`】——那是正常的**（2026-08-26）。
  //
  // 形狀由建構子長出來（`variadic` 用 `labelKey` ＋ `inputPattern`），
  // 所以 `message0` 是空的。而這裡原本寫 `if (!def.message0) return null`
  // ——於是**整個退場計畫的目標類別，這條護欄一顆都看不到**：
  // 它們被歸進「沒有 message0 或建不起來」那一桶，而那一桶不進比對。
  //
  // > **一條護欄的能力邊界，如果剛好切掉它要驗的那一類，
  // > 它的綠燈就與「沒有人在看」等價。**
  //
  // ⚠️ 這是 `retire-imperative-block` 第 2.5 步的**第七次**——而前六次都是
  // 「比對器缺一樣東西所以指控宣告」，這一次是「**比對器直接不看**」，
  // 症狀因此更難發現：報表上少一行，而沒有任何東西變紅。
  const hasBuilder = Boolean(def?.builder || def?.branchList || def?.paramList)
  if (!def || (!def.message0 && !hasBuilder)) return null
  const probe = `__decl_${type}`
  // ⚠️ 沒有 `message0` 時**不跑 `jsonInit`**——Blockly 會抱怨，而形狀本來
  //    就全部由建構子負責（顏色／前後接點也一起傳給它）。
  Blockly.Blocks[probe] = def.message0
    ? { init: function (this: Blockly.Block) { (this as unknown as { jsonInit: (d: unknown) => void }).jsonInit({ ...def, type: probe }) } }
    : { init: function () { /* 形狀全部由下面的建構子長出來 */ } }
  // ⚠️ 順序與 `block-registrar` 一致：先定義、再接建構子
  // 🔴 第四種形狀（2026-08-25）：依 `extraState` 換一整份佈局。
  //    ⚠️ 不接的話比對器會說「宣告少了 INDEX」——而那是**它自己沒接上**，
  //       `retire-imperative-block` 第 2.5 步那條規矩的第六次。
  if (def.altLayout) {
    attachAltLayout(probe, def as never, {
      stateKey: (def.altLayout as { stateKey: string }).stateKey,
      alt: def.altLayout as never,
    })
  }
  if (def.branchList) attachBranchList(probe, def.branchList as never)
  else if (def.paramList) attachParamList(probe, def.paramList as never)
  else if (def.builder === 'variadic') {
    const rules = (spec?.renderMapping as { dynamicRules?: { inputPattern?: string }[] } | undefined)?.dynamicRules
    const sole = rules?.length === 1 ? rules[0] : undefined
    // 🔴 **照抄產品那條路的分岔**（`block-registrar.ts`）：
    //    `args0` 非空 → jsonInit ＋ `attachVariadic`；否則 → `defineVariadicBlock`。
    //    ⚠️ 這裡原本只有前半，於是**全部由建構子長出來的那些**（`cpp_print`／
    //    `cpp_input`）比對器建不起來——而它們正是退場計畫的目標類別。
    //
    // > **比對之前，要先把【產品那側需要的每一樣東西】都備齊；
    // > 少一樣，比對就會指控宣告。**（第 2.5 步，這是第七次）
    if (sole?.inputPattern) {
      const common = {
        inputPattern: sole.inputPattern,
        check: (def.slotCheck as string) ?? 'Expression',
        colour: (def.colour as string) ?? '#5CB1D6',
        inputsInline: def.inputsInline as boolean | undefined,
        previousStatement: def.previousStatement as string | undefined,
        nextStatement: def.nextStatement as string | undefined,
        output: def.output as string | undefined,
        minCount: def.minCount as number | undefined,
        // ⚠️ 少傳一個鍵，比對器就會再一次指控宣告（今天剛付過這個學費）
        openLabelKey: def.openLabelKey as string | undefined,
        openLabelFallback: def.openLabelFallback as string | undefined,
        closeLabelKey: def.closeLabelKey as string | undefined,
        closeLabelFallback: def.closeLabelFallback as string | undefined,
        countKey: def.countKey as string | undefined,
      }
      if (Array.isArray(def.args0) && def.args0.length > 0) {
        attachVariadic(probe, common as never)
      } else {
        defineVariadicBlock(probe, {
          ...common,
          labelKey: def.labelKey as string | undefined,
          labelFallback: def.labelFallback as string | undefined,
          tooltipKey: typeof def.tooltip === 'string' && def.tooltip.startsWith('%{BKY_')
            ? def.tooltip.slice(6, -1) : undefined,
          tooltipFallback: typeof def.tooltip === 'string' && !def.tooltip.startsWith('%{BKY_')
            ? def.tooltip : undefined,
          leadingField: def.leadingField as { type: string; name: string } | undefined,
        } as never)
      }
    }
  }
  const b = ws.newBlock(probe)
  const s = shapeOf(b)
  b.dispose(false)
  delete Blockly.Blocks[probe]
  return s
}

/**
 * 兩個形狀哪裡不一樣——**抽成純函式是為了讓注入餵得進來**。
 *
 * 這裡有兩條**修過的**正規化規則，而它們沒有注入的話，被改回去也不會有人知道：
 * 欄位比「串起來的字」（不比怎麼切）、以及空白正規化。
 *
 * @param unexpressed 命令式有、而宣告表達不出的 extraState 鍵
 */
export function shapeDiff(imp: Shape, d: Shape, unexpressed: readonly string[] = []): string[] {
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
  const norm = (xs: readonly string[]): string => xs.join('').replace(/\s+/g, '')
  if (norm(imp.fields) !== norm(d.fields)) diffs.push(`欄位 ${imp.fields.join(',')} vs ${d.fields.join(',')}`)
  if (String(imp.output) !== String(d.output)) diffs.push(`output ${imp.output} vs ${d.output}`)
  if (imp.prev !== d.prev || imp.next !== d.next) diffs.push(`statement ${imp.prev}/${imp.next} vs ${d.prev}/${d.next}`)
  if (imp.colour !== d.colour) diffs.push(`顏色 ${imp.colour} vs ${d.colour}`)
  // 🔴 **載入時才跑的那一半**——見 `extraStateKeys` 的檔頭。
  //
  // ⚠️ 比的是**鍵**不是「有沒有」：`cpp_var_assign_compound` 宣告了 `dynamicRules`，
  // 而它的 extraState 是 `{hasIndex}`——**與 `dynamicRules` 無關**。
  // > **一個「有沒有宣告某種 extraState」的檢查，
  // > 答不出「宣告的是不是【同一個】extraState」。**
  if (imp.inline !== d.inline) diffs.push(`排版 inputsInline ${imp.inline} vs ${d.inline}`)
  if (unexpressed.length > 0) diffs.push(`載入時的狀態 ${unexpressed.join(',')} —— 宣告表達不出`)
  return diffs
}

/** 注入用的骨架形狀——只改要比的那一項。 */
const bareShape = (o: Partial<Shape> = {}): Shape =>
  ({ inline: false, inputs: [], fields: [], output: null, prev: false, next: false, colour: '#000', ...o }) as Shape

describe('spec 163 · 宣告與命令式，逐項比對', () => {
  // ★ 注入——錨點問「登錄表載到了嗎」，注入問「**比對認得出差異嗎**」。
  //    `shapeDiff` 永遠回空陣列的話，這條護欄會說「全部一模一樣、都可以刪」
  //    ——而錨點照樣過。**那是最貴的一種假綠：它的結論是「去刪程式碼」。**
  it('★ 注入①：每一項差異都必須被報出', () => {
    const b = bareShape()
    expect(shapeDiff(bareShape({ inputs: ['A'] }), b)).toHaveLength(1)
    expect(shapeDiff(bareShape({ fields: ['甲'] }), b)).toHaveLength(1)
    expect(shapeDiff(bareShape({ output: 'Number' }), b)).toHaveLength(1)
    expect(shapeDiff(bareShape({ prev: true }), b)).toHaveLength(1)
    expect(shapeDiff(bareShape({ colour: '#fff' }), b)).toHaveLength(1)
    // 🔴 第六維（2026-08-24 補）——它漏過一次真差異，所以要有注入釘著
    expect(shapeDiff(bareShape({ inline: true }), b), '排版那一維沒被比 → 它的差異就不存在').toHaveLength(1)
    expect(shapeDiff(b, b, ['hasIndex'])).toHaveLength(1)
  })

  it('★ 注入②：一模一樣的兩個形狀不得被誤報', () => {
    expect(shapeDiff(bareShape({ inputs: ['A'], fields: ['甲'] }), bareShape({ inputs: ['A'], fields: ['甲'] }))).toEqual([])
  })

  it('★ 注入④：空的啞插槽不算差異，而【有欄位的】那一列少了就要報', () => {
    // 🔴 沒有這一支的話，上面那條正規化被拿掉不會有人知道；
    //    而它被寫過頭（連有欄位的也吃掉）也不會有人知道。
    const withEmpty = bareShape({ inputs: ['A'] })
    expect(shapeDiff(withEmpty, bareShape({ inputs: ['A'] })), '同形不得被誤報').toEqual([])
    expect(shapeDiff(bareShape({ inputs: ['A', 'B'] }), bareShape({ inputs: ['A'] })),
      '少一個【被記進 shape 的】插槽必須報——正規化只吃「建不出 shape 的那些」').toHaveLength(1)
  })

  it('★ 注入③：欄位【怎麼切】與【空白】不算差異——這兩條規則是修過的', () => {
    // 🔴 沒有這一支的話，正規化被拿掉會讓幾十顆積木憑空變成「有差異」，
    //    而那看起來就像「宣告真的表達不出來」。
    expect(shapeDiff(bareShape({ fields: ['格', '←'] }), bareShape({ fields: ['格←'] }))).toEqual([])
    expect(shapeDiff(bareShape({ fields: [' 設定 ', ' x '] }), bareShape({ fields: ['設定x'] }))).toEqual([])
  })

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
        varDeclareExpr: n.C_VAR_DECLARE_EXPR_INPUTS, whileBlock: n.WHILE_INPUTS,
      countLoop: n.COUNT_LOOP_INPUTS, returnBlock: n.RETURN_INPUTS,
      arrayAccess: n.ARRAY_ACCESS_INPUTS, arrayAssign: n.ARRAY_ASSIGN_INPUTS, varAssign: n.VAR_ASSIGN_INPUTS,
    })


    // 🔴 **順序要對**：欄位在 `init` 的當下就抓住選項產生器，
    // 所以合成來源要在**建積木之前**設好，兩邊都是。
    const declared = declaredCache
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
    // ⚠️ **門檻 20 → 5**（2026-08-24）：這個錨問的是「**掃描有沒有讀到東西**」，
    //    而它原本錨在「今天有幾顆」——於是它會**在清乾淨的那天說謊**
    //    （第三十五條護欄講的正是這個病）。真的沒讀到是 0，5 擋得住。
    expect(imperativeTypes.size, '命令式母體是空的 → 掃描壞了，不是清乾淨了').toBeGreaterThan(5)

    const same: string[] = []
    const differ: { t: string; why: string }[] = []
    for (const [t, d] of declared) {
      if (!Blockly.Blocks[t]) continue
      if (!imperativeTypes.has(t)) continue
      let imp: Shape
      try { const b = ws.newBlock(t); imp = shapeOf(b); b.dispose(false) } catch { continue }
      const impKeys = extraStateKeys(Blockly.Blocks[t] as Record<string, unknown>)
      const canDeclare = new Set(declarableKeys(reg.getByBlockType(t)))
      const diffs = shapeDiff(imp, d, impKeys.filter((k) => !canDeclare.has(k)))
      if (diffs.length === 0) same.push(t)
      else differ.push({ t, why: diffs.join(' ｜ ') })
    }
    // eslint-disable-next-line no-console
    console.log(`\n  🟢 一模一樣（可刪）${same.length} 顆：\n    ${same.join(' ')}\n`
      + `  🔴 有差異（不准刪）${differ.length} 顆：\n`
      + differ.map((x) => `    ${x.t}\n      ${x.why}`).join('\n'))
    // ⚠️ **錨點不能錨在一個會隨清理下降的數字上**——第一版寫 `> 10`，
    // 而清到剩 10 顆的那天它自己紅了，訊息還說「registerAll 沒跑起來」。
    // > **一個錨在「今天有多少」的錨點，會在事情變好的那天說謊。**
    // 🟢 錨在「**有沒有比到**」與「母體是不是空的」。
    expect(same.length + differ.length, '一顆都沒比到 → registerAll 沒跑起來').toBeGreaterThan(0)
    expect(declared.size, '宣告一顆都沒建起來 → 是 jsonInit 那條路壞了').toBeGreaterThan(100)

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

  /**
   * 🔴 **這一維要有自己的斷言，否則它不會讓任何東西變紅。**
   *
   * ⚠️ 注射實測：拿掉宣告的 `extraStateFlags`、甚至**整條關掉這一維**，
   * `differ` 的棘輪都是綠的——因為那兩個注射讓數字**下降**，而棘輪只擋上升。
   *
   * > **一條只擋「變差」的棘輪，擋不住「量得更少」。**
   *
   * 🟢 所以指名：**這幾顆的「載入時的狀態」必須被報出來**。
   * 它們是今天已知宣告表達不出的那些——**任何一顆從清單消失，
   * 要嘛是宣告補上了（好事，改清單），要嘛是這一維瞎了（壞事）**。
   */
  it('🔴 「載入時的狀態」那一維要真的在報——指名它今天抓到誰', async () => {
    const { BlockRegistrar } = await import('../../src/ui/block-registrar')
    void BlockRegistrar
    const withLoad = [...declaredCache.keys()].filter((t) => {
      const impKeys = extraStateKeys(Blockly.Blocks[t] as Record<string, unknown>)
      const canDeclare = new Set(declarableKeys(reg.getByBlockType(t)))
      return impKeys.some((k) => !canDeclare.has(k))
    }).sort()
    expect(withLoad,
      '⚠️ 這一維瞎了，或某顆的宣告補上了。前者是護欄壞掉，後者要改這份清單'
      + '——**而兩者長得一樣，所以要指名**。')
      // 🪦 **`cpp_if`／`cpp_if_else` 於 2026-08-24 退場**（比對護欄確認一模一樣）
      //    ——它們的命令式定義沒了，所以這一維量不到它們，**那是對的**。
      //    ⚠️ 而清單要跟著改**並附理由**：這一則指名的存在理由就是
      //    「一條只擋變差的棘輪，擋不住量得更少」——名字一夕消失必須有人說得出為什麼。
      //
      // 🟢 **`cpp_doc_comment` 於 2026-08-25 從這份清單消失，而理由不是退場**：
      //    它的宣告**補上了那兩個鍵**（`paramCount` 由 `paramList` 產生、
      //    `hasReturn` 由 `blockOptions[].stateKey` 指定）。
      //    ⚠️ 那正是這一維存在的意義——它從「表達不出」變成「表達得出」，
      //    於是那顆命令式定義才刪得掉。
      .toEqual(['cpp_raw_code'])
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
