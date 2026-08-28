/**
 * spec 150：**函式庫的標頭與能力也得跟著板子走。**
 *
 * ## ⚠️ 這一支的能力邊界——它比 spec 146 那支弱，而弱在哪要寫出來
 *
 * ```
 * spec 146 的護欄   真的跑 gcc -x c -fsyntax-only     → 守到【編得過】
 * 這一支            比對宣告與產出的字串              → 只守到【我們產出的名字對不對】
 * ```
 *
 * 理由：本機沒有 Arduino 的核心（`~/Library/Arduino15/packages/` 只有 `arduino`／`builtin`），
 * 所以編不了 ESP8266 的程式碼。
 *
 * > **一個只守得到一半的護欄，要把另一半【寫在自己身上】
 * > ——否則下一個人會以為它守住了全部。**
 *
 * 🔴 沒守到的那一半：`ESP8266WiFi.h` 與 `WiFi.h` 的 **API 差異**。
 * 這一刀只換標頭（`WiFi.begin` 兩邊同名），而**更深的差異沒有人量過**。
 */
import { describe, it, expect } from 'vitest'
import type { Target } from '../../src/core/types'
import { componentTraits } from '../../src/core/component/traits'
import { filterByTarget } from '../../src/core/component/traits'

const modules = import.meta.glob('../../src/languages/cpp/targets/*.json', { eager: true }) as Record<
  string,
  { default: Target }
>
const targets = Object.values(modules).map((m) => m.default)
const byId = (id: string) => targets.find((t) => t.id === id)!

const WIFI_COMPONENTS = ['cpp:wifi_open', 'cpp:wifi_read'] as const

describe('spec 150 · US1：標頭跟著板子走', () => {
  it('★ 錨點：兩塊 ESP8266 都帶著替換表', () => {
    for (const id of ['wemos-d1-mini', 'nodemcu-esp8266'] as const) {
      expect(byId(id).headerAliases, `${id} 沒有替換表`).toBeTruthy()
    }
  })

  it('🔴 ESP8266 把 `<WiFi.h>` 換成 `<ESP8266WiFi.h>`', () => {
    // 來源：`esp8266/Arduino` 的 `libraries/` 有 ESP8266WiFi，**沒有 WiFi**
    expect(byId('wemos-d1-mini').headerAliases!['<WiFi.h>']).toBe('<ESP8266WiFi.h>')
  })

  it('🔴 ESP32 全系列【不換】——它的核心就叫 `WiFi`', () => {
    for (const id of ['esp32', 'esp32c3', 'esp32s3', 'esp32s3-cam'] as const) {
      expect(byId(id).headerAliases, `${id} 不該有替換表`).toBeUndefined()
    }
  })

  it('🔴 而元件宣告的仍然是 `<WiFi.h>`——替換是【投影】不是【真相】', () => {
    // > 標頭是那個需求在某塊板子上的投影（spec 146 同一課）。
    //   元件不該知道有哪些板子。
    expect(byId('wemos-d1-mini').headerAliases!['<ESP8266WiFi.h>'],
      '替換表反過來寫了——那會讓 ESP32 的產出也被動到').toBeUndefined()
  })
})

describe('spec 150 · US2：沒有 WiFi 的板子看不到 WiFi 積木', () => {
  it('★ 錨點：兩顆 WiFi 元件都宣告了它需要 `wifi`', () => {
    for (const c of WIFI_COMPONENTS) {
      expect(componentTraits(c)?.needsCapability, `${c} 沒宣告 needsCapability`).toBe('wifi')
    }
  })

  it('🔴 Uno／Nano 看不到——AVR 的核心裡沒有 WiFi 函式庫', () => {
    for (const id of ['arduino-uno', 'arduino-nano'] as const) {
      const visible = filterByTarget(new Set<string>(WIFI_COMPONENTS), byId(id))
      expect([...visible], `${id} 上看得到 WiFi 積木`).toEqual([])
    }
  })

  it('🔴 而六塊有 WiFi 的板子【看得到】——否則上面只是全部被關掉', () => {
    for (const id of ['esp32', 'esp32c3', 'esp32s3', 'esp32s3-cam',
                      'wemos-d1-mini', 'nodemcu-esp8266'] as const) {
      const visible = filterByTarget(new Set<string>(WIFI_COMPONENTS), byId(id))
      expect([...visible].sort(), `${id} 上看不到 WiFi 積木`).toEqual([...WIFI_COMPONENTS].sort())
    }
  })
})

describe('spec 150 · US3：其他目標一個字都不能變', () => {
  it('🔴 不指定板子的 `arduino` 省略 `provides` ＝ 提供全部', () => {
    const arduino = byId('arduino')
    expect(arduino.provides, '`arduino` 長出了 provides——那條預設不可反').toBeUndefined()
    expect([...filterByTarget(new Set<string>(WIFI_COMPONENTS), arduino)].sort())
      .toEqual([...WIFI_COMPONENTS].sort())
  })

  it('🔴 `cpp`／`c`／競程沒有替換表也沒有板子', () => {
    for (const id of ['cpp', 'c', 'cpp-advanced'] as const) {
      expect(byId(id).headerAliases, `${id} 長出了替換表`).toBeUndefined()
      expect(byId(id).board, `${id} 長出了板子`).toBeUndefined()
    }
  })
})
