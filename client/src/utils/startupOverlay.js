import { rememberStartupIntro, shouldShowStartupIntro } from './startupIntro'

export function mountStartupIntro(root) {
  if (!root || !shouldShowStartupIntro() || document.querySelector('[data-startup-intro]')) return
  const wasInert = root.inert
  const previousHidden = root.getAttribute('aria-hidden')
  root.inert = true
  root.setAttribute('aria-hidden', 'true')
  const overlay = document.createElement('div')
  overlay.dataset.startupIntro = ''
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.setAttribute('aria-label', '欢迎使用 Vivid4Free')
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#050507;opacity:1;transition:opacity .45s ease'
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
      if (reason === 'complete' || reason === 'skip') rememberStartupIntro()
      window.dispatchEvent(new CustomEvent('vivid:startup-ready', { detail: { reason } }))
    }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450)
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') finish('skip')
  }

  document.addEventListener('keydown', onKeyDown)
  Promise.all([
    import('../components/startup/intro.html?raw'),
    import('../components/startup/intro.js')
  ]).then(([template, animation]) => {
    if (completed) return
    const parsed = new DOMParser().parseFromString(template.default, 'text/html')
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
      addEventListener: (...args) => shadow.addEventListener(...args)
    }
    disposeAnimation = animation.runIntroAnimation(scope, finish)
    shadow.getElementById('skip')?.focus({ preventScroll: true })
  }).catch(() => finish('unavailable'))
}
