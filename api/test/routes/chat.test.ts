import { test } from 'node:test'
import * as assert from 'node:assert'
import { build } from '../helper'

test('chat route returns not implemented for a valid request', async (t) => {
  const app = await build(t)

  const res = await app.inject({
    method: 'POST',
    url: '/api/chat',
    payload: {
      question: 'Hello, world!'
    }
  })

  assert.equal(res.statusCode, 501)
  assert.deepStrictEqual(res.json(), {
    error: {
      code: 'CHAT_NOT_IMPLEMENTED',
      message: 'Chat functionality is not available yet.'
    }
  })
})

for (const [name, payload] of [
  ['missing body', undefined],
  ['missing question', {}],
  ['empty question', { question: '' }]
] as const) {
  test(`chat route rejects ${name}`, async (t) => {
    const app = await build(t)

    const res = await app.inject({
      method: 'POST',
      url: '/api/chat',
      ...(payload === undefined ? {} : { payload })
    })

    assert.equal(res.statusCode, 400)
    assert.equal(res.json().statusCode, 400)
    assert.equal(res.json().error, 'Bad Request')
  })
}

test('chat route rejects malformed JSON', async (t) => {
  const app = await build(t)

  const res = await app.inject({
    method: 'POST',
    url: '/api/chat',
    headers: { 'content-type': 'application/json' },
    payload: '{"question":'
  })

  assert.equal(res.statusCode, 400)
  assert.equal(res.json().statusCode, 400)
  assert.equal(res.json().error, 'Bad Request')
})
