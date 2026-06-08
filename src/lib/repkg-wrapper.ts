import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

import { type ExtractedFile } from './extractor'

export interface RepkgResult {
  success: boolean
  outputDir: string
  files: ExtractedFile[]
}

export function extractPkg(
  pkgPath: string,
  outputDir: string,
  onLog?: (log: string) => void
): Promise<RepkgResult> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(pkgPath)) {
      return reject(new Error(`文件不存在：${pkgPath}`))
    }

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // 找到 RePKG.exe（开发环境）
    const fallbackPath = path.join(process.cwd(), 'tools', 'RePKG.exe')
    const finalPath = fs.existsSync(fallbackPath) ? fallbackPath : path.join(__dirname, '..', 'tools', 'RePKG.exe')

    if (!fs.existsSync(finalPath)) {
      return reject(new Error('找不到 RePKG.exe，请确认 tools/RePKG.exe 存在'))
    }

    const args = ['extract', '-o', outputDir, pkgPath]

    onLog?.(`> ${finalPath} ${args.join(' ')}`)

    const child = spawn(finalPath, args, {
      windowsHide: true,
      cwd: outputDir,
    })

    const logs: string[] = []

    child.stdout.on('data', (data: Buffer) => {
      const text = data.toString()
      logs.push(text)
      onLog?.(text)
    })

    child.stderr.on('data', (data: Buffer) => {
      const text = data.toString()
      logs.push(text)
      onLog?.(text)
    })

    child.on('close', (code: number | null) => {
      if (code === 0) {
        // 扫描输出目录
        const files = scanDir(outputDir)
        resolve({ success: true, outputDir, files })
      } else {
        reject(new Error(`RePKG 退出码：${code}`))
      }
    })

    child.on('error', (err: Error) => {
      reject(err)
    })
  })
}

function scanDir(dir: string): ExtractedFile[] {
  const results: ExtractedFile[] = []

  function walk(currentDir: string) {
    if (!fs.existsSync(currentDir)) return
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
