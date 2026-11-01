/**
 * **板子專屬的標頭名 → 正典名**（第 204 刀）——`<ESP8266WiFi.h>` 收回 `<WiFi.h>`。
 *
 * spec 150 讓每塊板子宣告「正典名在我這裡叫什麼」（`headerAliases`：`<WiFi.h>` → `<ESP8266WiFi.h>`），
 * 產出時照當下的板子換。而反向沒有人做：ESP8266 的產出來回一趟後，語義樹裡是 `ESP8266WiFi.h`，
 * 再切到 ESP32 就換不回去（history 101 的「已知缺口」），D1 mini 上自己的產出來回一趟還會多一行。
 *
 * 101 寫下的正解方向是「一個能力有一個正典標頭」，而**不是**讓每塊板子列出別塊的標頭（不 scale）。
 * 這裡的反查表由**所有目標的 `headerAliases` 自動導出**——加一塊板子只要宣告它自己的別名。
 */
const TARGETS = import.meta.glob('./targets/*.json', { eager: true, import: 'default' }) as Record<string, { headerAliases?: Record<string, string> }>

const bare = (h: string): string => h.trim().replace(/^<|>$/g, '')

const CANON = new Map<string, string>()
for (const t of Object.values(TARGETS)) {
  for (const [canonical, local] of Object.entries(t.headerAliases ?? {})) CANON.set(bare(local), bare(canonical))
}

/** 板子專屬名 → 正典名（裸名，不帶角括號）；不是任何板子的專屬名就原樣（剝掉角括號）。 */
export function canonicalBoardHeader(header: string): string {
  const b = bare(header)
  return CANON.get(b) ?? b
}
