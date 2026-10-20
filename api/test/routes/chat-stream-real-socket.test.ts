import { test } from 'node:test'
import * as assert from 'node:assert'
import Fastify, { type FastifyInstance } from 'fastify'
import type Groq from 'groq-sdk'
// Importar los plugins (aunque no se registren aquí) es lo que carga sus declaraciones de
// tipo sobre FastifyInstance; sin esto la ruta no compila.
import '../../src/plugins/db'
import '../../src/plugins/groq'
import api from '../../src/routes/api/index'

type SSEFrame = { event: string; data: unknown }

function parseSSE (payload: string): SSEFrame[] {
  const frames: SSEFrame[] = []
  let current: { event?: string; data?: string } = {}

  for (const line of payload.split('\n')) {
    if (line === '') {
      if (current.event !== undefined && current.data !== undefined) {
        frames.push({ event: current.event, data: JSON.parse(current.data) })
      }
      current = {}
      continue
    }
    if (line.startsWith('event:')) current.event = line.slice(6).trim()
    else if (line.startsWith('data:')) current.data = line.slice(5).trim()
  }

  return frames
}

// Un cliente Groq que emite tokens con una pausa entre ellos.
//
// El stub honra la señal de aborto porque es lo que hace el SDK real: al abortar, su stream
// lanza y el `for await` de la ruta cae en el `catch`. Un doble que ignorase `signal`
// devolvería la respuesta entera aunque el abort espurio se hubiera disparado, y el test
// pasaría con el bug presente sin detectar nada (#93).
//
// La pausa importa por lo mismo: el `close` espurio del request llega a los ~110 ms, así que
// un stream que dure menos termina antes de que el abort le alcance y el test verde por
// casualidad. Aquí el stream dura medio segundo de sobra.
function slowStub (tokens: string[], delayMs = 100) {
  // Lleva la cuenta de lo generado y guarda la señal que recibe, que es lo que el SDK real
  // usa para cortar la petición al proveedor.
  const generated: string[] = []
  let modelSignal: AbortSignal | undefined

  const client = {
    chat: {
      completions: {
        create: async function* (_body: unknown, init?: { signal?: AbortSignal }) {
          modelSignal = init?.signal
          for (const token of tokens) {
            await new Promise(resolve => setTimeout(resolve, delayMs))
            if (init?.signal?.aborted) {
              throw Object.assign(new Error('The operation was aborted'), {
                name: 'AbortError'
              })
            }
            generated.push(token)
            yield { choices: [{ delta: { content: token } }] }
          }
        }
      }
    }
  } as unknown as Groq

  return { client, generated, signal: () => modelSignal }
}

// `pg` está decorado con el Pool de `@fastify/postgres`, así que el stub se conforma a esa
// forma: no solo devuelve `rows` (que es lo único que lee la búsqueda) sino el resto del
// contrato, para que el typecheck no exija casts por todos lados.
const fakeQuery = (async () => ({
  rows: [
    {
      document_id: '1',
      chunk_index: 0,
      content: 'Jorge es desarrollador full stack.',
      distance: 0.2
    }
  ],
  rowCount: 1,
  command: 'SELECT',
  oid: 0,
  fields: []
})) as unknown as FastifyInstance['pg']['query']

// Levanta la ruta sobre un puerto real. `inject()` no sirve aquí: no pasa por el socket, y
// el bug vive exactamente en cómo el socket cierra el request mientras la respuesta sigue
// abierta (#93). Toda la suite de rutas usa `inject` y por eso no lo veía.
async function serve (t: any, tokens: string[] = ['Hola', ' ', 'mundo']) {
  const app = Fastify({ logger: false })
  const { client, signal } = slowStub(tokens)

  // `pg` está decorado con el PostgresDb completo de `@fastify/postgres` (pool, Client,
  // transact…). La ruta solo usa `query`, así que el stub se reduce a eso y el resto se
  // declara ausente a propósito: si algún día alguien empieza a usar `fastify.pg.pool`, el
  // typecheck debe caer en el test y no fingir que el doble funciona.
  app.decorate('pg', { query: fakeQuery } as unknown as FastifyInstance['pg'])
  app.decorate('groq', {
    client,
    options: { modelDefault: 'stub', apiKey: 'stub' }
  })
  // El prefijo `/api` lo aporta autoload al cargar `routes/`; aquí hay que ponerlo a mano.
  await app.register(api, { prefix: '/api' })

  await app.listen({ port: 0, host: '127.0.0.1' })
  t.after(() => void app.close())

  const { port } = app.server.address() as { port: number }
  return { url: `http://127.0.0.1:${port}`, signal }
}

test('chat stream completes over a real socket instead of stopping after sources', async (t) => {
  const { url } = await serve(t)

  const res = await fetch(`${url}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: '¿Qué hace Jorge?' })
  })

  assert.equal(res.status, 200)
  assert.equal(res.headers.get('content-type'), 'text/event-stream')

  const frames = parseSSE(await res.text())
  const events = frames.map(frame => frame.event)

  assert.deepStrictEqual(events, [
    'sources',
    'token',
    'token',
    'token',
    'done'
  ])

  const answer = frames
    .filter(frame => frame.event === 'token')
    .map(frame => (frame.data as { token: string }).token)
    .join('')
  assert.equal(answer, 'Hola mundo')
})

test('chat stream aborts the model request when the client goes away', async (t) => {
  // Quitar la cancelación por descuido parece inofensivo: cuando el cliente se va, el
  // stream de Node se corta igual. Lo que se pierde es el otro efecto — que la petición al
  // proveedor se cancele—, y eso es lo que este test afirma: la señal que llega al modelo
  // queda abortada, de modo que no se sigue generando (y cobrando) hacia un cliente que ya
  // no está.
  //
  // Se afirma sobre la señal, no sobre lo que recibe el cliente, porque eso es lo único que
  // distingue este caso de "no hay cancelación": un stream abandonado tampoco entrega `done`.
  const { url, signal } = await serve(t, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])

  const controller = new AbortController()
  const res = await fetch(`${url}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: '¿Qué hace Jorge?' }),
    signal: controller.signal
  })

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()

  for (;;) {
    let chunk: Awaited<ReturnType<typeof reader.read>>
    try {
      chunk = await reader.read()
    } catch {
      // El propio abort del cliente corta la lectura. Es el camino normal de este test.
      break
    }
    if (chunk.done) break
    if (decoder.decode(chunk.value, { stream: true }).includes('event: token')) {
      controller.abort()
    }
  }

  // El cierre del socket es asíncrono: hay que dar margen antes de mirar la señal.
  await new Promise(resolve => setTimeout(resolve, 200))

  const modelSignal = signal()
  assert.ok(modelSignal, 'el modelo debería recibir una señal de cancelación')
  assert.equal(
    modelSignal.aborted,
    true,
    'al irse el cliente, la petición al modelo debería quedar abortada'
  )
})