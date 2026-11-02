/**
 * **共用的 Cella 判決入口**（spec 198，重構 6c-1）——6c 要把 127 個「拿 JS 直譯器當執行判準」的測試檔改成對 Cella 驗，這是它們共用的那一個入口。
 *
 * 守兩件事（`knowledge/draft/2026-11-02-6c測試盤點.md` 的風險 1、2）：
 * ① 同一個測試檔裡模組只準備一次（不然 127 個檔各編一次，全套多十幾分鐘，最後的結局是被加上跳過條件）
 * ② 判不出來、翻不出來、判定有錯，一律讓「斷言輸出」失敗並說清楚——**不得**被當成跳過或空字串（P6 誠實降級）
 *
 * ⚠️ 注入用的程式都挑「依定義不會變」的：無窮迴圈（步數用盡）、讀未初始化的值（標準定死的未定義行為）、內嵌組語（原樣保留）——
 * 不會因為 Cella 或 formalize 補了東西就過期（experience〈拿「今天還沒做的」當「不支援」的測試範例〉）。
 */
import { describe, it, expect } from 'vitest'
import { runCella, expectCellaOut, knownCellaGap } from '../../helpers/cella-run'

const H = '#include <iostream>\nusing namespace std;\n'

describe('runCella：走產品同一條路拿到判決', () => {
  it('★ 正向錨點：合法、輸出確定的程式 → accept 與輸出', async () => {
    const r = await runCella(`${H}int main() {\n    cout << 1 + 2;\n    return 0;\n}\n`)
    expect(r.verdict).toBe('accept')
    expect(r.out).toBe('3')
  })

  it('★ 輸入照送：讀兩個數、印它們的和', async () => {
    const r = await runCella(`${H}int main() {\n    int a, b;\n    cin >> a >> b;\n    cout << a + b;\n    return 0;\n}\n`, { stdin: '4 5\n' })
    expect(r).toMatchObject({ verdict: 'accept', out: '9' })
  })

  it('★ 同一個檔裡模組只準備一次：第二次起遠快於第一次的準備', async () => {
    const code = `${H}int main() {\n    cout << 7;\n    return 0;\n}\n`
    const t0 = Date.now()
    for (let i = 0; i < 20; i++) expect((await runCella(code)).out).toBe('7')
    const per = (Date.now() - t0) / 20
    // 準備模組要秒級；之後每次判決是毫秒級——平均每次遠小於一秒，就代表沒有每次重新準備
    expect(per).toBeLessThan(500)
  })
})

describe('expectCellaOut：非 accept 一律失敗並說清楚（P6）', () => {
  it('★ 正向錨點：accept 且輸出相同 → 通過', async () => {
    await expectCellaOut(`${H}int main() {\n    cout << "hi";\n    return 0;\n}\n`, 'hi')
  })

  it('🔴 unknown（步數用盡）→ 失敗，訊息有判決種類、問題種類與原始碼', async () => {
    const err = await expectCellaOut(`${H}int main() {\n    while (true) {\n    }\n    return 0;\n}\n`, '', { steps: 2000 }).then(() => null, (e: Error) => e)
    expect(err, '判不出來不得當成通過').not.toBeNull()
    expect(err!.message).toMatch(/unknown/)
    expect(err!.message).toMatch(/fuel/)
  })

  it('🔴 reject（讀未初始化的值）→ 失敗，訊息有原因與那一行', async () => {
    const err = await expectCellaOut(`${H}int main() {\n    int x;\n    cout << x;\n    return 0;\n}\n`, '0').then(() => null, (e: Error) => e)
    expect(err, '判定有錯不得當成通過').not.toBeNull()
    expect(err!.message).toMatch(/reject/)
    expect(err!.message).toMatch(/第 \d+ 行/)
  })

  it('🔴 翻不出（內嵌組語）→ 失敗並列出構造，不是輸出為空', async () => {
    const err = await expectCellaOut(`${H}int main() {\n    asm volatile("nop");\n    cout << 1;\n    return 0;\n}\n`, '1').then(() => null, (e: Error) => e)
    expect(err, '翻不出不得當成通過').not.toBeNull()
    expect(err!.message).toMatch(/翻不出/)
  })

  it('🔴 輸出不同 → 失敗，印出期望與實際', async () => {
    const err = await expectCellaOut(`${H}int main() {\n    cout << 2;\n    return 0;\n}\n`, '3').then(() => null, (e: Error) => e)
    expect(err).not.toBeNull()
    expect(err!.message).toMatch(/3/)
    expect(err!.message).toMatch(/2/)
  })

  it('★ 刻意驗 reject 的測試：runCella 拿得到完整判決，不會被入口先擋掉', async () => {
    const r = await runCella(`${H}int main() {\n    int x;\n    cout << x;\n    return 0;\n}\n`)
    expect(r.verdict).toBe('reject')
    expect(r.problems.map((p) => p.kind)).toContain('ubUninit')
    expect(r.problems[0].source?.line, '問題要對回原始碼的行號').toBeGreaterThan(0)
  })
})

// spec 199：已知缺陷的釘子——三種結果各一條（不碰 Cella，只驗包裝本身）
describe('knownCellaGap', () => {
  it('缺陷還在（本體丟錯、原因吻合）→ 通過', async () => {
    await knownCellaGap(/fmax/, async () => { throw new Error('unsupported：fmax is not supported yet') })
  })
  it('缺陷修好了（本體通過）→ 紅，並叫人拿掉包裝', async () => {
    await expect(knownCellaGap(/fmax/, async () => {})).rejects.toThrow(/不在了/)
  })
  it('缺陷換了一個（原因不吻合）→ 紅', async () => {
    await expect(knownCellaGap(/fmax/, async () => { throw new Error('reject：別的東西') })).rejects.toThrow(/形狀變了/)
  })
})
