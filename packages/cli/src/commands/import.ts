import { Command } from 'commander'
import chalk from 'chalk'
import inquirer from 'inquirer'
import path from 'path'
import { importConfig, validateImportSource } from '@anyaitools/core'
import { promptConfirm } from '../utils/confirm.js'

interface ImportOptions {
  password?: string
}

async function resolveImportPassword(options: ImportOptions): Promise<string> {
  if (options.password?.trim()) {
    return options.password.trim()
  }

  const { password } = await inquirer.prompt<{ password: string }>([
    {
      type: 'password',
      name: 'password',
      message: '输入备份密码',
      mask: '*',
      validate: (value: string) => (value.trim() ? true : '请输入备份密码'),
    },
  ])

  return password.trim()
}

export function importCommand(program: Command): void {
  program
    .command('import <备份文件或源目录>')
    .description('从加密备份文件导入配置（兼容旧目录）')
    .option('--password <password>', '备份密码（不推荐在共享终端历史中使用）')
    .action(async (sourceDir: string, options: ImportOptions) => {
      try {
        // 解析源路径（支持相对路径和 ~ 符号）
        const resolvedPath = sourceDir.startsWith('~')
          ? path.join(process.env.HOME || '', sourceDir.slice(1))
          : path.resolve(sourceDir)

        // 验证导入源
        console.log(chalk.bold('\n📥 导入配置\n'))
        let validation = validateImportSource(resolvedPath)
        let password: string | undefined

        if (!validation.valid) {
          console.log(chalk.red(`❌ ${validation.message}\n`))
          process.exit(1)
        }

        if (validation.requiresPassword) {
          password = await resolveImportPassword(options)
          validation = validateImportSource(resolvedPath, password)

          if (!validation.valid) {
            console.log(chalk.red(`❌ ${validation.message}\n`))
            process.exit(1)
          }
        }

        // 显示警告信息
        console.log(chalk.yellow('⚠️  警告：导入将覆盖当前配置\n'))
        console.log(`导入源: ${chalk.cyan(resolvedPath)}`)
        console.log()
        console.log('找到配置文件:')
        for (const file of validation.foundFiles) {
          console.log(`  ${chalk.cyan('✓')} ${file}`)
        }
        console.log()
        if (validation.legacy) {
          console.log(chalk.yellow('检测到旧版未加密目录格式'))
          console.log()
        }
        console.log(chalk.gray('未找到的受支持文件将自动跳过，不会中断导入'))
        console.log()
        console.log(chalk.gray('备份中包含的当前配置将被覆盖（自动备份）'))
        console.log()

        // 第一次确认
        const confirmFirst = await promptConfirm('确认导入？', false)

        if (!confirmFirst) {
          console.log(chalk.gray('\n❌ 已取消\n'))
          return
        }

        // 第二次确认（强调警告）
        console.log()
        console.log(chalk.red.bold('⚠️  最后确认：此操作将覆盖所有当前配置！'))
        console.log()

        const confirmSecond = await promptConfirm('真的要继续吗？', false)

        if (!confirmSecond) {
          console.log(chalk.gray('\n❌ 已取消\n'))
          return
        }

        // 执行导入
        console.log()
        console.log(chalk.gray('💾 备份当前配置...'))
        console.log(chalk.gray('📥 导入新配置...'))

        const result = importConfig(resolvedPath, password)

        // 显示结果
        console.log()
        console.log(chalk.green('✅ 导入成功'))
        console.log()

        if (result.backupPaths.length > 0) {
          console.log('备份文件:')
          for (const backupPath of result.backupPaths) {
            console.log(`  ${chalk.gray(backupPath)}`)
          }
          console.log()
        }

        console.log('已导入文件:')
        for (const file of result.importedFiles) {
          console.log(`  ${chalk.cyan('✓')} ${file}`)
        }
        console.log()
        console.log(chalk.blue("💡 请使用 'aat cx use' 或 'aat cc use' 切换服务商\n"))
      } catch (error) {
        console.error(chalk.red(`\n❌ ${(error as Error).message}\n`))
        process.exit(1)
      }
    })
}
