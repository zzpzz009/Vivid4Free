import { rememberStartupIntro, shouldShowStartupIntro } from './startupIntro'

export function mountStartupIntro(root) {
  if (!root || document.querySelector('[data-startup-intro]')) return
  let island = false
  try { island = JSON.parse(localStorage.getItem('ui:rightPanel'))?.skin === 'animal-island' } catch { /* Use the classic intro if preferences cannot be read. */ }
  const skin = island ? 'animal-island' : 'original'
  if (!shouldShowStartupIntro(undefined, skin)) return
  const wasInert = root.inert
  const previousHidden = root.getAttribute('aria-hidden')
  root.inert = true
  root.setAttribute('aria-hidden', 'true')
  const overlay = document.createElement('div')
  overlay.dataset.startupIntro = ''
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.setAttribute('aria-label', '欢迎使用 Vivid4Free')
  overlay.dataset.startupSkin = island ? 'animal-island' : 'original'
  overlay.style.cssText = `position:fixed;inset:0;z-index:10000;background:${island ? '#f7f3df' : '#050507'};opacity:1;transition:opacity .45s ease`
  const shadow = overlay.attachShadow({ mode: 'open' })
  const drag = document.createElement('div')
  drag.setAttribute('aria-hidden', 'true')
  drag.style.cssText = 'position:absolute;inset:0 0 auto;height:28px;-webkit-app-region:drag'
  shadow.append(drag)
  document.body.append(overlay)
  let completed = false
  let disposeAnimation
  const fallbackTimer = setTimeout(() => finish('unavailable'), 12000)

  function finish(reason) {
    if (completed) return
    completed = true
    clearTimeout(fallbackTimer)
    document.removeEventListener('keydown', onKeyDown)
    overlay.style.opacity = '0'
    setTimeout(() => {
      overlay.remove()
      disposeAnimation?.()
      root.inert = wasInert
      if (previousHidden === null) root.removeAttribute('aria-hidden')
      else root.setAttribute('aria-hidden', previousHidden)
      if (reason === 'complete' || reason === 'skip') rememberStartupIntro(undefined, skin)
      window.dispatchEvent(new CustomEvent('vivid:startup-ready', { detail: { reason } }))
    }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450)
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') finish('skip')
  }

  document.addEventListener('keydown', onKeyDown)
  const modules = island ? Promise.all([
    import('../components/startup/island.html?raw'),
    import('../components/startup/island.js'),
    import('../assets/brand/island-logo.svg?raw')
  ]) : Promise.all([
    import('../components/startup/intro.html?raw'),
    import('../components/startup/intro.js')
  ])
  modules.then(([template, animation, logo]) => {
    if (completed) return
    const parsed = new DOMParser().parseFromString(island ? template.default.replace('__ISLAND_LOGO__', logo.default) : template.default, 'text/html')
    const style = document.createElement('style')
    style.textContent = parsed.querySelector('style').textContent.replace(':root {', ':host {').replace('body {', '.startup-surface {')
    const surface = document.createElement('div')
    surface.className = 'startup-surface'
    surface.append(...parsed.body.childNodes)
    shadow.prepend(style, surface)
    const scope = {
      body: surface,
      get activeElement() { return shadow.activeElement },
      getElementById: id => shadow.getElementById(id),
      querySelector: selector => shadow.querySelector(selector),
      createElement: name => document.createElement(name),
      createTreeWalker: (...args) => document.createTreeWalker(...args),
      createRange: () => document.createRange(),
      addEventListener: (...args) => shadow.addEventListener(...args),
      removeEventListener: (...args) => shadow.removeEventListener(...args)
    }
    disposeAnimation = animation.runIntroAnimation(scope, finish)
    shadow.getElementById('skip')?.focus({ preventScroll: true })
  }).catch(() => finish('unavailable'))
}
