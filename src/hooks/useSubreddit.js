import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchListing, describeError } from '../lib/reddit.js'

export function useSubreddit(subreddit) {
  const [sort, setSort] = useState('hot')
  const [time, setTime] = useState('day')
  const [posts, setPosts] = useState([])
  const [after, setAfter] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const requestId = useRef(0)

  const effectiveTime = sort === 'top' ? time : 'day'

  const load = useCallback(
    async ({ append = false, cursor = null, force = false } = {}) => {
      const id = ++requestId.current
      if (append) setLoadingMore(true)
      else setLoading(true)
      setError(null)

      try {
        const result = await fetchListing(subreddit, {
          sort,
          after: cursor,
          time: effectiveTime,
          force,
        })
        if (id !== requestId.current) return

        setPosts((prev) => {
          if (!append) return result.posts
          const seen = new Set(prev.map((p) => p.id))
          return [...prev, ...result.posts.filter((p) => !seen.has(p.id))]
        })
        setAfter(result.after)
      } catch (err) {
        if (id !== requestId.current) return
        setError(describeError(subreddit, err))
        if (!append) {
          setPosts([])
          setAfter(null)
        }
      } finally {
        if (id === requestId.current) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    [subreddit, sort, effectiveTime]
  )

  useEffect(() => {
    load()
  }, [load])

  const loadMore = useCallback(() => {
    if (after && !loading && !loadingMore) load({ append: true, cursor: after })
  }, [after, loading, loadingMore, load])

  const refetch = useCallback(() => load({ force: true }), [load])

  return {
    posts,
    sort,
    setSort,
    time,
    setTime,
    after,
    loading,
    loadingMore,
    error,
    loadMore,
    refetch,
  }
}
