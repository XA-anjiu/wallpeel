// @ts-nocheck
// ============================================================
// Wallpeel — 前端 ↔ 后端 API 接口规范
//
// 前端已完成，后端需实现以下接口。
// 涉及两个文件：
//   1. electron/main.cjs   — 实现 IPC handler（业务逻辑）
//   2. electron/preload.cjs — 通过 contextBridge 暴露给前端
// ============================================================

// ====================
// 一、数据类型定义
// ====================

/**
 * WallpaperInfo — 单个壁纸的元信息
 *
 * scanWallpapers 接口返回的数组元素。
 * 注意：不含图片数据，图片通过 getPreviewImage 单独获取。
 */
interface WallpaperInfo {
  /**
   * 壁纸唯一标识 = 子文件夹名（Workshop ID）
   * 例："1289630048"
   */
  id: string

  /**
   * 壁纸标题
   * 来源：project.json → title
   * 例："Enter The Gungeon - Main Menu"
   */
  title: string

  /**
   * 壁纸类型
   * 来源：project.json → type
   * 可能的值：'video' | 'scene' | 'web' | 'application'
   * 注意：有些壁纸的 type 首字母大写（如 'Video'、'Scene'），
   *       建议统一转小写后返回。
   */
  type: string

  /**
   * 标签数组
   * 来源：project.json → tags
   * 例：["Pixel art", "Game"]
   */
  tags: string[]

  /**
   * 内容评级
   * 来源：project.json → contentrating
   * 常见值：'Everyone' | 'Questionable' | 'Mature'
   * 如果 project.json 没有该字段，默认返回 'Everyone'
   */
  contentRating: string

  /**
   * 主资源文件的完整绝对路径，会直接传给 startExtract 的 inputPath
   *
   * 规则：
   *   - 目录中有 .mpkg 文件 → 返回 .mpkg 路径
   *   - 目录中有 .pkg 文件  → 返回 .pkg 路径
   *   - 类型是 video 且 project.json 的 file 字段指向 .mp4 → 返回该视频文件路径
   *   - 如果以上都没有，返回 project.json 中 file 字段对应的文件路径
   *
   * 例："D:\\steam\\steamapps\\workshop\\content\\431960\\1289630048\\Ohne Titel.mp4"
   */
  filePath: string

  /**
   * 是否存在预览图（preview.jpg 或 preview.png）
   * 前端会据此决定是否调用 getPreviewImage
   */
  hasPreview: boolean

  /**
   * 整个壁纸文件夹的总大小（字节）
   * 递归计算目录下所有文件大小之和
   */
  fileSize: number
}

/**
 * ExtractedFile — 提取结果中的单个文件
 * 这个类型已经在 src/lib/extractor.ts 中定义，
 * startExtract 已有实现，此处仅供参考。
 */
interface ExtractedFile {
  name: string
  path: string
  ext: string
  type: 'video' | 'image' | 'config' | 'source' | 'other'
  size: number
}

// ====================
// 二、preload.cjs 需要暴露的 API
// ====================

// 在 preload.cjs 中：
//
// const { contextBridge, ipcRenderer } = require('electron')
//
// contextBridge.exposeInMainWorld('wallpeel', {
//   // ---- 已有（保持不变）----
//   selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
//   openPath: (targetPath) => ipcRenderer.invoke('shell:openPath', targetPath),
//   startExtract: (payload) => ipcRenderer.invoke('extract:start', payload),
//   onExtractLog: (callback) => {
//     ipcRenderer.removeAllListeners('extract:log')
//     ipcRenderer.on('extract:log', (_event, log) => callback(log))
//   },
//
//   // ---- 新增 ----
//   scanWallpapers: (dirPath) => ipcRenderer.invoke('wallpaper:scan', dirPath),
//   getPreviewImage: (wallpaperDirPath) => ipcRenderer.invoke('wallpaper:preview', wallpaperDirPath),
// })

// ====================
// 三、main.cjs 需要新增的 IPC Handler
// ====================

// ---- 接口 1：扫描壁纸目录 ----
//
// IPC 名称：'wallpaper:scan'
// 入参：dirPath (string) — WE 壁纸根目录路径，如 "D:\steam\steamapps\workshop\content\431960"
// 返回：WallpaperInfo[] — 所有壁纸的元信息数组
//
// 实现逻辑：
//   1. 读取 dirPath 下所有子文件夹（每个子文件夹名就是 Workshop ID）
//   2. 对每个子文件夹：
//      a. 读取 project.json（如果存在）
//      b. 解析出 title, type, tags, contentrating, file 等字段
//      c. 计算文件夹总大小
//      d. 判断是否存在 preview.jpg 或 preview.png
//      e. 确定 filePath（主资源文件路径）
//   3. 如果没有 project.json，跳过该文件夹或给默认值
//   4. 返回 WallpaperInfo[] 数组
//
// 示例代码：
//
// ipcMain.handle('wallpaper:scan', async (_event, dirPath) => {
//   const results = []
//   const dirs = fs.readdirSync(dirPath, { withFileTypes: true })
//     .filter(d => d.isDirectory())
//
//   for (const entry of dirs) {
//     const wpDir = path.join(dirPath, entry.name)
//     const pjPath = path.join(wpDir, 'project.json')
//
//     // 跳过没有 project.json 的文件夹
//     if (!fs.existsSync(pjPath)) continue
//
//     try {
//       const pj = JSON.parse(fs.readFileSync(pjPath, 'utf8'))
//
//       // 计算文件夹总大小
//       let totalSize = 0
//       function calcSize(dir) {
//         for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
//           const full = path.join(dir, item.name)
//           if (item.isDirectory()) calcSize(full)
//           else totalSize += fs.statSync(full).size
//         }
//       }
//       calcSize(wpDir)
//
//       // 判断预览图是否存在
//       const hasPreview =
//         fs.existsSync(path.join(wpDir, 'preview.jpg')) ||
//         fs.existsSync(path.join(wpDir, 'preview.png'))
//
//       // 确定主资源文件路径
//       let filePath = ''
//       // 优先找 mpkg
//       const files = fs.readdirSync(wpDir)
//       const mpkg = files.find(f => f.endsWith('.mpkg'))
//       const pkg = files.find(f => f.endsWith('.pkg'))
//       if (mpkg) filePath = path.join(wpDir, mpkg)
//       else if (pkg) filePath = path.join(wpDir, pkg)
//       else if (pj.file) filePath = path.join(wpDir, pj.file)
//
//       results.push({
//         id: entry.name,
//         title: pj.title || entry.name,
//         type: (pj.type || 'unknown').toLowerCase(),
//         tags: pj.tags || [],
//         contentRating: pj.contentrating || 'Everyone',
//         filePath,
//         hasPreview,
//         fileSize: totalSize,
//       })
//     } catch (e) {
//       // 解析失败的文件夹跳过
//       console.warn(`跳过 ${entry.name}: ${e.message}`)
//     }
//   }
//
//   return results
// })

// ---- 接口 2：获取壁纸预览图 ----
//
// IPC 名称：'wallpaper:preview'
// 入参：wallpaperDirPath (string) — 壁纸主资源文件的完整路径
//       （就是 WallpaperInfo.filePath，但你需要从中推导出壁纸目录）
// 返回：string | null — base64 Data URL，或 null（文件不存在时）
//
// 实现逻辑：
//   1. 从 wallpaperDirPath 推导出壁纸所在目录：
//      - 如果路径指向 .pkg/.mpkg/.mp4 等文件，取其 dirname
//      - 如果路径本身是目录，直接使用
//   2. 在该目录下查找 preview.jpg 或 preview.png
//   3. 读取图片文件，转为 base64 Data URL
//   4. 返回格式："data:image/jpeg;base64,/9j/4AAQ..." 或 "data:image/png;base64,iVBOR..."
//
// 示例代码：
//
// ipcMain.handle('wallpaper:preview', async (_event, filePath) => {
//   // 推导壁纸目录
//   let wpDir = filePath
//   const stat = fs.statSync(filePath)
//   if (stat.isFile()) {
//     wpDir = path.dirname(filePath)
//   }
//
//   // 查找预览图
//   let previewPath = path.join(wpDir, 'preview.jpg')
//   let mimeType = 'image/jpeg'
//
//   if (!fs.existsSync(previewPath)) {
//     previewPath = path.join(wpDir, 'preview.png')
//     mimeType = 'image/png'
//   }
//
//   if (!fs.existsSync(previewPath)) {
//     return null
//   }
//
//   // 读取并转 base64
//   const buffer = fs.readFileSync(previewPath)
//   const base64 = buffer.toString('base64')
//   return `data:${mimeType};base64,${base64}`
// })

// ====================
// 四、已有接口（不需要改动，保持原样即可）
// ====================

// dialog:selectFolder  — 选择文件夹对话框
// shell:openPath       — 在文件管理器中打开路径
// extract:start        — 开始提取壁纸资源
// extract:log          — 提取过程日志事件（通过 sender.send 推送）

// ====================
// 五、建议的 main.cjs 窗口尺寸调整
// ====================

// 新的前端布局是左右分栏，建议把窗口默认尺寸调大：
//
// const win = new BrowserWindow({
//   width: 1400,    // 原来 1180
//   height: 900,    // 原来 760
//   minWidth: 1100, // 原来 960
//   minHeight: 700, // 原来 640
//   ...
// })
