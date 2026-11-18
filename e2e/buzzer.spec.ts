/**
 * **蜂鳴器在 ESP32-C3 上走一整圈**（2026-11-18，使用者：「明天主要要教到蜂鳴器，這一些功能和體驗都要確保是好的」）。
 *
 * ```
 * ① 貼一段蜂鳴器程式 → 積木：tone（有時長／沒時長）、noTone、腳位模式那一顆都是專屬積木
 * ② 「持續 … 毫秒」那一格空著 ＝ 程式碼裡沒有第三個數字
 * ③ 以積木為準轉回程式碼 → 一字不差
 * ④ 積木上寫的是中文的意思（「發出 … 赫茲的聲音」「停止發聲」「模式」），不是函式名
 * ```
 *
 * ⚠️ 這支擋不住「聲音對不對」——那是 Cella 的判決，`src/components/cpp/tone/spec.test.ts`
 *    在 esp32c3 上跑了三條（沒時長、noTone 停、三音旋律）。
 */
import { test, expect } from '@playwright/test'
import { freshApp, pickTarget, useAsSource, treeHas, blocksSettled } from './helpers'

/* eslint-disable @typescript-eslint/no-explicit-any */
const BUZZER = `const int BUZZER = 4;

void setup() {
  pinMode(BUZZER, OUTPUT);
}

void loop() {
  tone(BUZZER, 262);
  delay(300);
  noTone(BUZZER);
  delay(300);
  tone(BUZZER, 330, 200);
  delay(500);
}
`

test('蜂鳴器：ESP32-C3 上 程式碼 → 積木 → 程式碼 一字不差，積木說的是中文的意思', async ({ page }) => {
  test.setTimeout(180_000)
  await freshApp(page)
  await pickTarget(page, 'esp32c3')
  await page.evaluate((c) => (window as any).__app.codeView.setCode(c), BUZZER)
  await useAsSource(page, '程式碼')
  await treeHas(page, 'cpp:tone_stop')
  await blocksSettled(page)

  const seen = await page.evaluate(() => {
    const ws = (window as any).__app.blocklyPanel.workspace
    const blocks = ws.getAllBlocks(false) as any[]
    const tones = blocks.filter((b) => b.type === 'cpp_tone')
    return {
      types: [...new Set(blocks.map((b) => b.type as string))],
      toneDurations: tones.map((b) => Boolean(b.getInputTargetBlock('DURATION'))),
      text: blocks.filter((b) => ['cpp_tone', 'cpp_tone_stop', 'cpp_pin_mode', 'cpp_pin_constant_mode'].includes(b.type))
        .map((b) => b.toString() as string),
    }
  })
  // ① 專屬積木，不是灰色的「直接寫程式碼」
  for (const t of ['cpp_tone', 'cpp_tone_stop', 'cpp_pin_mode', 'cpp_pin_constant_mode']) expect(seen.types, `少了 ${t}`).toContain(t)
  expect(seen.types, '有一段沒認出來').not.toContain('cpp_raw_code')
  // ② 第一顆 tone 沒有時長、第二顆有
  expect(seen.toneDurations).toEqual([false, true])
  // ④ 積木上的字
  const all = seen.text.join('\n')
  expect(all).toMatch(/發出.*赫茲的聲音/)
  expect(all).toMatch(/停止發聲/)
  expect(all).toMatch(/的模式為/)
  expect(all).toMatch(/輸出 OUTPUT/)

  // ③ 以積木為準 → 程式碼一字不差（⚠️ 範例用兩格縮排：那是預設風格，積木產出的碼照它排）
  await useAsSource(page, '積木')
  await blocksSettled(page)
  const back = await page.evaluate(() => (window as any).__app.codeView.getCode() as string)
  expect(back).toBe(BUZZER)
})
