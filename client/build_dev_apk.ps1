# 构建Android Dev版本APK脚本

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  构建 StegaCam Dev 版本 APK" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptPath

# 检查Node.js
Write-Host "[1/5] 检查Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "  Node.js版本: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  错误: 未找到Node.js，请先安装Node.js" -ForegroundColor Red
    exit 1
}

# 检查依赖
Write-Host "[2/5] 检查依赖..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "  安装依赖..." -ForegroundColor Yellow
    npm install
} else {
    Write-Host "  依赖已安装" -ForegroundColor Green
}

# 预构建（生成原生代码）
Write-Host "[3/5] 预构建原生代码..." -ForegroundColor Yellow
try {
    npx expo prebuild --platform android --clean 2>&1 | Out-Null
    Write-Host "  预构建完成" -ForegroundColor Green
} catch {
    Write-Host "  警告: 预构建可能失败，继续构建..." -ForegroundColor Yellow
}

# 构建Debug APK
Write-Host "[4/5] 构建Debug APK..." -ForegroundColor Yellow
Write-Host "  这可能需要几分钟，请耐心等待..." -ForegroundColor Gray

$androidPath = Join-Path $ScriptPath "android"
Set-Location $androidPath

try {
    # 使用Gradle构建
    if (Test-Path "gradlew.bat") {
        .\gradlew.bat assembleDebug
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  构建成功！" -ForegroundColor Green
        } else {
            Write-Host "  构建失败，退出码: $LASTEXITCODE" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "  错误: 未找到gradlew.bat" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "  构建失败: $_" -ForegroundColor Red
    exit 1
}

# 查找APK文件
Write-Host "[5/5] 查找APK文件..." -ForegroundColor Yellow
$apkPath = Join-Path $androidPath "app\build\outputs\apk\debug\app-debug.apk"

if (Test-Path $apkPath) {
    $apkInfo = Get-Item $apkPath
    $apkSize = [math]::Round($apkInfo.Length / 1MB, 2)
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  构建完成！" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "APK文件位置: $apkPath" -ForegroundColor Cyan
    Write-Host "文件大小: $apkSize MB" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "下一步:" -ForegroundColor Yellow
    Write-Host "1. 将APK文件传输到手机" -ForegroundColor White
    Write-Host "2. 在手机上安装APK" -ForegroundColor White
    Write-Host "3. 启动后端服务器: .\start_dev.ps1" -ForegroundColor White
    Write-Host "4. 启动前端Expo服务器: cd client && npm start" -ForegroundColor White
    Write-Host "5. 在应用中使用Expo Go或开发客户端连接" -ForegroundColor White
    Write-Host ""
    
    # 尝试打开文件所在文件夹
    try {
        explorer.exe /select,"$apkPath"
    } catch {
        Write-Host "提示: 可以手动打开文件夹: $($apkInfo.DirectoryName)" -ForegroundColor Gray
    }
} else {
    Write-Host "  错误: 未找到APK文件" -ForegroundColor Red
    Write-Host "  请检查构建日志" -ForegroundColor Yellow
    exit 1
}

Set-Location $ScriptPath

