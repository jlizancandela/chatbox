import { request } from 'node:http'
import { test } from 'node:test'
import * as assert from 'node:assert'
import type Groq from 'groq-sdk'
import { build } from '../helper'
import { CHAT_BODY_LIMIT_BYTES } from '../../src/schemas/chat'

type SSEFrame = {
  event: string
  data: unknown
}

function parseSSE (payload: string): SSEFrame[] {
  const frames: SSEFrame[] = []
  let current: { event?: string; data?: string } = {}

  for (const line of payload.split('\n')) {
    if (line === '') {
      if (current.event !== undefined && current.data !== undefined) {
        frames.push({
          event: current.event,
          data: JSON.parse(current.data)
        })
      }
      current = {}
      continue
    }
    if (line.startsWith('event:')) current.event = line.slice(6).trim()
    else if (line.startsWith('data:')) current.data = line.slice(5).trim()
  }

  return frames
}

test('chat stream returns empty sources and done for an unrelated question', async (t) => {
  const app = await build(t)

  const res = await app.inject({
    method: 'POST',
    url: '/api/chat',
    payload: {
      question: '¿Cómo se prepara una paella valenciana?'
    }
  })

  assert.equal(res.statusCode, 200)
  assert.equal(res.headers['content-type'], 'text/event-stream')

  const frames = parseSSE(res.payload)
  assert.equal(frames.length, 2)
  assert.equal(frames[0].event, 'sources')
  assert.deepStrictEqual(frames[0].data, { sources: [], history: [] })
  assert.equal(frames[1].event, 'done')
  assert.deepStrictEqual(frames[1].data, {})
})

test('chat stream returns sources, tokens and done for a relevant question', async (t) => {
  const app = await build(t)

  const res = await app.inject({
    method: 'POST',
    url: '/api/chat',
    payload: {
      question: '¿Qué tecnologías usa Jorge en el proyecto de reservas de peluquería?'
    }
  })

  assert.equal(res.statusCode, 200)
  assert.equal(res.headers['content-type'], 'text/event-stream')

  const frames = parseSSE(res.payload)

  assert.ok(frames.length >= 3, `expected at least 3 frames, got ${frames.length}`)

  const [first] = frames
  assert.equal(first.event, 'sources')
  const sources = (first.data as { sources: Array<unknown> }).sources
  assert.ok(Array.isArray(sources))
  assert.ok(sources.length > 0, 'expected at least one source')
  assert.ok(sources.length <= 5)

  for (const source of sources as Array<{
    documentId: string
    chunkIndex: number
    content: string
    distance: number
  }>) {
    assert.equal(typeof source.documentId, 'string')
    assert.equal(typeof source.chunkIndex, 'number')
    assert.equal(typeof source.content, 'string')
    assert.equal(typeof source.distance, 'number')
    assert.ok(source.distance < 0.5)
  }

  const tokenFrames = frames.filter((frame) => frame.event === 'token')
  assert.ok(tokenFrames.length > 0, 'expected at least one token frame')
  for (const frame of tokenFrames) {
    const token = (frame.data as { token: string }).token
    assert.equal(typeof token, 'string')
    assert.ok(token.length > 0)
  }

  const last = frames[frames.length - 1]
  assert.equal(last.event, 'done')
  assert.deepStrictEqual(last.data, {})
})

test('chat stream emits a generic error when Groq fails after sources', async (t) => {
  const app = await build(t)
  app.groq.client = {
    chat: {
      completions: {
        create: async () => {
          throw new Error('provider secret that must not leak')
        }
      }
    }
  } as unknown as Groq

  const res = await app.inject({
    method: 'POST',
    url: '/api/chat',
    payload: {
      question: '¿Qué tecnologías usa Jorge en el proyecto de reservas de peluquería?'
    }
  })

  assert.equal(res.statusCode, 200)
  assert.equal(res.headers['content-type'], 'text/event-stream')

  const frames = parseSSE(res.payload)
  assert.equal(frames[0].event, 'sources')
  assert.equal(frames[frames.length - 1].event, 'error')
  assert.deepStrictEqual(frames[frames.length - 1].data, {
    message: 'An unexpected error occurred while generating the answer'
  })
  assert.equal(res.payload.includes('provider secret that must not leak'), false)
})

test('chat stream aborts Groq when the HTTP client disconnects', async (t) => {
  const app = await build(t)
  let groqSignal: AbortSignal | undefined
  let resolveGroqStarted: (() => void) | undefined
  const groqStarted = new Promise<void>((resolve) => {
    resolveGroqStarted = resolve
  })

  app.groq.client = {
    chat: {
      completions: {
        create: async (
          _params: Record<string, unknown>,
          options?: { signal?: AbortSignal | null }
        ) => {
          groqSignal = options?.signal ?? undefined
          resolveGroqStarted?.()

          return (async function* () {
            await new Promise<void>((resolve) => {
              if (groqSignal?.aborted) {
                resolve()
                return
              }
              groqSignal?.addEventListener('abort', () => resolve(), { once: true })
            })
          })()
        }
      }
    }
  } as unknown as Groq

  await app.listen({ host: '127.0.0.1', port: 0 })
  const address = app.server.address()
  assert.ok(address && typeof address === 'object')

  const clientRequest = request({
    host: '127.0.0.1',
    port: address.port,
    method: 'POST',
    path: '/api/chat',
    headers: { 'content-type': 'application/json' }
  })

  const sourcesReceived = new Promise<void>((resolve, reject) => {
    clientRequest.once('response', (response) => {
      response.once('data', () => resolve())
      response.once('error', reject)
    })
    clientRequest.once('error', (error) => {
      if ((error as NodeJS.ErrnoException).code !== 'ECONNRESET') reject(error)
    })
  })

  clientRequest.end(JSON.stringify({
    question: '¿Qué tecnologías usa Jorge en el proyecto de reservas de peluquería?'
  }))

  await sourcesReceived
  await groqStarted
  clientRequest.destroy()

  await new Promise<void>((resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error('Groq signal was not aborted')), 1000)
    const check = () => {
      if (groqSignal?.aborted) {
        clearTimeout(deadline)
        resolve()
      } else {
        setImmediate(check)
      }
    }
    check()
  })

  await app.close()
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

test('chat route rejects a request body larger than the configured limit', async (t) => {
  const app = await build(t)

  const res = await app.inject({
    method: 'POST',
    url: '/api/chat',
    payload: {
      question: 'a'.repeat(CHAT_BODY_LIMIT_BYTES)
    }
  })

  assert.equal(res.statusCode, 413)
  assert.deepStrictEqual(res.json(), {
    error: {
      code: 'REQUEST_TOO_LARGE',
      message: 'Request body is too large'
    }
  })
})