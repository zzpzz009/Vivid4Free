// Asset path utilities
export const getImagePath = (imageName) => {
  return new URL(`../assets/images/${imageName}`, import.meta.url).href
}

export const getIconPath = (iconName) => {
  return new URL(`../assets/icons/${iconName}`, import.meta.url).href
}

// Pre-load commonly used assets
export const icons = {
  download: getIconPath('download.svg'),
  menu: getIconPath('menu0.svg'),
  avatar: getIconPath('generic-avatar0.svg'),
  more: getIconPath('more0.svg'),
  upload: getIconPath('icon6.svg'),
  reference: getIconPath('image-reference.svg'),
  dropdown: getIconPath('arrow-drop-down0.svg'),
  generateDropdown: getIconPath('icon11.svg'),
  leftNav: getIconPath('frame-11.svg'),
  rightNav: getIconPath('frame-13.svg'),
  zoomIn: getIconPath('icon9.svg'),
  zoomOut: getIconPath('icon10.svg'),
  settings: getIconPath('icon12.svg'),
  horizontalInset: getIconPath('horizontal-inset0.svg'),
  horizontalFullWidth: getIconPath('horizontal-full-width0.svg'),
  history: getIconPath('icon8.svg'),
  // Navigation icons
  workspaceActive: getIconPath('icon1.svg'),
  // Scene icons
  sceneDaylight: getIconPath('scene-daylight.svg'),
  sceneNight: getIconPath('scene-night.svg'),
  sceneDusk: getIconPath('scene-dusk.svg'),
  sceneCloudy: getIconPath('scene-cloudy.svg'),
  sceneDawn: getIconPath('scene-dawn.svg'),
  // Gallery icons
  folder: getIconPath('folder0.svg'),
  folderFilled: getIconPath('folder-filled0.svg'),
  navigateNext: getIconPath('navigate-next0.svg'),
  navigatePrevious: getIconPath('navigate-previous0.svg'),
  workspaceInactive: getIconPath('icon3.svg'),
  batchPreviewActive: getIconPath('icon1.svg'),
  batchPreviewInactive: getIconPath('icon3.svg'),
  localRepaintActive: getIconPath('icon1.svg'),
  localRepaintInactive: getIconPath('icon3.svg'),
  // Gallery and favorites icons
  back: getIconPath('arrow-drop-down0.svg'), // Reuse dropdown icon rotated
  image: getIconPath('image-reference.svg'), // Use proper image reference icon
  favorite: getIconPath('icon8.svg'), // Reuse history icon as favorite
  heart: getIconPath('icon8.svg'),
  preview: getIconPath('icon9.svg'), // Reuse zoom in as preview
  use: getIconPath('icon11.svg'), // Reuse generate dropdown as use
  check: getIconPath('icon11.svg'),
  copy: getIconPath('icon12.svg'), // Reuse settings as copy
  duplicate: getIconPath('icon12.svg'),
  remove: getIconPath('icon10.svg'), // Reuse zoom out as remove
  x: getIconPath('close.svg'),
  close: getIconPath('close.svg'),
  brush: getIconPath('brush.svg'), // Proper brush icon for mask editing
  eye: getIconPath('icon9.svg'), // Reuse zoom in as eye for mask toggle
  redraw: getIconPath('icon8.svg'), // Use history icon as redraw
  magicWand: getIconPath('magic-wand.svg'), // Magic wand icon for redraw
  jdcl: getIconPath('jdcl.svg'), // Magic wand icon for redraw
  jck: getIconPath('jck.svg'), // Magic wand icon for redraw
}

export const images = {
  rectangle71: getImagePath('rectangle-71.png'),
  rectangle80: getImagePath('rectangle-80.png'),
  rectangle90: getImagePath('rectangle-90.png'),
  rectangle100: getImagePath('rectangle-100.png'),
  rectangle110: getImagePath('rectangle-110.png'),
  rectangle120: getImagePath('rectangle-120.png'),
  rectangle130: getImagePath('rectangle-130.png'),
  rectangle131: getImagePath('rectangle-131.png'),
  rectangle140: getImagePath('rectangle-140.png'),
  rectangle150: getImagePath('rectangle-150.png'),
  rectangle160: getImagePath('rectangle-160.png'),
  rectangle170: getImagePath('rectangle-170.png'),
}
