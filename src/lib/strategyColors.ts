// Yearn brand palette, sourced from the press kit (https://presskit.yearn.fi/colors):
// the primary Yearn Blue plus mid-range shades of the four secondary hues —
// Metaverse Sunset, Disco Salmon, Tokyo Party and Up Only Green (the kit calls
// these out "for use in UI, charts and diagrams"). Ordered so adjacent
// stacked-area bands differ in both hue and lightness. Note: the kit lists the
// primary blue hex as #0675F9 but its own RGB (6.87.249) and logo resolve to
// #0657F9, which is what we use to stay consistent with the rest of the app.
const PALETTE = [
  '#0657F9', // Yearn Blue (primary / logo)
  '#F8A908', // Metaverse Sunset 500
  '#7D3787', // Tokyo Party 500
  '#38E331', // Up Only Green 400
  '#DF536A', // Disco Salmon 500
  '#FFDC53', // Metaverse Sunset 100
  '#7829E1', // Tokyo Party 200
  '#55F541', // Up Only Green 200
  '#FD5DA5', // Disco Salmon 200
  '#6B26C2', // Tokyo Party 400
  '#F1F025', // Metaverse Sunset 200
  '#FA3AA7' // Disco Salmon 300
]

function hashKey(key: string): number {
  let hash = 5381
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 33) ^ key.charCodeAt(i)
  }
  return Math.abs(hash)
}

export function assignStrategyColors(keys: string[]): Map<string, string> {
  const result = new Map<string, string>()
  const usedIndices = new Set<number>()

  for (const key of keys) {
    let index = hashKey(key) % PALETTE.length
    let attempts = 0
    while (usedIndices.has(index) && attempts < PALETTE.length) {
      index = (index + 1) % PALETTE.length
      attempts++
    }
    usedIndices.add(index)
    result.set(key, PALETTE[index])
  }

  return result
}
