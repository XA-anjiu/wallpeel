; installer.nsh — 自定义安装目录逻辑
; 默认安装到 D:\Wallpeel，用户可在安装向导中手动更改

!macro customInit
  ; 仅在用户未手动指定安装路径时生效
  StrCpy $INSTDIR "D:\Wallpeel"
!macroend

!macro customInstall
  ; 安装完成后可在此添加额外逻辑（如注册表、环境变量等）
!macroend
