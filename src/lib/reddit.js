const BASE = 'https://www.reddit.com'
const TIMEOUT_MS = 8000
const CACHE_TTL = 60_000

const PROXIES = [
  (url) => url,
  (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
]

export class RedditError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'RedditError'
    this.status = status
  }
}

const cache = new Map()
const inflight = new Map()

function timeoutSignal() {
  return typeof AbortSignal !== 'undefined' && AbortSignal.timeout
    ? AbortSignal.timeout(TIMEOUT_MS)
    : undefined
}

export function clearCache() {
  cache.clear()
}

async function requestJSON(path, { force = false } = {}) {
  const target = `${BASE}${path}`

  if (!force) {
    const cached = cache.get(target)
    if (cached && cached.expires > Date.now()) return cached.value
  }
  if (inflight.has(target)) return inflight.get(target)

  const task = (async () => {
    let lastError = null

    for (const build of PROXIES) {
      let res
      try {
        res = await fetch(build(target), {
          headers: { Accept: 'application/json' },
          signal: timeoutSignal(),
        })
      } catch (err) {
        lastError = new RedditError('Could not reach Reddit', 0)
        continue
      }

      if (res.ok) {
        try {
          const data = await res.json()
          cache.set(target, { value: data, expires: Date.now() + CACHE_TTL })
          return data
        } catch {
          lastError = new RedditError('Reddit returned an invalid response', 0)
          continue
        }
      }

      const contentType = res.headers.get('content-type') || ''
      let body = null
      if (contentType.includes('json')) {
        try {
          body = await res.json()
        } catch {
          body = null
        }
      }
      if (body && body.error === res.status) {
        throw new RedditError(`Reddit responded with ${res.status}`, res.status)
      }
      lastError = new RedditError(`Reddit responded with ${res.status}`, res.status)
    }

    throw lastError || new RedditError('Could not reach Reddit', 0)
  })()

  inflight.set(target, task)
  try {
    return await task
  } finally {
    inflight.delete(target)
  }
}

export function describeError(subreddit, err) {
  const status = err?.status ?? 0
  if (status === 404) return `r/${subreddit} does not exist`
  if (status === 403) return `r/${subreddit} is private, banned or blocked`
  if (status === 429) return 'Reddit rate limit reached. Try again shortly.'
  if (status >= 500) return 'Reddit is having problems. Try again later.'
  if (status === 0) return 'Could not reach Reddit. Check your connection.'
  return `Failed to load r/${subreddit}`
}

function normalizePost(d) {
  const thumbnail =
    typeof d.thumbnail === 'string' && /^https?:\/\//.test(d.thumbnail)
      ? d.thumbnail
      : null

  return {
    id: d.id,
    title: d.title,
    author: d.author,
    score: d.score,
    upvoteRatio: d.upvote_ratio,
    numComments: d.num_comments,
    permalink: d.permalink,
    url: d.url,
    domain: d.domain,
    createdUtc: d.created_utc,
    thumbnail,
    isSelf: !!d.is_self,
    nsfw: !!d.over_18,
  }
}

export const SORTS = ['hot', 'new', 'top', 'rising']

export async function fetchListing(
  subreddit,
  { sort = 'hot', after = null, limit = 25, time = 'day', force = false } = {}
) {
  const params = new URLSearchParams({
    limit: String(limit),
    raw_json: '1',
  })
  if (after) params.set('after', after)
  if (sort === 'top' || sort === 'controversial') params.set('t', time)

  const path = `/r/${encodeURIComponent(subreddit)}/${sort}.json?${params}`
  const data = await requestJSON(path, { force })
  const listing = data?.data

  if (!listing || !Array.isArray(listing.children)) {
    throw new RedditError('Reddit returned an invalid response', 0)
  }

  const posts = listing.children
    .filter((c) => c?.kind === 't3' && c.data && !c.data.stickied)
    .map((c) => normalizePost(c.data))

  return { posts, after: listing.after ?? null }
}

export async function getSubredditInfo(subreddit, { force = false } = {}) {
  const data = await requestJSON(
    `/r/${encodeURIComponent(subreddit)}/about.json?raw_json=1`,
    { force }
  )
  const info = data?.data

  if (!info?.display_name) {
    throw new RedditError('Reddit returned an invalid response', 0)
  }

  return {
    name: info.display_name,
    title: info.title,
    description: info.public_description || '',
    subscribers: info.subscribers ?? 0,
    nsfw: !!info.over_18,
    type: info.subreddit_type,
  }
}

export function formatCount(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return ''
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  return String(n)
}

export function timeAgo(createdUtc) {
  const seconds = Math.max(0, Date.now() / 1000 - createdUtc)
  if (seconds < 3600) return `${Math.max(1, Math.floor(seconds / 60))}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)}d`
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)}mo`
  return `${Math.floor(seconds / 31536000)}y`
}
