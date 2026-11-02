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
  /** 類別由 Cella 給（0.1.202611021901 起）：error／unsupported／indeterminate／termination／incomplete／invalid——見 `core/verdict-diagnostics.ts` 的 `VerdictProblem.class` */
  class?: string
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

/** 四個分支（C 家族三個 ＋ Python，spec 195）；由程式 JSON 決定走哪一個。 */
export type CellaBranch = 'c' | 'cpp' | 'arduino' | 'python'

/** 讀檔：`pkg` 為 `null` 是 `cella-lang` 本身的資產。 */
export type CellaRead = (pkg: string | null, file: string) => Promise<Uint8Array> | Uint8Array

/** 程式 JSON 該交給哪個分支：有板子 → arduino；`langC` → c；其餘 → cpp。 */
export function branchOf(program: { k?: string; lang?: { k?: string }; board?: unknown }): CellaBranch {
  // Python 的根是 `program`（`python.ast`），C 家族的是 `prog`（`cfamily.syntax`）
  if (program.k === 'program') return 'python'
  if (program.board != null) return 'arduino'
  return program.lang?.k === 'langC' ? 'c' : 'cpp'
}

/**
 * **兩個判決模組，用到才編**（spec 197c）。
 * 🔴 spec 195 第一版把 Python 編進同一個模組：量到 12 秒／4.7 MB → 22.7 秒／15.9 MB，**每一個學生**（包括只學 C++ 的）第一次載入都變慢、
 *    瀏覽器裡暖機超過 e2e 的三分鐘——所以拆成兩個家族：C 家族在暖機時編；Python 第一次遇到 Python 程式才編。
 */
export type CellaFamily = 'cfamily' | 'python'
const FAMILY_BRANCHES: Record<CellaFamily, readonly CellaBranch[]> = { cfamily: ['c', 'cpp', 'arduino'], python: ['python'] }
export const familyOf = (b: CellaBranch): CellaFamily => (b === 'python' ? 'python' : 'cfamily')
const libraryOf = (family: CellaFamily): string => {
  const bs = FAMILY_BRANCHES[family]
  return [...bs.map((b) => `import ${b}`), ...bs.flatMap((b) => [
    `def verdict_${b} (src : String) (input : String) (fuel : Nat) : String := ${b}.verdict src input fuel`,
    `def types_${b} (src : String) (candidates : String) : String := ${b}.types src candidates`,
  ])].join('\n') + '\n'
}
const exportsOf = (family: CellaFamily): string => FAMILY_BRANCHES[family].flatMap((b) => [`verdict_${b}`, `types_${b}`]).join(',')

/** 型別查詢（`@cella-lang/cfamily` README〈Type query〉）。 */
export interface CellaTypes {
  nodes?: Record<string, string>
  slots?: Record<string, { display?: string; expects?: string | null; fits?: Record<string, { level: 'exact' | 'convert' | 'narrowing' | 'no'; reason?: string }> }>
  errors?: { at: string; reason: string }[]
  [extra: string]: unknown
}

/** 一個編好的判決器：判決與型別查詢共用同一次載入。 */
export interface CellaChecker {
  verdict(program: unknown, input?: string, fuel?: number): CellaVerdict
  types(program: unknown, candidates?: string[]): CellaTypes
}

/** 判決模組的原始碼——它與套件版本一起決定快取鍵（`cache.ts`）。 */
export const checkerSource = (family: CellaFamily): string => libraryOf(family)
export const CHECKER_SOURCE = libraryOf('cfamily')

/**
 * 建一個判決器：載入 Cella 與三個語言套件、編好判決模組，回傳判決與型別查詢。
 * ⚠️ 昂貴（十幾秒）——一個宿主建一次。
 */
export async function createCellaChecker(read: CellaRead, families: readonly CellaFamily[] = ['cfamily']): Promise<CellaChecker> {
  const byFamily = new Map<CellaFamily, CellaChecker>()
  for (const f of families) byFamily.set(f, await checkerFromBytes(await compileCellaChecker(read, f)))
  const pick = (program: unknown): CellaChecker => {
    const f = familyOf(branchOf(program as never))
    const c = byFamily.get(f)
    if (!c) throw new Error(`判決器沒有編 ${f} 這一族（createCellaChecker 的 families）`)
    return c
  }
  return { verdict: (p, input, fuel) => pick(p).verdict(p, input, fuel), types: (p, cands) => pick(p).types(p, cands) }
}

/**
 * 只編譯：回傳判決模組的 wasm 位元組。
 * 🟢 **編好的模組不需要 Cella 的執行環境**（2026-10-31 量：4.7 MB 的模組在乾淨的行程裡 13 毫秒載起來就能判）
 * ——所以快取存這一份就夠，第二次打開連套件都不必下載。
 */
export async function compileCellaChecker(read: CellaRead, family: CellaFamily = 'cfamily'): Promise<Uint8Array> {
  const cella = await loadCellaPackages(read, FAMILY_BRANCHES[family])
  return cella.compile_wasm_library(libraryOf(family), exportsOf(family))
}

let base: Promise<{ cella: typeof import('cella-lang'); loadPackage(name: string): Promise<void> }> | null = null
/**
 * 載入 Cella 本體（一個行程一次）與**要用到的**語言套件（各載一次）——判決模組與除錯模組共用。
 * 回傳的 `cella-lang` 模組已經可以 `compile_wasm_library`。
 */
export async function loadCellaPackages(read: CellaRead, packages: readonly string[] = FAMILY_BRANCHES.cfamily): Promise<typeof import('cella-lang')> {
  base ??= loadBase(read).catch((e: unknown) => { base = null; throw e })
  const b = await base
  for (const p of packages) await b.loadPackage(p)
  return b.cella
}

async function loadBase(read: CellaRead): Promise<{ cella: typeof import('cella-lang'); loadPackage(name: string): Promise<void> }> {
  const cella = await import('cella-lang')
  const bytes = async (pkg: string | null, file: string): Promise<Uint8Array> => await read(pkg, file)
  const text = async (pkg: string, file: string): Promise<string> => new TextDecoder().decode(await bytes(pkg, file))

  await cella.default({ module_or_path: await bytes(null, 'cella_bg.wasm') })
  cella.init_stdlib_explicit(await bytes(null, 'stdlib.cell'))

  const loaded = new Map<string, Promise<void>>()
  const loadPackage = (name: string): Promise<void> => {
    let p = loaded.get(name)
    if (!p) {
      p = (async () => {
        const indexText = await text(name, 'index.json')
        const index = JSON.parse(indexText) as {
          requires: { 'cella-lang': { modules: string[] }; packages?: string[] }
          modules: Record<string, { deps: string[] }>
        }
        for (const m of index.requires['cella-lang'].modules) {
          if (loaded.has(`module:${m}`)) continue
          loaded.set(`module:${m}`, Promise.resolve())
          cella.load_module_pack(await bytes(null, `modules/${m}.cell`))
        }
        for (const dep of index.requires.packages ?? []) await loadPackage(dep)
        for (const m of index.modules[name].deps) {
          const r = JSON.parse(cella.load_library_pack(indexText, m, await bytes(name, `${m}.cell`))) as { ok: boolean; error?: string }
          if (!r.ok) throw new Error(`Cella 套件 ${name} 的模組 ${m} 載不進去：${r.error ?? '（沒有理由）'}`)
        }
      })()
      loaded.set(name, p)
    }
    return p
  }
  return { cella, loadPackage }
}

/** 編好的位元組 → 判決器（不載 Cella 本體）。 */
export async function checkerFromBytes(bytes: Uint8Array): Promise<CellaChecker> {
  const host = await import('cella-lang/host')
  const lib = await host.loadLibrary(bytes)
  const call = (fn: string, ...args: unknown[]): unknown => JSON.parse(lib.toStr(lib.call(fn, ...(args as never[]))))
  return {
    verdict: (program, input = '', fuel = 1_000_000) =>
      call(`verdict_${branchOf(program as never)}`, lib.str(JSON.stringify(program)), lib.str(input), lib.nat(fuel)) as CellaVerdict,
    types: (program, candidates = []) =>
      call(`types_${branchOf(program as never)}`, lib.str(JSON.stringify(program)), lib.str(JSON.stringify(candidates))) as CellaTypes,
  }
}
