import { readFile } from 'node:fs/promises'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

const root = process.cwd()
const docsPath = join(root, 'docs', 'PAGES.md')
const pagesPath = join(root, 'src', 'pages')

const docs = await readFile(docsPath, 'utf8')
const pages = await readdir(pagesPath)

const documentedPages = [...docs.matchAll(/^##\s+\d+\.\s+/gm)].length
const sourcePages = pages.filter((file) => file.endsWith('.jsx')).length

if (documentedPages !== sourcePages) {
  console.error(`PAGES.md documents ${documentedPages} pages, but src/pages has ${sourcePages} page components.`)
  process.exit(1)
}

console.log(`Page docs are in sync: ${documentedPages} documented pages, ${sourcePages} source pages.`)
