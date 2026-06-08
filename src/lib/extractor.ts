import fs from 'fs'
import path from 'path'

/**
 * Node.js 版 unmpkg — 解析 Wallpaper Engine 的 .mpkg 文件
 *
 * MPKG 文件结构：
 *   [Header]
 *     uint32 version_length      // 版本字符串长度
 *     char[8] version            // 版本标识，如 "PKGM0014"
 *     uint32 file_total          // 文件数量
 *   [Entries] (file_total 个)
 *     uint32 file_name_length    // 文件名长度
 *     char[file_name_length]     // 文件名
 *     uint32 index               // 索引（未知用途）
 *     uint32 file_size           // 文件大小
 *   [File Data] (file_total 个)
 *     byte[file_size]            // 文件内容
 */

export interface MpkgEntry {
  name: string
  index: number
  size: number
}

export interface MpkgInfo {
  version: string
  fileCount: number
  entries: MpkgEntry[]
}

export interface ExtractResult {
  outputDir: string
  files: ExtractedFile[]
}

export interface ExtractedFile {
  name: string
  path: string
  ext: string
  type: 'video' | 'image' | 'config' | 'source' | 'other'
  size: number
}

function readUint32(buffer: Buffer, offset: number): number {
  return buffer.readUInt32LE(offset)
}

function readString(buffer: Buffer, offset: number, length: number): string {
  return buffer.toString('utf8', offset, offset + length)
}

export function parseMpkg(filePath: string): MpkgInfo {
  const buffer = fs.readFileSync(filePath)
  let offset = 0

  offset += 4 // skip version_length

  const version = readString(buffer, offset, 8)
  offset += 8

  const fileCount = readUint32(buffer, offset)
  offset += 4

  const entries: MpkgEntry[] = []

  for (let i = 0; i < fileCount; i++) {
    const nameLength = readUint32(buffer, offset)
    offset += 4

    const name = readString(buffer, offset, nameLength)
    offset += nameLength

    void readUint32(buffer, offset) // index field, skip
    offset += 4

    const size = readUint32(buffer, offset)
    offset += 4

    entries.push({ name, index: 0, size })
  }

  return { version, fileCount, entries }
}

export function extractMpkg(filePath: string, outputDir: string): ExtractResult {
  const buffer = fs.readFileSync(filePath)
  let offset = 0

  // Skip header
  offset += 4 // version_length
  offset += 8 // version
  const fileCount = readUint32(buffer, offset)
  offset += 4

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // 第一步：读取所有 entry（不读文件数据）
  const entries: { name: string; size: number }[] = []
  for (let i = 0; i < fileCount; i++) {
    const nameLength = readUint32(buffer, offset)
    offset += 4

    const name = readString(buffer, offset, nameLength)
    offset += nameLength

    offset += 4 // 跳过 index 字段

    const size = readUint32(buffer, offset)
    offset += 4

    entries.push({ name, size })
  }

  // 第二步：读取所有文件数据
  const resultFiles: ExtractedFile[] = []
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const fileData = buffer.slice(offset, offset + entry.size)
    offset += entry.size

    // 写入文件（保留目录结构）
    const outputPath = path.join(outputDir, entry.name)
    const outputSubDir = path.dirname(outputPath)
    if (!fs.existsSync(outputSubDir)) {
      fs.mkdirSync(outputSubDir, { recursive: true })
    }
    fs.writeFileSync(outputPath, fileData)

    // 分类
    const ext = path.extname(entry.name).toLowerCase()
    let type: ExtractedFile['type'] = 'other'
    if (['.mp4', '.webm', '.mov', '.mkv'].includes(ext)) type = 'video'
    else if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) type = 'image'
    else if (['.json'].includes(ext)) type = 'config'
    else if (['.tex', '.pkg', '.mpkg'].includes(ext)) type = 'source'

    resultFiles.push({
      name: path.basename(entry.name),
      path: outputPath,
      ext,
      type,
      size: entry.size,
    })
  }

  return { outputDir, files: resultFiles }
}

/**
 * 扫描目录中的所有文件并分类
 */
export function scanOutputDir(dir: string): ExtractedFile[] {
  if (!dir || !fs.existsSync(dir)) return []

  const results: ExtractedFile[] = []

  function walk(currentDir: string) {
    for (const item of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = path.join(currentDir, item.name)

      if (item.isDirectory()) {
        walk(fullPath)
        continue
      }

      const ext = path.extname(item.name).toLowerCase()
      let type: ExtractedFile['type'] = 'other'
      if (['.mp4', '.webm', '.mov', '.mkv'].includes(ext)) type = 'video'
      else if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) type = 'image'
      else if (['.json'].includes(ext)) type = 'config'
      else if (['.tex', '.pkg', '.mpkg'].includes(ext)) type = 'source'

      results.push({
        name: item.name,
        path: fullPath,
        ext,
        type,
        size: fs.statSync(fullPath).size,
      })
    }
  }

  walk(dir)
  return results
}

/**
 * 格式化文件大小
 */
export function formatSize(size: number): string {
  if (size > 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`
  if (size > 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${size} B`
}
