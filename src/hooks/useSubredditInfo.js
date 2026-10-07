import { useState, useEffect, useCallback } from 'react'
import { getSubredditInfo, describeError } from '../lib/reddit.js'

export function useSubredditInfo(subreddit) {
  const [info, setInfo] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setInfo(await getSubredditInfo(subreddit))
    } catch (err) {
      setInfo(null)
      setError(describeError(subreddit, err))
    }
  }, [subreddit])

  useEffect(() => {
    load()
  }, [load])

  return { info, error, refetch: load }
}
