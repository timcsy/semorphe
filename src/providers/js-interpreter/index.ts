/**
 * **第一個提供者：今天的 JS 直譯器**（spec 179，重構階段 1）。
 *
 * 只宣告它真的有的能力——執行與除錯、步數。**不宣告判決與型別查詢**：
 * 它沒有這兩種能力，假裝有（例如把「跑完沒出錯」當 accept）就違反 P6 誠實降級。
 *
 * 🪦 **重構階段 6（切換到 Cella 那天）整個目錄刪掉**，連同 `src/interpreter/` 與各元件的 `execute.ts`。
 * 核心與介面不 import 這裡（`audit-layering` 守著），所以刪它不必動核心。
 */
import { SemanticInterpreter } from '../../interpreter/interpreter'
import { RuntimeError } from '../../interpreter/errors'
import { SessionStop, type ExecutionSession, type Provider, type SessionOptions } from '../../core/capabilities'

/** 直譯器的停止 → 核心的停止。控制器只認 `SessionStop`。 */
function normalize(e: unknown): unknown {
  if (e instanceof RuntimeError) {
    return new SessionStop(e.i18nKey === 'RUNTIME_ERR_ABORTED' ? 'aborted' : 'runtime', e.i18nKey, e.params, e.nodeId)
  }
  return e
}

function createSession(options: SessionOptions): ExecutionSession {
  const it = new SemanticInterpreter({ maxSteps: options.maxSteps, board: options.board })
  return {
    onOutput: (cb) => it.setOutputCallback(cb),
    onWaiting: (cb) => it.setWaitingCallback(cb),
    onStepRecord: (cb) => it.setStepRecordCallback(cb),
    setInputProvider: (p) => it.setInputProvider(p),
    setUnknownPause: (fn) => it.setUnknownComponentPause(fn),
    setRecordSteps: (on) => it.setRecordSteps(on),
    run: async (program) => {
      try { await it.execute(program) } catch (e) { throw normalize(e) }
    },
    runWithSteps: async (program) => {
      try { return await it.executeWithSteps(program) } catch (e) { throw normalize(e) }
    },
    abort: () => it.abort(),
    scope: () => it.snapshotScope(),
    setVariable: (name, raw) => it.setVariableFromHost(name, raw),
    visitCounts: () => it.getVisitCounts(),
    recordedInputs: () => it.getRecordedInputs(),
  }
}

export const jsInterpreterProvider: Provider = {
  id: 'js-interpreter',
  declares: { session: { granularity: 'node', setInput: false, setVariable: true, steps: true } },
  createSession,
}
