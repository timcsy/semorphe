/**
 * **第一百一十條護欄：身分的階層與實例的路徑，分得出來。**
 *
 * ## 🔴 它把一條「已定而未實作」的規則變成會出聲的
 *
 * `concepts/元件.md` §`name` 的階層自己標著：
 *
 * > **狀態：規則已定，尚未實作**（2026-08-13 三輪討論）。
 * > 今天 177 顆全是扁平的 `cpp:*`，**帶 `.` 的身分 0 顆**——語法位置空著。
 *
 * 而那正是 `concepts/執行機構.md` 的第一句：
 *
 * > **一條規範沒有機械化的檢查，它本身就是殼——而殼看起來像完成。**
 *
 * ## ⚠️ 為什麼現在做，而不是等有人用到
 *
 * vision 逐字：**「①（路徑語法）排第一是因為它是唯一一個三個域都會用到、
 * 而且錯了要全改的東西」**。兩種東西都用 `.`，而等到兩邊都有東西之後
 * 才解那個撞號，就要改三個域。
 *
 * ## 本護欄不檢測什麼
 *
 * - **不管實例路徑的資料結構**——那種東西今天不存在（分子的 ②③④）
 * - **不強制任何一顆膠囊改成帶 `.` 的身分**（那是 Python package 那一刀）
 * - **不自動修正歧義**——🔴 歧義要**出聲**。
 *   > **一個會自動解掉歧義的機制，會讓那個歧義永遠不被討論。**
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { classifyPath, identityToDir, identityToBlockType } from '../../src/core/component/path-syntax'
import { REPO_ROOT } from '../helpers/guardrail'

/** 現有的每一顆身分——回歸的底線。 */
function allIdentities(): string[] {
  const out: string[] = []
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name)
      if (e.isDirectory()) { walk(f); continue }
      if (e.name !== 'component.json') continue
      const id = (JSON.parse(fs.readFileSync(f, 'utf8')) as { componentId?: string }).componentId
      if (id) out.push(id)
    }
  }
  walk(path.join(REPO_ROOT, 'src/components'))
  return out
}

const IDS = allIdentities()

/**
 * 🔴 **「我們發明的分類」的明文清單**——`concepts/元件.md` 規則②。
 *
 * ⚠️ **這份清單會誤傷**：Python 真的有 `math` 模組。所以它**刻意很短**，
 * 每一筆都是這個 repo 真的用過的分類名，而它是**可下調的**
 * ——有人拿出「這是語言真的有的模組」的證據時就移除那一筆。
 *
 * > **分類會變，而變了就是搬家。**
 * > （`history/047`：「模組是搬家的中途站，不是終點」——`<cmath>` 的五面牆全空，
 * > 而那個組織方式五個月前才剛被稱為完成。）
 */
const OUR_CATEGORIES = ['containers', 'basic', 'advanced', 'special', 'misc', 'utils', 'helpers'] as const

describe('第一百一十條護欄：身分的階層與實例的路徑', () => {
  it('★ 入口條件——真的掃到身分了', () => {
    expect(IDS.length, '🔴 一顆身分都沒掃到 → 下面每一條都是空過的').toBeGreaterThan(100)
  })

  // ─── 規則③：`.` 是真實，`/` 與 `_` 是投影 ───

  describe('規則③（`concepts/元件.md`）：`.` 是真實，其餘兩個是投影', () => {
    it('身分 → 目錄', () => {
      expect(identityToDir('python:numpy.linalg.solve')).toBe('python/numpy/linalg/solve')
      expect(identityToDir('cpp:for_loop')).toBe('cpp/for_loop')
      expect(identityToDir('@someone:boost.vector')).toBe('@someone/boost/vector')
    })

    it('身分 → 積木型別名', () => {
      expect(identityToBlockType('python:numpy.linalg.solve')).toBe('python_numpy_linalg_solve')
      expect(identityToBlockType('cpp:for_loop')).toBe('cpp_for_loop')
    })

    it('🔴 不是身分的東西丟錯——不得靜靜投影一個垃圾出來', () => {
      expect(() => identityToDir('car.wheelFL.speed')).toThrow(/ambiguous/)
      expect(() => identityToBlockType('')).toThrow()
    })
  })

  // ─── 規則①＋②：分得出來，而歧義要出聲 ───

  describe('判別：三種答案', () => {
    it('有擁有者 → 身分', () => {
      expect(classifyPath('python:numpy.linalg.solve').kind).toBe('identity')
      expect(classifyPath('cpp:for_loop').kind).toBe('identity')
      expect(classifyPath('@someone:pkg.mod').kind).toBe('identity')
    })

    /**
     * 🔴 **這是全部的重點。**
     *
     * `numpy.linalg.solve` 少了 `python:` 就與 `car.wheelFL` 逐字同形
     * ——而它兩種都讀得通。
     */
    it('🔴 沒有擁有者而帶 `.` → 歧義，而且說得出為什麼', () => {
      const v = classifyPath('car.wheelFL.speed')
      expect(v.kind).toBe('ambiguous')
      expect(v.why, '🔴 說不出為什麼的歧義，與一個猜出來的答案一樣沒用')
        .toMatch(/兩種都讀得通/)
    })

    it('不合法的形狀 → 說得出哪一段壞了', () => {
      expect(classifyPath('').kind).toBe('invalid')
      expect(classifyPath('cpp:').kind).toBe('invalid')
      expect(classifyPath('cpp:a..b').why).toMatch(/不合法/)
      // ⚠️ `string::npos` 是程式碼的字面，不是身分
      expect(classifyPath('cpp:string::npos').kind).toBe('invalid')
      // 一個裸的名字：既不是身分（缺擁有者）也不是路徑（只有一段）
      expect(classifyPath('speed').kind).toBe('invalid')
    })
  })

  // ─── 回歸的底線 ───

  it('🔴 硬性零：現有的每一顆身分都判得成身分', () => {
    const bad = IDS.map((id) => ({ id, v: classifyPath(id) }))
      .filter((x) => x.v.kind !== 'identity')
      .map((x) => `${x.id} → ${x.v.kind}${x.v.why ? `（${x.v.why}）` : ''}`)
    expect(
      bad,
      '🔴 現有的身分被判成別的東西——判別器的規則比現實窄，\n'
        + '   而**現實才是對的**：先改判別器，不要改那些身分。',
    ).toEqual([])
  })

  /**
   * 規則②（`concepts/元件.md:214`）：**階層只能來自語言的語義，
   * 不准表達我們的分類**。
   *
   * ⚠️ 今天帶 `.` 的身分 0 顆，所以這一條**現在守的是未來**
   * ——它會在第一個人寫下 `cpp:containers.vector` 的那一刻紅。
   */
  it('🔴 硬性零：身分的階層不得是我們發明的分類', () => {
    const bad: string[] = []
    for (const id of IDS) {
      const name = id.slice(id.indexOf(':') + 1)
      if (!name.includes('.')) continue
      for (const seg of name.split('.')) {
        if ((OUR_CATEGORIES as readonly string[]).includes(seg)) {
          bad.push(`${id} 的「${seg}」是我們的分類，不是語言的語義`)
        }
      }
    }
    expect(
      bad,
      '🔴 階層表達了我們的分類——而**分類會變，變了就是搬家**\n'
        + '   （history/047：「模組是搬家的中途站，不是終點」）。\n'
        + '   🟢 分類已經有地方住：`forms/blocks.json` 的 `category` ＋ 工具箱的有序來源。',
    ).toEqual([])
  })

  // ─── 注入（第四十九條） ───

  it('★ 注入：一個歧義的字串 → 抓得到並說得出原因', () => {
    const v = classifyPath('a.b.c')
    expect(v.kind).toBe('ambiguous')
    expect(v.why).toBeTruthy()
  })

  it('★ 注入：一個帶我們分類的身分 → 抓得到', () => {
    const fake = ['cpp:containers.vector', 'cpp:for_loop']
    const bad = fake.filter((id) => {
      const name = id.slice(id.indexOf(':') + 1)
      return name.split('.').some((s) => (OUR_CATEGORIES as readonly string[]).includes(s))
    })
    expect(bad).toEqual(['cpp:containers.vector'])
  })

  it('★ 反向：乾淨的身分不得被報', () => {
    expect(classifyPath('python:numpy.linalg.solve').kind).toBe('identity')
  })

  /**
   * ★ **判別器不得知道任何語言**——它住在核心。
   *
   * `concepts/元件.md` 逐字：「選 `.` 而不是 `/` 的決定性理由是核心純淨性……
   * **所以分隔符不能跟語言走**」。
   */
  it('★ 核心純淨：判別器裡沒有語言名', () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'src/core/component/path-syntax.ts'), 'utf8')
    const code = src.split('\n')
      .filter((l) => { const t = l.trim(); return !t.startsWith('*') && !t.startsWith('//') && !t.startsWith('/*') })
      .join('\n')
    for (const lang of ['cpp', 'python', 'arduino']) {
      expect(code.includes(`'${lang}'`) || code.includes(`"${lang}"`),
        `🔴 判別器裡出現了語言名 ${lang}——它住在核心，而核心不得知道語言`).toBe(false)
    }
  })
})
