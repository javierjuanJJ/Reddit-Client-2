import React, { useState, useEffect } from 'react'
import Lane from './components/Lane.jsx'
import AddSubredditModal from './components/AddSubredditModal.jsx'

const STORAGE_KEY = 'reddit-client-lanes'
const DEFAULT_LANES = ['learnprogramming', 'javascript']

function loadLanes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {
    // ignore corrupted storage
  }
  return DEFAULT_LANES
}

export default function App() {
  const [lanes, setLanes] = useState(loadLanes)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lanes))
    } catch {
      // storage unavailable (private mode, quota)
    }
  }, [lanes])

  const addLane = (name) => {
    setLanes((prev) =>
      prev.includes(name.toLowerCase()) ? prev : [...prev, name.toLowerCase()]
    )
  }

  const removeLane = (name) => {
    setLanes((prev) => prev.filter((l) => l !== name.toLowerCase()))
  }

  const moveLane = (name, direction) => {
    setLanes((prev) => {
      const from = prev.indexOf(name)
      const to = from + direction
      if (from < 0 || to < 0 || to >= prev.length) return prev
      const next = [...prev]
      ;[next[from], next[to]] = [next[to], next[from]]
      return next
    })
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <span className="reddit-icon" aria-hidden="true">
            ◉
          </span>
          Reddit Client
        </div>
        <button className="header-add-btn" onClick={() => setModalOpen(true)}>
          + Add subreddit
        </button>
      </header>

      <main className="lanes-container">
        {lanes.length === 0 ? (
          <div className="no-lanes">
            <span className="no-lanes-icon" aria-hidden="true">
              ◉
            </span>
            <span className="no-lanes-text">No subreddit lanes yet</span>
            <span className="no-lanes-hint">
              Click the + button to add your first lane
            </span>
          </div>
        ) : (
          lanes.map((sub, i) => (
            <Lane
              key={sub}
              subreddit={sub}
              index={i}
              total={lanes.length}
              onRemove={removeLane}
              onMove={moveLane}
            />
          ))
        )}
      </main>

      <button
        className="add-lane-btn"
        onClick={() => setModalOpen(true)}
        aria-label="Add subreddit"
        title="Add subreddit"
      >
        +
      </button>

      {modalOpen && (
        <AddSubredditModal
          onClose={() => setModalOpen(false)}
          onAdd={addLane}
          existing={lanes}
        />
      )}
    </div>
  )
}
