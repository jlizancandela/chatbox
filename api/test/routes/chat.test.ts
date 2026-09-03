import { test } from 'node:test'
import * as assert from 'node:assert'
import { build } from '../helper'

test('chat route returns insufficient context for an unrelated question', async (t) => {
  const app = await build(t)

  const res = await app.inject({
    method: 'POST',
    url: '/api/chat',
    payload: {
      question: '¿Cómo se prepara una paella valenciana?'
    }
  })

  assert.equal(res.statusCode, 200)
  const body = res.json()
  assert.deepStrictEqual(body, {
    answer: null,
    sources: [],
    insufficientContext: true
  })
})

test('chat route rejects a whitespace-only question', async (t) => {
  const app = await build(t)

  const res = await app.inject({
    method: 'POST',
    url: '/api/chat',
    payload: {
      question: '   '
    }
  })

  assert.equal(res.statusCode, 400)
  assert.deepStrictEqual(res.json(), {
    error: {
      code: 'INVALID_QUESTION',
      message: 'Question must be between 1 and 1000 characters long.'
    }
  })
})

test('chat route rejects a question longer than 1000 characters', async (t) => {
  const app = await build(t)

  const res = await app.inject({
    method: 'POST',
    url: '/api/chat',
    payload: {
      question: 'a'.repeat(1001)
    }
  })

  assert.equal(res.statusCode, 400)
  assert.deepStrictEqual(res.json(), {
    error: {
      code: 'INVALID_QUESTION',
      message: 'Question must be between 1 and 1000 characters long.'
    }
  })
})

test('chat route returns an answer and sources for a relevant question', async (t) => {
  const app = await build(t)

  const res = await app.inject({
    method: 'POST',
    url: '/api/chat',
    payload: {
      question: '¿Qué tecnologías usa Jorge en el proyecto de reservas de peluquería?'
    }
  })

  assert.equal(res.statusCode, 200)
  const body = res.json()

  assert.equal(typeof body.answer, 'string')
  assert.ok(body.answer.length > 0)
  assert.equal(body.insufficientContext, false)
  assert.ok(Array.isArray(body.sources))
  assert.ok(body.sources.length > 0)
  assert.ok(body.sources.length <= 5)

  for (const source of body.sources) {
    assert.equal(typeof source.documentId, 'string')
    assert.equal(typeof source.chunkIndex, 'number')
    assert.equal(typeof source.content, 'string')
    assert.equal(typeof source.distance, 'number')
    assert.ok(source.distance < 0.5)
  }
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
    assert.deepStrictEqual(res.json(), {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed'
      }
    })
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
  assert.deepStrictEqual(res.json(), {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed'
    }
  })
})
