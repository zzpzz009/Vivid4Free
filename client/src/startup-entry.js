// Standalone entry for adding the same intro to an existing installed UI.
import { mountStartupIntro } from './utils/startupOverlay'

mountStartupIntro(document.getElementById('app'))
