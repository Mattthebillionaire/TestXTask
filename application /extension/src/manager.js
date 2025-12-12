import { XScraper } from './features/x-scraper.js'
import { DataExtractor } from './features/data-extractor.js'

export class ExtensionManager {
  constructor() {
    this.features = {
      xScraper: new XScraper(),
      dataExtractor: new DataExtractor()
    }
    this.initialized = false
  }

  initialize() {
    if (this.initialized) return

    this.setupMessageListener()
    this.initialized = true

    console.log('X Content Scraper content script initialized')
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message)
        .then(sendResponse)
        .catch((error) => {
          console.error('Message handling error:', error)
          sendResponse({ success: false, error: error.message })
        })
      return true
    })
  }

  async handleMessage(message) {
    const { action, searchQuery } = message

    switch (action) {
      case 'autoScrape':
        return await this.features.xScraper.autoExecute(searchQuery)

      case 'extractPosts':
        return await this.features.xScraper.extractPosts()

      case 'scrollAndExtract':
        return await this.features.xScraper.scrollAndExtract()

      case 'extractPageData':
        return await this.features.dataExtractor.extractData()

      case 'getPageType':
        return { success: true, pageType: this.features.xScraper.detectPageType() }

      default:
        return { success: false, error: `Unknown action: ${action}` }
    }
  }
}
