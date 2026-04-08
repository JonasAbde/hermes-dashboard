// api/routes/skills.js — skill listing, categories, read/write, refresh
import { Router } from 'express'
import {
  execAsync,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  mkdirSync,
  join,
  parseYaml,
  HERMES,
  HERMES_BIN,
  HOME_DIR,
} from './_lib.js'

const router = Router()

// GET /api/skills
router.get('/api/skills', (req, res) => {
  try {
    const skillsDirs = [
      join(HERMES, 'workspace', 'skills'),
      join(HERMES, 'hermes-agent', 'skills'),
    ]

    const skillSet = new Map()

    for (const baseDir of skillsDirs) {
      if (!existsSync(baseDir)) continue
      const source = baseDir.includes('hermes-agent') ? 'builtin' : 'custom'

      function scanDir(dir, pathPrefix = '') {
        try {
          for (const entry of readdirSync(dir)) {
            const fullPath = join(dir, entry)
            const stat = statSync(fullPath)

            if (stat.isDirectory()) {
              scanDir(fullPath, pathPrefix ? `${pathPrefix}/${entry}` : entry)
            } else if (entry === 'SKILL.md') {
              const skillName = pathPrefix

              try {
                const content = readFileSync(fullPath, 'utf8')
                const fmMatch = content.match(/^---\n([\s\S]+?)\n---\n?/)
                let frontmatter = {}
                if (fmMatch) {
                  try { frontmatter = parseYaml(fmMatch[1]) } catch {}
                }

                const displayName = frontmatter.name || skillName
                const description = frontmatter.description || ''

                let category = frontmatter.category || 'other'
                if (!frontmatter.category && skillName.includes('/')) {
                  const parts = skillName.split('/')
                  category = parts[0]
                }

                const existing = skillSet.get(skillName)
                if (!existing || source === 'custom') {
                  skillSet.set(skillName, {
                    name: skillName,
                    displayName,
                    description,
                    category,
                    frontmatter,
                    path: fullPath,
                    source,
                    version: frontmatter.version,
                    author: frontmatter.author,
                    triggers: frontmatter.triggers,
                  })
                }
              } catch {}
            }
          }
        } catch {}
      }

      scanDir(baseDir)
    }

    const skills = Array.from(skillSet.values())
    res.json({ skills })
  } catch (e) {
    res.json({ skills: [], error: e.message })
  }
})

// GET /api/skills/categories
router.get('/api/skills/categories', (req, res) => {
  try {
    const skillsDirs = [
      join(HERMES, 'workspace', 'skills'),
      join(HERMES, 'hermes-agent', 'skills'),
    ]

    const cats = {}
    const skillSet = new Map()

    for (const baseDir of skillsDirs) {
      if (!existsSync(baseDir)) continue
      const source = baseDir.includes('hermes-agent') ? 'builtin' : 'custom'

      function scanDir(dir, pathPrefix = '') {
        try {
          for (const entry of readdirSync(dir)) {
            const fullPath = join(dir, entry)
            const stat = statSync(fullPath)
            const currentPath = pathPrefix ? `${pathPrefix}/${entry}` : entry

            if (stat.isDirectory()) {
              scanDir(fullPath, currentPath)
            } else if (entry === 'SKILL.md') {
              const skillName = pathPrefix
              if (!skillName) return

              try {
                const content = readFileSync(fullPath, 'utf8')
                const fmMatch = content.match(/^---\n([\s\S]+?)\n---\n?/)
                let frontmatter = {}
                if (fmMatch) {
                  try { frontmatter = parseYaml(fmMatch[1]) } catch {}
                }

                const category = frontmatter.category || pathPrefix.split('/')[0] || 'other'
                const displayName = frontmatter.name || skillName

                if (!skillSet.has(skillName) || source === 'custom') {
                  skillSet.set(skillName, {
                    name: skillName,
                    displayName,
                    description: frontmatter.description || '',
                    category,
                    source,
                    frontmatter,
                  })
                }
              } catch {}
            }
          }
        } catch {}
      }

      scanDir(baseDir)
    }

    for (const skill of skillSet.values()) {
      const cat = skill.category || 'other'
      if (!cats[cat]) cats[cat] = []
      cats[cat].push(skill)
    }

    res.json({ categories: cats })
  } catch (e) {
    res.json({ categories: {}, error: e.message })
  }
})

// GET /api/skills/:name
router.get('/api/skills/:name', (req, res) => {
  const { name } = req.params
  const skillName = decodeURIComponent(name)

  const searchPaths = [
    join(HERMES, 'workspace', 'skills', skillName, 'SKILL.md'),
    join(HERMES, 'hermes-agent', 'skills', skillName, 'SKILL.md'),
  ]

  if (!searchPaths.some(p => existsSync(p))) {
    function findSkill(baseDir, targetName) {
      function scan(dir, pathPrefix = '') {
        try {
          for (const entry of readdirSync(dir)) {
            const fullPath = join(dir, entry)
            const stat = statSync(fullPath)
            const currentPath = pathPrefix ? `${pathPrefix}/${entry}` : entry

            if (stat.isDirectory()) {
              if (currentPath === targetName || entry === targetName) {
                const skillPath = join(fullPath, 'SKILL.md')
                if (existsSync(skillPath)) return skillPath
              }
              const found = scan(fullPath, currentPath)
              if (found) return found
            } else if (entry === 'SKILL.md') {
              if (pathPrefix === targetName || currentPath.replace('/SKILL.md', '') === targetName) {
                return fullPath
              }
            }
          }
        } catch {}
        return null
      }
      return scan(baseDir)
    }

    for (const baseDir of [join(HERMES, 'workspace', 'skills'), join(HERMES, 'hermes-agent', 'skills')]) {
      if (!existsSync(baseDir)) continue
      const found = findSkill(baseDir, skillName)
      if (found) {
        searchPaths.unshift(found)
        break
      }
    }
  }

  for (const path of searchPaths) {
    if (existsSync(path)) {
      try {
        const content = readFileSync(path, 'utf8')
        const fmMatch = content.match(/^---\n([\s\S]+?)\n---\n?([\s\S]*)$/)

        let frontmatter = {}
        let body = content

        if (fmMatch) {
          try { frontmatter = parseYaml(fmMatch[1]) } catch {}
          body = fmMatch[2].trim()
        }

        const source = path.includes('/.hermes/hermes-agent/') ? 'builtin' : 'custom'

        return res.json({
          name: skillName,
          content: body,
          frontmatter,
          path,
          source,
          fullContent: content,
        })
      } catch (e) {
        return res.status(500).json({ name: skillName, exists: false, error: e.message })
      }
    }
  }

  res.status(404).json({ name: skillName, exists: false })
})

// PUT /api/skills/:name
router.put('/api/skills/:name', (req, res) => {
  const { name } = req.params
  const skillName = decodeURIComponent(name)
  const { content } = req.body

  if (!content) return res.status(400).json({ error: 'content required' })

  const existingPaths = [
    join(HERMES, 'workspace', 'skills', skillName, 'SKILL.md'),
    join(HERMES, 'hermes-agent', 'skills', skillName, 'SKILL.md'),
  ]

  let targetPath = existingPaths.find(p => existsSync(p))

  if (!targetPath) {
    targetPath = join(HERMES, 'workspace', 'skills', skillName, 'SKILL.md')
  }

  try {
    const dir = join(targetPath, '..')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    writeFileSync(targetPath, content, 'utf8')
    res.json({ ok: true, path: targetPath })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/skills/:name/refresh
router.post('/api/skills/:name/refresh', async (req, res) => {
  const { name } = req.params
  const skillName = decodeURIComponent(name)

  try {
    const { stdout, stderr } = await execAsync(
      `${HERMES_BIN} skills refresh ${skillName} 2>&1`,
      { timeout: 30000, env: { ...process.env, HOME: HOME_DIR } }
    ).catch(() => ({ stdout: '', stderr: '' }))
    res.json({ ok: true, output: stdout || 'Skill reloaded' })
  } catch (e) {
    res.json({ ok: true, output: 'Skill refresh triggered' })
  }
})

export default router
