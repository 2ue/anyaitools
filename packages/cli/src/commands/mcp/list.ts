import { Command } from 'commander'
import chalk from 'chalk'
import { createMCPManager } from '@anyaitools/core'

export function listCommand(program: Command): void {
  program
    .command('list')
    .alias('ls')
    .description('列出所有 MCP 服务器')
    .action(async () => {
      try {
        const manager = createMCPManager()
        const providers = manager.list()

        if (providers.length === 0) {
          console.log(chalk.yellow('\n⚠️  暂无 MCP 服务器\n'))
          console.log(chalk.blue('💡 添加 MCP 服务器:') + chalk.white(' aat mcp add\n'))
          return
        }

        console.log(chalk.bold(`\n📋 MCP 服务器 (${providers.length} 个)\n`))

        // MCP 当前没有“激活”概念,所有配置的服务器都会被加载
        providers.forEach((provider) => {
          const isActive = false // MCP 没有 "当前激活" 的概念，所有配置的 MCP 都会加载

          const indicator = isActive ? chalk.green('●') : chalk.gray('○')
          const nameDisplay = chalk.bold(provider.name)
          const commandDisplay = chalk.gray(`${provider.baseUrl} ${provider.apiKey}`)

          console.log(`  ${indicator} ${nameDisplay}`)
          console.log(`    ${commandDisplay}`)

          // 如果有 env，显示环境变量
          if (provider.model) {
            try {
              const env = JSON.parse(provider.model)
              const envKeys = Object.keys(env)
              if (envKeys.length > 0) {
                console.log(chalk.gray(`    环境变量: ${envKeys.join(', ')}`))
              }
            } catch {
              // 忽略 JSON 解析错误
            }
          }

          console.log()
        })

        console.log(chalk.gray('提示: 所有配置的 MCP 服务器会自动同步到 ~/.claude.json'))
        console.log()
      } catch (error) {
        console.error(chalk.red(`\n❌ ${(error as Error).message}\n`))
        process.exit(1)
      }
    })
}
