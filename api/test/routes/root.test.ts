import { test } from 'node:test'
import * as assert from 'node:assert'
import { build, testDependencies } from '../helper'

test('default root route', async (t) => {
  const app = await build(t, testDependencies())

  const res = await app.inject({
    url: '/'
  })
  assert.deepStrictEqual(JSON.parse(res.payload), { root: true })
})
