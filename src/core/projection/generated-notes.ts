/**
 * **產碼自己加的註明**（spec 215）——不是使用者寫的註解，讀回來時不收成標註。
 *
 * ## 為什麼需要它
 *
 * 換成 printf 時推不出型別的那一行保留 `cout`，行尾註明原因（使用者 2026-11-04 定 A）。
 * 而那一行讀回程式碼時，註明會被當成**使用者的行末註解**收成標註——型別到了、那一行換成 printf 之後，
 * 「保留 cout」的註明還掛在 printf 那一行上：一句**過期的說明**。
 *
 * ## 分工
 *
 * | 誰 | 提供什麼 |
 * |---|---|
 * | 語言套件 | 註明的文字（它自己產的） |
 * | 核心 | 輸出行末註解時，把登記過的註明拿掉——那一行還需要的話，產生器會自己再加 |
 */
const notes = new Set<string>()

/** 語言套件登記一句「我自己會產的註明」。 */
export function declareGeneratedNote(text: string): void {
  notes.add(text)
}

/**
 * 把一段行末註解裡**產碼自己加的註明**拿掉，剩下使用者的部分；全是註明時回空字串。
 * ⚠️ 註明可能與使用者的註解併在同一行（`… // 註明 // 使用者的`）——拿掉註明，也拿掉它留下的分隔。
 */
export function withoutGeneratedNotes(text: string): string {
  let t = text
  for (const n of notes) {
    if (!t.includes(n)) continue
    t = t.split(n).join('')
  }
  if (t === text) return text
  // 拿掉之後兩端剩下的分隔（`; `、`//`）也拿掉
  return t.replace(/^[\s;/]+|[\s;/]+$/g, '')
}
