// captureArtifact for the jsdom tests, without the compute-time check (HOT_SCOPE_TIME). That check compares wall-clock
// time with an 8 ms budget, and in jsdom it measures the machine's load and dev-mode bookkeeping rather than what a
// page would cost: tiny memos crossed it at random whenever other work shared the CPU. Every other diagnostic, re-run
// attribution and waste check stays on, and the browser tests capture with the full defaults, timing included.
import { captureArtifact as capture, type CaptureOptions, type CaptureResult } from '@solidjs/diagnostics';

export function captureArtifact<T>(scenario: () => T | Promise<T>, options: CaptureOptions = {}): Promise<CaptureResult<T>> {
  return capture(scenario, { ...options, attribution: { hotTime: false } });
}
