import { beforeEach, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { clearCache } from '../lib/reddit.js'

beforeEach(() => {
  localStorage.clear()
  clearCache()
})

afterEach(() => {
  cleanup()
})
