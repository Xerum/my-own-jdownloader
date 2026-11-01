// The version of the project is the file VERSION at the repository root; everything else follows it.
// The backend (MCP server info) reads the file, the Android build gets it as -PversionName (android/build.sh, release workflow), a release tag is v<VERSION>.
// Only extension/manifest.json needs the number written into it (a browser reads the version from there): this script does that.
// Usage: node scripts/set-version.mjs <new version>   writes VERSION and the manifest
//        node scripts/set-version.mjs --check          fails when the manifest differs from VERSION
import { readFileSync, writeFileSync } from 'node:fs'

const manifestFile = 'extension/manifest.json'
const arg = process.argv[2]
const read = () => readFileSync('VERSION', 'utf8').trim()
const manifest = () => JSON.parse(readFileSync(manifestFile, 'utf8'))

if (arg === '--check') {
  if (manifest().version !== read()) {
    console.error(`${manifestFile} has version ${manifest().version}, VERSION has ${read()}: run node scripts/set-version.mjs ${read()}`)
    process.exit(1)
  }
  console.log(`version ${read()}`)
} else {
  if (!/^\d+\.\d+\.\d+$/.test(arg ?? '')) throw new Error('usage: set-version.mjs <major.minor.patch> | --check')
  writeFileSync('VERSION', arg + '\n')
  // replace the one line, so the rest of the file stays as it is
  const text = readFileSync(manifestFile, 'utf8')
  const next = text.replace(/("version"\s*:\s*)"[^"]*"/, `$1"${arg}"`)
  if (next === text && manifest().version !== arg) throw new Error('"version" not found in the manifest')
  writeFileSync(manifestFile, next)
  console.log(`version ${arg}`)
}
