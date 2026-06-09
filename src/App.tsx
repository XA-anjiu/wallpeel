import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckCircle2,
  CheckSquare,
  ExternalLink,
  FileArchive,
  FileImage,
  FileVideo,
  FolderOpen,
  ImageIcon,
  Layers,
  Loader2,
  Minus,
  Monitor,
  Moon,
  Package,
  Play,
  Search,
  Settings,
  Square,
  Sun,
  Video,
  X,
} from 'lucide-react'
import { formatSize, type ExtractedFile } from './lib/extractor'

// ==========================================
// 类型定义
// ==========================================

interface WallpaperInfo {
  id: string
  title: string
  type: string
  tags: string[]
  contentRating: string
  filePath: string
  hasPreview: boolean
  previewPath: string
  fileSize: number
  hasMP4: boolean
  mp4Path: string
  mp4Size: number
  hasPKG: boolean
  pkgPath: string
  pkgSize: number
  hasMPKG: boolean
  mpkgPath: string
  mpkgSize: number
  hasPNG: boolean
  pngPath: string
  pngSize: number
  needsExtraction: boolean
}

interface WallpeelAPI {
  selectFolder: () => Promise<string | null>
  openPath: (targetPath: string) => Promise<void>
  autoFindWallpaperDir: () => Promise<{ paths: string[]; count: number }>
  scanWallpapers: (dirPath: string) => Promise<WallpaperInfo[]>
  getPreviewImage: (wallpaperDirPath: string) => Promise<string | null>
  startExtract: (payload: {
    inputPath: string
    outputDir: string
  }) => Promise<{ success: boolean; outputDir: string; files: ExtractedFile[] }>
  onExtractLog: (callback: (log: string) => void) => void
  batchCopy: (payload: { files: { source: string; target: string }[]; outputDir: string }) => Promise<{ success: boolean; copied: number }>
  batchExtractPKG: (payload: { wallpapers: { id: string; pkgPath: string; title: string }[]; outputDir: string }) => Promise<{ success: boolean; results: { id: string; files: ExtractedFile[] }[] }>
  openWallpaperDir: (filePath: string) => Promise<boolean>
  cleanupWallpaperDir: (wpDir: string) => Promise<{ success: boolean; deletedCount: number }>
  copyImageToClipboard: (imagePath: string) => Promise<boolean>
  scanMPKG: (payload: { mpkgDir: string; wallpaperDir: string }) => Promise<{
    total: number; matched: number; unmatched: number
    files: Array<{ mpkgFile: string; mpkgId: string; mpkgPath: string; mpkgSize: number; matched: boolean; wpDir: string; alreadyHasMP4: boolean }>
  }>
  copyMPKG: (payload: { files: Array<{ mpkgPath: string; targetDir: string }> }) => Promise<{ success: boolean; copied: number; errors: any[] }>
  extractMPKG: (payload: { files: Array<{ mpkgPath: string; wpDir: string }>; outputDir: string }) => Promise<{
    success: boolean
    results: Array<{ mpkgPath: string; success: boolean; files: ExtractedFile[]; copiedCount: number }>
  }>
  windowMinimize: () => Promise<void>
  windowMaximize: () => Promise<void>
  windowClose: () => Promise<void>
  getDesktopPath: () => Promise<string>
  onBatchExtractProgress: (callback: (data: { id: string; title: string; success: boolean; copiedCount?: number; error?: string }) => void) => void
}

declare global {
  interface Window {
    wallpeel: WallpeelAPI
  }
}

// ==========================================
// 主题系统
// ==========================================

/** 浅色主题 — 科技感（Inter + 毛玻璃 + 点阵纹理） */
const lightTheme = {
  mode: 'light' as const,
  bg: '#FAFAFA',
  text: '#111',
  textSecondary: '#888',
  textTertiary: '#999',
  textMuted: '#BBB',
  border: 'rgba(0,0,0,0.06)',
  borderStrong: 'rgba(0,0,0,0.1)',
  headerBg: 'rgba(255,255,255,0.75)',
  cardBg: '#fff',
  cardBorder: 'rgba(0,0,0,0.06)',
  cardShadow: '0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.03)',
  inputBg: '#f4f4f5',
  inputBorder: 'rgba(0,0,0,0.08)',
  btnBg: '#fff',
  btnBorder: 'rgba(0,0,0,0.08)',
  btnActiveBg: '#111',
  btnActiveText: '#fff',
  filterBg: '#f4f4f5',
  filterText: '#666',
  contentBg: '#fff',
  contentShadow: '0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.03)',
  modalBg: '#fff',
  modalShadow: '0 24px 48px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)',
  modalOverlay: 'rgba(0,0,0,0.35)',
  badgeDefaultBg: 'rgba(0,0,0,0.06)',
  badgeDefaultText: '#888',
  codeBlockBg: '#111',
  tagBorder: 'rgba(0,0,0,0.06)',
  tagText: '#666',
  fileBg: '#fafafa',
  fileBorder: 'rgba(0,0,0,0.1)',
  scrollHover: 'rgba(0,0,0,0.18)',
  cardEmpty: '#e8e8e8',
  fontFamily: "'Inter', 'PingFang SC', sans-serif",
  headingFamily: "'Lora', 'PingFang SC', serif",
}

/** 深色主题 — 高端感（Lora 衬线标题 + 纯黑底 + 优雅留白） */
const darkTheme = {
  mode: 'dark' as const,
  bg: '#000',
  text: '#fff',
  textSecondary: '#888',
  textTertiary: '#666',
  textMuted: '#444',
  border: 'rgba(255,255,255,0.12)',
  borderStrong: 'rgba(255,255,255,0.18)',
  headerBg: 'rgba(14,14,14,0.85)',
  cardBg: '#141414',
  cardBorder: 'rgba(255,255,255,0.1)',
  cardShadow: '0 1px 3px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06)',
  inputBg: '#111',
  inputBorder: 'rgba(255,255,255,0.15)',
  btnBg: '#161616',
  btnBorder: 'rgba(255,255,255,0.15)',
  btnActiveBg: '#fff',
  btnActiveText: '#000',
  filterBg: '#1e1e1e',
  filterText: '#888',
  contentBg: '#141414',
  contentShadow: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)',
  modalBg: '#111',
  modalShadow: '0 24px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)',
  modalOverlay: 'rgba(0,0,0,0.6)',
  badgeDefaultBg: 'rgba(255,255,255,0.08)',
  badgeDefaultText: '#888',
  codeBlockBg: '#000',
  tagBorder: 'rgba(255,255,255,0.1)',
  tagText: '#888',
  fileBg: '#1a1a1a',
  fileBorder: 'rgba(255,255,255,0.15)',
  scrollHover: 'rgba(255,255,255,0.2)',
  cardEmpty: '#1a1a1a',
  fontFamily: "'Inter', 'PingFang SC', sans-serif",
  headingFamily: "'Lora', 'PingFang SC', serif",
}

type Theme = Omit<typeof lightTheme, 'mode'> & { mode: 'light' | 'dark' }

// ==========================================
// 常量
// ==========================================

/** 可选字体方案 */
const FONT_OPTIONS = [
  { key: 'lora', label: 'Lora', family: "'Lora', 'PingFang SC', serif", desc: '经典衬线' },
  { key: 'inter', label: 'Inter', family: "'Inter', 'PingFang SC', sans-serif", desc: '现代无衬线' },
  { key: 'noto-serif', label: 'Noto Serif', family: "'Noto Serif', 'PingFang SC', serif", desc: '思源衬线' },
  { key: 'playfair', label: 'Playfair', family: "'Playfair Display', 'PingFang SC', serif", desc: '优雅衬线' },
  { key: 'dm-sans', label: 'DM Sans', family: "'DM Sans', 'PingFang SC', sans-serif", desc: '几何无衬线' },
] as const

/** 类型标签配色 — 低饱和度 */
const TYPE_BADGE: Record<string, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  video:       { label: '视频', bg: 'rgba(59,130,246,0.12)',  text: '#3b82f6', icon: <Video size={10} /> },
  scene:       { label: '场景', bg: 'rgba(139,92,246,0.12)',  text: '#8b5cf6', icon: <Layers size={10} /> },
  web:         { label: '网页', bg: 'rgba(34,197,94,0.12)',   text: '#16a34a', icon: <Monitor size={10} /> },
  application: { label: '应用', bg: 'rgba(249,115,22,0.12)',  text: '#ea580c', icon: <Monitor size={10} /> },
}

// ==========================================
// 可拖拽浮动面板
// ==========================================

function DraggablePanel({ width = 420, height = '70vh', theme: t, children, onClose, title }: {
  width?: number; height?: string; theme: Theme; children: React.ReactNode; onClose: () => void; title: React.ReactNode
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  // 首次出现时居中
  useEffect(() => {
    const panelH = height.endsWith('vh')
      ? window.innerHeight * parseInt(height) / 100
      : parseInt(height)
    setPos({ x: (window.innerWidth - width) / 2, y: Math.max(40, (window.innerHeight - panelH) / 2) })
  }, [])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      setPos({ x: e.clientX - dragOffset.current.x, y: Math.max(0, e.clientY - dragOffset.current.y) })
    }
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [dragging])

  // ESC 关闭
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  if (!pos) return null

  return (
    <div style={{
      position: 'fixed', left: pos.x, top: pos.y, zIndex: 50,
      width, maxHeight: height, borderRadius: 16,
      background: t.modalBg, boxShadow: t.modalShadow,
      border: `1px solid ${t.border}`, overflow: 'hidden',
      display: 'flex', flexDirection: 'column', transition: 'background 0.3s',
      userSelect: dragging ? 'none' : 'auto',
    }}>
      {/* 可拖拽标题栏 */}
      <div
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) return
          dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
          setDragging(true)
        }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: `1px solid ${t.border}`,
          cursor: dragging ? 'grabbing' : 'grab', flexShrink: 0,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 15, fontFamily: t.headingFamily, fontWeight: 600 }}>
          {title}
        </h3>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer', color: t.textTertiary,
          width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6,
        }}>
          <X size={14} />
        </button>
      </div>
      {/* 内容区 */}
      <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
        {children}
      </div>
    </div>
  )
}

// ==========================================
// 主组件
// ==========================================

function App() {
  const [wallpapers, setWallpapers] = useState<WallpaperInfo[]>([])
  const [previewMap, setPreviewMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<WallpaperInfo | null>(null)

  // 面板动画状态
  const [panelVisible, setPanelVisible] = useState(false)
  const [panelWp, setPanelWp] = useState<WallpaperInfo | null>(null)
  const [panelContentReady, setPanelContentReady] = useState(false)
  const panelTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // FLIP 动画状态（网格卡片平滑滑动到新位置）
  const gridRef = useRef<HTMLDivElement>(null)
  const flipAnimsRef = useRef<Animation[]>([])
  const flipTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // 当 selected 变化时控制动画
  useEffect(() => {
    clearTimeout(panelTimerRef.current)
    clearTimeout(flipTimerRef.current)
    // 取消正在进行的 FLIP 动画
    flipAnimsRef.current.forEach(a => a.cancel())
    flipAnimsRef.current = []

    if (selected) {
      const isOpening = !panelVisible
      if (isOpening) {
        // === 打开面板：FLIP 动画 ===
        // 1. First：记录卡片当前位置
        const firstMap = new Map<string, { x: number; y: number }>()
        gridRef.current?.querySelectorAll<HTMLElement>('[data-flip-id]').forEach(el => {
          const r = el.getBoundingClientRect()
          firstMap.set(el.dataset.flipId!, { x: r.left, y: r.top })
        })
        // 2. Last：布局瞬间变化（无 CSS transition）
        setPanelWp(selected)
        setPanelVisible(true)
        // 3. 等 React 提交 + 浏览器布局后，执行 FLIP
        flipTimerRef.current = setTimeout(() => {
          const anims: Animation[] = []
          gridRef.current?.querySelectorAll<HTMLElement>('[data-flip-id]').forEach(el => {
            const first = firstMap.get(el.dataset.flipId!)
            if (!first) return
            const last = el.getBoundingClientRect()
            const dx = first.x - last.left
            const dy = first.y - last.top
            if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
            anims.push(el.animate([
              { transform: `translate(${dx}px, ${dy}px)`, opacity: 0.4 },
              { transform: 'translate(0, 0)', opacity: 1 },
            ], { duration: 450, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' }))
          })
          flipAnimsRef.current = anims
          // 面板内容淡入
          panelTimerRef.current = setTimeout(() => { setPanelContentReady(true) }, 140)
        }, 1)
      } else {
        // === 切换壁纸（布局不变）===
        setPanelContentReady(false)
        setPanelWp(selected)
        panelTimerRef.current = setTimeout(() => { setPanelContentReady(true) }, 150)
      }
    } else {
      // === 关闭面板：FLIP 动画 ===
      // 1. First：记录卡片当前位置
      const firstMap = new Map<string, { x: number; y: number }>()
      gridRef.current?.querySelectorAll<HTMLElement>('[data-flip-id]').forEach(el => {
        const r = el.getBoundingClientRect()
        firstMap.set(el.dataset.flipId!, { x: r.left, y: r.top })
      })
      // 2. Last：布局瞬间变化
      setPanelContentReady(false)
      setPanelVisible(false)
      setPanelWp(null)
      // 3. FLIP
      flipTimerRef.current = setTimeout(() => {
        const anims: Animation[] = []
        gridRef.current?.querySelectorAll<HTMLElement>('[data-flip-id]').forEach(el => {
          const first = firstMap.get(el.dataset.flipId!)
          if (!first) return
          const last = el.getBoundingClientRect()
          const dx = first.x - last.left
          const dy = first.y - last.top
          if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
          anims.push(el.animate([
            { transform: `translate(${dx}px, ${dy}px)`, opacity: 0.4 },
            { transform: 'translate(0, 0)', opacity: 1 },
          ], { duration: 450, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' }))
        })
        flipAnimsRef.current = anims
      }, 1)
    }
  }, [selected])

  // 壁纸目录
  const [wallpaperDir, setWallpaperDir] = useState(() => localStorage.getItem('we-wallpaper-dir') || '')
  useEffect(() => { localStorage.setItem('we-wallpaper-dir', wallpaperDir) }, [wallpaperDir])

  // 提取
  const [useCustomOutput, setUseCustomOutput] = useState(() => localStorage.getItem('we-use-custom-output') === 'true')
  const [outputDir, setOutputDir] = useState(() => localStorage.getItem('we-output-dir') || '')
  const [desktopPath, setDesktopPath] = useState('')
  // 默认输出路径 = 桌面/Wallpeel_Output
  const defaultOutputDir = desktopPath ? `${desktopPath}\\Wallpeel_Output` : ''

  // 获取桌面路径
  useEffect(() => {
    window.wallpeel.getDesktopPath().then((p: string) => setDesktopPath(p))
  }, [])

  useEffect(() => { localStorage.setItem('we-use-custom-output', String(useCustomOutput)) }, [useCustomOutput])
  useEffect(() => { localStorage.setItem('we-output-dir', outputDir) }, [outputDir])
  const [isRunning, setIsRunning] = useState(false)
  const [extractStatus, setExtractStatus] = useState('')
  const [files, setFiles] = useState<ExtractedFile[]>([])
  const [_jobDir, setJobDir] = useState('')
  const [_logs, setLogs] = useState<string[]>([])

  // 过滤和多选
  const [activeFilter, setActiveFilter] = useState<'all' | 'video' | 'scene'>('all')
  const [multiSelectMode, setMultiSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // 右键菜单
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; wallpaper: WallpaperInfo } | null>(null)

  // MPKG 管理
  const [showMPKG, setShowMPKG] = useState(false)

  // 设置
  const [showSettings, setShowSettings] = useState(false)
  const [headingFont, setHeadingFont] = useState<string>(() => localStorage.getItem('we-heading-font') || 'lora')
  const [autoCleanup, setAutoCleanup] = useState<boolean>(() => localStorage.getItem('we-auto-cleanup') === 'true')

  // 持久化设置
  useEffect(() => { localStorage.setItem('we-heading-font', headingFont) }, [headingFont])
  useEffect(() => { localStorage.setItem('we-auto-cleanup', String(autoCleanup)) }, [autoCleanup])

  // Toast 通知
  const [toasts, setToasts] = useState<{ id: number; message: string; type: 'info' | 'success' | 'error'; exiting?: boolean }[]>([])
  const toastId = useRef(0)
  const addToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = ++toastId.current
    setToasts((prev) => [...prev.slice(-4), { id, message, type }])
    // 3秒后标记为退出状态，触发淡出动画
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => t.id === id ? { ...t, exiting: true } : t))
      // 动画结束后彻底移除
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 300)
    }, 3200)
  }

  const handleContextMenu = (e: React.MouseEvent, wp: WallpaperInfo) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, wallpaper: wp })
    setSelected(wp)  // 右键时同时切换到详情面板
  }

  // 主题
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('we-dark-mode') === 'true')
  const baseTheme: Theme = darkMode ? darkTheme : lightTheme
  const selectedFont = FONT_OPTIONS.find((f) => f.key === headingFont) ?? FONT_OPTIONS[0]
  const t: Theme = { ...baseTheme, headingFamily: selectedFont.family }

  // 根据主题切换 favicon
  useEffect(() => {
    const favicon = document.getElementById('favicon') as HTMLLinkElement
    if (favicon) {
      favicon.href = darkMode ? '/favicon-dark.svg' : '/favicon-light.svg'
    }
    localStorage.setItem('we-dark-mode', String(darkMode))
  }, [darkMode])

  // 同步 body class（控制滚动条颜色）
  useEffect(() => {
    document.body.classList.toggle('dark', darkMode)
  }, [darkMode])

  // 初始化：自动搜索壁纸目录并扫描
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        let wpDir = wallpaperDir

        // 如果没有保存的路径，自动搜索
        if (!wpDir) {
          addToast('正在自动搜索壁纸目录...', 'info')
          const result = await window.wallpeel.autoFindWallpaperDir()
          if (result.count > 0) {
            wpDir = result.paths[0]
            setWallpaperDir(wpDir)
            addToast(`找到壁纸目录：${wpDir}`, 'success')
          } else {
            addToast('未找到壁纸目录，请在设置中手动选择', 'error')
            setLoading(false)
            return
          }
        }

        if (cancelled) return

        // 扫描壁纸
        const list = await window.wallpeel.scanWallpapers(wpDir)
        if (cancelled) return
        setWallpapers(list)

        const BATCH = 8
        for (let i = 0; i < list.length; i += BATCH) {
          if (cancelled) return
          const batch = list.slice(i, i + BATCH)
          const results = await Promise.allSettled(
            batch.map((wp) => window.wallpeel.getPreviewImage(wp.filePath))
          )
          if (cancelled) return
          setPreviewMap((prev) => {
            const next = { ...prev }
            batch.forEach((wp, j) => {
              const r = results[j]
              if (r.status === 'fulfilled' && r.value) next[wp.id] = r.value
            })
            return next
          })
        }
      } catch (err) {
        console.error('扫描失败:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const filtered = wallpapers.filter((w) => {
    if (search.trim()) {
      const q = search.toLowerCase()
      const matchSearch = w.title.toLowerCase().includes(q) || w.tags.some((t) => t.toLowerCase().includes(q))
      if (!matchSearch) return false
    }
    if (activeFilter === 'video' && w.type.toLowerCase() !== 'video') return false
    if (activeFilter === 'scene' && w.type.toLowerCase() !== 'scene') return false
    return true
  })

  const filterCounts = useMemo(() => ({
    all: wallpapers.filter((w) => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return w.title.toLowerCase().includes(q) || w.tags.some((t) => t.toLowerCase().includes(q))
    }).length,
    video: wallpapers.filter((w) => {
      if (w.type.toLowerCase() !== 'video') return false
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return w.title.toLowerCase().includes(q) || w.tags.some((t) => t.toLowerCase().includes(q))
    }).length,
    scene: wallpapers.filter((w) => {
      if (w.type.toLowerCase() !== 'scene') return false
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return w.title.toLowerCase().includes(q) || w.tags.some((t) => t.toLowerCase().includes(q))
    }).length,
  }), [wallpapers, search])

  const addLog = useCallback((text: string) => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (!lines.length) return
    setLogs((prev) => [...prev, ...lines].slice(-300))
    // 日志仅记录，不再触发 Toast；Toast 由各操作函数自行调用
  }, [])

  const handleExtract = async () => {
    // 多选模式且选中多个时，自动切换到批量提取
    if (multiSelectMode && selectedIds.size > 1) {
      await handleBatchExtractPKG()
      return
    }

    if (!selected) return

    // 检查是否有 PKG 文件
    if (!selected.hasPKG) {
      setExtractStatus('未识别到pkg文件')
      addToast('未识别到pkg文件', 'info')
      // 2秒后自动清除状态
      setTimeout(() => { setExtractStatus('') }, 2000)
      return
    }

    const out = (useCustomOutput && outputDir) ? outputDir : defaultOutputDir
    setIsRunning(true)
    setExtractStatus('正在提取...')
    setFiles([])
    setLogs([])
    setJobDir('')
    window.wallpeel.onExtractLog((log) => addLog(log))
    try {
      const result = await window.wallpeel.startExtract({ inputPath: selected.filePath, outputDir: out })
      setJobDir(result.outputDir)
      setFiles(result.files)

      // 如果启用了删除冗余文件，清理壁纸目录
      if (autoCleanup) {
        setExtractStatus('正在清理冗余文件...')
        const wpDir = selected.filePath.substring(0, selected.filePath.lastIndexOf('\\'))
        await window.wallpeel.cleanupWallpaperDir(wpDir)
      }

      setExtractStatus('提取完成')
      addToast(`提取完成，共 ${result.files.length} 个文件`, 'success')
    } catch (err) {
      setExtractStatus('提取失败')
      addToast('PKG 提取失败', 'error')
      addLog(err instanceof Error ? err.message : String(err))
    } finally {
      setIsRunning(false)
    }
  }

  const stats = {
    videos: files.filter((f) => f.type === 'video').length,
    images: files.filter((f) => f.type === 'image').length,
    configs: files.filter((f) => f.type === 'config').length,
    sources: files.filter((f) => f.type === 'source').length,
  }

  const toggleMultiSelect = () => {
    setMultiSelectMode((prev) => {
      if (prev) setSelectedIds(new Set())
      return !prev
    })
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => setSelectedIds(new Set(filtered.map((w) => w.id)))
  const deselectAll = () => {
    if (selectedIds.size === 0) setMultiSelectMode(false)
    else setSelectedIds(new Set())
  }

  const selectedWallpapers = useMemo(() => wallpapers.filter((w) => selectedIds.has(w.id)), [wallpapers, selectedIds])

  const batchStats = useMemo(() => ({
    hasMP4: selectedWallpapers.some((w) => w.hasMP4),
    hasPNG: selectedWallpapers.some((w) => w.hasPNG),
    hasPKG: selectedWallpapers.some((w) => w.hasPKG),
    needsExtraction: selectedWallpapers.some((w) => w.needsExtraction),
  }), [selectedWallpapers])

  const handleBatchCopyMP4 = async () => {
    const out = (useCustomOutput && outputDir) ? outputDir : defaultOutputDir
    const filesToCopy = selectedWallpapers.filter((w) => w.hasMP4).map((w) => ({
      source: w.mp4Path,
      target: w.title + '\\' + w.mp4Path.split('\\').pop()
    }))
    if (!filesToCopy.length) return
    try {
      await window.wallpeel.batchCopy({ files: filesToCopy, outputDir: out })
      addToast(`${filesToCopy.length} 个 MP4 复制完成`, 'success')
    } catch (err) {
      addToast('MP4 复制失败', 'error')
      console.error(err)
    }
  }

  const handleBatchCopyPNG = async () => {
    const out = (useCustomOutput && outputDir) ? outputDir : defaultOutputDir
    const filesToCopy = selectedWallpapers.filter((w) => w.hasPNG).map((w) => ({
      source: w.pngPath,
      target: w.title + '\\' + w.pngPath.split('\\').pop()
    }))
    if (!filesToCopy.length) return
    try {
      await window.wallpeel.batchCopy({ files: filesToCopy, outputDir: out })
      addToast(`${filesToCopy.length} 张图片复制完成`, 'success')
    } catch (err) {
      addToast('图片复制失败', 'error')
      console.error(err)
    }
  }

  const handleBatchExtractPKG = async () => {
    const out = (useCustomOutput && outputDir) ? outputDir : defaultOutputDir
    const pkgs = selectedWallpapers.filter((w) => w.needsExtraction).map((w) => ({ id: w.id, pkgPath: w.pkgPath, title: w.title }))
    if (!pkgs.length) return

    // 监听单个壁纸提取进度
    let successCount = 0
    let failCount = 0
    window.wallpeel.onBatchExtractProgress((data) => {
      if (data.success) {
        successCount++
        addToast(`✓ ${data.title} 提取成功`, 'success')
      } else {
        failCount++
        addToast(`✕ ${data.title} 提取失败`, 'error')
      }
    })

    try {
      await window.wallpeel.batchExtractPKG({ wallpapers: pkgs, outputDir: out })

      // 如果启用了删除冗余文件，清理壁纸目录
      if (autoCleanup) {
        for (const pkg of pkgs) {
          try {
            const wpDir = pkg.pkgPath.substring(0, pkg.pkgPath.lastIndexOf('\\'))
            await window.wallpeel.cleanupWallpaperDir(wpDir)
          } catch (e) {
            console.warn('清理失败:', e)
          }
        }
      }

      // 显示总结
      addToast(`批量提取完成：共 ${pkgs.length} 个，成功 ${successCount} 个，失败 ${failCount} 个`, 'success')
    } catch (err) {
      addToast('PKG 提取失败', 'error')
      console.error(err)
    }
  }

  const handleBatchOpenDir = async () => {
    const targetDir = (useCustomOutput && outputDir) ? outputDir : defaultOutputDir
    if (targetDir) {
      await window.wallpeel.openPath(targetDir)
    }
  }

  // ==========================================
  // 渲染
  // ==========================================

  return (
    <div id="app-root" className={darkMode ? 'dot-grid' : 'dot-grid'} style={{
      height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative',
      background: t.bg, color: t.text, fontFamily: t.headingFamily,
      transition: 'background 0.3s, color 0.3s',
    }}>
      {/* ---- 顶部栏 ---- */}
      <header style={{
        height: 48, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 8px 0 20px', gap: 12, margin: '8px 8px 0 8px', borderRadius: 12,
        border: `1px solid ${t.mode === 'dark' ? 'rgba(255,255,255,0.15)' : t.border}`, background: t.mode === 'dark' ? 'rgba(10,10,10,0.95)' : 'rgba(255,255,255,0.92)',
        WebkitAppRegion: 'drag', userSelect: 'none', position: 'relative', zIndex: 2,
        transition: 'background 0.3s, border-color 0.3s',
      } as React.CSSProperties}>
        {/* 品牌 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src={darkMode ? '/favicon-dark.svg' : '/favicon-light.svg'} alt="Wallpeel" style={{ width: 42, height: 42, borderRadius: 10 }} />
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em', transition: 'letter-spacing 0.3s' }}>Wallpeel</span>
        </div>

        {/* 弹性占位，把右侧组件推到右边 */}
        <div style={{ flex: 1 }} />

        {/* 设置按钮 */}
        <button
          onClick={() => setShowSettings((s) => !s)}
          style={{
            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 8, border: `1px solid ${t.btnBorder}`,
            background: showSettings ? t.btnActiveBg : t.btnBg,
            color: showSettings ? t.btnActiveText : t.text,
            cursor: 'pointer', transition: 'all 0.2s',
            WebkitAppRegion: 'no-drag',
          } as React.CSSProperties}
        >
          <Settings size={14} />
        </button>

        {/* 主题切换 */}
        <button
          onClick={() => setDarkMode((d) => !d)}
          style={{
            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 8, border: `1px solid ${t.btnBorder}`, background: t.btnBg,
            color: t.text, cursor: 'pointer', transition: 'all 0.2s',
            WebkitAppRegion: 'no-drag',
          } as React.CSSProperties}
        >
          {darkMode ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        {/* MPKG 管理按钮 */}
        <button
          onClick={() => setShowMPKG(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
            border: `1px solid ${t.btnBorder}`, background: t.btnBg, color: t.text,
            cursor: 'pointer', transition: 'all 0.2s',
            WebkitAppRegion: 'no-drag',
          } as React.CSSProperties}
        >
          <Package size={13} /> MPKG
        </button>

        {/* 多选按钮 */}
        <button
          onClick={toggleMultiSelect}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
            border: `1px solid ${t.btnBorder}`,
            background: multiSelectMode ? t.btnActiveBg : t.btnBg,
            color: multiSelectMode ? t.btnActiveText : t.text,
            cursor: 'pointer', transition: 'all 0.2s',
            WebkitAppRegion: 'no-drag',
          } as React.CSSProperties}
        >
          <CheckSquare size={13} />
          {multiSelectMode ? '单选' : '多选'}
        </button>

        {multiSelectMode && (
          <>
            <button onClick={selectAll} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500, border: `1px solid ${t.border}`, background: t.btnBg, color: t.text, cursor: 'pointer', WebkitAppRegion: 'no-drag', transition: 'all 0.2s' } as React.CSSProperties}>
              全选
            </button>
            <button onClick={deselectAll} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500, border: `1px solid ${t.border}`, background: t.btnBg, color: t.text, cursor: 'pointer', WebkitAppRegion: 'no-drag', transition: 'all 0.2s' } as React.CSSProperties}>
              取消
            </button>
          </>
        )}

        <span style={{ fontSize: 11, fontWeight: 500, color: t.textTertiary, flexShrink: 0, minWidth: 60, textAlign: 'right', transition: 'color 0.3s' }}>
          {loading ? '加载中...' : `${filtered.length} 个壁纸`}
        </span>

        {/* 窗口控制 */}
        <div style={{ display: 'flex', alignItems: 'center', marginLeft: 8, WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            onClick={() => window.wallpeel.windowMinimize()}
            style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', cursor: 'pointer', color: t.text, borderRadius: 6, transition: 'background 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <Minus size={14} />
          </button>
          <button
            onClick={() => window.wallpeel.windowMaximize()}
            style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', cursor: 'pointer', color: t.text, borderRadius: 6, transition: 'background 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <Square size={11} />
          </button>
          <button
            onClick={() => window.wallpeel.windowClose()}
            style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', cursor: 'pointer', color: t.text, borderRadius: 6, transition: 'background 0.15s, color 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#e81123'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = t.text }}
          >
            <X size={14} />
          </button>
        </div>
      </header>

      {/* ---- 主体（网格 + 右侧面板） ---- */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
        {/* 左侧网格区 */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', padding: '0 8px 8px 8px', position: 'relative', zIndex: 1 }}>
          <div ref={gridRef} style={{
            height: '100%', display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0 0 0',
            transition: 'background 0.3s, box-shadow 0.3s',
          }}>
            {/* 过滤栏 + 批量操作 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderRadius: 12, background: t.contentBg, border: `1px solid ${t.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'transparent'}`, boxShadow: t.contentShadow, flexShrink: 0, transition: 'background 0.3s, box-shadow 0.3s, border-color 0.3s' }}>
              {([
                { key: 'all' as const, label: '全部', count: filterCounts.all },
                { key: 'video' as const, label: '视频壁纸', count: filterCounts.video },
                { key: 'scene' as const, label: '场景壁纸', count: filterCounts.scene },
              ]).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500, fontFamily: t.headingFamily,
                    border: activeFilter === f.key ? 'none' : `1px solid ${t.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'transparent'}`, cursor: 'pointer', transition: 'all 0.2s',
                    background: activeFilter === f.key ? t.btnActiveBg : t.filterBg,
                    color: activeFilter === f.key ? t.btnActiveText : t.text,
                  }}
                >
                  {f.label}
                  <span style={{ fontSize: 10, fontWeight: 400, opacity: activeFilter === f.key ? 0.7 : 0.5 }}>
                    {f.count}
                  </span>
                </button>
              ))}

              {/* 搜索框 */}
              <div style={{ position: 'relative', width: 200 }}>
                <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: t.text, pointerEvents: 'none' }} />
                <input
                  type="text"
                  placeholder="搜索壁纸..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    width: '100%', border: `1px solid ${t.inputBorder}`, borderRadius: 20, background: t.inputBg,
                    padding: '5px 12px 5px 30px', fontSize: 12, outline: 'none', color: t.text,
                    transition: 'border-color 0.15s, background 0.15s, color 0.3s',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = t.borderStrong; e.target.style.background = darkMode ? '#1a1a1a' : '#fff' }}
                  onBlur={(e) => { e.target.style.borderColor = t.inputBorder; e.target.style.background = t.inputBg }}
                />
              </div>

              {multiSelectMode && selectedIds.size > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                  <span style={{ fontSize: 11, color: t.text, whiteSpace: 'nowrap' }}>
                    已选 <strong style={{ color: t.text, fontWeight: 600 }}>{selectedIds.size}</strong> 个
                  </span>
                  <div style={{ width: 1, height: 16, background: t.border }} />

                  {batchStats.hasMP4 && (
                    <button onClick={handleBatchCopyMP4} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500, fontFamily: t.headingFamily, border: `1px solid ${t.btnBorder}`, background: t.btnBg, color: t.text, cursor: 'pointer', transition: 'all 0.2s' }}>
                      <FileVideo size={12} /> 复制 MP4
                    </button>
                  )}
                  {batchStats.hasPNG && (
                    <button onClick={handleBatchCopyPNG} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500, fontFamily: t.headingFamily, border: `1px solid ${t.btnBorder}`, background: t.btnBg, color: t.text, cursor: 'pointer', transition: 'all 0.2s' }}>
                      <FileImage size={12} /> 复制图片
                    </button>
                  )}
                  {batchStats.needsExtraction && (
                    <button onClick={handleBatchExtractPKG} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500, fontFamily: t.headingFamily, background: t.btnActiveBg, color: t.btnActiveText, border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}>
                      <Package size={12} /> 提取 PKG
                    </button>
                  )}
                </div>
              )}

              {/* 输出目录 — 常显 */}
              <button onClick={handleBatchOpenDir} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 500, fontFamily: t.headingFamily, border: `1px solid ${t.btnBorder}`, background: t.btnBg, color: t.text, cursor: 'pointer', transition: 'all 0.2s', marginLeft: (multiSelectMode && selectedIds.size > 0) ? 0 : 'auto' }}>
                <ExternalLink size={12} /> 输出目录
              </button>
            </div>

            <div style={{ flex: 1, minHeight: 0, borderRadius: 12, background: t.contentBg, boxShadow: t.contentShadow, overflowY: 'auto', transition: 'background 0.3s, box-shadow 0.3s' }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '120px 0', color: t.textTertiary }}>
                <Loader2 size={28} className="animate-spin" />
                <p style={{ marginTop: 12, fontSize: 13 }}>正在加载壁纸预览图...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: t.textTertiary }}>
                <p style={{ fontSize: 16, fontFamily: t.headingFamily, fontWeight: 500, letterSpacing: '0.5px' }}>
                  {wallpapers.length === 0
                    ? '请前往设置中设置 Wallpaper 文件路径'
                    : '没有匹配的壁纸'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 1, padding: 1 }}>
                {filtered.map((wp) => (
                  <GridCard
                    key={wp.id}
                    wallpaper={wp}
                    previewSrc={previewMap[wp.id] ?? null}
                    loaded={!!previewMap[wp.id]}
                    multiSelectMode={multiSelectMode}
                    isChecked={selectedIds.has(wp.id)}
                    onClick={() => { if (multiSelectMode) toggleSelect(wp.id); setSelected(wp) }}
                    onContextMenu={(e) => handleContextMenu(e, wp)}
                    theme={t}
                  />
                ))}
              </div>
            )}
            </div>
          </div>
        </div>

        {/* 右侧详情面板 */}
        <div style={{
          width: panelVisible ? 340 : 0,
          opacity: panelContentReady ? 1 : 0,
          transform: panelContentReady ? 'translateY(0)' : 'translateY(8px)',
          flexShrink: 0,
          overflow: 'hidden',
          margin: panelVisible ? '8px 8px 8px 0' : '8px 0 8px 0',
          transition: 'opacity 0.18s ease, transform 0.18s ease',
        }}>
          {panelWp && (
            <DetailPanel
              wallpaper={panelWp}
              previewSrc={previewMap[panelWp.id] ?? null}
              outputDir={(useCustomOutput && outputDir) ? outputDir : defaultOutputDir}
              isRunning={isRunning}
              extractStatus={extractStatus}
              files={files}
              stats={stats}
              theme={t}
              onClose={() => { setSelected(null); setFiles([]); setLogs([]); setJobDir(''); setExtractStatus('') }}
              onExtract={handleExtract}
              onToast={addToast}
              multiSelectMode={multiSelectMode}
              selectedCount={selectedIds.size}
            />
          )}
        </div>

        {/* 右键菜单 */}
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x} y={contextMenu.y}
            wallpaper={contextMenu.wallpaper}
            previewSrc={previewMap[contextMenu.wallpaper.id] ?? null}
            theme={t}
            onClose={() => setContextMenu(null)}
            onViewDetail={(wp) => setSelected(wp)}
            onOpenDir={(fp) => window.wallpeel.openWallpaperDir(fp)}
            onEnterMultiSelect={(id) => {
              if (!multiSelectMode) setMultiSelectMode(true)
              toggleSelect(id)
            }}
          />
        )}

        {/* 设置弹窗 */}
        {showSettings && (
          <DraggablePanel width={480} height="75vh" theme={t} onClose={() => setShowSettings(false)}
            title={<><Settings size={15} style={{ marginRight: 6, verticalAlign: -2 }} />设置</>}
          >

                {/* 壁纸目录 */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 11, color: t.textTertiary, display: 'block', marginBottom: 6 }}>壁纸目录</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      value={wallpaperDir}
                      onChange={(e) => setWallpaperDir(e.target.value)}
                      placeholder="Wallpaper Engine 创意工坊目录..."
                      style={{
                        flex: 1, border: `1px solid ${t.inputBorder}`, borderRadius: 8, background: t.inputBg,
                        padding: '7px 10px', fontSize: 12, outline: 'none', color: t.text, transition: 'border-color 0.15s',
                      }}
                    />
                    <button onClick={async () => { const d = await window.wallpeel.selectFolder(); if (d) setWallpaperDir(d) }} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                      border: `1px solid ${t.btnBorder}`, background: t.btnBg, color: t.text, cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                      <FolderOpen size={13} /> 浏览
                    </button>
                    <button onClick={async () => {
                      addToast('正在自动搜索壁纸目录...', 'info')
                      const result = await window.wallpeel.autoFindWallpaperDir()
                      if (result.count > 0) {
                        setWallpaperDir(result.paths[0])
                        addToast(`找到壁纸目录：${result.paths[0]}`, 'success')
                      } else {
                        addToast('未找到壁纸目录', 'error')
                      }
                    }} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                      background: t.btnActiveBg, color: t.btnActiveText, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                      <Search size={13} /> 自动搜索
                    </button>
                  </div>
                </div>

                <div style={{ height: 1, background: t.border, margin: '0 0 20px' }} />

                {/* 字体选择 */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 11, color: t.textTertiary, display: 'block', marginBottom: 8 }}>标题字体</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {FONT_OPTIONS.map((f) => (
                      <div
                        key={f.key}
                        onClick={() => setHeadingFont(f.key)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px',
                          borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
                          background: headingFont === f.key ? (t.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') : 'transparent',
                          border: headingFont === f.key ? `1px solid ${t.border}` : '1px solid transparent',
                        }}
                      >
                        <span style={{ fontSize: 14, fontFamily: f.family, color: t.text, width: 90 }}>{f.label}</span>
                        <span style={{ fontSize: 10, color: t.textTertiary }}>{f.desc}</span>
                        {headingFont === f.key && <CheckCircle2 size={12} color={t.mode === 'dark' ? '#fff' : '#111'} style={{ marginLeft: 'auto', flexShrink: 0 }} />}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ height: 1, background: t.border, margin: '0 0 20px' }} />

                {/* 输出与复制路径 */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', borderRadius: 10,
                    background: useCustomOutput ? (t.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)') : (t.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
                    border: `1px solid ${t.border}`, transition: 'background 0.2s',
                  }}>
                    <div>
                      <div style={{ fontSize: 12, color: t.text, fontWeight: 500 }}>输出与复制路径</div>
                      <div style={{ fontSize: 10, color: t.textTertiary, marginTop: 2 }}>开启后将文件复制到指定目录</div>
                    </div>
                    <div
                      onClick={() => setUseCustomOutput(!useCustomOutput)}
                      style={{
                        width: 40, height: 22, borderRadius: 11, cursor: 'pointer', flexShrink: 0,
                        background: useCustomOutput ? (t.mode === 'dark' ? '#fff' : '#111') : (t.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'),
                        transition: 'background 0.2s', position: 'relative',
                      }}
                    >
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%', background: useCustomOutput ? (t.mode === 'dark' ? '#111' : '#fff') : '#fff',
                        position: 'absolute', top: 2,
                        left: useCustomOutput ? 20 : 2,
                        transition: 'left 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                    </div>
                  </div>

                  <div style={{ marginTop: 10, opacity: useCustomOutput ? 1 : 0.4, pointerEvents: useCustomOutput ? 'auto' : 'none', transition: 'opacity 0.2s' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        value={outputDir}
                        onChange={(e) => setOutputDir(e.target.value)}
                        placeholder="选择输出目录..."
                        style={{
                          flex: 1, border: `1px solid ${t.inputBorder}`, borderRadius: 8, background: t.inputBg,
                          padding: '6px 10px', fontSize: 11, outline: 'none', color: t.text, transition: 'border-color 0.15s',
                        }}
                      />
                      <button onClick={async () => { const d = await window.wallpeel.selectFolder(); if (d) setOutputDir(d) }} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 8,
                        fontSize: 11, border: `1px solid ${t.btnBorder}`, background: t.btnBg, color: t.textSecondary, cursor: 'pointer',
                      }}>
                        <FolderOpen size={12} /> 浏览
                      </button>
                    </div>
                    <p style={{ fontSize: 10, color: t.textTertiary, margin: '6px 0 0' }}>未指定路径时，默认输出到桌面的 Wallpaper_Output 文件夹</p>
                  </div>
                </div>

                <div style={{ height: 1, background: t.border, margin: '0 0 20px' }} />

                {/* 删除冗余文件 */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px', borderRadius: 10,
                  background: autoCleanup ? (t.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)') : (t.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
                  border: `1px solid ${t.border}`, transition: 'background 0.2s',
                }}>
                  <div>
                    <div style={{ fontSize: 12, color: t.text, fontWeight: 500 }}>删除冗余文件</div>
                    <div style={{ fontSize: 10, color: t.textTertiary, marginTop: 2 }}>解压后清理 .json/.tex/.pkg 等非媒体文件</div>
                  </div>
                  <div
                    onClick={() => setAutoCleanup(!autoCleanup)}
                    style={{
                      width: 40, height: 22, borderRadius: 11, cursor: 'pointer', flexShrink: 0,
                      background: autoCleanup ? (t.mode === 'dark' ? '#fff' : '#111') : (t.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'),
                      transition: 'background 0.2s', position: 'relative',
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%', background: autoCleanup ? (t.mode === 'dark' ? '#111' : '#fff') : '#fff',
                      position: 'absolute', top: 2,
                      left: autoCleanup ? 20 : 2,
                      transition: 'left 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                  </div>
                </div>

          </DraggablePanel>
        )}

        {/* MPKG 管理弹窗 */}
        {showMPKG && (
          <MPKGManager theme={t} onClose={() => setShowMPKG(false)} onToast={addToast} wallpaperDir={wallpaperDir} useCustomOutput={useCustomOutput} outputDir={outputDir} defaultOutputDir={defaultOutputDir} autoCleanup={autoCleanup} />
        )}

        {/* Toast 通知弹窗 */}
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          display: 'flex', flexDirection: 'column-reverse', gap: 8,
          pointerEvents: 'none',
        }}>
          {toasts.map((toast) => {
            const icon = toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ'
            const accent = toast.type === 'success'
              ? (t.mode === 'dark' ? '#fff' : '#111')
              : toast.type === 'error' ? '#f87171' : t.text
            const iconColor = toast.type === 'success'
              ? (t.mode === 'dark' ? '#111' : '#fff')
              : '#fff'
            return (
              <div key={toast.id} className={toast.exiting ? 'toast-exit' : 'toast-enter'} style={{
                pointerEvents: 'auto',
                width: 360,
                padding: '10px 16px',
                borderRadius: 10,
                background: t.mode === 'dark' ? 'rgba(24,24,28,0.96)' : 'rgba(255,255,255,0.96)',
                border: `1px solid ${t.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                display: 'flex', alignItems: 'center', gap: 10,
                boxShadow: t.mode === 'dark'
                  ? '0 4px 24px rgba(0,0,0,0.4)'
                  : '0 4px 24px rgba(0,0,0,0.08)',
              }}>
                <span style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  background: accent, color: iconColor,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, lineHeight: 1, paddingBottom: 1,
                }}>{icon}</span>
                <span style={{
                  fontSize: 13, lineHeight: 1.5, color: t.text,
                  wordBreak: 'break-all',
                }}>{toast.message}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ==========================================
// 网格卡片
// ==========================================

function GridCard({
  wallpaper: wp, previewSrc, loaded, multiSelectMode, isChecked, onClick, onContextMenu, theme: t,
}: {
  wallpaper: WallpaperInfo
  previewSrc: string | null
  loaded: boolean
  multiSelectMode: boolean
  isChecked: boolean
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
  theme: Theme
}) {
  const badge = TYPE_BADGE[wp.type.toLowerCase()] ?? { label: wp.type, bg: t.badgeDefaultBg, text: t.badgeDefaultText, icon: <FileArchive size={10} /> }

  return (
    <div
      data-flip-id={wp.id}
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={{
        position: 'relative', cursor: 'pointer', overflow: 'hidden',
        background: t.cardEmpty, aspectRatio: '1/1',
        outline: isChecked ? '2px solid #111' : 'none',
        outlineOffset: -2,
        transition: 'background 0.3s',
        contain: 'size layout paint',
        contentVisibility: 'auto',
      }}
    >
      {previewSrc ? (
        <img
          src={previewSrc}
          alt={wp.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.4s ease', willChange: 'transform' }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.transform = 'scale(1.03)' }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.transform = 'scale(1)' }}
        />
      ) : loaded ? (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textMuted }}>
          <ImageIcon size={28} strokeWidth={1} />
        </div>
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 size={18} className="animate-spin" style={{ color: t.textMuted }} />
        </div>
      )}

      {/* 底部名字条 */}
      <div
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          display: 'flex', alignItems: 'center',
          background: 'linear-gradient(to top, rgba(0,0,0,0.52) 0%, rgba(0,0,0,0.18) 60%, rgba(0,0,0,0) 100%)',
          padding: '18px 10px 7px',
        }}
      >
        <p style={{
          color: '#fff', fontSize: 11, fontWeight: 500, lineHeight: 1.3, margin: 0, fontFamily: t.headingFamily,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%',
          textShadow: '0 1px 3px rgba(0,0,0,0.4)',
          letterSpacing: '0',
        }}>
          {wp.title}
        </p>
      </div>

      {/* 类型角标 */}
      <span style={{
        position: 'absolute', top: 10, left: 10,
        fontSize: 11, fontWeight: 600, color: '#fff',
        textShadow: '0 1px 4px rgba(0,0,0,0.5)',
        fontFamily: t.headingFamily,
      }}>
        {badge.label}
      </span>

      {/* 多选复选框 */}
      {multiSelectMode && (
        <div style={{
          position: 'absolute', top: 8, right: 8, zIndex: 2,
          width: 22, height: 22, borderRadius: '50%',
          border: isChecked ? 'none' : '1.5px solid rgba(255,255,255,0.7)',
          background: isChecked ? '#111' : 'rgba(0,0,0,0.25)',
          backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s ease',
          boxShadow: isChecked ? '0 2px 10px rgba(255,255,255,0.25)' : '0 1px 4px rgba(0,0,0,0.2)',
        }}>
          {isChecked && (
            <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
              <path d="M1 4.5L4 7.5L10 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      )}
    </div>
  )
}

// ==========================================
// 右侧详情面板
// ==========================================

function DetailPanel({
  wallpaper: wp, previewSrc, outputDir, isRunning, extractStatus, files, stats, theme: t,
  onClose, onExtract, onToast, multiSelectMode, selectedCount,
}: {
  wallpaper: WallpaperInfo
  previewSrc: string | null
  outputDir: string
  isRunning: boolean
  extractStatus: string
  files: ExtractedFile[]
  stats: { videos: number; images: number; configs: number; sources: number }
  theme: Theme
  onClose: () => void
  onExtract: () => void
  onToast: (message: string, type: 'info' | 'success' | 'error') => void
  multiSelectMode: boolean
  selectedCount: number
}) {
  const badge = TYPE_BADGE[wp.type.toLowerCase()] ?? { label: wp.type, bg: t.badgeDefaultBg, text: t.badgeDefaultText, icon: <FileArchive size={11} /> }

  // ESC 关闭
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  // 复制 MP4 / PNG（与多选筛选栏逻辑一致）
  const handleCopyMP4 = async () => {
    if (!wp.hasMP4) return
    try {
      await window.wallpeel.batchCopy({
        files: [{ source: wp.mp4Path, target: wp.title + '\\' + wp.mp4Path.split('\\').pop() }],
        outputDir: outputDir,
      })
      onToast('MP4 复制完成', 'success')
    } catch {
      onToast('MP4 复制失败', 'error')
    }
  }

  const handleCopyPNG = async () => {
    if (!wp.hasPNG) return
    try {
      await window.wallpeel.batchCopy({
        files: [{ source: wp.pngPath, target: wp.title + '\\' + wp.pngPath.split('\\').pop() }],
        outputDir: outputDir,
      })
      onToast('图片复制完成', 'success')
    } catch {
      onToast('图片复制失败', 'error')
    }
  }

  const FilePill = ({ ok, label }: { ok: boolean; label: string }) => (
    <span style={{
      fontSize: 12, fontWeight: 500,
      color: ok ? '#16a34a' : t.textTertiary,
    }}>
      {label}
    </span>
  )

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 12,
      border: `1px solid ${t.border}`, background: t.contentBg, boxShadow: t.contentShadow, overflow: 'hidden', transition: 'background 0.3s, border-color 0.3s',
    }}>
      {/* 头部：角标 + 关闭 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 0', flexShrink: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: t.text, fontFamily: t.headingFamily }}>
          {badge.label}壁纸
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', color: t.textTertiary,
            width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 6, transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = t.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          <X size={14} />
        </button>
      </div>

      {/* 大图 */}
      <div style={{ margin: '12px auto 0', width: 300, height: 300, borderRadius: 10, overflow: 'hidden', background: t.inputBg, transition: 'background 0.3s', flexShrink: 0 }}>
        {previewSrc ? (
          <img src={previewSrc} alt={wp.title} style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textMuted }}>
            <ImageIcon size={36} strokeWidth={1} />
          </div>
        )}
      </div>

      {/* 下方可滚动内容 */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>

      {/* 信息 */}
      <div style={{ padding: '16px 16px 0' }}>
        <h2 style={{ fontSize: 16, fontFamily: t.headingFamily, fontWeight: 600, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.3, transition: 'font-family 0.3s' }}>{wp.title}</h2>
        <p style={{ fontSize: 11, color: t.textTertiary, marginTop: 8, transition: 'color 0.3s' }}>ID: {wp.id} · {formatSize(wp.fileSize)}</p>
      </div>

      {/* 文件信息 */}
      <div style={{ margin: '16px 16px 0', padding: '16px 18px', borderRadius: 12, background: t.mode === 'dark' ? 'linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0.08))' : 'linear-gradient(135deg, rgba(255,255,255,0.85), rgba(250,250,252,0.6))', backdropFilter: 'blur(12px) saturate(1.4)', WebkitBackdropFilter: 'blur(12px) saturate(1.4)', border: `1px solid ${t.mode === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.07)'}`, boxShadow: t.mode === 'dark' ? 'inset 0 0.5px 0 rgba(255,255,255,0.06)' : '0 2px 12px rgba(0,0,0,0.05), inset 0 0.5px 0 rgba(255,255,255,0.7)', transition: 'all 0.3s' }}>
        <h4 style={{ fontSize: 10, color: t.textTertiary, letterSpacing: '1.5px', textTransform: 'uppercase', margin: '0 0 10px', fontWeight: 600 }}>文件信息</h4>
        {[
          { label: 'MP4 视频', ok: wp.hasMP4, text: wp.hasMP4 ? formatSize(wp.mp4Size) : '无' },
          { label: 'PKG 包', ok: wp.hasPKG, text: wp.hasPKG ? formatSize(wp.pkgSize) : '无' },
          { label: 'MPKG 包', ok: wp.hasMPKG, text: wp.hasMPKG ? formatSize(wp.mpkgSize) : '无' },
          { label: 'PNG 图片', ok: wp.hasPNG, text: wp.hasPNG ? formatSize(wp.pngSize) : '无' },
          { label: '预览图', ok: wp.hasPreview, text: wp.hasPreview ? '有' : '无' },
        ].map((row, i, arr) => (
          <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < arr.length - 1 ? `1px solid ${t.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)'}` : 'none' }}>
            <span style={{ fontSize: 12, color: t.text, fontWeight: 500 }}>{row.label}</span>
            <FilePill ok={row.ok} label={row.text} />
          </div>
        ))}
      </div>

      {/* 操作按钮 */}
      <div style={{ margin: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          onClick={onExtract}
          disabled={isRunning}
          style={{
            width: '100%', padding: 10, borderRadius: 12, fontSize: 13, fontWeight: 500,
            background: t.btnActiveBg, color: t.btnActiveText, border: 'none',
            cursor: 'pointer', transition: 'all 0.2s', letterSpacing: '0.5px',
            opacity: isRunning ? 0.5 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          {isRunning ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
          {isRunning ? '提取中...' : (multiSelectMode && selectedCount > 1 ? `批量提取 (${selectedCount})` : '开始提取')}
        </button>
        <button onClick={() => window.wallpeel.openWallpaperDir(wp.previewPath || wp.filePath)} style={{
          width: '100%', padding: 8, borderRadius: 12, fontSize: 12, fontWeight: 400,
          background: 'transparent', color: t.text, border: `1px solid ${t.mode === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.07)'}`,
          cursor: 'pointer', transition: 'all 0.15s',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        }}>
          <ExternalLink size={12} /> 壁纸目录
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          {wp.hasMP4 && (
            <button onClick={handleCopyMP4} style={{
              flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              padding: '8px 10px', borderRadius: 12, fontSize: 12, fontWeight: 500,
              border: `1px solid ${t.mode === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.07)'}`, background: 'transparent', color: t.text,
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
              <FileVideo size={12} /> 复制 MP4
            </button>
          )}
          {wp.hasPNG && (
            <button onClick={handleCopyPNG} style={{
              flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              padding: '8px 10px', borderRadius: 12, fontSize: 12, fontWeight: 500,
              border: `1px solid ${t.mode === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.07)'}`, background: 'transparent', color: t.text,
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
              <FileImage size={12} /> 复制图片
            </button>
          )}
        </div>
      </div>

      {/* 提取状态 */}
      {extractStatus && (
        <div style={{ margin: '12px 16px 0', display: 'flex', alignItems: 'center', gap: 4 }}>
          {extractStatus === '提取完成' && <CheckCircle2 size={13} color="#16a34a" />}
          <span style={{ fontSize: 12, color: t.textSecondary }}>{extractStatus}</span>
        </div>
      )}

      {/* 提取结果 */}
      {files.length > 0 && (
        <div style={{ padding: '12px 16px 0' }}>
          <h3 style={{ fontSize: 12, fontFamily: t.headingFamily, fontWeight: 600, margin: '0 0 8px' }}>提取结果</h3>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <StatPill label="视频" count={stats.videos} color="#3b82f6" />
            <StatPill label="图片" count={stats.images} color="#16a34a" />
            <StatPill label="配置" count={stats.configs} color="#ca8a04" />
            <StatPill label="源文件" count={stats.sources} color="#888" />
          </div>
          <div style={{ marginTop: 8, maxHeight: 120, overflowY: 'auto', borderRadius: 8, background: t.fileBg, border: `1px solid ${t.fileBorder}`, padding: 8, transition: 'all 0.3s' }}>
            {files.slice(0, 40).map((f) => (
              <div key={f.path} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `1px solid ${t.fileBorder}`, fontSize: 10 }}>
                <span style={{ color: t.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{f.name}</span>
                <span style={{ color: t.textTertiary, flexShrink: 0, marginLeft: 8 }}>{formatSize(f.size)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 日志已通过 Toast 通知展示 */}

      <div style={{ height: 20, flexShrink: 0 }} />
      </div>
    </div>
  )
}

// ==========================================
// 统计小药丸
// ==========================================

function StatPill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 20, fontSize: 11,
      background: `${color}10`, color,
    }}>
      {label} {count}
    </span>
  )
}

// ==========================================
// 右键菜单
// ==========================================

function ContextMenu({
  x, y, wallpaper: wp, previewSrc, theme: t, onClose, onViewDetail, onOpenDir, onEnterMultiSelect,
}: {
  x: number; y: number; wallpaper: WallpaperInfo; previewSrc: string | null; theme: Theme
  onClose: () => void; onViewDetail: (wp: WallpaperInfo) => void
  onOpenDir: (filePath: string) => void; onEnterMultiSelect: (id: string) => void
}) {
  useEffect(() => {
    const h = () => onClose()
    const kh = (e: KeyboardEvent) => { if (e.key === 'Escape') h() }
    window.addEventListener('click', h)
    window.addEventListener('keydown', kh)
    return () => { window.removeEventListener('click', h); window.removeEventListener('keydown', kh) }
  }, [onClose])

  const [copied, setCopied] = useState<string | null>(null)

  const itemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 14px', fontSize: 12, color: t.text, cursor: 'pointer',
    borderRadius: 6, margin: '2px 4px', transition: 'background 0.1s',
  }

  const handleCopyPreview = async () => {
    if (!previewSrc) return
    // 从壁纸文件路径推导出预览图路径
    const wpDir = wp.filePath.substring(0, wp.filePath.lastIndexOf('\\'))
    // 尝试 jpg、png、gif 三种格式
    const extensions = ['preview.jpg', 'preview.png', 'preview.gif']
    for (const ext of extensions) {
      const previewPath = wpDir + '\\' + ext
      try {
        const result = await window.wallpeel.copyImageToClipboard(previewPath)
        if (result) {
          setCopied('preview')
          setTimeout(() => setCopied(null), 1500)
          return
        }
      } catch {
        // 继续尝试下一个格式
      }
    }
    console.error('复制预览图失败：未找到预览图文件')
  }

  const handleCopyPath = async () => {
    const wpDir = wp.filePath.substring(0, wp.filePath.lastIndexOf('\\'))
    await navigator.clipboard.writeText(wpDir)
    setCopied('path')
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div onClick={(e) => e.stopPropagation()} style={{
      position: 'fixed', left: x, top: y, zIndex: 100,
      background: t.modalBg, borderRadius: 10,
      boxShadow: t.modalShadow, padding: '4px 0', minWidth: 180,
    }}>
      <div style={itemStyle} onClick={() => { onViewDetail(wp); onClose() }}
        onMouseEnter={(e) => { e.currentTarget.style.background = t.filterBg }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
        <FileArchive size={14} /> 查看详情
      </div>
      <div style={itemStyle} onClick={() => { onOpenDir(wp.filePath); onClose() }}
        onMouseEnter={(e) => { e.currentTarget.style.background = t.filterBg }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
        <FolderOpen size={14} /> 打开本地目录
      </div>

      <div style={{ height: 1, background: t.border, margin: '4px 8px' }} />

      <div style={itemStyle} onClick={() => { onEnterMultiSelect(wp.id); onClose() }}
        onMouseEnter={(e) => { e.currentTarget.style.background = t.filterBg }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
        <CheckSquare size={14} /> 多选
      </div>
      <div style={itemStyle} onClick={handleCopyPreview}
        onMouseEnter={(e) => { e.currentTarget.style.background = t.filterBg }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
        {copied === 'preview' ? <CheckCircle2 size={14} color="#16a34a" /> : <FileImage size={14} />}
        {copied === 'preview' ? '已复制' : '复制预览图'}
      </div>
      <div style={itemStyle} onClick={handleCopyPath}
        onMouseEnter={(e) => { e.currentTarget.style.background = t.filterBg }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
        {copied === 'path' ? <CheckCircle2 size={14} color="#16a34a" /> : <FileArchive size={14} />}
        {copied === 'path' ? '已复制' : '复制路径'}
      </div>
    </div>
  )
}

// ==========================================
// MPKG 管理器
// ==========================================

function MPKGManager({ theme: t, onClose, onToast, wallpaperDir, useCustomOutput, outputDir, defaultOutputDir, autoCleanup }: { theme: Theme; onClose: () => void; onToast: (msg: string, type: 'info' | 'success' | 'error') => void; wallpaperDir: string; useCustomOutput: boolean; outputDir: string; defaultOutputDir: string; autoCleanup: boolean }) {
  const [mpkgDir, setMpkgDir] = useState(() => localStorage.getItem('we-mpkg-dir') || '')
  useEffect(() => { localStorage.setItem('we-mpkg-dir', mpkgDir) }, [mpkgDir])
  const [scanResult, setScanResult] = useState<any>(null)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [actionStatus, setActionStatus] = useState('')

  const handleScan = async () => {
    if (!mpkgDir) return
    setActionStatus('')
    setLoading(true)
    try {
      const result = await window.wallpeel.scanMPKG({
        mpkgDir, wallpaperDir: wallpaperDir || '',
      })
      setScanResult(result)
      setSelectedFiles(new Set(result.files.filter((f: any) => f.matched).map((f: any) => f.mpkgFile)))
      const matched = result.files.filter((f: any) => f.matched).length
      onToast(`扫描完成，找到 ${matched} 个匹配文件`, 'success')
    } catch (e) {
      setActionStatus('扫描失败: ' + String(e))
      onToast('MPKG 扫描失败', 'error')
    }
    setLoading(false)
  }

  const handleCopy = async () => {
    if (!scanResult) return
    const files = scanResult.files
      .filter((f: any) => selectedFiles.has(f.mpkgFile))
      .map((f: any) => ({ mpkgPath: f.mpkgPath, targetDir: f.wpDir }))
    setActionStatus('正在复制...')
    const res = await window.wallpeel.copyMPKG({ files })
    setActionStatus(`复制完成: ${res.copied} 个`)
    onToast(`复制完成: ${res.copied} 个`, 'success')
  }

  const handleExtract = async () => {
    if (!scanResult) return
    const files = scanResult.files
      .filter((f: any) => selectedFiles.has(f.mpkgFile))
      .map((f: any) => ({ mpkgPath: f.mpkgPath, wpDir: f.wpDir, wpTitle: f.wpTitle }))
    setActionStatus('正在解压提取...')
    // 使用设置中的输出路径（如果有启用）
    const out = (useCustomOutput && outputDir) ? outputDir : defaultOutputDir
    const res = await window.wallpeel.extractMPKG({ files, outputDir: out })
    const ok = res.results.filter((r: any) => r.success).length

    // 如果启用了删除冗余文件，清理壁纸目录
    if (autoCleanup) {
      setActionStatus('正在清理冗余文件...')
      for (const file of files) {
        try {
          await window.wallpeel.cleanupWallpaperDir(file.wpDir)
        } catch (e) {
          console.warn('清理失败:', e)
        }
      }
    }

    setActionStatus(`提取完成: ${ok}/${res.results.length} 成功`)
    onToast(`提取完成: ${ok}/${res.results.length} 成功`, ok === res.results.length ? 'success' : 'info')
  }

  const toggleFile = (name: string) => {
    setActionStatus('')
    setSelectedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name); else next.add(name)
      return next
    })
  }

  const toggleAll = () => {
    if (!scanResult) return
    setActionStatus('')
    if (selectedFiles.size === scanResult.files.length) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(scanResult.files.map((f: any) => f.mpkgFile)))
    }
  }

  const inputStyle: React.CSSProperties = {
    flex: 1, border: `1px solid ${t.inputBorder}`, borderRadius: 8, background: t.inputBg,
    padding: '7px 10px', fontSize: 12, outline: 'none', color: t.text, transition: 'border-color 0.15s',
  }
  const btnStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
    border: `1px solid ${t.btnBorder}`, background: t.btnBg, color: t.text,
    cursor: 'pointer', transition: 'all 0.15s',
  }
  const primaryBtn: React.CSSProperties = {
    ...btnStyle, background: t.btnActiveBg, color: t.btnActiveText, border: 'none',
  }

  return (
    <DraggablePanel width={460} height="75vh" theme={t} onClose={onClose}
      title={<><Package size={15} style={{ marginRight: 6, verticalAlign: -2 }} />MPKG 管理</>}
    >
          {/* MPKG 目录选择 */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: t.textTertiary, display: 'block', marginBottom: 6 }}>MPKG 目录</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={mpkgDir} onChange={(e) => setMpkgDir(e.target.value)} placeholder="选择 MPKG 文件所在目录..." style={inputStyle} />
              <button onClick={async () => { const d = await window.wallpeel.selectFolder(); if (d) setMpkgDir(d) }} style={btnStyle}>
                <FolderOpen size={13} /> 浏览
              </button>
              <button onClick={handleScan} disabled={loading || !mpkgDir} style={primaryBtn}>
                {loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />} 扫描
              </button>
            </div>
          </div>

          {/* 扫描结果 */}
          {scanResult && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: t.textSecondary }}>
                  共 <strong>{scanResult.total}</strong> 个，匹配 <strong style={{ color: '#16a34a' }}>{scanResult.matched}</strong> 个，未匹配 <strong style={{ color: '#dc2626' }}>{scanResult.unmatched}</strong> 个
                </span>
              </div>
              <div style={{ borderRadius: 10, border: `1px solid ${t.border}`, overflow: 'hidden', maxHeight: 260, overflowY: 'auto' }}>
                {scanResult.files.map((f: any) => (
                  <div
                    key={f.mpkgFile}
                    onClick={() => f.matched && toggleFile(f.mpkgFile)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                      borderBottom: `1px solid ${t.border}`, cursor: f.matched ? 'pointer' : 'default',
                      background: selectedFiles.has(f.mpkgFile) ? (t.mode === 'dark' ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.04)') : 'transparent',
                      transition: 'background 0.1s',
                    }}
                  >
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%', flexShrink: 0, transition: 'all 0.2s ease',
                      border: selectedFiles.has(f.mpkgFile) ? 'none' : `1.5px solid ${t.border}`,
                      background: selectedFiles.has(f.mpkgFile) ? '#111' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: selectedFiles.has(f.mpkgFile) ? '0 2px 10px rgba(255,255,255,0.25)' : 'none',
                    }}>
                      {selectedFiles.has(f.mpkgFile) && (
                        <svg width="10" height="8" viewBox="0 0 11 9" fill="none">
                          <path d="M1 4.5L4 7.5L10 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: t.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.mpkgFile}</span>
                    <span style={{ fontSize: 10, color: t.textTertiary, flexShrink: 0 }}>{formatSize(f.mpkgSize)}</span>
                    <span style={{ fontSize: 10, color: f.matched ? '#16a34a' : '#dc2626', flexShrink: 0 }}>{f.matched ? '已匹配' : '未匹配'}</span>
                    {f.alreadyHasMP4 && <span style={{ fontSize: 10, color: t.textTertiary, flexShrink: 0 }}>已有MP4</span>}
                    {f.matched && (
                      <button
                        onClick={(e) => { e.stopPropagation(); window.wallpeel.openWallpaperDir(f.wpDir) }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: 24, height: 24, borderRadius: 6, border: 'none',
                          background: 'transparent', color: t.textTertiary, cursor: 'pointer',
                          transition: 'all 0.15s', flexShrink: 0,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = t.filterBg; e.currentTarget.style.color = t.text }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = t.textTertiary }}
                      >
                        <FolderOpen size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* 选择操作 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <button onClick={toggleAll} style={{ ...btnStyle, padding: '4px 10px', fontSize: 11 }}>
                  {selectedFiles.size === scanResult.files.length ? '取消全选' : '全选'}
                </button>
                <span style={{ fontSize: 11, color: t.textTertiary }}>已选 {selectedFiles.size} 个</span>
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
            <button onClick={handleCopy} disabled={!scanResult || selectedFiles.size === 0} style={btnStyle}>
              <FolderOpen size={13} /> 复制到文件夹
            </button>
            <button onClick={handleExtract} disabled={!scanResult || selectedFiles.size === 0} style={primaryBtn}>
              <Package size={13} /> 解压并提取
            </button>
          </div>

          {/* 提示 */}
          <p style={{ fontSize: 10, color: t.textTertiary, marginTop: 12 }}>
            💡 解压文件将保存到壁纸原始目录，如有设置输出路径则同时复制有用文件
          </p>

          {/* 状态 */}
          {actionStatus && (
            <div style={{ marginTop: 12, fontSize: 12, color: t.textSecondary }}>{actionStatus}</div>
          )}
    </DraggablePanel>
  )
}

export default App
