import React, { useState, useRef, useEffect } from 'react'
import Post from './Post.jsx'
import { useSubreddit } from '../hooks/useSubreddit.js'
import { useSubredditInfo } from '../hooks/useSubredditInfo.js'
import { formatCount, SORTS } from '../lib/reddit.js'

const TIME_FILTERS = ['hour', 'day', 'week', 'month', 'year', 'all']

export default function Lane({ subreddit, index, total, onRemove, onMove }) {
  const {
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
  } = useSubreddit(subreddit)
  const { info } = useSubredditInfo(subreddit)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [menuOpen])

  const changeSort = (next) => {
    if (next !== sort) setSort(next)
  }

  const changeTime = (e) => setTime(e.target.value)

  return (
    <section className="lane" aria-label={`Subreddit r/${subreddit}`}>
      <header className="lane-header">
        <div className="lane-heading">
          <span className="lane-title">/r/{subreddit}</span>
          {info && (
            <span className="lane-subscribers">
              {formatCount(info.subscribers)} members
            </span>
          )}
        </div>
        <div className="lane-header-actions">
          <button
            className="lane-icon-btn"
            onClick={refetch}
            aria-label={`Refresh r/${subreddit}`}
            title="Refresh"
          >
            ⟳
          </button>
          <button
            className="lane-menu-btn"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Lane options"
            aria-expanded={menuOpen}
          >
            ⋮
          </button>
        </div>
        {menuOpen && (
          <div className="lane-menu" ref={menuRef} role="menu">
            <button
              className="lane-menu-item"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false)
                refetch()
              }}
            >
              Refresh
            </button>
            <button
              className="lane-menu-item"
              role="menuitem"
              disabled={index === 0}
              onClick={() => {
                setMenuOpen(false)
                onMove(subreddit, -1)
              }}
            >
              Move left
            </button>
            <button
              className="lane-menu-item"
              role="menuitem"
              disabled={index === total - 1}
              onClick={() => {
                setMenuOpen(false)
                onMove(subreddit, 1)
              }}
            >
              Move right
            </button>
            <button
              className="lane-menu-item danger"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false)
                onRemove(subreddit)
              }}
            >
              Delete
            </button>
          </div>
        )}
      </header>

      <div className="lane-toolbar">
        <div className="sort-tabs" role="tablist" aria-label="Sort posts">
          {SORTS.map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={sort === s}
              className={`sort-tab${sort === s ? ' active' : ''}`}
              onClick={() => changeSort(s)}
            >
              {s}
            </button>
          ))}
        </div>
        {sort === 'top' && (
          <select
            className="time-select"
            value={time}
            onChange={changeTime}
            aria-label="Time range"
          >
            {TIME_FILTERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="lane-posts">
        {loading && (
          <div className="loading-state">
            <div className="spinner" />
            <span>Loading r/{subreddit}…</span>
          </div>
        )}
        {error && !loading && (
          <div className="error-state">
            <span className="error-icon">⚠</span>
            <span>{error}</span>
            <button className="retry-btn" onClick={refetch}>
              Try again
            </button>
          </div>
        )}
        {!loading && !error && posts.length === 0 && (
          <div className="empty-state">
            <span>No posts found</span>
          </div>
        )}
        {!loading &&
          !error &&
          posts.map((post) => <Post key={post.id} post={post} />)}
        {!loading && !error && posts.length > 0 && (
          <div className="lane-footer">
            {after ? (
              <button
                className="load-more-btn"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            ) : (
              <span className="lane-end">End of posts</span>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
