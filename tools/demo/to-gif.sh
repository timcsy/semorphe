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
