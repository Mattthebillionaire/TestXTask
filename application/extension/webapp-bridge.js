const handleStartScraping = async (event) => {
  console.log('X Scraper: Received start event', event)
  const { searchQuery } = event.detail || {}

  if (!searchQuery) {
    console.error('X Scraper: No search query provided')
    return
  }

  console.log('X Scraper: Starting scrape for:', searchQuery)

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'startScraping',
      searchQuery
    })
    console.log('X Scraper: Background response:', response)

    window.dispatchEvent(new CustomEvent('x-scraper-started', {
      detail: response
    }))
  } catch (error) {
    console.error('X Scraper: Error starting scrape:', error)
    window.dispatchEvent(new CustomEvent('x-scraper-error', {
      detail: { error: error.message }
    }))
  }
}

window.addEventListener('x-scraper-start', handleStartScraping)

window.addEventListener('x-scraper-stop', async () => {
  console.log('X Scraper: Stopping scrape')

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'stopScraping'
    })

    window.dispatchEvent(new CustomEvent('x-scraper-stopped', {
      detail: response
    }))
  } catch (error) {
    console.error('X Scraper: Error stopping scrape:', error)
  }
})

window.addEventListener('x-scraper-get-state', async () => {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getScrapingState'
    })

    window.dispatchEvent(new CustomEvent('x-scraper-state', {
      detail: response
    }))
  } catch (error) {
    console.error('X Scraper: Error getting state:', error)
  }
})

window.__X_SCRAPER_READY__ = true
window.dispatchEvent(new CustomEvent('x-scraper-ready'))

console.log('X Scraper: Web app bridge initialized and ready')
