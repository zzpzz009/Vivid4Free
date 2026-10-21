export const STARTUP_INTRO_KEY = 'vivid-desktop:startup-intro:v1'

export function shouldShowStartupIntro(storage) {
  try {
    return (storage || window.localStorage).getItem(STARTUP_INTRO_KEY) !== 'seen'
  } catch {
    return true
  }
}

export function rememberStartupIntro(storage) {
  try {
    (storage || window.localStorage).setItem(STARTUP_INTRO_KEY, 'seen')
    return true
  } catch {
    return false
  }
}
