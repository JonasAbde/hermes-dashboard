import express from 'express'
import { authMiddleware } from './_lib.js'
const router = express.Router()

router.get('/', authMiddleware, (req, res) => {
  res.json({
    pending: [
      {
        id: 'app_1',
        title: 'Send Lead Follow-up',
        command: 'himalaya send --to "kunde@example.dk" --body "Hej, her er dit tilbud..."',
        reason: 'Automatisk opfølgning på nyt lead fra Rendetalje @ operationsbase',
        impact: 'medium',
        created_at: Math.floor(Date.now() / 1000) - 120,
        source: 'lead-worker',
        model: 'gemini-3-flash'
      },
      {
        id: 'app_2',
        title: 'Delete Stale Project Data',
        command: 'rm -rf ./temp/lead-cache-2024',
        reason: 'Rengøring af midlertidige filer for at spare plads',
        impact: 'high',
        created_at: Math.floor(Date.now() / 1000) - 30,
        source: 'cleanup-cron',
        model: 'codex'
      }
    ]
  })
})

router.post('/:id/:action', authMiddleware, (req, res) => {
  const { id, action } = req.params;
  res.json({ ok: true, message: `Handling ${action} anvendt på ${id}` });
})

export default router
