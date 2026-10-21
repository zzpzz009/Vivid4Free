export const STARTUP_INTRO_KEY = 'vivid-desktop:startup-intro:v1'
export const ISLAND_STARTUP_INTRO_KEY = 'vivid-desktop:startup-intro:animal-island:v1'

export function shouldShowStartupIntro(storage, skin = 'original') {
  try {
    const key = skin === 'animal-island' ? ISLAND_STARTUP_INTRO_KEY : STARTUP_INTRO_KEY
    return (storage || window.localStorage).getItem(key) !== 'seen'
  } catch {
    return true
  }
}

export function rememberStartupIntro(storage, skin = 'original') {
  try {
    const key = skin === 'animal-island' ? ISLAND_STARTUP_INTRO_KEY : STARTUP_INTRO_KEY
    const targetStorage = storage || window.localStorage
    targetStorage.setItem(key, 'seen')
    return true
  } catch {
    return false
  }
}
