import http from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const DIST = join(__dirname, 'dist')
const PORT = Number(process.env.PORT || 80)
const API_TARGET = process.env.API_TARGET || 'http://backend:8000'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
}

function sendFile(res, filePath) {
  const ext = extname(filePath)
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
  createReadStream(filePath).pipe(res)
}

async function proxy(req, res) {
  const target = new URL(req.url, API_TARGET)
  const headers = { ...req.headers, host: target.host }
  delete headers['content-length']

  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const body = Buffer.concat(chunks)

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
  })

  const outHeaders = {}
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'transfer-encoding') return
    outHeaders[key] = value
  })
  res.writeHead(upstream.status, outHeaders)
  const buf = Buffer.from(await upstream.arrayBuffer())
  res.end(buf)
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/') || req.url.startsWith('/docs') || req.url === '/openapi.json') {
      await proxy(req, res)
      return
    }

    const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
    let filePath = normalize(join(DIST, urlPath === '/' ? '/index.html' : urlPath))
    if (!filePath.startsWith(DIST)) {
      res.writeHead(403).end('Forbidden')
      return
    }

    if (existsSync(filePath) && statSync(filePath).isFile()) {
      sendFile(res, filePath)
      return
    }

    // SPA fallback
    sendFile(res, join(DIST, 'index.html'))
  } catch (err) {
    console.error(err)
    res.writeHead(502, { 'Content-Type': 'text/plain' })
    res.end(`Upstream error: ${err.message}`)
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Frontend listening on :${PORT} (API -> ${API_TARGET})`)
})
