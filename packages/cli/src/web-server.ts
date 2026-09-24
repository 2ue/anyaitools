import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dispatchWebMethod, getWebInfo } from './web-api.js'

export interface WebServerOptions {
  host: string
  port: number
  token?: string
  staticDir?: string
  logger?: (message: string) => void
}

export interface RunningWebServer {
  server: http.Server
  address: string
  close: () => Promise<void>
}

const require = createRequire(import.meta.url)
const MAX_BODY_BYTES = 10 * 1024 * 1024

function isLoopback(host: string): boolean {
  return host === '127.0.0.1' || host === 'localhost' || host === '::1'
}

function getStaticDir(explicit?: string): string {
  if (explicit) return path.resolve(explicit)
  if (process.env.ANYAITOOLS_WEB_DIST) return path.resolve(process.env.ANYAITOOLS_WEB_DIST)

  const currentDir = path.dirname(fileURLToPath(import.meta.url))
  const bundledWebDir = path.join(currentDir, 'web')
  if (fs.existsSync(path.join(bundledWebDir, 'index.html'))) {
    return bundledWebDir
  }

  try {
    const packagePath = require.resolve('@vebing-tools/anyaitools-web/package.json')
    return path.join(path.dirname(packagePath), 'dist')
  } catch {
    return path.resolve(currentDir, '../../web/dist')
  }
}

function contentType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase()
  return (
    {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
    }[extension] || 'application/octet-stream'
  )
}

function sendJson(response: http.ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  })
  response.end(body)
}

function getToken(request: http.IncomingMessage): string | undefined {
  const authorization = request.headers.authorization
  if (authorization?.startsWith('Bearer ')) return authorization.slice('Bearer '.length).trim()
  const header = request.headers['x-anyai-tools-token']
  return typeof header === 'string' ? header : undefined
}

function parseJsonBody(request: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('请求体过大'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch {
        reject(new Error('请求体必须是合法 JSON'))
      }
    })
    request.on('error', reject)
  })
}

function safeStaticPath(staticDir: string, pathname: string): string | null {
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
  const candidate = path.resolve(staticDir, relative)
  return candidate === staticDir || candidate.startsWith(`${staticDir}${path.sep}`)
    ? candidate
    : null
}

async function serveStatic(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  staticDir: string
): Promise<void> {
  const pathname = new URL(request.url || '/', 'http://localhost').pathname
  let filePath = safeStaticPath(staticDir, pathname)
  if (!filePath) {
    sendJson(response, 400, { error: '非法资源路径' })
    return
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(staticDir, 'index.html')
  }
  if (!fs.existsSync(filePath)) {
    sendJson(response, 503, { error: `Web 静态资源不存在: ${staticDir}` })
    return
  }

  response.writeHead(200, {
    'content-type': contentType(filePath),
    'cache-control': pathname === '/' ? 'no-store' : 'public, max-age=31536000, immutable',
  })
  if (request.method === 'HEAD') {
    response.end()
    return
  }
  response.end(fs.readFileSync(filePath))
}

export async function startWebServer(options: WebServerOptions): Promise<RunningWebServer> {
  if (!isLoopback(options.host) && !options.token?.trim()) {
    throw new Error('Web 服务绑定非本机地址时必须提供 --token')
  }

  const staticDir = getStaticDir(options.staticDir)
  const log = options.logger || ((message) => console.log(message))
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', `http://${options.host}`)
      const isApi = url.pathname.startsWith('/api/v1/')
      if (isApi && options.token && getToken(request) !== options.token) {
        sendJson(response, 401, { error: '缺少或无效的 Web token' })
        return
      }

      if (url.pathname === '/api/v1/health' && request.method === 'GET') {
        sendJson(response, 200, {
          ok: true,
          ...getWebInfo(),
          host: options.host,
          port: options.port,
          time: new Date().toISOString(),
        })
        return
      }

      if (url.pathname === '/api/v1/rpc' && request.method === 'POST') {
        const body = await parseJsonBody(request)
        if (typeof body.method !== 'string' || !Array.isArray(body.args)) {
          sendJson(response, 400, { ok: false, error: 'RPC 请求需要 method 和 args' })
          return
        }
        const result = await dispatchWebMethod(body.method, body.args)
        sendJson(response, 200, { ok: true, result })
        return
      }

      if (isApi) {
        sendJson(response, 404, { ok: false, error: '未知 Web API 路径' })
        return
      }

      if (request.method !== 'GET' && request.method !== 'HEAD') {
        sendJson(response, 405, { error: '只支持 GET/HEAD' })
        return
      }
      await serveStatic(request, response, staticDir)
    } catch (error) {
      log(`[Web] request failed: ${(error as Error).message}`)
      if (!response.headersSent) {
        sendJson(response, 500, { ok: false, error: (error as Error).message })
      } else {
        response.destroy()
      }
    }
  })

  await new Promise<void>((resolve, reject) => {
    const onError = (error: NodeJS.ErrnoException) => {
      server.removeListener('listening', onListening)
      reject(error)
    }
    const onListening = () => {
      server.removeListener('error', onError)
      resolve()
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(options.port, options.host)
  })

  const address = `http://${isLoopback(options.host) ? options.host : options.host}:${options.port}`
  log(`[Web] listening at ${address}`)
  log(`[Web] static directory: ${staticDir}`)
  return {
    server,
    address,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      }),
  }
}

export { getStaticDir, isLoopback }
