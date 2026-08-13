import { test } from 'node:test'
import * as assert from 'node:assert'
import { build } from '../helper'

test('health route returns correct response', async (t) => {
  const app = await build(t)

  const res = await app.inject({
    url: '/health'
  })

  assert.equal(res.statusCode, 200)

  assert.deepStrictEqual(res.json(), { status: 'ok' })
})