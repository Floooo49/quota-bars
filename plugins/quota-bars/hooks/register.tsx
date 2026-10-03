import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Limits } from '../types'

const limits = atom({ plugin: 'quota-bars', key: 'limits' } as const, null as Limits | null)

const BAR = 12
const USAGE_TOOL = 'mcp__ccd_session_mgmt__get_usage'

let isStarted = false
let hasUsageTool = true

// L'app de bureau connait les quotas de l'abonnement (son outil get_usage) ;
// ailleurs, les fenetres que le moteur a lues dans la derniere reponse.
async function refresh($: any) {
  if (hasUsageTool) {
    try {
      const answer = await $.tool.call({ tool: USAGE_TOOL })
      const windows: { label: string; percentUsed: number; resetsAt?: string }[] =
        JSON.parse(answer.text ?? '{}').plan?.windows ?? []
      const found: Limits = []
      for (const w of windows) {
        if (/5-hour/i.test(w.label)) found.push({ kind: 'five_hour', percentUsed: w.percentUsed, resetsAt: w.resetsAt })
        else if (/weekly/i.test(w.label) && /all/i.test(w.label)) found.push({ kind: 'seven_day', percentUsed: w.percentUsed, resetsAt: w.resetsAt })
      }
      if (found.length > 0) {
        await update($, limits, () => found)
        return
      }
    } catch {
      hasUsageTool = false
    }
  }
  try {
    const usage = await $.session.usage()
    if (usage.rateLimits.length > 0) await update($, limits, () => usage.rateLimits)
  } catch {}
}

async function start($: any) {
  if (isStarted) return
  isStarted = true
  $.clock.every(60_000, () => {
    refresh($)
  })
  await refresh($)
}

// Vert sous 70 %, jaune jusqu'a 90 %, rouge au-dela.
const colorOf = (pct: number) => (pct >= 90 ? 'red' : pct >= 70 ? 'yellow' : 'green')

const bar = (pct: number) => {
  const full = Math.max(0, Math.min(BAR, Math.round((pct / 100) * BAR)))
  return { full: '█'.repeat(full), empty: '░'.repeat(BAR - full) }
}

// Temps restant avant la remise a zero : « 2h13 », « 3j 4h », « 12 min ».
const remaining = (resetsAt: string | undefined, now: number) => {
  if (!resetsAt) return ''
  const ms = Date.parse(resetsAt) - now
  if (!(ms > 0)) return ''
  const min = Math.round(ms / 60000)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h${String(min % 60).padStart(2, '0')}`
  return `${Math.floor(h / 24)}j ${h % 24}h`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await start($)
    return result
  })

  on('prompt.submit', async ($, e, next) => {
    await start($)
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits') && e.rateLimits.length > 0) await update($, limits, () => e.rateLimits)
    return next(e)
  })

  on('ui.render', async ($, e, next) => {
    const isHint = e.component === 'PromptHint'
    const isBand = e.component === 'AbovePrompt'
    if (!isHint && !isBand) return next(e)

    // Terminal : la ligne grisee sous le prompt. Ailleurs : la bande juste au-dessus.
    const here = e.surface === 'terminal' ? isHint : isBand && !(e.props as { hasSurvey: boolean }).hasSurvey
    if (!here) return next(e)

    const quota = await read($, limits)
    const five = quota?.find(l => l.kind === 'five_hour')
    const week = quota?.find(l => l.kind === 'seven_day')
    if (!five && !week) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const now = await $.clock.now()

    const meter = (label: string, limit: (typeof five) | undefined) => {
      if (!limit) return null
      const pct = limit.percentUsed
      const { full, empty } = bar(pct)
      const left = remaining(limit.resetsAt, now)
      return (
        <Box key={label} flexDirection="row" gap={1}>
          <Text dimColor>{label}</Text>
          <Box flexDirection="row">
            <Text color={colorOf(pct)}>{full}</Text>
            <Text dimColor>{empty}</Text>
          </Box>
          <Text bold color={colorOf(pct)}>{`${Math.round(pct)}%`}</Text>
          {left ? <Text dimColor>{`↺ ${left}`}</Text> : null}
        </Box>
      )
    }

    return (
      <Box flexDirection="row" justifyContent="space-between" gap={2}>
        <Box flexDirection="row" gap={3} flexShrink={0}>
          {meter('5 h', five)}
          {meter('Semaine', week)}
        </Box>
        {isHint ? <Text dimColor wrap="truncate-start">{(e.props as { hint: string }).hint}</Text> : null}
      </Box>
    )
  })
}
