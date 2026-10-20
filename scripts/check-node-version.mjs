import { readFileSync } from 'node:fs'

const { engines } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const version = process.versions.node
const current = version.split('.').map(Number)
// The declared range uses caret minimums within a major, plus an open >= minimum.
const supported = engines.node.split(' || ').some((clause) => {
  const [, operator, major, minor, patch] = /^(\^|>=)(\d+)\.(\d+)\.(\d+)$/.exec(clause) ?? []
  if (!operator) throw new Error(`Unsupported Node engine range: ${clause}`)
  const minimum = [Number(major), Number(minor), Number(patch)]
  const difference = current.map((part, index) => part - minimum[index]).find((part) => part !== 0) ?? 0
  return difference >= 0 && (operator === '>=' || current[0] === minimum[0])
})

if (!supported) {
  console.error(
    `Node ${engines.node} is required by jsdom 30; found ${version}. Update Node before installing or testing.`
  )
  process.exit(1)
}
