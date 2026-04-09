import express from 'express'
import { authMiddleware } from './_lib.js'
const router = express.Router()

router.get('/graph', authMiddleware, (req, res) => {
  res.json({
    nodes: [
      { id: 'root', label: 'Hermes Mind', type: 'root' },
      // Categories
      { id: 'user', label: 'Jonas', type: 'category' },
      { id: 'business', label: 'Rendetalje ApS', type: 'category' },
      { id: 'skills', label: 'Skillset', type: 'category' },
      // Items under Jonas
      { id: 'rawan', label: 'Rawan (Hustru)', type: 'subcategory', content: 'Gift den 18/4-2026' },
      { id: 'aarhus', label: 'Aarhus', type: 'subcategory', content: 'Bopæl' },
      { id: 'ps5', label: 'PlayStation 5', type: 'item', content: 'Spiller Crimson Desert' },
      // Items under Business
      { id: 'leads', label: 'Lead Management', type: 'subcategory', content: 'Drift af Rendetalje leads' },
      { id: 'erp', label: 'ERP Integration', type: 'item', content: 'Specialist i ERP systemer' },
      // Items under Skills
      { id: 'coding', label: 'Automated Coding', type: 'subcategory', content: 'React, Node.js, Python' },
      { id: 'mcp', label: 'MCP Mastery', type: 'item', content: 'Expert i Model Context Protocol' }
    ],
    links: [
      { source: 'root', target: 'user', value: 5 },
      { source: 'root', target: 'business', value: 5 },
      { source: 'root', target: 'skills', value: 5 },
      { source: 'user', target: 'rawan', value: 3 },
      { source: 'user', target: 'aarhus', value: 3 },
      { source: 'user', target: 'ps5', value: 1 },
      { source: 'business', target: 'leads', value: 3 },
      { source: 'business', target: 'erp', value: 1 },
      { source: 'skills', target: 'coding', value: 3 },
      { source: 'skills', target: 'mcp', value: 1 }
    ]
  })
})

export default router
