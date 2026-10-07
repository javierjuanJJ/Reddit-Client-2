import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import App from './App.jsx'

const NOW = Math.floor(Date.now() / 1000)

function jsonRes(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (h) =>
        h.toLowerCase() === 'content-type' ? 'application/json' : null,
    },
    json: async () => body,
  }
}

function mkPost(id, title, extra = {}) {
  return {
    id,
    title,
    author: `user_${id}`,
    score: 1234,
    upvote_ratio: 0.95,
    num_comments: 7,
    permalink: `/r/test/comments/${id}/title/`,
    url: `https://example.com/${id}`,
    domain: 'example.com',
    created_utc: NOW - 3600,
    thumbnail: `https://example.com/${id}.jpg`,
    ...extra,
  }
}

function mkListing(posts, after = null) {
  return {
    kind: 'Listing',
    data: {
      after,
      children: posts.map((p) => ({ kind: 't3', data: p })),
    },
  }
}

function mkAbout(name, subscribers = 1000, type = 'public') {
  return {
    kind: 't5',
    data: {
      display_name: name,
      title: name,
      subscribers,
      subreddit_type: type,
      over_18: false,
      public_description: '',
    },
  }
}

const notFound = () =>
  jsonRes({ message: 'Not Found', error: 404 }, 404)

function defaultHandler(url) {
  if (url.includes('/about.json')) {
    const name = url.match(/\/r\/([^/]+)\/about/)?.[1] ?? 'unknown'
    return jsonRes(mkAbout(name))
  }
  const match = url.match(/\/r\/([^/]+)\/(\w+)\.json/)
  if (match) {
    return jsonRes(mkListing([mkPost(`${match[1]}_1`, `${match[1]} headline`)]))
  }
  return notFound()
}

let handler = defaultHandler
const fetchMock = vi.fn(async (input) => handler(String(input)))
const requestedUrls = () => fetchMock.mock.calls.map((c) => String(c[0]))

beforeEach(() => {
  handler = defaultHandler
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Reddit client', () => {
  it('renders default lanes and their posts', async () => {
    render(<App />)

    expect(
      await screen.findByText('learnprogramming headline')
    ).toBeTruthy()
    expect(screen.getByText('javascript headline')).toBeTruthy()
    expect(screen.getByLabelText('Subreddit r/learnprogramming')).toBeTruthy()

    const urls = requestedUrls()
    expect(urls.some((u) => u.includes('/r/learnprogramming/hot.json?'))).toBe(
      true
    )
    expect(urls.some((u) => u.includes('/r/javascript/hot.json?'))).toBe(true)
    expect(urls.every((u) => u.startsWith('https://www.reddit.com'))).toBe(true)
  })

  it('shows a loading state while fetching', async () => {
    const pending = []
    handler = () => new Promise((resolve) => pending.push(() => resolve(defaultHandler('https://www.reddit.com/r/learnprogramming/hot.json'))))

    render(<App />)

    expect(screen.getAllByText(/^Loading r\//).length).toBe(2)

    while (pending.length < 2) {
      await new Promise((r) => setTimeout(r, 0))
    }
    pending.forEach((resolve) => resolve())

    expect(await screen.findByText('learnprogramming headline')).toBeTruthy()
    expect(screen.queryByText(/^Loading r\//)).toBeNull()
  })

  it('shows an error message for an invalid subreddit', async () => {
    localStorage.setItem('reddit-client-lanes', JSON.stringify(['nope']))
    handler = (url) => (url.includes('/about.json') ? jsonRes(mkAbout('nope')) : notFound())

    render(<App />)

    expect(await screen.findByText('r/nope does not exist')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
    expect(
      requestedUrls().every((u) => u.startsWith('https://www.reddit.com'))
    ).toBe(true)
  })

  it('restores lanes saved in localStorage', async () => {
    localStorage.setItem('reddit-client-lanes', JSON.stringify(['webdev']))

    render(<App />)

    expect(await screen.findByText('webdev headline')).toBeTruthy()
    expect(screen.queryByLabelText('Subreddit r/learnprogramming')).toBeNull()
  })

  it('adds a lane after verifying the subreddit exists', async () => {
    localStorage.setItem('reddit-client-lanes', JSON.stringify(['javascript']))

    render(<App />)
    await screen.findByText('javascript headline')

    screen.getByLabelText('Add subreddit').click()
    const dialog = await screen.findByRole('dialog')
    const input = within(dialog).getByPlaceholderText('e.g. javascript')

    input.value = 'react'
    input.dispatchEvent(new Event('input', { bubbles: true }))

    within(dialog).getByRole('button', { name: /add subreddit/i }).click()

    expect(await screen.findByLabelText('Subreddit r/react')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(JSON.parse(localStorage.getItem('reddit-client-lanes'))).toEqual([
      'javascript',
      'react',
    ])
  })

  it('rejects subreddits that do not exist in the modal', async () => {
    localStorage.setItem('reddit-client-lanes', JSON.stringify(['javascript']))
    handler = (url) =>
      url.includes('/about.json') && url.includes('ghost')
        ? notFound()
        : defaultHandler(url)

    render(<App />)
    await screen.findByText('javascript headline')

    screen.getByLabelText('Add subreddit').click()
    const dialog = await screen.findByRole('dialog')
    const input = within(dialog).getByPlaceholderText('e.g. javascript')
    input.value = 'ghost'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    within(dialog).getByRole('button', { name: /add subreddit/i }).click()

    expect(await screen.findByText('r/ghost does not exist')).toBeTruthy()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(JSON.parse(localStorage.getItem('reddit-client-lanes'))).toEqual([
      'javascript',
    ])
  })

  it('rejects duplicate lanes before hitting the API', async () => {
    localStorage.setItem('reddit-client-lanes', JSON.stringify(['javascript']))

    render(<App />)
    await screen.findByText('javascript headline')
    const callsBefore = fetchMock.mock.calls.length

    screen.getByLabelText('Add subreddit').click()
    const dialog = await screen.findByRole('dialog')
    const input = within(dialog).getByPlaceholderText('e.g. javascript')
    input.value = '/r/javascript'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    within(dialog).getByRole('button', { name: /add subreddit/i }).click()

    expect(await screen.findByText('r/javascript already added')).toBeTruthy()
    expect(fetchMock.mock.calls.length).toBe(callsBefore)
  })

  it('removes a lane and persists the change', async () => {
    render(<App />)
    await screen.findByText('learnprogramming headline')

    const lane = screen.getByLabelText('Subreddit r/learnprogramming')
    within(lane).getByRole('button', { name: 'Lane options' }).click()
    within(lane).getByRole('menuitem', { name: 'Delete' }).click()

    expect(screen.queryByLabelText('Subreddit r/learnprogramming')).toBeNull()
    expect(JSON.parse(localStorage.getItem('reddit-client-lanes'))).toEqual([
      'javascript',
    ])
  })

  it('moves a lane when using the menu', async () => {
    render(<App />)
    await screen.findByText('learnprogramming headline')

    const lane = screen.getByLabelText('Subreddit r/learnprogramming')
    within(lane).getByRole('button', { name: 'Lane options' }).click()
    within(lane).getByRole('menuitem', { name: 'Move right' }).click()

    expect(JSON.parse(localStorage.getItem('reddit-client-lanes'))).toEqual([
      'javascript',
      'learnprogramming',
    ])
  })

  it('switches lane sort and requests the new listing', async () => {
    localStorage.setItem('reddit-client-lanes', JSON.stringify(['solo']))
    handler = (url) =>
      url.includes('/about.json')
        ? jsonRes(mkAbout('solo'))
        : jsonRes(
            mkListing([
              mkPost(url.includes('/new.json') ? 'n1' : 'h1', url.includes('/new.json') ? 'sorted by new' : 'sorted by hot'),
            ])
          )

    render(<App />)
    await screen.findByText('sorted by hot')

    const lane = screen.getByLabelText('Subreddit r/solo')
    within(lane).getByRole('tab', { name: 'new' }).click()

    expect(await screen.findByText('sorted by new')).toBeTruthy()
    expect(
      requestedUrls().some((u) => u.includes('/r/solo/new.json?raw_json=1'))
    ).toBe(true)
  })

  it('requests the top listing with the selected time filter', async () => {
    localStorage.setItem('reddit-client-lanes', JSON.stringify(['solo']))
    handler = (url) =>
      url.includes('/about.json')
        ? jsonRes(mkAbout('solo'))
        : jsonRes(mkListing([mkPost('t1', 'top post')]))

    render(<App />)
    await screen.findByText('top post')

    const lane = screen.getByLabelText('Subreddit r/solo')
    within(lane).getByRole('tab', { name: 'top' }).click()
    await screen.findByText('top post')

    const urls = requestedUrls()
    expect(
      urls.some((u) => u.includes('/r/solo/top.json?') && u.includes('&t=day'))
    ).toBe(true)
  })

  it('loads more posts using the after cursor', async () => {
    localStorage.setItem('reddit-client-lanes', JSON.stringify(['solo']))
    handler = (url) =>
      url.includes('/about.json')
        ? jsonRes(mkAbout('solo'))
        : url.includes('after=t3_next')
          ? jsonRes(mkListing([mkPost('p2', 'Second page')]))
          : jsonRes(mkListing([mkPost('p1', 'First page')], 't3_next'))

    render(<App />)
    await screen.findByText('First page')

    const lane = screen.getByLabelText('Subreddit r/solo')
    within(lane).getByRole('button', { name: 'Load more' }).click()

    expect(await screen.findByText('Second page')).toBeTruthy()
    expect(
      requestedUrls().some((u) => u.includes('after=t3_next'))
    ).toBe(true)
    expect(within(lane).queryByRole('button', { name: 'Load more' })).toBeNull()
  })
})
