/**
 * Python 的骨架宣告——**在模組載入時註冊**。
 *
 * 🔴 為什麼 Python 也要一份「空的」：`skeletonById('none')` 在 2026-08-28
 * 對 Python 回的是**C++ 那一份**——同一個 id 跨語言撞名。
 * 症狀是狀態列顯示「沒有骨架」而那句話碰巧是對的，
 * **而選單裡「骨架」那一組整個不見**（`skeletonsOfLanguage('python')` 是空的）。
 *
 * > **一個 id 沒有語言的話，第二個語言進來的那天它會安靜地撿到別人的宣告。**
 */
import { registerSkeleton, parseSkeleton } from '../../../core/skeleton'
import pythonNoneSkeletonDef from './python-none.json'

registerSkeleton(parseSkeleton(pythonNoneSkeletonDef))
