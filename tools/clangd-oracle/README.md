# clangd 裁判——階段 6.6 ⑤ 的量測工具

**用途**：拿一個**每台機器都一樣**的 C++ 裁判，量兩個數字：

```
涵蓋率  clang 說不合法而我們也擋下的比例
假警報  clang 說合法而我們擋下的比例
```

## 🔴 為什麼是瀏覽器裡的 clang，不是本機的 g++

`build-guardrail` 6.8 逐字：「⚠️ 而還有第三個問題，它在單機開發時永遠是隱形的：
**這個量在別台機器上一樣嗎？**」——`audit-behavior-error` 的不一致筆數在 macOS 是 1、
在 CI 是 0，因為 macOS 的 `g++` 其實是 Apple clang。

**跑在 wasm 裡的 clangd 每台機器都是同一個二進位。**

## 怎麼跑

```bash
# 1. 取得 clangd.wasm（121 MB，【不進版控】）
mkdir -p tools/clangd-oracle/wasm
curl -L https://clangd.guyutongxue.site/wasm/clangd.js   -o tools/clangd-oracle/wasm/clangd.js
curl -L https://clangd.guyutongxue.site/wasm/clangd.wasm -o tools/clangd-oracle/wasm/clangd.wasm

# 2. 產生「我們的判定」→ /tmp/ours.json
# 3. 產生「clang 的判定」→ /tmp/clang.json
# 4. 合併
node tools/clangd-oracle/run.mjs
```

## ⚠️ 三件必讀

**① clangd 必須跑在 worker 裡。** 它 build 時只開了 `worker` 環境，
主緒載入會 `Aborted(web environment detected but not enabled at build time)`。

**② sysroot 在 wasm 裡，而 clangd 找不到它**——要寫 `/compile_flags.txt`：

```
-xc++  -std=c++20  --target=wasm32-wasi
-isystem/usr/include/wasm32-wasi/c++/v1
```

沒有這個檔的時候它報 `'iostream' file not found`——⚠️ **那看起來像
「sysroot 不存在」，實際上是「沒有人告訴它去哪裡找」**。

**③ 🔴 這個裁判有它看不懂的方言，那些必須歸「無法確定」**：

```
Arduino     核心標頭不在 wasi sysroot 裡 → 全部報 undeclared_var_use
__gcd       GCC 擴充，不在 libc++ 裡
```

⚠️ **不把它們排除掉，涵蓋率會從 78% 變成 35%**——而那個數字
**看起來像一個發現**（`build-guardrail` 6.5）。
**判不出來的不計入任一邊。**

### 🔴 而更準的說法：**邊界是「目標」的函數**（2026-08-17 補）

「Arduino 判不出來」不是這個裁判壞了，是**我們沒有告訴它目標是什麼**。
`--target=wasm32-wasi` 是**我們選的**；換成 `arduino-cli`，那十筆就是可判的。

> **裁判的能力邊界不是固定的——它是【目標】的函數。**

⚠️ 而那正是 `knowledge/draft/2026-08-13-C和C++難分難捨.md`§三 的 `target` 設計裡
`reference` 那個欄位在說的事。**這份工具今天把目標寫死在 `FLAGS` 裡。**
