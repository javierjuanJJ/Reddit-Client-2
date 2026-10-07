import React from 'react'
import { timeAgo } from '../lib/reddit.js'

function formatScore(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(n)
}

export default function Post({ post }) {
  const isRedditLink =
    post.isSelf || /^https?:\/\/(www\.)?reddit\.com/i.test(post.url || '')

  return (
    <a
      className="post"
      href={`https://www.reddit.com${post.permalink}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      <div className="post-votes">
        <span className="post-vote-arrow" aria-hidden="true">
          ▲
        </span>
        <span className="post-vote-count">{formatScore(post.score)}</span>
        <span
          className="post-ratio"
          title={`${Math.round((post.upvoteRatio || 0) * 100)}% upvoted`}
        >
          {Math.round((post.upvoteRatio || 0) * 100)}%
        </span>
      </div>
      <h3 className="post-title">
        {post.title}
        {post.nsfw && <span className="post-badge nsfw">NSFW</span>}
        {!isRedditLink && post.domain && (
          <span className="post-badge domain">{post.domain}</span>
        )}
      </h3>
      <div className="post-meta">
        by <span className="post-author">u/{post.author}</span>
        {' · '}
        <span title={new Date(post.createdUtc * 1000).toLocaleString()}>
          {timeAgo(post.createdUtc)}
        </span>
        {' · '}
        {post.numComments} comments
      </div>
    </a>
  )
}
