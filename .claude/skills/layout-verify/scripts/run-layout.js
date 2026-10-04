// Playwright snippet for the Playwright MCP's browser_run_code_unsafe tool
// (the MCP runs it with `page` and has no import(), so it is one function
// expression). make-runner.sh copies it with __OPTIONS__ filled in to
// .playwright-mcp/layout-verify-<name>.js, which is passed as `filename`.
// Returns a JSON report string.
//
// Visits every step of the chosen modules (and Parts Identification) at each
// viewport height, in each language, and checks the page against the fit
// rules of docs/modules/module-improvements-plan.md section 8: no page
// scroll, the named regions inside the viewport and clear of each other,
// no clipped text, no scrollbar except the task body's, no control under
// 24x24, and the driving HUD's actions on one row.
//
// Locked steps: the runner seeds a progress copy in localStorage that marks
// every step complete, so the stepper opens all of them, and answers
// PUT /api/progress in the browser so the seeded copy never reaches the
// database. The original copy is put back at the end.

async (page) => {
  const OPTIONS = __OPTIONS__
  const BASE = 'http://localhost:5173'
  const WIDTH = OPTIONS.width || 1920
  const HEIGHTS = OPTIONS.heights || [929, 945]
  const LANGUAGES = OPTIONS.languages || ['en', 'fil']
  const ROLE = OPTIONS.role || 'trainee'
  const ACCOUNTS = {
    trainee: ['trainee@mail.com', 'trainee123'],
    admin: ['admin@mail.com', 'admin123'],
  }
  const SHOTS = '.playwright-mcp/layout'

  await page.bringToFront()
  const consoleErrors = []
  const onConsole = (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 200))
  }
  page.on('console', onConsole)
  // A plugged-in wheel would steer the parked truck; hide gamepads.
  if (!page.__layoutVerifyGamepadStub) {
    await page.addInitScript(() => {
      navigator.getGamepads = () => []
    })
    page.__layoutVerifyGamepadStub = true
  }

  // The sign-in endpoint allows 10 attempts per 15 minutes: reuse a session.
  await page.goto(`${BASE}/login`)
  const [email, password] = ACCOUNTS[ROLE]
  const signedIn = await page.evaluate(async ([email, password]) => {
    const token = localStorage.getItem('gearview_token')
    const cached = JSON.parse(localStorage.getItem('gearview_user') || 'null')
    if (token && cached?.email === email) {
      const check = await fetch('/api/progress', { headers: { Authorization: `Bearer ${token}` } })
      if (check.ok) return { ok: true }
    }
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!response.ok) return { ok: false, status: response.status }
    const body = await response.json()
    localStorage.setItem('gearview_token', body.token)
    localStorage.setItem('gearview_user', JSON.stringify(body.user))
    return { ok: true }
  }, [email, password])
  if (!signedIn.ok) return JSON.stringify({ error: `Sign-in as ${email} failed (HTTP ${signedIn.status})` })

  // The modules and their step ids, then the seeded progress.
  const catalogue = await page.evaluate(async (wanted) => {
    const headers = { Authorization: `Bearer ${localStorage.getItem('gearview_token')}` }
    const modules = await (await fetch('/api/content/modules', { headers })).json()
    const chosen = modules.filter((module) => !wanted || wanted.includes(module.slug))
    const result = []
    for (const module of chosen) {
      const steps = await (await fetch(`/api/content/courses/${module.slug}`, { headers })).json()
      result.push({ slug: module.slug, steps: steps.map((step) => ({ id: step.id, title: step.title, kind: step.kind })) })
    }
    return result
  }, OPTIONS.modules || null)

  await page.route('**/api/progress', async (route) => {
    if (route.request().method() === 'PUT') await route.fulfill({ json: { ok: true } })
    else await route.fallback()
  })
  const original = await page.evaluate((catalogue) => {
    const saved = localStorage.getItem('gearview_progress_v1')
    const progress = JSON.parse(saved || '{}')
    progress.simulations = { ...(progress.simulations || {}) }
    for (const module of catalogue) {
      const simulation = progress.simulations[module.slug] || {}
      progress.simulations[module.slug] = {
        ...simulation,
        stepsComplete: Object.fromEntries(module.steps.map((step) => [step.id, true])),
      }
    }
    localStorage.setItem('gearview_progress_v1', JSON.stringify(progress))
    return { progress: saved, language: localStorage.getItem('gearview_language') }
  }, catalogue)

  // The viewport in CSS pixels, whatever zoom the browser runs at (the MCP's
  // Chrome may start at 110%, which would make a 1920 viewport 1745 CSS px).
  const setViewport = async (height) => {
    await page.setViewportSize({ width: WIDTH, height })
    const ratio = await page.evaluate(() => devicePixelRatio)
    if (Math.abs(ratio - 1) > 0.01) {
      await page.setViewportSize({ width: Math.round(WIDTH * ratio), height: Math.round(height * ratio) })
    }
    await page.waitForFunction(([width, height]) => innerWidth === width && innerHeight === height, [WIDTH, height], { timeout: 5000 }).catch(() => {})
  }

  // Every check, run in the page. Returns a list of problems.
  const inspect = () => page.evaluate(() => {
    const problems = []
    const W = innerWidth
    const H = innerHeight
    const visible = (element) => {
      const box = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
    }
    const box = (element) => element.getBoundingClientRect()
    const name = (element) => {
      const cls = typeof element.className === 'string' ? element.className.split(' ').filter(Boolean).slice(0, 2).join('.') : ''
      const text = (element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 40)
      return `${element.tagName.toLowerCase()}${cls ? `.${cls}` : ''}${text ? ` "${text}"` : ''}`
    }
    const overlaps = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5

    // 1. Page scroll.
    const doc = document.documentElement
    if (doc.scrollHeight > H + 1) problems.push(`page scrolls vertically (${doc.scrollHeight} > ${H})`)
    if (doc.scrollWidth > W + 1) problems.push(`page scrolls horizontally (${doc.scrollWidth} > ${W})`)

    // 2. Named regions inside the viewport, and pairs that must not overlap.
    const REGIONS = [
      '.module-page-header', '.back-button', '.module-page-title', '.module-stepper', '.module-header-progress',
      '.simulation-scene', '.simulation-task', '.simulation-task-header', '.simulation-task-footer',
      '.driving-hud-status', '.driving-hud-actions', '.driving-hud-menu-list', '.operator-dashboard', '.proximity-inset', '.safety-sign',
      '.interactive-viewer-toolbar', '.parts-viewer-toolbar',
    ]
    const found = {}
    for (const selector of REGIONS) {
      const elements = [...document.querySelectorAll(selector)].filter(visible)
      if (elements.length) found[selector] = elements
      for (const element of elements) {
        const b = box(element)
        if (b.left < -0.5 || b.top < -0.5 || b.right > W + 0.5 || b.bottom > H + 0.5) {
          problems.push(`${selector} outside the viewport [${[b.left, b.top, b.right, b.bottom].map(Math.round)}]`)
        }
      }
    }
    const langToggle = [...document.querySelectorAll('.module-page-header [role="group"]')].filter(visible)
    if (langToggle.length) found.language = langToggle
    const PAIRS = [
      ['.back-button', '.module-page-title'], ['.module-page-title', '.module-stepper'], ['.module-stepper', '.module-header-progress'],
      ['.module-header-progress', 'language'], ['.module-page-title', 'language'],
      ['.module-page-header', '.simulation-scene'], ['.module-page-header', '.simulation-task'], ['.simulation-scene', '.simulation-task'],
      ['.driving-hud-status', '.driving-hud-actions'], ['.driving-hud-actions', '.operator-dashboard'],
      ['.operator-dashboard', '.proximity-inset'], ['.operator-dashboard', '.safety-sign'], ['.proximity-inset', '.safety-sign'],
      ['.simulation-task-header', '.simulation-task-footer'],
    ]
    for (const [a, b] of PAIRS) {
      for (const first of found[a] || []) {
        for (const second of found[b] || []) {
          if (first !== second && !first.contains(second) && !second.contains(first) && overlaps(box(first), box(second))) {
            problems.push(`${a} overlaps ${b}`)
          }
        }
      }
    }

    // The HUD's actions on one row.
    for (const actions of found['.driving-hud-actions'] || []) {
      const tops = new Set([...actions.children].filter(visible).map((child) => Math.round(box(child).top / 8)))
      if (tops.size > 1) problems.push('driving HUD actions wrap onto more than one row')
    }

    // 3. Clipped text. Ellipsis truncation is by design (the stepper's long
    // titles, the page title) and listed apart, not failed.
    const truncated = []
    const TEXT = 'button, [role="button"], .driving-checkpoint-badge, .driving-parking-badge, label, .module-stepper-title, .module-page-title, .safety-sign, .operator-dashboard span'
    for (const element of document.querySelectorAll(TEXT)) {
      if (!visible(element) || element.closest('canvas')) continue
      if (element.scrollWidth > element.clientWidth + 1 && element.clientWidth > 0) {
        const style = getComputedStyle(element)
        if (style.textOverflow === 'ellipsis') truncated.push(name(element))
        else if (style.overflow !== 'visible' || style.whiteSpace === 'nowrap') problems.push(`clipped text: ${name(element)}`)
      }
    }

    // 4. Scrollbars anywhere but the task body (and the hint, which scrolls
    // inside itself when an admin wrote a long one).
    const ALLOWED_SCROLL = ['simulation-task-body']
    for (const element of document.querySelectorAll('body *')) {
      if (!visible(element)) continue
      const style = getComputedStyle(element)
      const scrollsY = ['auto', 'scroll'].includes(style.overflowY) && element.scrollHeight > element.clientHeight + 1
      const scrollsX = ['auto', 'scroll'].includes(style.overflowX) && element.scrollWidth > element.clientWidth + 1
      if ((scrollsY || scrollsX) && !ALLOWED_SCROLL.some((cls) => element.classList.contains(cls))) {
        problems.push(`scrollbar on ${name(element)} (${scrollsY ? 'vertical' : 'horizontal'})`)
      }
    }

    // 5. Controls under 24x24.
    for (const element of document.querySelectorAll('button, a[href], input:not([type="hidden"]), select, [role="button"], [role="menuitem"], [role="menuitemcheckbox"]')) {
      if (!visible(element)) continue
      const b = box(element)
      // A range input is a slider: its thumb is the target, the track is thin by design.
      if (element.type === 'range' || element.type === 'checkbox' || element.type === 'radio') continue
      if (Math.round(b.width) < 24 || Math.round(b.height) < 24) problems.push(`control under 24x24 (${Math.round(b.width)}x${Math.round(b.height)}): ${name(element)}`)
    }

    const scene = found['.simulation-scene']?.[0]
    return { problems: [...new Set(problems)], truncated: [...new Set(truncated)], sceneHeight: scene ? Math.round(box(scene).height) : null }
  })

  // The window's scale does not survive a navigation, so every page load
  // sets the viewport again.
  const open = async (path, height) => {
    await page.goto(`${BASE}${path}`)
    await setViewport(height)
  }

  const setLanguage = async (language) => {
    await page.evaluate((language) => localStorage.setItem('gearview_language', language), language)
  }

  const results = []
  const record = async (label, extra = {}) => {
    // Two frames, so a resize or a step change has been laid out.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    const result = await inspect()
    const actual = await page.evaluate(() => [innerWidth, innerHeight])
    if (actual[0] !== WIDTH || actual[1] !== extra.height) result.problems.unshift(`viewport is ${actual.join('x')}, not ${WIDTH}x${extra.height}`)
    const file = `${SHOTS}/${label}.png`
    await page.screenshot({ path: file, scale: 'css' })
    results.push({ step: label, ...extra, ...result })
  }

  // Waits for the scene of the current step: a driving step's simulation, a
  // 3D viewer's canvas, or just a beat for the rest.
  const settle = async (kind) => {
    if (kind === 'driving') {
      await page.waitForFunction(() => window.__drivingDebug, null, { timeout: 30000 }).catch(() => {})
      await page.waitForTimeout(1200)
    } else if (kind === 'walk-around') {
      await page.waitForSelector('.simulation-scene canvas', { timeout: 30000 }).catch(() => {})
      await page.waitForTimeout(1200)
    } else {
      await page.waitForTimeout(500)
    }
  }

  for (const height of HEIGHTS) {
    await setViewport(height)
    for (const language of LANGUAGES) {
      await setLanguage(language)
      for (const module of catalogue) {
        await open(`/training/modules/${module.slug}`, height)
        const scope = page.locator('.scope-notice-modal-dismiss')
        if (await scope.isVisible({ timeout: 4000 }).catch(() => false)) await scope.click()
        await page.locator('.module-stepper').waitFor({ timeout: 20000 })
        for (const [index, step] of module.steps.entries()) {
          await page.locator('.module-stepper button').nth(index).click()
          await settle(step.kind)
          const label = `${ROLE}-${height}-${language}-${module.slug}-${String(index + 1).padStart(2, '0')}-${step.id}`
          await record(label, { height })
          // The More menu, open, on a driving step: inside the viewport too.
          if (step.kind === 'driving' && (await page.locator('.driving-hud-menu button').first().isVisible().catch(() => false))) {
            await page.locator('.driving-hud-menu button').first().click()
            await page.waitForTimeout(200)
            await record(`${label}-menu`, { height })
            await page.keyboard.press('Escape')
          }
        }
        // The task column folded, once per module.
        await page.locator('.simulation-task-collapse').click()
        await page.waitForTimeout(300)
        await record(`${ROLE}-${height}-${language}-${module.slug}-collapsed`, { height })
        await page.locator('.simulation-task-tab').click()
      }
      if (OPTIONS.parts !== false) {
        await open('/training/parts', height)
        const scope = page.locator('.scope-notice-modal-dismiss')
        if (await scope.isVisible({ timeout: 4000 }).catch(() => false)) await scope.click()
        await page.locator('.module-stepper').waitFor({ timeout: 20000 }).catch(() => {})
        const count = await page.locator('.module-stepper button').count()
        for (let index = 0; index < count; index += 1) {
          await page.locator('.module-stepper button').nth(index).click()
          await settle(index === 0 ? 'walk-around' : 'quiz')
          await record(`${ROLE}-${height}-${language}-parts-${index + 1}`, { height })
        }
      }
    }
  }

  // Put the learner's own progress copy and language back, while PUT is still
  // answered here, then stop answering it.
  await page.goto(`${BASE}/login`)
  await page.evaluate((original) => {
    if (original.progress === null) localStorage.removeItem('gearview_progress_v1')
    else localStorage.setItem('gearview_progress_v1', original.progress)
    if (original.language === null) localStorage.removeItem('gearview_language')
    else localStorage.setItem('gearview_language', original.language)
  }, original)
  await page.goto('about:blank')
  await page.unroute('**/api/progress')
  page.off('console', onConsole)

  const failing = results.filter((result) => result.problems.length)
  return JSON.stringify({
    role: ROLE,
    visited: results.length,
    passed: failing.length === 0,
    minSceneHeight: Math.min(...results.map((result) => result.sceneHeight ?? Infinity)),
    failing: failing.map(({ step, problems, sceneHeight }) => ({ step, sceneHeight, problems })),
    truncatedByDesign: [...new Set(results.flatMap((result) => result.truncated))],
    consoleErrors: [...new Set(consoleErrors)].slice(0, 20),
    screenshots: SHOTS,
  })
}
