/**
 * 433：Arduino 的 `String`（核心的類別，不是 std::string）翻得到 Cella——板子上送 `tClass String`、方法走 `eMCall`。
 * 來源：探針 `arduino-builtins` 的序列埠指令解析語料（real_11／14／15）原本整支「型別 String 還沒有對應」，Cella 判不了。
 */
import { describe, it, expect } from 'vitest'
import { expectCellaOut, runCella, describeCellaResult } from '../helpers/cella-run'

const PARSER = `
void setup() {
  Serial.begin(9600);
  String line = Serial.readStringUntil('\\n');
  line.trim();
  int comma = line.indexOf(',');
  String cmd = line.substring(0, comma);
  int value = line.substring(comma + 1).toInt();
  Serial.print(cmd);
  Serial.print(" -> ");
  Serial.println(value * 2);
}
void loop() {}
`

describe('Arduino 的 String 接上 Cella', () => {
  it('Uno：讀一行、trim、indexOf／substring 拆開、toInt', async () => {
    await expectCellaOut(PARSER, 'led -> 42\r\n', { board: 'uno', stdin: 'led,21  \n' })
  })

  // ⚠️ Uno 上「開頭有空白、去掉之後比空白長」的 trim 判 reject（ubLib），ESP32 不會。實測的邊界（`"  ab  "` 綠、`"  led,2"` 紅）
  //    符合「AVR 核心的 `String::trim()` 用 memcpy 搬重疊的區段」——那在真的板子上也是未定義行為；⚠️ 這是推測，已請 Cella 確認（433）。
  //    送出去的形狀與 ESP32 那支相同，所以不是我們送錯——釘住它，Cella 改了模型時這條會紅
  it('Uno：開頭有空白而 trim 要搬重疊的區段 → reject（AVR 核心的 memcpy）', async () => {
    const r = await runCella(PARSER, { board: 'uno', stdin: '  led,21\n' })
    expect(r.verdict).toBe('reject')
    expect(describeCellaResult(r)).toContain('line.trim()')
  })

  it('ESP32：同一支在另一塊板子上也一樣', async () => {
    await expectCellaOut(PARSER, 'led -> 42\r\n', { board: 'esp32', stdin: 'led,21\n' })
  })

  it('不在板子上：`String` 不是標準 C++ 的型別，照實翻不出', async () => {
    const r = await runCella('#include <iostream>\nint main() { String s = "a"; }\n')
    expect(describeCellaResult(r)).toContain('型別「String」還沒有對應')
  })
})
