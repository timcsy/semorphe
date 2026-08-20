/**
 * 判別式萃取與互斥判定（第五條護欄用）
 *
 * ## 這裡在回答什麼
 *
 * 「兩條辨識規則會不會搶同一段語法？」
 *
 * ## 最容易做錯的一步
 *
 * **判別式不只在 `constraints` 裡。** `chain` 型規則的判別式住在
 * `chain.operator` 與 `chain.rootMatch.text`：
 *
 *   print:  chain { operator: '<<', rootMatch: { text: 'cout' } }
 *   input:  chain { operator: '>>', rootMatch: { text: 'cin'  } }
 *
 * 兩者的 `constraints` **都是空的**。只看 constraints 會判成「確定會撞」——
 * 而那是專案最常用的兩條規則。**誤報它足以讓維護者立刻學會忽略整個護欄。**
 *
 * ## 判定方向是保守的
 *
 * 只有在**能證明**互斥時才判「不會撞」。判不出來一律「無法確定」——
 * 那是誠實的答案，不是失敗。絕不為了讓數字好看而樂觀歸類。
 *
 * 見 specs/051-lift-claim-arbitration/research.md F1／F2、D1
 */

/** 一條規則用來區分自己與別人的一項依據 */
export interface Discriminator {
  /** 判別維度，如 `field:operator`、`chain:rootText` */
  dimension: string
  kind: 'exact' | 'prefix' | 'nodeType' | 'set'
  value: string
}

/** PatternLifter 內部規則的結構性子集——只取判定需要的欄位 */
export interface RuleLike {
  componentId: string
  patternType: string
  priority: number
  constraints?: { field: string; text?: string; nodeType?: string; match?: string }[]
  chain?: { operator?: string; rootMatch?: { text?: string } }
  operatorDispatch?: { routes?: Record<string, string> }
  composite?: { checks?: { field: string; typeIs?: string; operatorIn?: string[] }[] }
}

/**
 * 萃取一條規則的全部判別式。
 *
 * 來源有四處——只看第一處是本功能最容易犯的錯（見檔頭）。
 */
export function extractDiscriminators(rule: RuleLike): Discriminator[] {
  const out: Discriminator[] = []

  // ① 限定條件
  for (const c of rule.constraints ?? []) {
    if (c.text !== undefined) {
      out.push({
        dimension: `field:${c.field}`,
        kind: c.match === 'startsWith' ? 'prefix' : 'exact',
        value: c.text,
      })
    }
    if (c.nodeType !== undefined) {
      out.push({ dimension: `field:${c.field}`, kind: 'nodeType', value: c.nodeType })
    }
  }

  // ② chain 型——判別式在運算子與根文字，不在限定條件裡
  if (rule.chain) {
    if (rule.chain.operator) {
      out.push({ dimension: 'chain:operator', kind: 'exact', value: rule.chain.operator })
    }
    if (rule.chain.rootMatch?.text) {
      out.push({ dimension: 'chain:rootText', kind: 'exact', value: rule.chain.rootMatch.text })
    }
  }

  // ③ operatorDispatch 型——判別式是它能處理的運算子集合
  if (rule.operatorDispatch?.routes) {
    const ops = Object.keys(rule.operatorDispatch.routes).sort()
    if (ops.length > 0) {
      out.push({ dimension: 'dispatch:operators', kind: 'set', value: ops.join('|') })
    }
  }

  // ④ composite 型——每個 check 是一個維度
  for (const chk of rule.composite?.checks ?? []) {
    if (chk.typeIs) {
      out.push({ dimension: `composite:${chk.field}`, kind: 'nodeType', value: chk.typeIs })
    }
    if (chk.operatorIn && chk.operatorIn.length > 0) {
      out.push({
        dimension: `composite:${chk.field}:op`,
        kind: 'set',
        value: [...chk.operatorIn].sort().join('|'),
      })
    }
  }

  return out
}

/**
 * 兩個同維度的判別式**可證互斥**嗎。
 *
 * 回傳 true 只代表「證明得出來」，回傳 false 是「證不出來」——**不是**「證明會撞」。
 */
export function provablyDisjoint(a: Discriminator, b: Discriminator): boolean {
  if (a.dimension !== b.dimension) return false

  if (a.kind === 'exact' && b.kind === 'exact') return a.value !== b.value
  if (a.kind === 'nodeType' && b.kind === 'nodeType') return a.value !== b.value
  if (a.kind === 'exact' && b.kind === 'prefix') return !a.value.startsWith(b.value)
  if (a.kind === 'prefix' && b.kind === 'exact') return !b.value.startsWith(a.value)
  if (a.kind === 'prefix' && b.kind === 'prefix') {
    return !a.value.startsWith(b.value) && !b.value.startsWith(a.value)
  }
  if (a.kind === 'set' && b.kind === 'set') {
    const sa = new Set(a.value.split('|'))
    return b.value.split('|').every((x) => !sa.has(x))
  }
  // exact vs nodeType 等混合組合：意義不同的維度，證不出來
  return false
}

export type Verdict = 'never' | 'definitely' | 'unknown'

export interface PairVerdict {
  a: string
  b: string
  verdict: Verdict
  /** 判定的依據——必填，讓報表說得出「為什麼」 */
  reason: string
}

/** 判別式集合的正規化字串（用來比較集合關係） */
function keyOf(d: Discriminator): string {
  return `${d.dimension}|${d.kind}|${d.value}`
}

/** a 的判別式是否為 b 的子集——若是，任何匹配 b 的輸入必然也匹配 a */
function isSubset(a: Discriminator[], b: Discriminator[]): boolean {
  const bk = new Set(b.map(keyOf))
  return a.every((x) => bk.has(keyOf(x)))
}

/**
 * 兩條規則的三分類。
 *
 * 1. 存在一個維度可證互斥                          → never
 * 2. 一方的判別式是另一方的子集（含相同、含皆空）  → **definitely**
 * 3. 其餘                                          → unknown
 *
 * 第 2 條的道理：若 A 的限定條件 ⊆ B 的，那麼**任何滿足 B 的輸入必然也滿足 A**
 * ——兩者必定同時認領。皆空與完全相同都是它的特例。
 *
 * ⚠️ 這一條是實作時被自我驗證測試逼出來的。第一版只判「雙方皆空」，於是
 * 5 條**限定條件完全相同**的規則（都是 `type: template_type`）被判成「無法
 * 確定」——而它們其實是最嚴重的一種：第一條贏走全部，另外 4 條**永遠不會
 * 被試到**。見 specs/051-lift-claim-arbitration/research.md F5。
 */
export function classifyPair(ruleA: RuleLike, ruleB: RuleLike): PairVerdict {
  const da = extractDiscriminators(ruleA)
  const db = extractDiscriminators(ruleB)
  const base = { a: ruleA.componentId, b: ruleB.componentId }

  for (const x of da) {
    for (const y of db) {
      if (provablyDisjoint(x, y)) {
        return {
          ...base,
          verdict: 'never',
          reason: `${x.dimension} 互斥：「${x.value}」vs「${y.value}」`,
        }
      }
    }
  }

  if (da.length === 0 && db.length === 0) {
    return {
      ...base,
      verdict: 'definitely',
      reason: '兩者都沒有任何判別式——都會匹配這種語法的所有情形',
    }
  }

  if (isSubset(da, db) || isSubset(db, da)) {
    const same = da.length === db.length
    return {
      ...base,
      verdict: 'definitely',
      reason: same
        ? `判別式完全相同（${da.map((d) => `${d.dimension}=${d.value}`).join('、')}）` +
          '——先登記的那條贏走全部，另一條**永遠不會被試到**'
        : '一方的限定條件是另一方的子集——任何滿足較嚴格那條的輸入，必然也滿足較寬鬆那條',
    }
  }

  const dims = [...new Set([...da, ...db].map((d) => d.dimension))].join('、')
  return {
    ...base,
    verdict: 'unknown',
    reason: `無法證明互斥（涉及維度：${dims || '無'}）——判不出來就說判不出來，不猜`,
  }
}
