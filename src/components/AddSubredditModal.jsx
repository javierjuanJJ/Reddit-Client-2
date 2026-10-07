import React, { useState, useEffect, useRef } from 'react'
import { getSubredditInfo, describeError } from '../lib/reddit.js'

export default function AddSubredditModal({ onClose, onAdd, existing }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const validate = (raw) => {
    const cleaned = raw.trim().replace(/^\/?r\//i, '').replace(/\/+$/, '')
    if (!cleaned) return { ok: false, error: 'Enter a subreddit name' }
    if (!/^[a-zA-Z0-9_]{3,21}$/.test(cleaned))
      return {
        ok: false,
        error: '3-21 chars: letters, numbers, underscores',
      }
    if (existing.includes(cleaned.toLowerCase()))
      return { ok: false, error: `r/${cleaned} already added` }
    return { ok: true, name: cleaned }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const v = validate(name)
    if (!v.ok) {
      setError(v.error)
      return
    }
    setChecking(true)
    setError('')
    try {
      const info = await getSubredditInfo(v.name)
      if (info.type !== 'public' && info.type !== 'restricted') {
        setError(`r/${v.name} is private or banned`)
        return
      }
      onAdd(info.name.toLowerCase())
      onClose()
    } catch (err) {
      setError(describeError(v.name, err))
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Add subreddit"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-title">Enter the name of subreddit</div>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            className="modal-input"
            type="text"
            placeholder="e.g. javascript"
            value={name}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => {
              setName(e.target.value)
              setError('')
            }}
          />
          {error && (
            <div className="modal-error" role="alert">
              {error}
            </div>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="modal-btn modal-btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="modal-btn modal-btn-primary"
              disabled={checking}
            >
              {checking ? 'Checking…' : 'Add Subreddit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
