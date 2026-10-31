/**
 * **編好的判決模組存在 IndexedDB**（spec 182 T014）——第二次打開不必下載套件、不必再編十幾秒。
 *
 * 鍵 ＝ 六個 Cella 套件的版本 ＋ 判決模組的原始碼：任何一個變了，舊的那份就不會被拿到（不必另外清）。
 * ⚠️ 隱私模式、被封鎖的站台資料下 IndexedDB 會失敗——一律當成「沒有快取」，照常編譯。
 *
 * 🔴 research R6 原本是「套件檔用 Cache Storage、模組用 IndexedDB」兩層。
 *    量到編好的模組不需要 Cella 執行環境之後，前一層沒有用處了——只剩這一層。
 */
import { CHECKER_SOURCE } from './verdict'

const VERSIONS = import.meta.glob(
  ['/node_modules/cella-lang/package.json', '/node_modules/@cella-lang/*/package.json'],
  { import: 'version', eager: true },
) as Record<string, string>

/** 鍵裡的套件版本（`名字@版本`）——glob 落空時鍵就不再隨升版改變，測試盯著它不是空的。 */
export const checkerVersions = (): string[] =>
  Object.entries(VERSIONS).sort(([a], [b]) => a.localeCompare(b)).map(([p, v]) => `${p.split('/').slice(-2, -1)[0]}@${v}`)

/** 快取鍵：`<模組名>:` ＋ 套件版本（依路徑排序）與模組原始碼的 SHA-256。模組名讓判決模組與各分支的除錯模組各存一份。 */
export async function moduleKey(name: string, source: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(checkerVersions().join(',') + '\n' + source))
  return `${name}:` + [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const checkerKey = (): Promise<string> => moduleKey('verdict', CHECKER_SOURCE)

const DB = 'semorphe-cella'
const STORE = 'checkers'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function loadCompiled(key: string): Promise<Uint8Array | null> {
  try {
    const db = await open()
    return await new Promise((resolve) => {
      const req = db.transaction(STORE).objectStore(STORE).get(key)
      req.onsuccess = () => resolve(req.result instanceof Uint8Array ? req.result : null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

/** 存一份、清掉【同一個模組】的舊版（套件升版之後舊模組永遠用不到；別的模組不動）。 */
export async function saveCompiled(key: string, bytes: Uint8Array): Promise<void> {
  const name = key.slice(0, key.indexOf(':') + 1)
  try {
    const db = await open()
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      const keys = store.getAllKeys()
      keys.onsuccess = () => {
        for (const k of keys.result) if (typeof k === 'string' && k.startsWith(name) && k !== key) store.delete(k)
      }
      store.put(bytes, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {
    /* 存不進去就下次再編 */
  }
}
