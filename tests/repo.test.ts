import { describe, expect, it } from 'vitest'
import { parseRepo } from '../server/utils/store'

describe('parseRepo', () => {
  it('accepts the usual ways to write a repository', () => {
    expect(parseRepo('tobiaskugel/femto-pasta-data')).toEqual({ repo: 'tobiaskugel/femto-pasta-data', kind: null })
    expect(parseRepo('https://huggingface.co/tobiaskugel/femto-pasta-data')).toEqual({ repo: 'tobiaskugel/femto-pasta-data', kind: 'models' })
    expect(parseRepo('https://huggingface.co/datasets/tobiaskugel/femto-pasta-data/tree/main')).toEqual({ repo: 'tobiaskugel/femto-pasta-data', kind: 'datasets' })
    expect(parseRepo(' datasets/tobiaskugel/femto-pasta-data/ ')).toEqual({ repo: 'tobiaskugel/femto-pasta-data', kind: 'datasets' })
  })
  it('refuses nonsense and spaces', () => {
    expect(parseRepo('')).toBeNull()
    expect(parseRepo('femto-pasta-data')).toBeNull()
    expect(parseRepo('https://huggingface.co/spaces/a/b')).toBeNull()
  })
})
