#!/usr/bin/env bash
# 把 `npm run demo:record` 錄下來的影片轉成 README 用的 GIF。
#
# 🔴 **參數是量出來的**（2026-09-02）：同一支影片
#   fps 11 · 900px · 全彩 → 4.1MB   ❌ 讀者不會等
#   fps 8  · 760px · 64 色 → 1.0MB  ✅
#
# > **一支示範的長度與畫質，不是由「還想演什麼」決定的，是由它幾 MB 決定的。**
set -euo pipefail
cd "$(dirname "$0")/../.."
mk() {
  local src="$1" out="$2"
  [ -f "$src" ] || { echo "🔴 找不到 $src——先跑 npm run demo:record"; exit 1; }
  ffmpeg -v error -y -i "$src" \
    -vf "fps=8,scale=760:-1:flags=lanczos,palettegen=max_colors=64:stats_mode=diff" /tmp/semorphe-pal.png
  ffmpeg -v error -y -i "$src" -i /tmp/semorphe-pal.png \
    -lavfi "fps=8,scale=760:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" "$out"
  echo "$out  $(ls -lh "$out" | awk '{print $5}')"
}
mk test-results/record-demo/video.webm        assets/demo.gif
mk test-results/record-demo-layout/video.webm assets/demo-layout.gif
mk test-results/record-raw-raw/video.webm      assets/demo-raw.gif
mk test-results/record-lessons-lessons/video.webm assets/demo-lessons.gif

# ── 課文頁用的短片段 ──────────────────────────────────────────
#
# 🔴 **webm 不是 GIF**：同樣 3 秒的 UI 動畫，webm 大約是 GIF 的 1/5～1/10，
#    而課文頁現在是 7.5KB／零外部請求——那是它的體驗基礎。
#
# ⚠️ 而 README 仍然用 GIF：GitHub 會把 webm 變成一個【要按才會播】的播放器。
#    同一支影片轉兩種格式，各自去該去的地方。
#
# 🔴 **要剪掉開頭那幾秒**（2026-09-04 量到）：每一支的前面都是開機
#   （`goto` → 清 localStorage → `reload` → 等應用起來），而那幾秒**畫面是空的**。
#   症狀很具體：課文頁上還沒捲到的那一支，第一格是**一塊黑色方框**——看起來像壞了。
#
# ⚠️ `-ss` 要放在 `-i` **前面**（快速定位），而 2 秒是量出來的：
#   三支原始長度 9.4／10.7／9.9 秒，第 3 秒時都已經在演正題了。
clip() {
  local src="test-results/record-clips-$1/video.webm" out="assets/clips/$1.webm"
  [ -f "$src" ] || { echo "🔴 找不到 $src——先跑 npm run demo:record"; exit 1; }
  ffmpeg -v error -y -ss 2 -i "$src" \
    -vf "fps=12,scale=720:-2:flags=lanczos" \
    -c:v libvpx-vp9 -crf 40 -b:v 0 -an -row-mt 1 "$out"
  echo "$out  $(ls -lh "$out" | awk '{print $5}')"
}
mkdir -p assets/clips
clip clip-drag
clip clip-compare
clip clip-run
