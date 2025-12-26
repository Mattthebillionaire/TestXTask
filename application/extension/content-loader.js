(async () => {
  const src = chrome.runtime.getURL('src/content-script.js')
  const contentScript = await import(src)
})()
