import express from 'express'
import { authMiddleware } from './_lib.js'
const router = express.Router()

// Dette simulerer Stripe integrationen indtil vi har dine API keys
router.post('/create-checkout', authMiddleware, (req, res) => {
  const { plan } = req.body;
  
  // I produktion ville vi her kalde stripe.checkout.sessions.create()
  res.json({ 
    ok: true, 
    url: 'https://checkout.stripe.com/pay/hermes_pro_demo',
    message: 'Redirecting to Stripe...' 
  });
})

router.get('/usage', authMiddleware, (req, res) => {
  // Her skal vi senere tælle queries fra terminal.log og gateway.log
  res.json({
    queries: { used: 142, limit: 500 },
    agents: { used: 1, limit: 1 },
    plan: 'Free'
  });
})

export default router
