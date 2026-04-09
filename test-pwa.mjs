import { chromium } from 'playwright'

const TUNNEL = 'https://f920cf94523626.lhr.life'

async function testPWA() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  const errors = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  console.log('1. Loading page...')
  await page.goto(TUNNEL, { waitUntil: 'networkidle', timeout: 15000 })

  console.log('2. Checking title...')
  const title = await page.title()
  console.log(`   Title: ${title}`)

  console.log('3. Checking manifest...')
  const manifest = await page.evaluate(() => {
    const link = document.querySelector('link[rel="manifest"]')
    return link ? link.href : null
  })
  console.log(`   Manifest: ${manifest}`)

  const manifestData = await page.evaluate(async () => {
    const link = document.querySelector('link[rel="manifest"]')
    if (!link) return null
    const res = await fetch(link.href)
    return res.ok ? await res.json() : null
  })
  if (manifestData) {
    console.log(`   Name: ${manifestData.name}`)
    console.log(`   Short name: ${manifestData.short_name}`)
    console.log(`   Display: ${manifestData.display}`)
    console.log(`   Icons: ${manifestData.icons.length}`)
    console.log(`   Shortcuts: ${manifestData.shortcuts?.length || 0}`)
  }

  console.log('4. Checking service worker registration...')
  await page.waitForTimeout(2000) // SW registers async
  const sw = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'NOT SUPPORTED'
    const regs = await navigator.serviceWorker.getRegistrations()
    if (regs.length === 0) return 'NO REGISTRATIONS'
    const r = regs[0]
    return `active=${r.active ? 'yes' : 'no'}, state=${r.active?.state || 'none'}`
  })
  console.log(`   SW: ${sw}`)

  console.log('5. Checking PWA meta tags...')
  const meta = await page.evaluate(() => ({
    theme: document.querySelector('meta[name="theme-color"]')?.content,
    mobileCapable: document.querySelector('meta[name="mobile-web-app-capable"]')?.content,
    appleCapable: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.content,
    appleTitle: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.content,
  }))
  console.log(`   Theme: ${meta.theme}`)
  console.log(`   Mobile capable: ${meta.mobileCapable}`)
  console.log(`   Apple capable: ${meta.appleCapable}`)
  console.log(`   Apple title: ${meta.appleTitle}`)

  console.log('6. Checking beforeinstallprompt event...')
  const canInstall = await page.evaluate(() => {
    return new Promise(resolve => {
      if (!('beforeinstallprompt' in window)) return resolve('not supported')
      resolve('available')
    })
  })
  console.log(`   Install prompt: ${canInstall}`)

  console.log('7. Checking theme_color === background_color (avoids white flash)...')
  console.log(`   Theme: ${manifestData?.theme_color}, Background: ${manifestData?.background_color}`)

  console.log('\n8. Console errors:')
  if (errors.length === 0) {
    console.log('   None ✓')
  } else {
    errors.forEach(e => console.log(`   ERROR: ${e}`))
  }

  await browser.close()
  console.log('\n✓ PWA audit complete')
}

testPWA().catch(e => { console.error('FAIL:', e.message); process.exit(1) })
