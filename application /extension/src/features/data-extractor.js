import { BaseFeature } from './base.js'

export class DataExtractor extends BaseFeature {
  constructor() {
    super()
  }

  async extractData() {
    const data = {
      url: window.location.href,
      title: document.title,
      timestamp: new Date().toISOString(),
      content: this.extractContent(),
      metadata: this.extractMetadata(),
      links: this.extractLinks(),
      structuredData: this.extractStructuredData()
    }

    return { success: true, data }
  }

  extractContent() {
    const mainSelectors = [
      'main',
      '[role="main"]',
      '#main-content',
      '.main-content',
      'article'
    ]

    for (const selector of mainSelectors) {
      const element = document.querySelector(selector)
      if (element) {
        return {
          text: this.cleanText(element.textContent),
          html: element.innerHTML.substring(0, 10000)
        }
      }
    }

    return {
      text: this.cleanText(document.body.textContent),
      html: ''
    }
  }

  extractMetadata() {
    const metadata = {}

    const metaTags = document.querySelectorAll('meta')

    metaTags.forEach(tag => {
      const name = tag.getAttribute('name') || tag.getAttribute('property')
      const content = tag.getAttribute('content')

      if (name && content) {
        metadata[name] = content
      }
    })

    return metadata
  }

  extractLinks() {
    const links = []
    const seenUrls = new Set()

    document.querySelectorAll('a[href]').forEach(anchor => {
      const href = anchor.getAttribute('href')
      const text = this.cleanText(anchor.textContent)

      if (href && !href.startsWith('javascript:') && !seenUrls.has(href)) {
        seenUrls.add(href)
        links.push({
          url: href,
          text: text.substring(0, 100),
          title: anchor.getAttribute('title') || ''
        })
      }
    })

    return links.slice(0, 100)
  }

  extractStructuredData() {
    const structuredData = []

    document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
      try {
        const data = JSON.parse(script.textContent)
        structuredData.push(data)
      } catch (e) {
        console.error('Failed to parse structured data:', e)
      }
    })

    return structuredData
  }

  async sendToWebhook(data, webhookUrl) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
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
