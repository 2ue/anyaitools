import chalk from 'chalk'
import { VERSION } from '@anyaitools/core'

export function printLogo(): void {
  console.log(chalk.bold('\n  anyaitools\n'))
  console.log(chalk.gray('  Any AI Tools 工作流配置与集成工具'))
  console.log(chalk.gray(`  版本 ${VERSION}\n`))
}
