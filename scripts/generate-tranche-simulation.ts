import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { simulateTranches, TRANCHE_IDS } from '../src/lib/tranche-simulation'

const sourcePath = new URL('../src/mock-data/tranche-source.json', import.meta.url)
const configPath = new URL('../src/mock-data/tranche-config.json', import.meta.url)
const outputPath = new URL('../src/mock-data/tranche-simulation.json', import.meta.url)
const sourceText = await readFile(sourcePath, 'utf8')
const configText = await readFile(configPath, 'utf8')
const engineText = await readFile(new URL('../src/lib/tranche-simulation.ts', import.meta.url), 'utf8')
const result = simulateTranches(JSON.parse(sourceText), JSON.parse(configText))
const dataset = {
  ...result,
  engineSha256: createHash('sha256').update(engineText).digest('hex'),
  inputSha256: createHash('sha256').update(sourceText).update(configText).digest('hex')
}
await writeFile(outputPath, `${JSON.stringify(dataset, null, 2)}\n`)
const last = result.points[result.points.length - 1]
console.table(
  TRANCHE_IDS.map((id) => ({
    tranche: id,
    start: result.initial[id],
    end: last.tranches[id].nav,
    earnings: last.tranches[id].earningsUsd,
    returnPct: last.tranches[id].cumulativeReturn * 100,
    thirtyDayApyPct: (last.tranches[id].thirtyDayApy ?? 0) * 100
  }))
)
console.log(`Wrote ${result.points.length} observations; input hash ${dataset.inputSha256}`)
