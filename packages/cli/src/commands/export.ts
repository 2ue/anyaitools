import { Command } from 'commander'
import chalk from 'chalk'
import inquirer from 'inquirer'
import path from 'path'
import { exportConfig, validateExport } from '@anyaitools/core'

interface ExportOptions {
  password?: string
}

async function resolveExportPassword(options: ExportOptions): Promise<string> {
  if (options.password?.trim()) {
    return options.password.trim()
  }

  const answers = await inquirer.prompt<{
    password: string
    confirmPassword: string
  }>([
    {
      type: 'password',
      name: 'password',
      message: '设置导出密码',
      mask: '*',
      validate: (value: string) => (value.trim() ? true : '请输入导出密码'),
    },
    {
      type: 'password',
      name: 'confirmPassword',
      message: '再次输入导出密码',
      mask: '*',
      validate: (value: string, answers?: { password?: string }) =>
        value.trim() === answers?.password?.trim() ? true : '两次输入的密码不一致',
    },
  ])

  return answers.password.trim()
}

export function exportCommand(program: Command): void {
  program
    .command('export <目标目录>')
    .description('导出加密备份到本地文件')
    .option('--password <password>', '导出密码（不推荐在共享终端历史中使用）')
    .action(async (targetDir: string, options: ExportOptions) => {
      try {
        // 验证源文件
        console.log(chalk.bold('\n📦 导出加密备份\n'))
        const validation = validateExport()

        if (!validation.valid) {
          console.log(chalk.red(`❌ ${validation.message}\n`))
          process.exit(1)
        }

        // 解析目标路径（支持相对路径和 ~ 符号）
        const resolvedPath = targetDir.startsWith('~')
          ? path.join(process.env.HOME || '', targetDir.slice(1))
          : path.resolve(targetDir)

        // 显示信息
        console.log('将导出的配置文件:')
        for (const file of validation.foundFiles || []) {
          console.log(`  ${chalk.cyan('✓')} ${file}`)
        }
        console.log()
        console.log(`目标目录: ${chalk.cyan(resolvedPath)}`)
        console.log()
        console.log(chalk.yellow('⚠️  备份内容将整体加密，忘记密码将无法恢复'))
        console.log()

        const password = await resolveExportPassword(options)

        // 执行导出
        const result = exportConfig(resolvedPath, password)

        // 显示结果
        console.log(chalk.green('✅ 导出成功'))
        console.log()
        console.log(`备份文件: ${chalk.cyan(result.backupPath)}`)
        console.log()
        console.log('已导出文件:')
        for (const file of result.exportedFiles) {
          console.log(`  ${chalk.cyan('✓')} ${file}`)
        }
        console.log()
        console.log(chalk.blue(`💡 导入命令: aat import ${result.backupPath}\n`))
      } catch (error) {
        console.error(chalk.red(`\n❌ ${(error as Error).message}\n`))
        process.exit(1)
      }
    })
}
