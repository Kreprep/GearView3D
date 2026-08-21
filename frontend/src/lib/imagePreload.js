// Nudges the browser to fetch reference images into its HTTP cache ahead of
// time, so by the time a learner clicks a hotspot, PartDetailCard's <img>
// resolves from cache instead of paying the fetch latency at click time.
const preloaded = new Set()

export function preloadImages(urls) {
  for (const url of urls) {
    if (!url || preloaded.has(url)) continue
    preloaded.add(url)
    const img = new Image()
    img.src = url
  }
}
