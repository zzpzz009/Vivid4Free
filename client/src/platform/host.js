import { createElectronHost } from './electronHost.js'

// UI code depends on this composition point, never on a preload/global/channel.
export const host = createElectronHost()
