#!/usr/bin/env node

/**
 * 独立的 v2 到 v3 配置迁移脚本
 * 不依赖 core 包，直接实现迁移逻辑
 */

import fs from 'fs'
import path from 'path'
import os from 'os'

const anyaitoolsDir = path.join(os.homedir(), '.anyaitools')
const v2ConfigPath = path.join(anyaitoolsDir, 'config.json')
const v2ProvidersDir = path.join(anyaitoolsDir, 'providers')
const v3ConfigPath = path.join(anyaitoolsDir, 'claude.json')

/**
 * 生成唯一的 provider ID
 */
function generateProviderId(timestamp) {
  const random = Math.random().toString(36).substring(2, 8)
  return `claude-${timestamp}-${random}`
}

/**
 * 将 ISO 时间字符串转换为 Unix timestamp
 */
function parseTimestamp(isoString) {
  return new Date(isoString).getTime()
}

/**
 * 执行迁移
 */
function migrate() {
  console.log('🚀 开始执行 v2 -> v3 配置迁移\n')
  console.log('='.repeat(60))
  console.log()

  // 检查是否需要迁移
  if (!fs.existsSync(v2ConfigPath)) {
    console.log('✅ 未找到旧版配置文件，无需迁移')
    return
  }

  if (!fs.existsSync(v2ProvidersDir)) {
    console.error('❌ 未找到 providers 目录，配置文件可能已损坏')
    process.exit(1)
  }

  // 检查是否已经迁移过
  if (fs.existsSync(v3ConfigPath)) {
    console.log('✅ 新版配置文件已存在，无需迁移')
    console.log(`   文件位置: ${v3ConfigPath}`)
    return
  }

  try {
    // 读取 v2 配置索引
    const v2ConfigContent = fs.readFileSync(v2ConfigPath, 'utf-8')
    const v2Config = JSON.parse(v2ConfigContent)

    console.log(`📖 读取到 ${Object.keys(v2Config.providers).length} 个服务商配置\n`)

    // 转换所有 providers
    const migratedProviders = []
    const skippedFiles = []
    let currentProviderId = undefined

    for (const [providerKey, providerMeta] of Object.entries(v2Config.providers)) {
      const providerFilePath = path.join(v2ProvidersDir, providerMeta.configFile)

      // 检查 provider 文件是否存在
      if (!fs.existsSync(providerFilePath)) {
        console.warn(`⚠️  跳过不存在的文件: ${providerMeta.configFile}`)
        skippedFiles.push(providerMeta.configFile)
        continue
      }

      // 读取 provider 详细配置
      const providerDetailContent = fs.readFileSync(providerFilePath, 'utf-8')
      const providerDetail = JSON.parse(providerDetailContent)

      // 提取关键字段
      const baseUrl = providerDetail.config.env.ANTHROPIC_BASE_URL
      const apiKey = providerDetail.config.env.ANTHROPIC_AUTH_TOKEN

      // 验证必需字段
      if (!baseUrl || !apiKey) {
        console.warn(`⚠️  跳过缺少必需字段的配置: ${providerMeta.configFile}`)
        skippedFiles.push(providerMeta.configFile)
        continue
      }

      // 生成新的 provider ID
      const createdAt = providerDetail.metadata?.createdAt
        ? parseTimestamp(providerDetail.metadata.createdAt)
        : Date.now()

      const providerId = generateProviderId(createdAt)

      // 转换 lastUsedAt
      const lastUsedAt = providerMeta.lastUsed ? parseTimestamp(providerMeta.lastUsed) : undefined

      // 创建新的 provider 对象
      const newProvider = {
        id: providerId,
        name: providerDetail.name,
        baseUrl,
        apiKey,
        createdAt,
        lastUsedAt,
      }

      migratedProviders.push(newProvider)

      // 如果是当前激活的 provider，记录其 ID
      if (v2Config.currentProvider === providerKey) {
        currentProviderId = providerId
      }

      console.log(`✅ 迁移成功: ${providerDetail.name}`)
    }

    // 按最后使用时间排序（没有 lastUsedAt 的排在最后）
    migratedProviders.sort((a, b) => {
      if (!a.lastUsedAt && !b.lastUsedAt) return 0
      if (!a.lastUsedAt) return 1
      if (!b.lastUsedAt) return -1
      return b.lastUsedAt - a.lastUsedAt
    })

    // 创建新的 v3 配置
    const v3Config = {
      currentProviderId,
      providers: migratedProviders,
      presets: [],
    }

    // 写入新配置文件
    fs.writeFileSync(v3ConfigPath, JSON.stringify(v3Config, null, 2), { mode: 0o600 })

    console.log(`\n✨ 迁移完成！已生成新配置文件: ${v3ConfigPath}`)
    console.log(`📊 成功迁移 ${migratedProviders.length} 个服务商`)

    if (currentProviderId) {
      const currentProvider = migratedProviders.find((p) => p.id === currentProviderId)
      console.log(`🎯 当前激活: ${currentProvider?.name}`)
    }

    if (skippedFiles.length > 0) {
      console.log(`⚠️  跳过 ${skippedFiles.length} 个文件: ${skippedFiles.join(', ')}`)
    }

    // 验证迁移结果
    console.log('\n\n🔍 验证迁移结果...\n')
    validateMigration(v3Config)

    console.log('\n' + '='.repeat(60))
    console.log('\n✨ 迁移完成！')
    console.log('\n📁 新配置文件位置: ~/.anyaitools/claude.json')
    console.log('📁 旧配置文件保留: ~/.anyaitools/config.json 和 ~/.anyaitools/providers/')
    console.log('\n💡 下一步:')
    console.log('   1. 使用新版 CLI 命令测试: aat cc list')
    console.log('   2. 确认无误后，可以手动删除旧配置（可选）\n')
  } catch (error) {
    console.error(`\n❌ 迁移失败: ${error.message}`)
    console.error(error.stack)
    process.exit(1)
  }
}

/**
 * 验证新配置
 */
function validateMigration(v3Config) {
  const errors = []

  // 验证必需字段
  if (!Array.isArray(v3Config.providers)) {
    errors.push('providers 必须是数组')
  }

  // 验证每个 provider
  if (Array.isArray(v3Config.providers)) {
    for (const [index, provider] of v3Config.providers.entries()) {
      const requiredFields = ['id', 'name', 'baseUrl', 'apiKey', 'createdAt']
      for (const field of requiredFields) {
        if (!provider[field]) {
          errors.push(`providers[${index}].${field} 缺失`)
        }
      }
    }
  }

  // 验证 currentProviderId
  if (v3Config.currentProviderId) {
    const currentExists = v3Config.providers.some((p) => p.id === v3Config.currentProviderId)
    if (!currentExists) {
      errors.push(`currentProviderId (${v3Config.currentProviderId}) 不存在于 providers 中`)
    }
  }

  if (errors.length > 0) {
    console.error('❌ 验证失败:\n')
    errors.forEach((err) => console.error(`   ${err}`))
    process.exit(1)
  }

  console.log('✅ 所有验证通过')
  console.log(`   服务商数量: ${v3Config.providers.length}`)
  if (v3Config.currentProviderId) {
    const current = v3Config.providers.find((p) => p.id === v3Config.currentProviderId)
    console.log(`   当前激活: ${current?.name}`)
  }
}

// 执行迁移
migrate()
