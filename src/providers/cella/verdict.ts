/**
 * **Cella 的判決入口**（spec 180 T010；重構階段 5 的 Cella 提供者會用這一支）。
 *
 * 一支 `formalize` 翻出來的程式 JSON → Cella 的判決：`accept`／`reject`／`unknown`／`invalid`，
 * 附 `problems`（每一筆帶節點標籤 `at`、標準條文、理由）。
 *
 * ## 載入（照 `cella-lang` README 的〈Official packages〉）
 *
 * 先載依賴的標準模組與套件，再依 `index.json` 的順序載這個套件自己的模組；
 * 然後編一個匯出三個語言判決的小模組（一次，約 12 秒），之後每支程式毫秒到百毫秒級。
 *
 * ## 讀檔交給宿主
 *
 * `read(pkg, file)`：`pkg` 是 `null` 時讀 `cella-lang` 自己的資產（wasm、stdlib、標準模組），
 * 否則讀 `@cella-lang/<pkg>` 裡的檔。Node 用 `readFileSync`，瀏覽器用 `fetch`——這一支不認識任何一種。
 *
 * ## 🔴 沒有支援清單（cella 2026-10-31 確認）
 *
 * 模型還沒有的構造一律判 `unknown`，`problems` 裡有一筆 `kind: "unsupported"`、`at` 是那個節點。
 * 判決本身就是最準的清單——送出前在我們這側先擋，反而會擋掉 Cella 已經支援的構造（spec 180 FR-004 改道）。
 */

/** 判決的一個問題。`at` 是 formalize 給的節點標籤（語義樹的 id，或 `<id>/<角色>`、`<id>#<槽>`）。 */
export interface CellaProblem {
  kind: string
  at?: string
  clause?: string
  reason?: string
}

/** `@cella-lang/cfamily` 的判決 JSON（板子上的程式另有 pins／env／clock，這裡不收窄）。 */
export interface CellaVerdict {
  verdict: 'accept' | 'reject' | 'unknown' | 'invalid'
  basis: 'computed' | 'kernel'
  exit: number | null
  out: string
  problems: CellaProblem[]
  assumes?: { implementation: string; choice: string }[]
  [extra: string]: unknown
}

/** 三個分支；由程式 JSON 決定走哪一個。 */
export type CellaBranch = 'c' | 'cpp' | 'arduino'

/** 讀檔：`pkg` 為 `null` 是 `cella-lang` 本身的資產。 */
export type CellaRead = (pkg: string | null, file: string) => Promise<Uint8Array> | Uint8Array

/** 程式 JSON 該交給哪個分支：有板子 → arduino；`langC` → c；其餘 → cpp。 */
export function branchOf(program: { lang?: { k?: string }; board?: unknown }): CellaBranch {
  if (program.board != null) return 'arduino'
  return program.lang?.k === 'langC' ? 'c' : 'cpp'
}

const LIBRARY = [
  'import c', 'import cpp', 'import arduino',
  'def verdict_c (src : String) (input : String) (fuel : Nat) : String := c.verdict src input fuel',
  'def verdict_cpp (src : String) (input : String) (fuel : Nat) : String := cpp.verdict src input fuel',
  'def verdict_arduino (src : String) (input : String) (fuel : Nat) : String := arduino.verdict src input fuel',
].join('\n') + '\n'

/**
 * 建一個判決器：載入 Cella 與三個語言套件、編好判決模組，回傳 `(program, input, fuel) => 判決`。
 * ⚠️ 昂貴（十幾秒）——一個宿主建一次。
 */
export async function createCellaVerdict(read: CellaRead): Promise<(program: unknown, input?: string, fuel?: number) => CellaVerdict> {
  const cella = await import('cella-lang')
  const host = await import('cella-lang/host')
  const bytes = async (pkg: string | null, file: string): Promise<Uint8Array> => await read(pkg, file)
  const text = async (pkg: string, file: string): Promise<string> => new TextDecoder().decode(await bytes(pkg, file))

  await cella.default({ module_or_path: await bytes(null, 'cella_bg.wasm') })
  cella.init_stdlib_explicit(await bytes(null, 'stdlib.cell'))

  const loaded = new Set<string>()
  const loadPackage = async (name: string): Promise<void> => {
    if (loaded.has(name)) return
    const indexText = await text(name, 'index.json')
    const index = JSON.parse(indexText) as {
      requires: { 'cella-lang': { modules: string[] }; packages?: string[] }
      modules: Record<string, { deps: string[] }>
    }
    for (const m of index.requires['cella-lang'].modules) {
      if (loaded.has(`module:${m}`)) continue
      cella.load_module_pack(await bytes(null, `modules/${m}.cell`))
      loaded.add(`module:${m}`)
    }
    for (const p of index.requires.packages ?? []) await loadPackage(p)
    for (const m of index.modules[name].deps) {
      const r = JSON.parse(cella.load_library_pack(indexText, m, await bytes(name, `${m}.cell`))) as { ok: boolean; error?: string }
      if (!r.ok) throw new Error(`Cella 套件 ${name} 的模組 ${m} 載不進去：${r.error ?? '（沒有理由）'}`)
    }
    loaded.add(name)
  }
  for (const b of ['c', 'cpp', 'arduino'] as const) await loadPackage(b)

  const lib = await host.loadLibrary(cella.compile_wasm_library(LIBRARY, 'verdict_c,verdict_cpp,verdict_arduino'))
  return (program, input = '', fuel = 1_000_000) => {
    const fn = `verdict_${branchOf(program as never)}`
    const raw = lib.toStr(lib.call(fn, lib.str(JSON.stringify(program)), lib.str(input), lib.nat(fuel)))
    return JSON.parse(raw) as CellaVerdict
  }
}
