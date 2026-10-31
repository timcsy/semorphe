/**
 * `cella-lang/host` 的型別——套件只附了 `cella.d.ts`，這一支沒有（2026-10-31，已回報 cella）。
 * 只宣告我們用到的形狀（`cella-host.mjs` 的 `loadLibrary` 回傳值）。
 */
declare module 'cella-lang/host' {
  /** Cella 的值：不透明。 */
  export type CellaValue = unknown
  export interface CellaLibrary {
    exports: Record<string, unknown>
    call(name: string, ...args: CellaValue[]): CellaValue
    str(s: string): CellaValue
    nat(n: number | bigint): CellaValue
    toStr(v: CellaValue): string
    toNat(v: CellaValue): bigint
    tag(v: CellaValue): number
  }
  export function loadLibrary(bytes: Uint8Array): Promise<CellaLibrary>
}
