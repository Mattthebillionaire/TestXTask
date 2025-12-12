import { ExtensionManager } from './manager.js'

const manager = new ExtensionManager()

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    manager.initialize()
  })
} else {
  manager.initialize()
}
