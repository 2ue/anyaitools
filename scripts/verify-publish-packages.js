#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const rootDir = path.resolve(__dirname, '..')
const packagesDir = path.join(rootDir, 'packages')
const npmScope = '@vebing-tools/'
const npmRegistry = 'https://registry.npmjs.org/'
const expectedPublishablePackages = new Map([
  ['packages/cli/package.json', '@vebing-tools/anyaitools'],
  ['packages/aicoding/package.json', '@vebing-tools/aicoding'],
])

const errors = []
const publishablePackages = new Map()

for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue

  const manifestPath = path.join(packagesDir, entry.name, 'package.json')
  if (!fs.existsSync(manifestPath)) continue

  const relativePath = path.relative(rootDir, manifestPath)
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

  if (manifest.private === true) continue

  publishablePackages.set(relativePath, manifest.name)

  if (typeof manifest.name !== 'string' || !manifest.name.startsWith(npmScope)) {
    errors.push(`${relativePath}: publishable package must use the ${npmScope} scope`)
  }

  if (manifest.publishConfig?.access !== 'public') {
    errors.push(`${relativePath}: publishConfig.access must be public`)
  }

  if (manifest.publishConfig?.registry !== npmRegistry) {
    errors.push(`${relativePath}: publishConfig.registry must be ${npmRegistry}`)
  }
}

for (const [relativePath, expectedName] of expectedPublishablePackages) {
  const actualName = publishablePackages.get(relativePath)
  if (actualName !== expectedName) {
    errors.push(
      `${relativePath}: expected publishable package name ${expectedName}, got ${actualName}`
    )
  }
}

for (const [relativePath, packageName] of publishablePackages) {
  if (!expectedPublishablePackages.has(relativePath)) {
    errors.push(`${relativePath}: unexpected publishable package ${packageName}`)
  }
}

if (errors.length > 0) {
  console.error('npm publish package verification failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('npm publish packages:')
for (const [relativePath, packageName] of publishablePackages) {
  console.log(`- ${packageName} (${relativePath})`)
}
