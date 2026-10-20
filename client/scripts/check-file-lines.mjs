import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 配置
const SOFT_LIMIT = 220
const HARD_LIMIT = 280
const TARGET_DIR = path.resolve(__dirname, '../src/stores/job')
const STORE_ENTRY = path.resolve(__dirname, '../src/stores/useJobStore.js')

// 白名单记录：允许超过限制的文件，必须说明原因
const WHITELIST = {
  // 当前处于遗留状态，需在后续 Phase 拆分
  'useJobStore.js': { max: 2700, reason: '门面装配文件，待进一步拆分重构' },
  'helpers.js': { max: 400, reason: '旧的工具集合，待拆分为纯函数' },
  'apiWrappers.js': { max: 350, reason: '旧的 API 封装，待拆分为 apiGateway' }
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n').length
  const fileName = path.basename(filePath)
  
  const whiteListEntry = WHITELIST[fileName]
  let limit = HARD_LIMIT
  let isWhiteListed = false

  if (whiteListEntry) {
    limit = whiteListEntry.max
    isWhiteListed = true
  }

  if (lines > limit) {
    console.error(`❌ [ERROR] ${fileName} 有 ${lines} 行，超过了硬上限 ${limit} 行。`)
    if (isWhiteListed) {
      console.error(`   原因：已在白名单中，但仍超出了白名单允许的最大值。`)
    } else {
      console.error(`   请将其拆分，或者在 scripts/check-file-lines.mjs 的 WHITELIST 中登记原因。`)
    }
    return false
  }

  if (lines > SOFT_LIMIT && !isWhiteListed) {
    console.warn(`⚠️ [WARN] ${fileName} 有 ${lines} 行，超过了软上限 ${SOFT_LIMIT} 行。建议考虑拆分。`)
  }

  return true
}

function run() {
  let allPass = true

  // 检查入口
  if (!checkFile(STORE_ENTRY)) {
    allPass = false
  }

  // 检查 job 目录
  if (fs.existsSync(TARGET_DIR)) {
    const files = fs.readdirSync(TARGET_DIR)
    for (const file of files) {
      if (file.endsWith('.js')) {
        const fullPath = path.join(TARGET_DIR, file)
        if (!checkFile(fullPath)) {
          allPass = false
        }
      }
    }
  }

  if (!allPass) {
    console.error('\n❌ 行数检查未通过！请处理上述错误。')
    process.exit(1)
  } else {
    console.log('✅ 行数检查通过！')
  }
}

run()