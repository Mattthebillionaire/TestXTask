import { BaseFeature } from './base.js'

export class XScraper extends BaseFeature {
  constructor() {
    super()
    this.extractedPostIds = new Set()
    this.scrollAttempts = 0
    this.maxScrollAttempts = 10
    this.lastPostCount = 0
    this.noNewPostsCount = 0
    this.searchQuery = ''
  }

  detectPageType() {
    const url = window.location.href

    if (url.includes('/search')) {
      return 'search-results'
    }

    if (url.includes('/explore')) {
      return 'explore'
    }

    if (url.match(/\/status\/\d+/)) {
      return 'tweet-detail'
    }

    if (url.includes('/home')) {
      return 'home'
    }

    return 'unknown'
  }

  async autoExecute(searchQuery = null) {
    if (searchQuery) {
      this.searchQuery = searchQuery
    }

    const pageType = this.detectPageType()
    console.log('X Scraper - Page type:', pageType, 'Query:', this.searchQuery)

    switch (pageType) {
      case 'explore':
        return await this.handleExplorePage()

      case 'search-results':
        return await this.scrollAndExtract()

      default:
        return { success: false, error: `Unsupported page type: ${pageType}` }
    }
  }

  async handleExplorePage() {
    if (!this.searchQuery) {
      const state = await this.getScrapingState()
      this.searchQuery = state?.searchQuery || ''
    }

    if (!this.searchQuery) {
      return { success: false, error: 'No search query provided' }
    }

    await this.updateScrapingState({
      status: 'typing_search',
      statusText: `Typing "${this.searchQuery}" in search...`
    })

    this.showNotification(`Searching for "${this.searchQuery}"...`, 'info')

    await this.delay(1000)

    const searchInput = await this.findSearchInput()

    if (!searchInput) {
      return { success: false, error: 'Could not find search input' }
    }

    await this.typeInSearchInput(searchInput, this.searchQuery)

    await this.delay(500)

    await this.submitSearch(searchInput)

    return { success: true, message: 'Search submitted, waiting for results...' }
  }

  async getScrapingState() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getScrapingState' }, (response) => {
        resolve(response?.state)
      })
    })
  }

  async findSearchInput() {
    const selectors = [
      'input[data-testid="SearchBox_Search_Input"]',
      'input[aria-label="Search query"]',
      'input[placeholder="Search"]',
      'form[role="search"] input'
    ]

    for (const selector of selectors) {
      try {
        const element = await this.waitForElement(selector, 5000)
        if (element) {
          console.log('Found search input with selector:', selector)
          return element
        }
      } catch (e) {
        continue
      }
    }

    return null
  }

  async typeInSearchInput(input, text) {
    input.focus()
    await this.delay(200)

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    ).set

    nativeInputValueSetter.call(input, text)

    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
    input.dispatchEvent(new Event('change', { bubbles: true, composed: true }))

    await this.delay(300)

    if (input.value !== text) {
      console.log('X Scraper: Input value mismatch, retrying...')
      nativeInputValueSetter.call(input, text)
      input.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
      await this.delay(200)
    }

    console.log('X Scraper: Typed query:', input.value)
  }

  async submitSearch(input) {
    await this.updateScrapingState({
      status: 'submitting_search',
      statusText: 'Submitting search...'
    })

    input.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true
    }))

    await this.delay(100)

    input.dispatchEvent(new KeyboardEvent('keyup', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true
    }))

    const form = input.closest('form')
    if (form) {
      form.dispatchEvent(new Event('submit', { bubbles: true }))
    }
  }

  async scrollAndExtract() {
    await this.updateScrapingState({
      status: 'extracting',
      statusText: 'Extracting posts from search results...'
    })

    this.showNotification('Starting to extract posts...', 'info')

    await this.delay(2000)

    let allPosts = []
    this.scrollAttempts = 0
    this.noNewPostsCount = 0
    this.lastPostCount = 0

    while (this.scrollAttempts < this.maxScrollAttempts) {
      const posts = await this.extractPosts()

      if (posts.length > 0) {
        allPosts = [...allPosts, ...posts]

        await this.updateScrapingState({
          newPosts: posts,
          currentPage: this.scrollAttempts + 1,
          statusText: `Extracted ${allPosts.length} posts...`
        })

        this.showNotification(`Extracted ${allPosts.length} posts so far...`, 'success', 2000)
      }

      if (allPosts.length === this.lastPostCount) {
        this.noNewPostsCount++
        if (this.noNewPostsCount >= 3) {
          console.log('No new posts found after 3 attempts, stopping')
          break
        }
      } else {
        this.noNewPostsCount = 0
        this.lastPostCount = allPosts.length
      }

      await this.scrollPage(800)
      await this.delay(1500)

      this.scrollAttempts++
    }

    allPosts.sort((a, b) => (b.textScore || 0) - (a.textScore || 0))

    this.showNotification(`Extraction complete! Found ${allPosts.length} posts`, 'success', 5000)

    await this.notifyScrapingComplete()

    return { success: true, posts: allPosts, total: allPosts.length }
  }

  async extractPosts() {
    const posts = []
    const MIN_TEXT_LENGTH = 50

    const tweetSelectors = [
      'article[data-testid="tweet"]',
      '[data-testid="cellInnerDiv"] article'
    ]

    const tweetElements = this.findElements(tweetSelectors)

    for (const element of tweetElements) {
      try {
        const post = this.extractPostData(element)

        if (post && post.id && !this.extractedPostIds.has(post.id)) {
          if (post.content.length < MIN_TEXT_LENGTH) {
            console.log(`Skipping short post (${post.content.length} chars): "${post.content.slice(0, 30)}..."`)
            continue
          }

          post.textScore = this.calculateTextScore(post)
          this.extractedPostIds.add(post.id)
          posts.push(post)
        }
      } catch (error) {
        console.error('Error extracting post:', error)
      }
    }

    return posts
  }

  calculateTextScore(post) {
    let score = post.content.length

    if (!post.hasMedia) {
      score += 50
    }

    if (post.content.length > 150) {
      score += 30
    }

    const lines = post.content.split('\n').filter(l => l.trim())
    if (lines.length >= 2) {
      score += 20
    }

    return score
  }

  extractPostData(element) {
    const article = element.closest('article') || element

    const authorElement = article.querySelector('[data-testid="User-Name"] a[href^="/"]')
    const authorHandle = authorElement?.getAttribute('href')?.replace('/', '') || ''

    const displayNameEl = article.querySelector('[data-testid="User-Name"] span')
    const displayName = displayNameEl?.textContent || ''

    const textElement = article.querySelector('[data-testid="tweetText"]')
    const content = textElement?.textContent || ''

    const timeElement = article.querySelector('time')
    const timestamp = timeElement?.getAttribute('datetime') || ''
    const tweetUrl = timeElement?.closest('a')?.getAttribute('href') || ''

    const tweetId = tweetUrl.match(/status\/(\d+)/)?.[1] || ''

    const metrics = this.extractMetrics(article)

    const mediaElements = article.querySelectorAll('[data-testid="tweetPhoto"], video')
    const hasMedia = mediaElements.length > 0
    const mediaType = this.detectMediaType(article)

    const hashtags = this.extractHashtags(content)
    const mentions = this.extractMentions(content)
    const structure = this.classifyTweetStructure(content)

    return {
      id: tweetId,
      author: {
        handle: authorHandle,
        displayName: this.cleanText(displayName)
      },
      content: this.cleanText(content),
      timestamp,
      url: tweetUrl ? `https://x.com${tweetUrl}` : '',
      metrics,
      hasMedia,
      mediaType,
      hashtags,
      mentions,
      structure,
      extractedAt: new Date().toISOString()
    }
  }

  extractMetrics(article) {
    const metrics = {
      replies: 0,
      retweets: 0,
      likes: 0,
      views: 0,
      bookmarks: 0
    }

    const replyButton = article.querySelector('[data-testid="reply"]')
    const retweetButton = article.querySelector('[data-testid="retweet"]')
    const likeButton = article.querySelector('[data-testid="like"]')
    const viewsElement = article.querySelector('a[href*="/analytics"]')

    if (replyButton) {
      metrics.replies = this.parseMetricValue(replyButton.textContent)
    }

    if (retweetButton) {
      metrics.retweets = this.parseMetricValue(retweetButton.textContent)
    }

    if (likeButton) {
      metrics.likes = this.parseMetricValue(likeButton.textContent)
    }

    if (viewsElement) {
      metrics.views = this.parseMetricValue(viewsElement.textContent)
    }

    return metrics
  }

  parseMetricValue(text) {
    if (!text) return 0

    const cleaned = text.replace(/[^\d.KMB]/gi, '')

    if (cleaned.includes('K') || cleaned.includes('k')) {
      return Math.round(parseFloat(cleaned) * 1000)
    }
    if (cleaned.includes('M') || cleaned.includes('m')) {
      return Math.round(parseFloat(cleaned) * 1000000)
    }
    if (cleaned.includes('B') || cleaned.includes('b')) {
      return Math.round(parseFloat(cleaned) * 1000000000)
    }

    return parseInt(cleaned) || 0
  }

  detectMediaType(article) {
    if (article.querySelector('video')) return 'video'
    if (article.querySelector('[data-testid="tweetPhoto"]')) return 'image'
    if (article.querySelector('[data-testid="card.wrapper"]')) return 'link'
    return 'text'
  }

  extractHashtags(content) {
    const matches = content.match(/#\w+/g) || []
    return [...new Set(matches.map(tag => tag.toLowerCase()))]
  }

  extractMentions(content) {
    const matches = content.match(/@\w+/g) || []
    return [...new Set(matches.map(mention => mention.toLowerCase()))]
  }

  classifyTweetStructure(content) {
    if (!content) return 'unknown'

    const lines = content.split('\n').filter(line => line.trim())

    if (lines.length > 3 && lines.some(l => /^[\d•\-\*]/.test(l.trim()))) {
      return 'list_format'
    }

    if (content.includes('?') && lines.length >= 2) {
      return 'question_answer'
    }

    if (content.includes('Thread') || content.includes('1/')) {
      return 'thread_starter'
    }

    if (lines.length >= 2 && lines[0].length < 50) {
      return 'hook_story'
    }

    if (content.match(/\b(unpopular opinion|hot take|controversial)\b/i)) {
      return 'controversial_take'
    }

    if (content.match(/\b(learn|tip|how to|guide)\b/i)) {
      return 'educational'
    }

    if (content.match(/\b(link in bio|check out|sign up|click)\b/i)) {
      return 'call_to_action'
    }

    return 'general'
  }
}
