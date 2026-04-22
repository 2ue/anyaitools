#!/usr/bin/env node

/**
 * 执行 v2 到 v3 的配置迁移
 *
 * 此脚本会：
 * 1. 调用实际的迁移函数
 * 2. 生成新的 claude.json 配置文件
 * 3. 保留旧配置（不删除）
 */

import { migrateV2ToV3, validateMigration } from '../packages/core/dist/index.js'

console.log('🚀 开始执行 v2 -> v3 配置迁移\n')
console.log('=' .repeat(60))
console.log()

// 执行迁移
console.log('📦 正在迁移配置...\n')
const migrateResult = migrateV2ToV3()

console.log('\n' + '='.repeat(60))
console.log()

if (!migrateResult.success) {
  console.error('❌ 迁移失败:', migrateResult.message)
  process.exit(1)
}

console.log('✅', migrateResult.message)

if (migrateResult.details) {
  console.log('\n📊 迁移详情:')
  console.log(`   成功迁移: ${migrateResult.details.migratedProviders} 个服务商`)
  if (migrateResult.details.currentProvider) {
    console.log(`   当前激活: ${migrateResult.details.currentProvider}`)
  }
  if (migrateResult.details.skippedFiles) {
    console.log(`   ⚠️  跳过文件: ${migrateResult.details.skippedFiles.join(', ')}`)
  }
}

// 验证迁移结果
console.log('\n\n🔍 验证迁移结果...\n')
const validateResult = validateMigration()

if (!validateResult.success) {
  console.error('❌ 验证失败:', validateResult.message)
  if (validateResult.details?.missingFields) {
    console.log('\n缺少字段:')
    validateResult.details.missingFields.forEach((field) => {
      console.log(`   - ${field}`)
    })
  }
  process.exit(1)
}

console.log('✅', validateResult.message)

if (validateResult.details) {
  console.log(`   服务商数量: ${validateResult.details.providersCount}`)
  if (validateResult.details.currentProvider) {
    console.log(`   当前激活: ${validateResult.details.currentProvider}`)
  }
}

console.log('\n' + '='.repeat(60))
console.log('\n✨ 迁移完成！')
console.log('\n📁 新配置文件位置: ~/.anyaitools/claude.json')
console.log('📁 旧配置文件保留: ~/.anyaitools/config.json 和 ~/.anyaitools/providers/')
console.log('\n💡 下一步:')
console.log('   1. 使用新版 CLI 命令测试: aat cc list')
console.log('   2. 确认无误后，可以手动删除旧配置（可选）\n')
