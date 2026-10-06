import { execFileSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const renderRevision = process.env.RENDER_GIT_COMMIT
const revision = renderRevision ?? execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: root,
  encoding: 'utf8',
}).trim()

if (!/^[a-f0-9]{40}$/i.test(revision)) {
  throw new Error('The deployment revision must be a complete 40-character Git SHA.')
}

await writeFile(new URL('../dist/deployment.json', import.meta.url), JSON.stringify({
  revision: revision.toLowerCase(),
  source: renderRevision === undefined ? 'git' : 'render',
}) + '\n', 'utf8')
