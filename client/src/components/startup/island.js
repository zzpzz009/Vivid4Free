// Shared by the isolated preview and the application's Shadow DOM overlay.
export function runIntroAnimation(scope, onComplete) {
  const intro = scope.getElementById('island-intro')
  const skip = scope.getElementById('skip')
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
  let timer
  let active = true

  function finish(reason = 'complete') {
    if (!active) return
    active = false
    clearTimeout(timer)
    onComplete(reason)
  }
  function onSkip() { finish('skip') }
  function onKeyDown(event) { if (event.key === 'Escape') finish('skip') }
  function onMotionChange(event) { if (event.matches) finish() }

  // Load the actual skin fonts before revealing or measuring the logo lockup.
  intro.style.visibility = 'hidden'
  skip.addEventListener('click', onSkip)
  scope.addEventListener('keydown', onKeyDown)
  reducedMotion.addEventListener('change', onMotionChange)
  Promise.all([
    document.fonts.load('700 24px Nunito', 'Vivid4Free'),
    document.fonts.load('500 24px Nunito', '4Free'),
    document.fonts.load('700 44px "Noto Sans SC"', '让灵感，即刻成形')
  ]).catch(() => {}).then(() => {
    if (!active) return
    intro.style.visibility = ''
    intro.classList.add('playing')
    skip.focus({ preventScroll: true })
    timer = setTimeout(() => finish(), reducedMotion.matches ? 1200 : 5600)
  })

  return () => {
    active = false
    clearTimeout(timer)
    skip.removeEventListener('click', onSkip)
    scope.removeEventListener('keydown', onKeyDown)
    reducedMotion.removeEventListener('change', onMotionChange)
    intro.classList.remove('playing')
  }
}
