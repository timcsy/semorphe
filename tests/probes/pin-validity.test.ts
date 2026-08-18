/**
 * 探針：**語料裡的腳位使用，在它宣告的板子上合法嗎。**
 *
 * ## 🔴 它量出 0，而【0 是這支探針最重要的產出】
 *
 * 起因是一個提案：把接線積木的腳位欄位改成**跟著板子的下拉**
 * （Mind+ 的 `_menus/` 一塊板子一份選單，四家競品裡三家都做了）。
 *
 * ⚠️ 而 draft 的出口條件寫著「**要先量『腳位打錯』在語料裡發生過幾次**」
 * ——不量就做，就是照著別人的答案抄。
 *
 * 量出來：**597 處腳位使用，四類錯誤 0 筆。**
 *
 * ## 而 0 不代表「學生不會打錯」——**它代表這份語料答不了這個問題**
 *
 * ```
 * 語料的來源   140 段【AI 生成】的 sketch
 * LLM 的行為   用教科書腳位（LED 接 13、PWM 接 9）——因為訓練資料就是那些
 * 🔴 結論       一份沒有學生寫過的語料，量不出學生的錯誤
 * ```
 *
 * > **一個量測的效力，上限是它的樣本來自誰。**
 *
 * 🟢 **所以這支探針的用途變了**：它不再是「該不該做下拉」的證據，
 * 而是一條**回歸線**——當真實的學生語料進來時，這個 0 會變，而那才是訊號。
 *
 * ⚠️ 而**偵測器本身驗過**（見下面的注入）：四類都會報、對照組不亂報。
 * **0 是量到的，不是漏掉的。**
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/** 板子的腳位事實。⚠️ 寫在這裡只為量測——**不是**產品的真相來源。 */
interface Board {
  digital: (n: number) => boolean
  pwm: (n: number) => boolean
  inputOnly: (n: number) => boolean
  reserved: (n: number) => boolean
}
const UNO_PWM = new Set([3, 5, 6, 9, 10, 11])
const BOARDS: Record<string, Board> = {
  uno: {
    digital: (n) => n >= 0 && n < 20,
    pwm: (n) => UNO_PWM.has(n),
    inputOnly: () => false,
    reserved: () => false,
  },
  nano: {
    digital: (n) => n >= 0 && n < 22,
    pwm: (n) => UNO_PWM.has(n),
    inputOnly: () => false,
    reserved: () => false,
  },
  esp32: {
    digital: (n) => n >= 0 && n < 40,
    pwm: (n) => n >= 0 && n < 34,
    // GPIO 34–39 只能輸入（沒有輸出驅動電路）
    inputOnly: (n) => n >= 34 && n <= 39,
    // GPIO 6–11 接內建快閃記憶體——動它板子會當
    reserved: (n) => n >= 6 && n <= 11,
  },
}

const CALLS =
  /\b(pinMode|digitalWrite|digitalRead|analogWrite|analogRead|tone|noTone|pulseIn|ledcAttachPin|ledcAttach)\s*\(\s*([A-Za-z_]\w*|\d+)/g

/** `#define` 與整數常數宣告 → 值。⚠️ 追不到值的**不計入分母**。 */
function constants(code: string): Map<string, number> {
  const m = new Map<string, number>()
  for (const x of code.matchAll(/#define\s+(\w+)\s+(\d+)/g)) m.set(x[1], Number(x[2]))
  for (const x of code.matchAll(/(?:const\s+)?(?:int|byte|uint8_t)\s+(\w+)\s*=\s*(\d+)\s*;/g)) {
    m.set(x[1], Number(x[2]))
  }
  return m
}

interface Finding { kind: string; where: string }

export function scanPins(code: string, board: string): { findings: Finding[]; checked: number } {
  const B = BOARDS[board] ?? BOARDS.uno
  const C = constants(code)
  const findings: Finding[] = []
  let checked = 0
  for (const [, fn, arg] of code.matchAll(CALLS)) {
    const n = /^\d+$/.test(arg) ? Number(arg) : C.get(arg)
    if (n === undefined) continue
    checked++
    const at = `${fn}(${arg}=${n})`
    if (!B.digital(n)) findings.push({ kind: '① 腳位號超出板子範圍', where: at })
    if (fn === 'analogWrite' && !B.pwm(n)) findings.push({ kind: '② analogWrite 用在沒有 PWM 的腳位', where: at })
    if ((fn === 'digitalWrite' || fn === 'pinMode') && B.inputOnly(n) && code.includes('OUTPUT')) {
      findings.push({ kind: '③ 只能輸入的腳位被當輸出', where: at })
    }
    if (B.reserved(n)) findings.push({ kind: '④ 接快閃記憶體的保留腳位', where: at })
  }
  return { findings, checked }
}

interface Sketch { board?: string; code: string }
function corpus(): { id: string; board: string; code: string }[] {
  const dir = __dirname
  const out: { id: string; board: string; code: string }[] = []
  for (const f of readdirSync(dir).filter((x) => /^arduino-.*-corpus\.json$/.test(x))) {
    const raw = JSON.parse(readFileSync(join(dir, f), 'utf8')) as Record<string, Sketch>
    for (const [id, v] of Object.entries(raw)) out.push({ id, board: v.board ?? 'uno', code: v.code })
  }
  return out
}

describe('探針：語料裡的腳位在它的板子上合法嗎', () => {
  it('⚠️ 入口條件：語料載得到（🔴 錨在段數，不在錯誤數）', () => {
    expect(corpus().length).toBeGreaterThanOrEqual(100)
  })

  it('★ 注入：四類已知的錯誤都必須被報出', () => {
    const cases: [string, string, string][] = [
      ['uno', 'void setup(){pinMode(7,OUTPUT);}\nvoid loop(){analogWrite(7,128);}', '②'],
      ['uno', 'void setup(){pinMode(25,OUTPUT);}\nvoid loop(){digitalWrite(25,HIGH);}', '①'],
      ['esp32', 'void setup(){pinMode(34,OUTPUT);}\nvoid loop(){digitalWrite(34,HIGH);}', '③'],
      ['esp32', '#define LED 8\nvoid setup(){pinMode(LED,OUTPUT);}\nvoid loop(){}', '④'],
    ]
    for (const [board, code, want] of cases) {
      const { findings } = scanPins(code, board)
      expect(findings.map((f) => f.kind).join(' '), `${want} 沒被報出`).toContain(want)
    }
  })

  it('★ 注入：合法的用法不得被報（不亂報）', () => {
    expect(scanPins('void setup(){pinMode(9,OUTPUT);}\nvoid loop(){analogWrite(9,128);}', 'uno').findings).toEqual([])
    expect(scanPins('void setup(){pinMode(2,OUTPUT);}\nvoid loop(){digitalWrite(2,HIGH);}', 'esp32').findings).toEqual([])
  })

  it('報表：語料的腳位合法率（🔴 不設門檻——這是觀察不是把關）', () => {
    let checked = 0
    const all: string[] = []
    const byBoard: Record<string, number> = {}
    for (const s of corpus()) {
      byBoard[s.board] = (byBoard[s.board] ?? 0) + 1
      const r = scanPins(s.code, s.board)
      checked += r.checked
      for (const f of r.findings) all.push(`${s.id}(${s.board}) ${f.kind}：${f.where}`)
    }
    // ← 正向錨點：真的掃到了腳位，否則 0 是「沒量到」不是「沒有錯」
    expect(checked, '一處腳位使用都沒掃到').toBeGreaterThan(300)
    console.log(
      `\n腳位合法性：${corpus().length} 段（${JSON.stringify(byBoard)}）· 追得到值的腳位使用 ${checked} 處` +
        (all.length > 0 ? `\n  🔴 不合法 ${all.length} 處：\n  ${all.join('\n  ')}` : '\n  🟢 四類錯誤 0 筆'),
    )
  })

  it('🔴 而 0 是【這份語料】的答案，不是【學生】的答案', () => {
    // 語料是 AI 生成的——LLM 用教科書腳位，因為訓練資料就是那些。
    // ⚠️ 這一條不斷言 0（那會變成「成功即紅」的錨）；它斷言的是**樣本來源**。
    //
    // > **一個量測的效力，上限是它的樣本來自誰。**
    //
    // 🟢 真實的學生語料進來時，這支探針就會變成有意義的——**而它已經在了**。
    const boards = new Set(corpus().map((s) => s.board))
    expect(boards.has('esp32'), 'ESP32 段落要在，否則③④兩類永遠量不到').toBe(true)
    expect(boards.size, '只有一種板子的話，板子相依的錯誤量不出來').toBeGreaterThan(1)
  })
})
