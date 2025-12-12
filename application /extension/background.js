class StorageManager {
  async getSession(keys) {
    return new Promise((resolve) => {
      chrome.storage.session.get(keys, (result) => {
        resolve(result)
      })
    })
  }

  async setSession(data) {
    return new Promise((resolve) => {
      chrome.storage.session.set(data, () => {
        resolve()
      })
    })
  }

  async getLocal(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (result) => {
        resolve(result)
      })
    })
  }

  async setLocal(data) {
    return new Promise((resolve) => {
      chrome.storage.local.set(data, () => {
        resolve()
      })
    })
  }

  async getScrapingState() {
    const { scrapingState } = await this.getSession(['scrapingState'])
    return scrapingState || {
      active: false,
      searchQuery: '',
      currentPage: 1,
      totalPages: 1,
      collectedPosts: [],
      postsProcessed: 0,
      startTime: null,
      completed: false,
      minLikes: 100,
      minRetweets: 10
    }
  }

  async setScrapingState(state) {
    await this.setSession({ scrapingState: state })
  }

  async getSavedPosts() {
    const { savedPosts } = await this.getLocal(['savedPosts'])
    return savedPosts || []
  }

  async updateSavedPosts(posts) {
    await this.setLocal({ savedPosts: posts })
  }

  async setTabData(tabId, data) {
    const key = `tab_${tabId}`
    await this.setSession({ [key]: data })
  }

  async getTabData(tabId) {
    const key = `tab_${tabId}`
    const result = await this.getSession([key])
    return result[key]
  }

  async removeTabData(tabId) {
    const key = `tab_${tabId}`
    return new Promise((resolve) => {
      chrome.storage.session.remove([key], () => {
        resolve()
      })
    })
  }
}

class TabManager {
  async openTab(url) {
    return new Promise((resolve) => {
      chrome.tabs.create({ url, active: true }, (tab) => {
        resolve(tab)
      })
    })
  }

  async closeTab(tabId) {
    return new Promise((resolve) => {
      chrome.tabs.remove(tabId, () => {
        resolve()
      })
    })
  }

  async getActiveTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs[0])
      })
    })
  }

  async waitForTabLoad(tabId, timeout = 60000) {
    const startTime = Date.now()

    return new Promise((resolve, reject) => {
      const checkTab = () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error('Tab load timeout'))
          return
        }

        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
            return
          }

          if (tab.status === 'complete') {
            setTimeout(() => resolve(tab), 1000)
          } else {
            setTimeout(checkTab, 500)
          }
        })
      }

      checkTab()
    })
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

class MessageHandler {
  constructor(storageManager, tabManager) {
    this.storage = storageManager
    this.tabs = tabManager
  }

  async handleMessage(message, sender, sendResponse) {
    const { action } = message

    try {
      switch (action) {
        case 'startScraping':
          return await this.handleStartScraping(message)

        case 'stopScraping':
          return await this.handleStopScraping()

        case 'getScrapingState':
          return await this.handleGetScrapingState()

        case 'updateScrapingState':
          return await this.handleUpdateScrapingState(message.updates)

        case 'scrapingComplete':
          return await this.handleScrapingComplete(message)

        case 'extractPosts':
          return await this.handleExtractPosts(sender.tab?.id)

        case 'closeCurrentTab':
          return await this.handleCloseTab(sender.tab?.id)

        case 'sendToWebApp':
          return await this.handleSendToWebApp(message.data)

        default:
          return { success: false, error: 'Unknown action' }
      }
    } catch (error) {
      console.error(`Error handling ${action}:`, error)
      return { success: false, error: error.message }
    }
  }

  async handleStartScraping(message) {
    const { searchQuery, minLikes = 100, minRetweets = 10 } = message

    const initialState = {
      active: true,
      searchQuery,
      status: 'opening_explore',
      statusText: 'Opening X Explore page...',
      currentPage: 1,
      totalPages: 5,
      collectedPosts: [],
      postsProcessed: 0,
      startTime: Date.now(),
      completed: false,
      minLikes,
      minRetweets
    }

    await this.storage.setScrapingState(initialState)

    const tab = await this.tabs.openTab('https://x.com/explore')
    await this.tabs.waitForTabLoad(tab.id)

    await this.tabs.delay(2000)

    chrome.tabs.sendMessage(tab.id, {
      action: 'autoScrape',
      searchQuery
    })

    return { success: true, state: initialState }
  }

  async handleStopScraping() {
    const state = await this.storage.getScrapingState()

    state.active = false
    state.completed = true

    await this.storage.setScrapingState(state)

    return {
      success: true,
      posts: state.collectedPosts,
      totalPosts: state.collectedPosts.length
    }
  }

  async handleGetScrapingState() {
    const state = await this.storage.getScrapingState()
    return { success: true, state }
  }

  async handleUpdateScrapingState(updates) {
    const currentState = await this.storage.getScrapingState()

    if (updates.newPosts && Array.isArray(updates.newPosts)) {
      const existingIds = new Set(currentState.collectedPosts.map(p => p.id))
      const uniqueNewPosts = updates.newPosts.filter(p => !existingIds.has(p.id))
      currentState.collectedPosts = [...currentState.collectedPosts, ...uniqueNewPosts]
      currentState.postsProcessed = currentState.collectedPosts.length
      delete updates.newPosts
    }

    const newState = { ...currentState, ...updates }
    await this.storage.setScrapingState(newState)

    return { success: true, state: newState }
  }

  async handleScrapingComplete(message) {
    const state = await this.storage.getScrapingState()

    state.active = false
    state.completed = true

    await this.storage.setScrapingState(state)

    console.log('Scraping complete:', {
      query: state.searchQuery,
      totalPosts: state.collectedPosts.length,
      duration: Date.now() - state.startTime
    })

    return { success: true, posts: state.collectedPosts }
  }

  async handleExtractPosts(tabId) {
    if (!tabId) {
      return { success: false, error: 'No tab ID provided' }
    }

    chrome.tabs.sendMessage(tabId, { action: 'extractPosts' })
    return { success: true }
  }

  async handleCloseTab(tabId) {
    if (tabId) {
      await this.tabs.closeTab(tabId)
    }
    return { success: true }
  }

  async handleSendToWebApp(data) {
    const { posts, webhookUrl } = data

    if (!webhookUrl) {
      return { success: false, error: 'No webhook URL provided' }
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ posts })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
}

const storageManager = new StorageManager()
const tabManager = new TabManager()
const messageHandler = new MessageHandler(storageManager, tabManager)

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  messageHandler.handleMessage(message, sender, sendResponse)
    .then(sendResponse)
    .catch((error) => {
      sendResponse({ success: false, error: error.message })
    })
  return true
})

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return

  const url = tab.url || ''
  if (!url.includes('x.com') && !url.includes('twitter.com')) return

  const state = await storageManager.getScrapingState()
  if (!state.active) return

  await tabManager.delay(2000)

  chrome.tabs.sendMessage(tabId, { action: 'autoScrape' })
})

console.log('X Content Scraper background service worker initialized')
