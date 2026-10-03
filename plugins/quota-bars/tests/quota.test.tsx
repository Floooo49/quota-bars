import { expect, mock, test } from 'claude-code/testing'

// Terminal : la ligne grisee sous le prompt. Bureau : la bande juste au-dessus.
const SITES = [
  {
    surface: 'terminal',
    component: 'PromptHint',
    props: { isDraft: false, isWorking: false, hint: '? for shortcuts' },
  },
  {
    surface: 'desktop',
    component: 'AbovePrompt',
    props: {
      hasSurvey: false,
      isWorking: false,
      maxRows: 10,
      bodyColumns: 120,
      scroll: { offset: 0, bodyRows: 10 },
      view: {},
    },
  },
] as const

const engine = ($: any, e: any) => {
  const { Text } = $.ui.resolve(e)
  return <Text>moteur</Text>
}

test('sans chiffres, le moteur dessine comme d’habitude', async ($, on) => {
  on('ui.render', engine)
  for (const site of SITES) {
    const ui = await $.ui.mount({ plugin: 'quota-bars', ...(site as any) })
    expect(await ui.find({ text: 'moteur' })).toBeDefined()
    expect(await ui.find({ text: 'Semaine' })).toBeUndefined()
    await ui.unmount()
  }
})

test('deux barres et leurs pourcentages', async ($, on) => {
  on('ui.render', engine)
  on('session.measure', ($, e) => ({ changed: e.changed }))
  const clock = mock.clock(on)
  const now = Date.parse('2026-10-03T12:00:00Z')
  await clock.set(now)
  await $.session.measure({
    context: { percent: 10 } as never,
    rateLimits: [
      { kind: 'five_hour', percentUsed: 58.4, resetsAt: new Date(now + 133 * 60000).toISOString() },
      { kind: 'seven_day', percentUsed: 92, resetsAt: new Date(now + 76 * 3600000).toISOString() },
    ],
    changed: ['rateLimits'],
  })
  for (const site of SITES) {
    const ui = await $.ui.mount({ plugin: 'quota-bars', ...(site as any) })
    expect(await ui.find({ text: 'moteur' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: '5 h' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Semaine' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '58%' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '92%' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '↺ 2h13' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '↺ 3j 4h' })).toBeDefined()
    const bars = (await ui.findAll({ type: 'Text', text: /█/ })).map(b => b.text)
    expect(bars).toEqual(['███████', '███████████'])
    await ui.unmount()
  }
})
