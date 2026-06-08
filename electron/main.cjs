const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron')
const path = require('path')
const fs = require('fs')

const isDev = !app.isPackaged

// ========== MPKG 解析器（Node.js 版，替代 unmpkg.exe） ==========

function readUint32(buffer, offset) {
  return buffer.readUInt32LE(offset)
}

function extractMpkg(filePath, outputDir) {
  const buffer = fs.readFileSync(filePath)
  let offset = 0

  // 跳过头部
  offset += 4 // version_length
  offset += 8 // version
  const fileCount = readUint32(buffer, offset)
  offset += 4

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // 第一步：读取所有 entry（不读文件数据）
  const entries = []
  for (let i = 0; i < fileCount; i++) {
    const nameLength = readUint32(buffer, offset)
    offset += 4

    const name = buffer.toString('utf8', offset, offset + nameLength)
    offset += nameLength

    offset += 4 // 跳过 index 字段

    const size = readUint32(buffer, offset)
    offset += 4

    entries.push({ name, size })
  }

  // 第二步：读取所有文件数据
  const files = []
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const fileData = buffer.slice(offset, offset + entry.size)
    offset += entry.size

    // 写入文件
    const outputPath = path.join(outputDir, entry.name)
    const outputSubDir = path.dirname(outputPath)
    if (!fs.existsSync(outputSubDir)) {
      fs.mkdirSync(outputSubDir, { recursive: true })
    }
    fs.writeFileSync(outputPath, fileData)

    // 分类
    const ext = path.extname(entry.name).toLowerCase()
    let type = 'other'
    if (['.mp4', '.webm', '.mov', '.mkv'].includes(ext)) type = 'video'
    else if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) type = 'image'
    else if (['.json'].includes(ext)) type = 'config'
    else if (['.tex', '.pkg', '.mpkg'].includes(ext)) type = 'source'

    files.push({ name: path.basename(entry.name), path: outputPath, ext, type, size: entry.size })
  }

  return files
}

/**
 * 自动搜索 Steam 库目录中的 Wallpaper Engine 壁纸路径
 * 返回找到的所有壁纸目录路径
 */
function findWallpaperDir() {
  const wallpaperAppId = '431960'
  const results = []

  // 常见的 Steam 安装路径
  const commonSteamPaths = [
    'C:\\Program Files (x86)\\Steam',
    'C:\\Program Files\\Steam',
    'D:\\Steam',
    'D:\\steam',
    'E:\\Steam',
    'E:\\steam',
    'F:\\Steam',
    'F:\\steam',
  ]

  // 找到 Steam 安装目录
  let steamDir = ''
  for (const p of commonSteamPaths) {
    if (fs.existsSync(p) && fs.existsSync(path.join(p, 'steam.exe'))) {
      steamDir = p
      break
    }
  }

  if (!steamDir) return results

  // 读取 libraryfolders.vdf
  const vdfPath = path.join(steamDir, 'steamapps', 'libraryfolders.vdf')
  if (!fs.existsSync(vdfPath)) return results

  try {
    const vdfContent = fs.readFileSync(vdfPath, 'utf8')

    // 解析所有库路径
    const pathRegex = /"path"\s+"([^"]+)"/g
    let match
    const libraryPaths = []

    while ((match = pathRegex.exec(vdfContent)) !== null) {
      // 处理转义的反斜杠
      const libPath = match[1].replace(/\\\\/g, '\\')
      libraryPaths.push(libPath)
    }

    // 在每个库路径下查找壁纸目录
    for (const libPath of libraryPaths) {
      const wpDir = path.join(libPath, 'steamapps', 'workshop', 'content', wallpaperAppId)
      if (fs.existsSync(wpDir)) {
        results.push(wpDir)
      }
    }
  } catch (err) {
    console.warn('解析 libraryfolders.vdf 失败:', err.message)
  }

  return results
}

function scanDir(dir) {
  const results = []

  function walk(currentDir) {
    if (!fs.existsSync(currentDir)) return
    for (const item of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = path.join(currentDir, item.name)
      if (item.isDirectory()) {
        walk(fullPath)
        continue
      }

      const ext = path.extname(item.name).toLowerCase()
      let type = 'other'
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

// ========== Electron 主进程 ==========

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: 'WE Extractor',
    frame: false,
    backgroundColor: '#f7f7f8',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.handle('dialog:selectFile', async () => {
  const result = await dialog.showOpenDialog({
    title: '选择 PKG / MPKG 文件',
    properties: ['openFile'],
    filters: [
      { name: 'Wallpaper Package', extensions: ['pkg', 'mpkg'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('dialog:selectFolder', async () => {
  const result = await dialog.showOpenDialog({
    title: '选择输出文件夹',
    properties: ['openDirectory', 'createDirectory'],
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('shell:openPath', async (_event, targetPath) => {
  return shell.openPath(targetPath)
})

/**
 * 复制图片文件到剪贴板
 * 支持 jpg/png/gif，gif 会保留动画
 */
ipcMain.handle('clipboard:copyImage', async (_event, imagePath) => {
  console.log('[clipboard:copyImage] 尝试复制:', imagePath)

  if (!fs.existsSync(imagePath)) {
    console.log('[clipboard:copyImage] 文件不存在:', imagePath)
    return false
  }

  const { clipboard, nativeImage } = require('electron')
  const ext = path.extname(imagePath).toLowerCase()

  // GIF 文件：读取为 buffer，写入剪贴板（保留动画）
  if (ext === '.gif') {
    const buffer = fs.readFileSync(imagePath)
    clipboard.writeBuffer('image/gif', buffer)
    console.log('[clipboard:copyImage] GIF 复制成功:', imagePath)
    return true
  }

  // JPG/PNG 文件：用 nativeImage 复制
  const image = nativeImage.createFromPath(imagePath)
  if (image.isEmpty()) {
    console.log('[clipboard:copyImage] 图片为空:', imagePath)
    return false
  }

  clipboard.writeImage(image)
  console.log('[clipboard:copyImage] 复制成功:', imagePath)
  return true
})

ipcMain.handle('extract:start', async (event, payload) => {
  const inputPath = payload.inputPath
  const outputDir = payload.outputDir
  const ext = path.extname(inputPath).toLowerCase()

  if (!fs.existsSync(inputPath)) throw new Error('输入文件不存在')
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

  // 壁纸文件夹路径（解压目标）
  const wpDir = path.dirname(inputPath)

  event.sender.send('extract:log', `开始提取：${inputPath}`)
  event.sender.send('extract:log', `壁纸目录：${wpDir}`)
  event.sender.send('extract:log', `输出目录：${outputDir}`)

  let files = []

  if (ext === '.pkg') {
    // PKG 解压到壁纸文件夹
    const repkgPath = path.join(__dirname, '..', 'tools', 'RePKG.exe')
    if (!fs.existsSync(repkgPath)) throw new Error('找不到 tools/RePKG.exe')

    event.sender.send('extract:log', `调用 RePKG：${repkgPath}`)

    const { spawn } = require('child_process')
    await new Promise((resolve, reject) => {
      const child = spawn(repkgPath, ['extract', '-o', wpDir, inputPath], {
        windowsHide: true,
        cwd: wpDir,
      })

      child.stdout.on('data', (data) => {
        event.sender.send('extract:log', data.toString())
      })

      child.stderr.on('data', (data) => {
        event.sender.send('extract:log', data.toString())
      })

      child.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`RePKG 退出码：${code}`))
      })
    })

    files = scanDir(wpDir)
  } else if (ext === '.mpkg') {
    // MPKG 解压到壁纸文件夹
    event.sender.send('extract:log', '使用内置解析器提取 MPKG...')
    files = extractMpkg(inputPath, wpDir)
    event.sender.send('extract:log', `MPKG 解析完成，共 ${files.length} 个文件`)

    // 检查是否有嵌套的 PKG 文件
    const nestedPkgs = files.filter((f) => f.ext === '.pkg')
    if (nestedPkgs.length > 0) {
      const repkgPath = path.join(__dirname, '..', 'tools', 'RePKG.exe')
      if (fs.existsSync(repkgPath)) {
        for (const pkg of nestedPkgs) {
          event.sender.send('extract:log', `检测到嵌套 PKG，继续提取：${pkg.name}`)
          const pkgOutDir = path.join(wpDir, path.basename(pkg.name, '.pkg'))
          fs.mkdirSync(pkgOutDir, { recursive: true })

          const { spawn } = require('child_process')
          await new Promise((resolve, reject) => {
            const child = spawn(repkgPath, ['extract', '-o', pkgOutDir, pkg.path], {
              windowsHide: true,
              cwd: pkgOutDir,
            })

            child.stdout.on('data', (data) => {
              event.sender.send('extract:log', data.toString())
            })

            child.stderr.on('data', (data) => {
              event.sender.send('extract:log', data.toString())
            })

            child.on('close', (code) => {
              if (code === 0) resolve()
              else reject(new Error(`RePKG 退出码：${code}`))
            })
          })

          // 把嵌套 PKG 的解包结果也合并到文件列表
          files = files.filter((f) => f.ext !== '.pkg')
          files.push(...scanDir(pkgOutDir))
        }
      } else {
        event.sender.send('extract:log', '警告：找不到 RePKG.exe，跳过嵌套 PKG 提取')
      }
    }
  } else {
    throw new Error('暂时只支持 .pkg 和 .mpkg 文件')
  }

  // 复制有用的文件（MP4, PNG, JPG）到输出目录
  let wpName = path.basename(wpDir)
  const pjPath = path.join(wpDir, 'project.json')
  if (fs.existsSync(pjPath)) {
    try {
      const pj = JSON.parse(fs.readFileSync(pjPath, 'utf8'))
      if (pj.title) wpName = pj.title
    } catch {}
  }
  const copyDir = path.join(outputDir, wpName)
  if (!fs.existsSync(copyDir)) fs.mkdirSync(copyDir, { recursive: true })

  const usefulExts = ['.mp4', '.webm', '.mov', '.mkv', '.png', '.jpg', '.jpeg']
  const usefulFiles = files.filter((f) => usefulExts.includes(f.ext))
  let copiedCount = 0

  for (const file of usefulFiles) {
    try {
      const targetPath = path.join(copyDir, file.name)
      fs.copyFileSync(file.path, targetPath)
      copiedCount++
      event.sender.send('extract:log', `复制：${file.name}`)
    } catch (err) {
      event.sender.send('extract:log', `复制失败：${file.name} - ${err.message}`)
    }
  }

  event.sender.send('extract:log', `提取完成，共 ${files.length} 个文件，复制 ${copiedCount} 个到输出目录`)
  return { success: true, outputDir: copyDir, files }
})

// ========== 壁纸扫描 & 预览图（新增） ==========

/**
 * 递归计算文件夹总大小（字节）
 */
function calcDirSize(dirPath) {
  let total = 0
  if (!fs.existsSync(dirPath)) return 0
  for (const item of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const full = path.join(dirPath, item.name)
    if (item.isDirectory()) {
      total += calcDirSize(full)
    } else {
      total += item.size || fs.statSync(full).size
    }
  }
  return total
}

/**
 * 扫描壁纸目录 — 返回所有壁纸的元信息（含文件检测）
 */
ipcMain.handle('wallpaper:scan', async (_event, dirPath) => {
  if (!fs.existsSync(dirPath)) return []

  const results = []
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const wpDir = path.join(dirPath, entry.name)
    const pjPath = path.join(wpDir, 'project.json')

    // 没有 project.json 的跳过
    if (!fs.existsSync(pjPath)) continue

    try {
      const pj = JSON.parse(fs.readFileSync(pjPath, 'utf8'))

      // 预览图
      let previewPath = path.join(wpDir, 'preview.jpg')
      let hasPreview = fs.existsSync(previewPath)
      if (!hasPreview) {
        previewPath = path.join(wpDir, 'preview.png')
        hasPreview = fs.existsSync(previewPath)
      }
      if (!hasPreview) {
        previewPath = path.join(wpDir, 'preview.gif')
        hasPreview = fs.existsSync(previewPath)
      }

      // 扫描所有文件
      const dirFiles = fs.readdirSync(wpDir)

      // MP4 检测
      const mp4File = dirFiles.find((f) => f.endsWith('.mp4'))
      const hasMP4 = !!mp4File
      const mp4Path = mp4File ? path.join(wpDir, mp4File) : ''
      const mp4Size = mp4File ? fs.statSync(path.join(wpDir, mp4File)).size : 0

      // PKG 检测
      const pkgFile = dirFiles.find((f) => f.endsWith('.pkg'))
      const hasPKG = !!pkgFile
      const pkgPath = pkgFile ? path.join(wpDir, pkgFile) : ''
      const pkgSize = pkgFile ? fs.statSync(path.join(wpDir, pkgFile)).size : 0

      // MPKG 检测
      const mpkgFile = dirFiles.find((f) => f.endsWith('.mpkg'))
      const hasMPKG = !!mpkgFile
      const mpkgPath = mpkgFile ? path.join(wpDir, mpkgFile) : ''
      const mpkgSize = mpkgFile ? fs.statSync(path.join(wpDir, mpkgFile)).size : 0

      // PNG/JPG 检测（检查顶层目录，不递归）
      const pngFile = dirFiles.find((f) => /\.(png|jpg|jpeg)$/i.test(f) && !f.startsWith('preview'))
      const hasPNG = !!pngFile
      const pngPath = pngFile ? path.join(wpDir, pngFile) : ''
      const pngSize = pngFile ? fs.statSync(path.join(wpDir, pngFile)).size : 0

      // 主资源文件路径（用于提取）
      let filePath = ''
      if (mp4File) filePath = path.join(wpDir, mp4File)
      else if (pkgFile) filePath = path.join(wpDir, pkgFile)
      else if (pj.file) filePath = path.join(wpDir, pj.file)

      // 是否需要提取：有 PKG 但没有 PNG
      const needsExtraction = hasPKG && !hasPNG

      results.push({
        id: entry.name,
        title: pj.title || entry.name,
        type: (pj.type || 'unknown').toLowerCase(),
        tags: pj.tags || [],
        contentRating: pj.contentrating || 'Everyone',
        filePath,
        hasPreview,
        previewPath: hasPreview ? previewPath : '',
        fileSize: calcDirSize(wpDir),

        // 文件检测
        hasMP4,
        mp4Path,
        mp4Size,
        hasPKG,
        pkgPath,
        pkgSize,
        hasMPKG,
        mpkgPath,
        mpkgSize,
        hasPNG,
        pngPath,
        pngSize,
        needsExtraction,
      })
    } catch (e) {
      // 解析失败的跳过
      console.warn(`跳过壁纸 ${entry.name}: ${e.message}`)
    }
  }

  return results
})

/**
 * 获取壁纸预览图 — 返回 base64 Data URL
 */
ipcMain.handle('wallpaper:preview', async (_event, filePath) => {
  // 从文件路径推导出壁纸目录
  let wpDir = filePath
  try {
    const stat = fs.statSync(filePath)
    if (stat.isFile()) wpDir = path.dirname(filePath)
  } catch {
    return null
  }

  // 优先 jpg，其次 png，最后 gif
  let previewPath = path.join(wpDir, 'preview.jpg')
  let mimeType = 'image/jpeg'

  if (!fs.existsSync(previewPath)) {
    previewPath = path.join(wpDir, 'preview.png')
    mimeType = 'image/png'
  }

  if (!fs.existsSync(previewPath)) {
    previewPath = path.join(wpDir, 'preview.gif')
    mimeType = 'image/gif'
  }

  if (!fs.existsSync(previewPath)) return null

  try {
    const buffer = fs.readFileSync(previewPath)
    return `data:${mimeType};base64,${buffer.toString('base64')}`
  } catch {
    return null
  }
})

/**
 * 打开壁纸本地目录
 */
ipcMain.handle('wallpaper:openDir', async (_event, filePath) => {
  let wpDir = filePath
  try {
    const stat = fs.statSync(filePath)
    if (stat.isFile()) wpDir = path.dirname(filePath)
  } catch {
    return false
  }

  if (!fs.existsSync(wpDir)) return false

  await shell.openPath(wpDir)
  return true
})

/**
 * 自动搜索 Steam 库中的 Wallpaper Engine 壁纸目录
 */
ipcMain.handle('wallpaper:autoFind', async () => {
  const paths = findWallpaperDir()
  return { paths, count: paths.length }
})

/**
 * 清理壁纸目录中的冗余文件（保留视频、图片、project.json、预览图、shaders）
 */
ipcMain.handle('wallpaper:cleanup', async (_event, wpDir) => {
  if (!fs.existsSync(wpDir)) return { success: false, deletedCount: 0, error: '目录不存在' }

  const keepExts = ['.mp4', '.webm', '.mov', '.mkv', '.png', '.jpg', '.jpeg', '.gif']
  const keepFiles = ['project.json', 'preview.jpg', 'preview.png', 'preview.gif']
  const keepDirs = ['shaders']

  let deletedCount = 0
  const entries = fs.readdirSync(wpDir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(wpDir, entry.name)

    if (entry.isDirectory()) {
      if (keepDirs.includes(entry.name)) continue
      try {
        fs.rmSync(fullPath, { recursive: true, force: true })
        deletedCount++
      } catch (err) {
        console.warn(`删除目录失败: ${fullPath} - ${err.message}`)
      }
    } else {
      if (keepFiles.includes(entry.name)) continue
      if (keepExts.includes(path.extname(entry.name).toLowerCase())) continue
      try {
        fs.unlinkSync(fullPath)
        deletedCount++
      } catch (err) {
        console.warn(`删除文件失败: ${fullPath} - ${err.message}`)
      }
    }
  }

  return { success: true, deletedCount }
})

// ========== 批量操作 ==========

/**
 * 批量复制文件到输出目录
 * payload: { files: [{ source, target }], outputDir: string }
 */
ipcMain.handle('batch:copy', async (_event, payload) => {
  const { files, outputDir } = payload

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  let copied = 0
  const errors = []

  for (const file of files) {
    try {
      const targetPath = path.join(outputDir, file.target)
      const targetDir = path.dirname(targetPath)
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true })
      }
      fs.copyFileSync(file.source, targetPath)
      copied++
    } catch (err) {
      errors.push({ source: file.source, error: err.message })
    }
  }

  return { success: errors.length === 0, copied, errors }
})

/**
 * 批量提取 PKG 文件
 * payload: { wallpapers: [{ id, pkgPath, title }], outputDir: string }
 * 流程：解压到壁纸文件夹 → 复制有用文件到输出目录
 */
ipcMain.handle('batch:extractPKG', async (event, payload) => {
  const { wallpapers, outputDir } = payload
  const repkgPath = path.join(__dirname, '..', 'tools', 'RePKG.exe')

  if (!fs.existsSync(repkgPath)) {
    throw new Error('找不到 tools/RePKG.exe')
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const { spawn } = require('child_process')
  const results = []
  const usefulExts = ['.mp4', '.webm', '.mov', '.mkv', '.png', '.jpg', '.jpeg']

  for (const wp of wallpapers) {
    // 壁纸文件夹路径（PKG 所在目录）
    const wpDir = path.dirname(wp.pkgPath)

    event.sender.send('extract:log', `正在提取: ${wp.title} (${wp.id})`)

    try {
      // 解压到壁纸文件夹
      await new Promise((resolve, reject) => {
        const child = spawn(repkgPath, ['extract', '-o', wpDir, wp.pkgPath], {
          windowsHide: true,
          cwd: wpDir,
        })

        child.stdout.on('data', (data) => {
          event.sender.send('extract:log', data.toString())
        })

        child.stderr.on('data', (data) => {
          event.sender.send('extract:log', data.toString())
        })

        child.on('close', (code) => {
          if (code === 0) resolve()
          else reject(new Error(`RePKG 退出码：${code}`))
        })
      })

      // 扫描壁纸文件夹
      const files = scanDir(wpDir)

      // 复制有用文件到输出目录（使用壁纸名称）
      const copyDir = path.join(outputDir, wp.title || wp.id)
      if (!fs.existsSync(copyDir)) fs.mkdirSync(copyDir, { recursive: true })

      const usefulFiles = files.filter((f) => usefulExts.includes(f.ext))
      let copiedCount = 0
      for (const file of usefulFiles) {
        try {
          const targetPath = path.join(copyDir, file.name)
          fs.copyFileSync(file.path, targetPath)
          copiedCount++
        } catch (err) {
          event.sender.send('extract:log', `复制失败：${file.name}`)
        }
      }

      results.push({ id: wp.id, success: true, files, copiedCount })
      event.sender.send('extract:log', `完成: ${wp.title}，复制 ${copiedCount} 个文件`)
    } catch (err) {
      results.push({ id: wp.id, success: false, error: err.message })
      event.sender.send('extract:log', `失败: ${wp.title} - ${err.message}`)
    }
  }

  return { success: true, results }
})

// ========== MPKG 管理 ==========

/**
 * 扫描目录中的 MPKG 文件，并匹配本地壁纸文件夹
 * payload: { mpkgDir: string, wallpaperDir: string }
 * 返回：匹配到的 MPKG 文件列表
 */
ipcMain.handle('mpkg:scan', async (_event, payload) => {
  const { mpkgDir, wallpaperDir } = payload

  if (!fs.existsSync(mpkgDir)) throw new Error('MPKG 目录不存在')
  if (!fs.existsSync(wallpaperDir)) throw new Error('壁纸目录不存在')

  // 扫描 MPKG 文件
  const mpkgFiles = fs.readdirSync(mpkgDir).filter((f) => f.endsWith('.mpkg'))

  // 扫描壁纸文件夹
  const wpFolders = fs.readdirSync(wallpaperDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)

  // 匹配
  const results = []
  for (const mpkgFile of mpkgFiles) {
    const mpkgId = path.basename(mpkgFile, '.mpkg')
    const mpkgPath = path.join(mpkgDir, mpkgFile)
    const mpkgSize = fs.statSync(mpkgPath).size

    // 检查是否已有本地壁纸文件夹
    const matchedFolder = wpFolders.find((f) => f === mpkgId)
    const wpDir = matchedFolder ? path.join(wallpaperDir, matchedFolder) : ''

    // 检查壁纸文件夹是否已有 MP4
    let alreadyHasMP4 = false
    // 读取壁纸名称
    let wpTitle = mpkgId
    if (wpDir && fs.existsSync(wpDir)) {
      const wpFiles = fs.readdirSync(wpDir)
      alreadyHasMP4 = wpFiles.some((f) => f.endsWith('.mp4'))

      // 尝试从 project.json 读取壁纸名称
      const pjPath = path.join(wpDir, 'project.json')
      if (fs.existsSync(pjPath)) {
        try {
          const pj = JSON.parse(fs.readFileSync(pjPath, 'utf8'))
          if (pj.title) wpTitle = pj.title
        } catch {}
      }
    }

    results.push({
      mpkgFile,
      mpkgId,
      mpkgPath,
      mpkgSize,
      matched: !!matchedFolder,
      wpDir,
      wpTitle,
      alreadyHasMP4,
    })
  }

  return {
    total: mpkgFiles.length,
    matched: results.filter((r) => r.matched).length,
    unmatched: results.filter((r) => !r.matched).length,
    files: results,
  }
})

/**
 * 批量复制 MPKG 文件到对应壁纸文件夹（跳过已存在的文件）
 * payload: { files: [{ mpkgPath, targetDir }] }
 */
ipcMain.handle('mpkg:copy', async (_event, payload) => {
  const { files } = payload

  let copied = 0
  let skipped = 0
  const errors = []

  for (const file of files) {
    try {
      const targetPath = path.join(file.targetDir, path.basename(file.mpkgPath))
      // 如果目标文件已存在则跳过
      if (fs.existsSync(targetPath)) {
        skipped++
        continue
      }
      fs.copyFileSync(file.mpkgPath, targetPath)
      copied++
    } catch (err) {
      errors.push({ source: file.mpkgPath, error: err.message })
    }
  }

  return { success: errors.length === 0, copied, skipped, errors }
})

/**
 * 批量提取 MPKG 文件
 * payload: { files: [{ mpkgPath, wpDir }], outputDir: string }
 * 流程：解压到壁纸文件夹 → 复制有用文件到输出目录（如果设置了）
 */
ipcMain.handle('mpkg:extract', async (event, payload) => {
  const { files, outputDir } = payload
  const usefulExts = ['.mp4', '.webm', '.mov', '.mkv', '.png', '.jpg', '.jpeg']

  console.log('[mpkg:extract] 收到请求，files:', files.length, 'outputDir:', outputDir)

  // 如果设置了输出目录，确保其存在
  if (outputDir && !fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const results = []

  for (const file of files) {
    const wpDir = file.wpDir
    console.log('[mpkg:extract] 处理文件:', file.mpkgPath, 'wpDir:', wpDir)

    event.sender.send('extract:log', `正在提取: ${path.basename(file.mpkgPath)}`)

    try {
      // 检查 wpDir 是否存在
      if (!wpDir || !fs.existsSync(wpDir)) {
        throw new Error(`壁纸目录不存在: ${wpDir}`)
      }

      // 检查 mpkg 文件是否存在
      if (!fs.existsSync(file.mpkgPath)) {
        throw new Error(`MPKG 文件不存在: ${file.mpkgPath}`)
      }

      // 解压到壁纸文件夹
      console.log('[mpkg:extract] 开始解压...')
      const extractedFiles = extractMpkg(file.mpkgPath, wpDir)
      console.log('[mpkg:extract] 解压完成，文件数:', extractedFiles.length)
      event.sender.send('extract:log', `解压完成，共 ${extractedFiles.length} 个文件`)

      // 扫描壁纸文件夹
      const allFiles = scanDir(wpDir)

      // 如果设置了输出目录，复制有用文件到输出目录
      let copiedCount = 0
      if (outputDir) {
        // 优先使用传入的壁纸名称，否则从 project.json 读取
        let wpName = file.wpTitle || path.basename(wpDir)
        if (!file.wpTitle) {
          const pjPath = path.join(wpDir, 'project.json')
          if (fs.existsSync(pjPath)) {
            try {
              const pj = JSON.parse(fs.readFileSync(pjPath, 'utf8'))
              if (pj.title) wpName = pj.title
            } catch {}
          }
        }
        const copyDir = path.join(outputDir, wpName)
        if (!fs.existsSync(copyDir)) fs.mkdirSync(copyDir, { recursive: true })

        const usefulFiles = allFiles.filter((f) => usefulExts.includes(f.ext))
        for (const ufile of usefulFiles) {
          try {
            const targetPath = path.join(copyDir, ufile.name)
            fs.copyFileSync(ufile.path, targetPath)
            copiedCount++
          } catch (err) {
            event.sender.send('extract:log', `复制失败：${ufile.name}`)
          }
        }
      }

      results.push({ mpkgPath: file.mpkgPath, success: true, files: allFiles, copiedCount })
      event.sender.send('extract:log', `完成: ${path.basename(wpDir)}，复制 ${copiedCount} 个文件`)
    } catch (err) {
      console.log('[mpkg:extract] 错误:', err.message)
      results.push({ mpkgPath: file.mpkgPath, success: false, error: err.message })
      event.sender.send('extract:log', `失败: ${path.basename(file.mpkgPath)} - ${err.message}`)
    }
  }

  return { success: true, results }
})

// ========== 窗口控制（无边框窗口） ==========

ipcMain.handle('window:minimize', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) win.minimize()
})

ipcMain.handle('window:maximize', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) {
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  }
})

ipcMain.handle('window:close', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) win.close()
})
