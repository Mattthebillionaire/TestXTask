export class BaseFeature {
  constructor() {
    this.notificationContainer = null
  }

  async waitForElement(selector, timeout = 10000) {
    const startTime = Date.now()

    return new Promise((resolve, reject) => {
      const check = () => {
        const element = document.querySelector(selector)

        if (element && this.isElementVisible(element)) {
          resolve(element)
          return
        }

        if (Date.now() - startTime > timeout) {
          reject(new Error(`Element not found: ${selector}`))
          return
        }

        requestAnimationFrame(check)
      }

      check()
    })
  }

  async waitForElements(selector, minCount = 1, timeout = 10000) {
    const startTime = Date.now()

    return new Promise((resolve, reject) => {
      const check = () => {
        const elements = document.querySelectorAll(selector)
        const visibleElements = Array.from(elements).filter((el) =>
          this.isElementVisible(el)
        )

        if (visibleElements.length >= minCount) {
          resolve(visibleElements)
          return
        }

        if (Date.now() - startTime > timeout) {
          resolve(visibleElements)
          return
        }

        requestAnimationFrame(check)
      }

      check()
    })
  }

  isElementVisible(element) {
    if (!element) return false

    const style = window.getComputedStyle(element)
    if (style.display === 'none') return false
    if (style.visibility === 'hidden') return false
    if (parseFloat(style.opacity) === 0) return false

    const rect = element.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  }

  findElement(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector)
      if (element && this.isElementVisible(element)) {
        return element
      }
    }
    return null
  }

  findElements(selectors) {
    const allElements = []

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector)
      allElements.push(...Array.from(elements))
    }

    return allElements.filter((el) => this.isElementVisible(el))
  }

  clickElement(element) {
    if (!element) return false

    try {
      element.click()
      return true
    } catch (e) {
      try {
        const events = ['mousedown', 'mouseup', 'click']
        for (const eventType of events) {
          const event = new MouseEvent(eventType, {
            bubbles: true,
            cancelable: true,
            view: window
          })
          element.dispatchEvent(event)
        }
        return true
      } catch (e2) {
        try {
          element.focus()
          const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            bubbles: true
          })
          element.dispatchEvent(enterEvent)
          return true
        } catch (e3) {
          console.error('All click methods failed:', e3)
          return false
        }
      }
    }
  }

  scrollToElement(element, behavior = 'smooth') {
    if (!element) return

    element.scrollIntoView({
      behavior,
      block: 'center',
      inline: 'nearest'
    })
  }

  async scrollPage(amount = 500) {
    window.scrollBy({
      top: amount,
      behavior: 'smooth'
    })

    await this.delay(500)
  }

  async scrollToBottom() {
    const scrollHeight = document.documentElement.scrollHeight
    window.scrollTo({
      top: scrollHeight,
      behavior: 'smooth'
    })

    await this.delay(1000)
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  async sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        resolve(response)
      })
    })
  }

  async updateScrapingState(updates) {
    return this.sendMessage({
      action: 'updateScrapingState',
      updates
    })
  }

  async notifyScrapingComplete() {
    return this.sendMessage({
      action: 'scrapingComplete'
    })
  }

  async requestCloseTab() {
    return this.sendMessage({
      action: 'closeCurrentTab'
    })
  }

  showNotification(message, type = 'info', duration = 3000) {
    if (!this.notificationContainer) {
      this.notificationContainer = document.createElement('div')
      this.notificationContainer.id = 'x-scraper-notifications'
      this.notificationContainer.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 999999;
        display: flex;
        flex-direction: column;
        gap: 10px;
      `
      document.body.appendChild(this.notificationContainer)
    }

    const colors = {
      info: '#1da1f2',
      success: '#17bf63',
      warning: '#ffad1f',
      error: '#e0245e'
    }

    const notification = document.createElement('div')
    notification.style.cssText = `
      background: ${colors[type] || colors.info};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      animation: slideIn 0.3s ease;
      max-width: 300px;
    `
    notification.textContent = message

    const style = document.createElement('style')
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `
    document.head.appendChild(style)

    this.notificationContainer.appendChild(notification)

    if (duration > 0) {
      setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease forwards'
        setTimeout(() => notification.remove(), 300)
      }, duration)
    }

    return notification
  }

  async retry(fn, maxRetries = 3, baseDelay = 1000) {
    let lastError

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error
        const delay = baseDelay * Math.pow(2, i)
        await this.delay(delay)
      }
    }

    throw lastError
  }

  cleanText(text) {
    if (!text) return ''

    return text
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
      .replace(/[\u{2600}-\u{26FF}]/gu, '')
      .replace(/[\u{2700}-\u{27BF}]/gu, '')
      .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
      .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
      .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '')
      .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
  }
}
