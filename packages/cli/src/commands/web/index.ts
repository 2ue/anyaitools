import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { Command, Option } from 'commander'
import chalk from 'chalk'
import { getAnyAIToolsDir, VERSION } from '@anyaitools/core'
import { startWebServer } from '../../web-server.js'

type WebMode = 'foreground' | 'daemon'

interface WebOptions {
  host: string
  port: string
  mode: WebMode
  token?: string
  pidFile?: string
  logFile?: string
  json?: boolean
}

function defaultPidFile(): string {
  return path.join(getAnyAIToolsDir(), 'web-server.pid')
}

function defaultLogFile(): string {
  return path.join(getAnyAIToolsDir(), 'logs', 'web-server.log')
}

function ensureRuntimeDirs(): void {
  fs.mkdirSync(getAnyAIToolsDir(), { recursive: true })
  fs.mkdirSync(path.join(getAnyAIToolsDir(), 'logs'), { recursive: true })
}

function readPid(pidFile: string): number | undefined {
  try {
    const pid = Number(fs.readFileSync(pidFile, 'utf8').trim())
    return Number.isInteger(pid) && pid > 0 ? pid : undefined
  } catch {
    return undefined
  }
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function clearPidFile(pidFile: string): void {
  try {
    fs.unlinkSync(pidFile)
  } catch {
    // Stale PID files are harmless.
  }
}

function normalizePort(raw: string): number {
  const port = Number(raw)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`端口必须是 1-65535 的整数: ${raw}`)
  }
  return port
}

function foregroundArgs(options: WebOptions): string[] {
  const args = [
    'web',
    'start',
    '--mode',
    'foreground',
    '--host',
    options.host,
    '--port',
    options.port,
  ]
  if (options.token) args.push('--token', options.token)
  if (options.pidFile) args.push('--pid-file', options.pidFile)
  if (options.logFile) args.push('--log-file', options.logFile)
  return args
}

async function runForeground(options: WebOptions): Promise<void> {
  ensureRuntimeDirs()
  const pidFile = options.pidFile || defaultPidFile()
  const logFile = options.logFile || defaultLogFile()
  const existingPid = readPid(pidFile)
  if (existingPid && isProcessRunning(existingPid) && existingPid !== process.pid) {
    throw new Error(`Web 服务已经在运行，PID: ${existingPid}`)
  }

  const log = (message: string) => {
    if (options.mode === 'daemon') {
      fs.appendFileSync(logFile, `${new Date().toISOString()} ${message}\n`)
    } else {
      console.log(message)
    }
  }

  fs.writeFileSync(pidFile, `${process.pid}\n`, { mode: 0o600 })
  let running: Awaited<ReturnType<typeof startWebServer>>
  try {
    running = await startWebServer({
      host: options.host,
      port: normalizePort(options.port),
      token: options.token,
      logger: log,
    })
  } catch (error) {
    clearPidFile(pidFile)
    throw error
  }

  const stop = async (signal: string) => {
    log(`[Web] received ${signal}, stopping`)
    await running.close()
    clearPidFile(pidFile)
    process.exit(0)
  }
  process.once('SIGINT', () => void stop('SIGINT'))
  process.once('SIGTERM', () => void stop('SIGTERM'))

  if (options.mode === 'foreground') {
    console.log(chalk.green(`\nWeb 版已启动: ${running.address}`))
    console.log(chalk.gray(`前台运行中，按 Ctrl+C 停止；配置目录: ${getAnyAIToolsDir()}`))
    if (options.token) console.log(chalk.yellow('已启用 token 认证'))
  }
  await new Promise<void>(() => {})
}

async function startWeb(options: WebOptions): Promise<void> {
  const pidFile = options.pidFile || defaultPidFile()
  const existingPid = readPid(pidFile)
  if (existingPid && isProcessRunning(existingPid)) {
    throw new Error(`Web 服务已经在运行，PID: ${existingPid}`)
  }
  if (options.mode === 'foreground') {
    await runForeground(options)
    return
  }

  if (process.argv[1]?.endsWith('.ts')) {
    throw new Error('守护进程模式需要先构建 CLI：pnpm --filter @vebing-tools/anyaitools build')
  }

  ensureRuntimeDirs()
  const logFile = options.logFile || defaultLogFile()
  const logFd = fs.openSync(logFile, 'a')
  const child = spawn(process.execPath, [process.argv[1], ...foregroundArgs(options)], {
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: { ...process.env, ANYAITOOLS_WEB_DAEMON_CHILD: '1' },
  })
  child.unref()
  fs.closeSync(logFd)
  console.log(chalk.green(`Web 守护进程已启动，PID: ${child.pid}`))
  console.log(chalk.gray(`日志: ${logFile}`))
}

function stopWeb(options: WebOptions): void {
  const pidFile = options.pidFile || defaultPidFile()
  const pid = readPid(pidFile)
  if (!pid || !isProcessRunning(pid)) {
    clearPidFile(pidFile)
    console.log('Web 服务未运行')
    return
  }
  process.kill(pid, 'SIGTERM')
  clearPidFile(pidFile)
  console.log(`Web 服务已停止，PID: ${pid}`)
}

async function statusWeb(options: WebOptions): Promise<void> {
  const pidFile = options.pidFile || defaultPidFile()
  const pid = readPid(pidFile)
  const running = Boolean(pid && isProcessRunning(pid))
  const result = {
    running,
    pid: running ? pid : null,
    version: VERSION,
    pidFile,
    url: running ? `http://${options.host}:${options.port}` : null,
  }
  if (options.json) {
    console.log(JSON.stringify(result))
    return
  }
  console.log(running ? chalk.green(`Web 服务运行中 (PID ${pid})`) : chalk.gray('Web 服务未运行'))
  console.log(chalk.gray(`PID 文件: ${pidFile}`))
  if (running) console.log(chalk.gray(`地址: ${result.url}`))
}

function addOptions(command: Command): Command {
  return command
    .option('--host <host>', '绑定地址（默认 127.0.0.1）', '127.0.0.1')
    .option('--port <port>', '监听端口（默认 3000）', '3000')
    .addOption(
      new Option('--mode <mode>', '启动模式')
        .choices(['foreground', 'daemon'])
        .default('foreground')
    )
    .option('--token <token>', '非本机绑定时的访问 token')
    .option('--pid-file <path>', '自定义 PID 文件路径')
    .option('--log-file <path>', '自定义守护进程日志路径')
}

export function createWebCommand(): Command {
  const web = new Command('web').description('启动和管理 AnyAI Tools Web 版')
  const start = addOptions(web.command('start').description('启动 Web 服务'))
  start.action((options: WebOptions) => startWeb(options))

  const restart = addOptions(web.command('restart').description('重启 Web 服务'))
  restart.action(async (options: WebOptions) => {
    stopWeb(options)
    await startWeb(options)
  })

  const stop = web
    .command('stop')
    .description('停止 Web 服务')
    .option('--pid-file <path>', '自定义 PID 文件路径')
  stop.action((options: WebOptions) => stopWeb(options))

  const status = web
    .command('status')
    .description('查看 Web 服务状态')
    .option('--host <host>', '服务地址', '127.0.0.1')
    .option('--port <port>', '服务端口', '3000')
    .option('--pid-file <path>', '自定义 PID 文件路径')
    .option('--json', '输出 JSON')
  status.action((options: WebOptions) => statusWeb(options))

  web.action(() => web.help())
  return web
}
