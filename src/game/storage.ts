// ── localStorage helpers with Safari private-mode guard ──────────────────────

export function lsGet(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

export function lsSet(key: string, value: string): void {
  try { localStorage.setItem(key, value) } catch { /* noop */ }
}

// ── Daily challenge date helpers ──────────────────────────────────────────────

/** Returns YYYYMMDD string for today's local date */
export function todayKey(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

/** Returns true if the player has already attempted today's daily */
export function isDailyDone(): boolean {
  return lsGet(`gnr-daily-${todayKey()}`) === 'done'
}

/** Marks today's daily as completed and stores the score */
export function markDailyDone(score: number): void {
  const key = todayKey()
  lsSet(`gnr-daily-${key}`, 'done')
  lsSet(`gnr-daily-score-${key}`, String(score))
}

/** Returns today's saved daily score, or null */
export function getDailyScore(): number | null {
  const raw = lsGet(`gnr-daily-score-${todayKey()}`)
  if (raw === null) return null
  const n = parseInt(raw, 10)
  return isNaN(n) ? null : n
}

// ── Best scores per mode ──────────────────────────────────────────────────────

export function getBestScore(modeKey: string): number {
  const raw = lsGet(`gnr-best-${modeKey}`)
  if (raw === null) return 0
  const n = parseInt(raw, 10)
  return isNaN(n) ? 0 : n
}

export function saveBestScore(modeKey: string, score: number): void {
  const current = getBestScore(modeKey)
  if (score > current) {
    lsSet(`gnr-best-${modeKey}`, String(score))
  }
}
