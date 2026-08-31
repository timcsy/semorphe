/**
 * Auto-include engine
 *
 * Scans a semantic tree to collect all component IDs, then queries
 * DependencyResolver to determine which #include headers are required.
 * Merges with manually placed #include blocks (deduplication).
 */
// ⚠️ **副作用 import**——把 C++ 的骨架宣告註冊進去。
//    少了它，`skeletonById` 在沒有載語言套件的路徑上找不到東西。
import './skeletons'
import { skeletonById } from '../../core/skeleton'
import type { SemanticNode } from '../../core/types'
import type { DependencyResolver, DependencyEdge } from '../../core/dependency-resolver'
import { expandHeaderAliases, normalizeHeader } from './header-aliases'
import { buildInclude } from '../../components/cpp/include/lift'
import { isIncludeDirective } from './core/node-traits'

/**
 * Collect all component IDs from a semantic tree (recursive).
 */
export function collectComponents(node: SemanticNode, out: Set<string>): void {
  out.add(node.componentId)
  for (const children of Object.values(node.children)) {
    for (const child of children) {
      collectComponents(child, out)
    }
  }
}

/**
 * Collect manually placed #include headers from the program's body.
 */
function collectManualIncludes(body: SemanticNode[]): Set<string> {
  const manual = new Set<string>()
  for (const node of body) {
    if (isIncludeDirective(node.componentId) && typeof node.properties.header === 'string') {
      manual.add(`<${node.properties.header}>`)
    }
  }
  return expandHeaderAliases(manual)
}

/**
 * Compute the set of #include headers required by the semantic tree,
 * based on components used and their module membership.
 *
 * Returns sorted, deduplicated DependencyEdge list excluding any already
 * present as manual #include blocks in the program body.
 */
export function computeAutoIncludes(
  root: SemanticNode,
  resolver: DependencyResolver,
): DependencyEdge[] {
  const components = new Set<string>()
  collectComponents(root, components)

  const edges = resolver.resolve([...components])

  // Exclude headers already manually included
  const body = root.children.body ?? []
  const manual = collectManualIncludes(body)

  return edges.filter(e => !manual.has(e.header))
}

/**
 * Create a code patcher that fixes missing scaffold items (#include, using namespace, int main)
 * based on components used in the semantic tree.
 */
export function createCppCodePatcher(
  resolver: DependencyResolver,
): (
  code: string,
  tree: SemanticNode,
  namespaceStyle: 'using' | 'explicit',
  cogLevel?: number,
  /**
   * 這個目標有沒有程式外殼——🔴 **由目標宣告**（`Target.skeleton`）。
   *
   * ⚠️ 少了它的話，這個補丁器會在 Arduino sketch 上補出
   * `int main() { … }`，把 `setup()`／`loop()` 包進去
   * ——**而鷹架那一側早就修好了，這裡是第二個入口**。
   *
   * > **同一個決定如果有兩個地方各自實作，
   * > 修好一個之後症狀只會少一半——而少一半看起來很像修好了。**
   */
  skeletonId?: string,
) => string | null {
  return (code, tree, namespaceStyle, cogLevel = 1, skeletonId = 'main') => {
    const components = new Set<string>()
    collectComponents(tree, components)
    const edges = resolver.resolve([...components])
    let changed = false
    let patched = code

    // 1. Patch missing #include directives (also check C/C++ header equivalents)
    const existingHeaders = new Set<string>()
    const includeRe = /#include\s*[<"]([^>"]+)[>"]/g
    let m: RegExpExecArray | null
    while ((m = includeRe.exec(code)) !== null) {
      existingHeaders.add(normalizeHeader(m[1]))
    }
    const missingIncludes = edges.filter(e => !existingHeaders.has(normalizeHeader(e.header)))
    if (missingIncludes.length > 0) {
      const patch = missingIncludes.map(e => e.directive).join('\n') + '\n'
      const idx = patched.indexOf('#include')
      patched = idx >= 0 ? patched.slice(0, idx) + patch + patched.slice(idx) : patch + patched
      changed = true
    }

    // 2. Patch missing using namespace std
    if (namespaceStyle === 'using' && edges.length > 0 && !patched.includes('using namespace std')) {
      const lines = patched.split('\n')
      const lastInc = lines.reduce((a, l, i) => l.trimStart().startsWith('#include') ? i : a, -1)
      lines.splice(lastInc + 1, 0, 'using namespace std;')
      patched = lines.join('\n')
      changed = true
    }

    // 3. Patch missing entry point (L0 only — scaffold manages it)
    //
    // 🔴 **這裡讀的是與鷹架【同一份宣告】**（`core/skeleton.ts`，2026-08-28）。
    //    在此之前它自己寫死 `'int main() {'` 與 `'    return 0;'`
    //    ——而鷹架那一側也各寫了一次。
    //
    // > **同一個決定如果有兩個地方各自實作，
    // > 修好一個之後症狀只會少一半——而少一半看起來很像修好了。**
    //
    // ⚠️ 「有沒有進入點」現在也問宣告：`entryPoint` 是空陣列就不補
    //    （Arduino 的 `none` 是一份空的宣告，不是一個特例的 `if`）。
    // 🔴 **2026-08-31：改成問 `entryFunctions`，不是 `entryPoint`。**
    //    使用者：「我選了 Arduino 骨架，但是是空的」——而根因就在這個閘門：
    //    `entryPoint` 是**一個**進入點包住**一個**本體的形狀，Arduino 有兩顆，
    //    表達不出來於是被留空，`entry.length > 0` 為假，一個字都不補。
    //
    // > **一個裝不下的形狀，最常見的偽裝是一句解釋它為什麼該是空的註解。**
    //
    //    ⚠️ 只補**缺的那幾顆**；全部都缺（＝新開的空程式）才整份重建，
    //    否則會把已經在的那顆複製一次。
    const skeleton = skeletonById(skeletonId)
    const entryFns = skeleton?.entryFunctions ?? []
    const missing = entryFns.filter((f) => !patched.includes(f.open[0].code.trim()))
    if (entryFns.length > 0 && cogLevel === 0 && missing.length > 0) {
      const shell = (f: (typeof entryFns)[number], inner: string): string =>
        [...f.open.map((l) => l.code), ...(inner ? [inner] : []), ...f.close.map((l) => l.code)]
          .join('\n')

      if (missing.length === entryFns.length) {
        // Extract header lines (#include, using namespace, blank) and body
        const lines = patched.split('\n')
        const headerEnd = lines.reduce((a, l, i) => {
          const t = l.trim()
          return (t.startsWith('#include') || t.startsWith('using ') || t === '') ? i + 1 : a
        }, 0)
        const header = lines.slice(0, headerEnd).join('\n')
        const bodyLines = lines.slice(headerEnd).filter(l => l.trim() !== '')
        const indented = bodyLines.map(l => '    ' + l).join('\n')
        // ⚠️ 鬆散的語句只有**一個**去處——由宣告指定（Arduino 是 `loop`）
        const host = entryFns.find((f) => f.hostsBody) ?? entryFns[0]
        patched = (header ? header + '\n' : '') +
          entryFns.map((f) => shell(f, f === host ? indented : '')).join('\n\n')
      } else {
        patched = patched.replace(/\s*$/, '') + '\n\n' +
          missing.map((f) => shell(f, '')).join('\n\n')
      }
      changed = true
    }

    return changed ? patched : null
  }
}

/**
 * 把自動推導出的引入邊轉成語義節點。
 *
 * **這一步原本在介面層做**（`src/ui/app.ts` 直接建 include 節點）。
 * 那讓介面層認得一個 C++ 專屬的概念身分——換一種語言，引入指令的概念叫別的
 * 名字，而介面層寫死了這一個。
 *
 * 現在介面層只知道「請語言套件把這些邊變成節點」。**哪個概念代表引入，是
 * 語言套件自己的知識。**
 */
export function autoIncludeNodes(edges: DependencyEdge[]): SemanticNode[] {
  return edges.map((edge) =>
    buildInclude(edge.header.replace(/^<|>$/g, '')),
  )
}
