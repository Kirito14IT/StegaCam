# StegaCam 开发环境一键启动脚本
# 功能：检查端口、启动MySQL、启动服务器、启动frpc内网穿透、启动前端Expo服务器

param(
    [int]$ServerPort = 8080,
    [int]$FrpcPort = 7000,
    [string]$FrpcConfig = "frp_0.64.0_windows_amd64\frpc.toml",
    [switch]$StartFrontend = $false,
    [switch]$SkipDbCheck = $false
)

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  StegaCam 开发环境启动脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查并获取项目根目录
$ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptPath
Write-Host "[1/7] 项目目录: $ScriptPath" -ForegroundColor Green

# 检测Python和conda环境
Write-Host "[2/7] 检测Python环境..." -ForegroundColor Yellow
$pythonCmd = "python"
$condaEnv = $env:CONDA_DEFAULT_ENV

# 检查是否在conda环境中
if ($condaEnv) {
    Write-Host "  当前conda环境: $condaEnv" -ForegroundColor Green
    $pythonCmd = "python"  # conda环境中的python
} else {
    Write-Host "  未检测到conda环境，使用系统Python" -ForegroundColor Yellow
    Write-Host "  提示: 建议在conda环境中运行: conda activate stega-tf210" -ForegroundColor Yellow
}

# 检查Python是否可用
try {
    $pythonVersion = & $pythonCmd --version 2>&1
    Write-Host "  Python版本: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "  错误: 无法执行Python命令" -ForegroundColor Red
    exit 1
}

# 检查关键依赖
Write-Host "  检查Python依赖..." -ForegroundColor Yellow
$deps = @("sqlalchemy", "fastapi", "uvicorn", "pymysql")
$missingDeps = @()
foreach ($dep in $deps) {
    $check = & $pythonCmd -c "import $dep" 2>&1
    if ($LASTEXITCODE -ne 0) {
        $missingDeps += $dep
    }
}
if ($missingDeps.Count -gt 0) {
    Write-Host "  警告: 缺少以下依赖: $($missingDeps -join ', ')" -ForegroundColor Red
    Write-Host "  请运行: pip install $($missingDeps -join ' ')" -ForegroundColor Yellow
    if (-not $SkipDbCheck) {
        $continue = Read-Host "  是否继续? (y/n)"
        if ($continue -ne 'y' -and $continue -ne 'Y') {
            exit 1
        }
    }
} else {
    Write-Host "  依赖检查通过" -ForegroundColor Green
}

# 检查端口占用
function Test-Port {
    param([int]$Port)
    $connection = Test-NetConnection -ComputerName localhost -Port $Port -InformationLevel Quiet -WarningAction SilentlyContinue 2>$null
    return $connection
}

# 检查服务器端口
Write-Host "[3/7] 检查端口占用..." -ForegroundColor Yellow
if (Test-Port -Port $ServerPort) {
    Write-Host "  警告: 端口 $ServerPort 已被占用" -ForegroundColor Yellow
    $kill = Read-Host "  是否尝试终止占用该端口的进程? (y/n)"
    if ($kill -eq 'y' -or $kill -eq 'Y') {
        try {
            $process = Get-NetTCPConnection -LocalPort $ServerPort -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -First 1
            if ($process) {
                Stop-Process -Id $process -Force
                Write-Host "  已终止占用端口 $ServerPort 的进程" -ForegroundColor Green
                Start-Sleep -Seconds 2
            }
        } catch {
            Write-Host "  无法终止进程，请手动处理" -ForegroundColor Red
        }
    }
}

# 检查MySQL服务
Write-Host "[4/7] 检查MySQL服务..." -ForegroundColor Yellow
$mysqlService = Get-Service -Name "MySQL*" -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'Running' }
if (-not $mysqlService) {
    Write-Host "  尝试启动MySQL服务..." -ForegroundColor Yellow
    try {
        $mysqlServices = Get-Service -Name "MySQL*" -ErrorAction SilentlyContinue
        if ($mysqlServices) {
            $mysqlService = $mysqlServices[0]
            Start-Service -Name $mysqlService.Name
            Write-Host "  MySQL服务已启动: $($mysqlService.Name)" -ForegroundColor Green
            Start-Sleep -Seconds 3
        } else {
            Write-Host "  警告: 未找到MySQL服务，请确保MySQL已安装并运行" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  无法启动MySQL服务: $_" -ForegroundColor Red
        Write-Host "  请手动启动MySQL服务后继续" -ForegroundColor Yellow
    }
} else {
    Write-Host "  MySQL服务运行中: $($mysqlService.Name)" -ForegroundColor Green
}

# 检查数据库连接
Write-Host "[5/7] 检查数据库连接..." -ForegroundColor Yellow
if (-not $SkipDbCheck) {
    try {
        $dbCheck = & $pythonCmd -c "from server.app.database import engine; from sqlalchemy import text; conn = engine.connect(); result = conn.execute(text('SELECT 1')); print('OK'); conn.close()" 2>&1
        if ($dbCheck -match "OK") {
            Write-Host "  数据库连接成功" -ForegroundColor Green
        } else {
            Write-Host "  数据库连接失败，请检查配置" -ForegroundColor Red
            Write-Host "  错误信息: $($dbCheck -join ' ')" -ForegroundColor Red
            Write-Host "  提示: 使用 -SkipDbCheck 参数跳过数据库检查" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  无法检查数据库连接: $_" -ForegroundColor Yellow
    }
} else {
    Write-Host "  跳过数据库连接检查" -ForegroundColor Yellow
}

# 初始化数据库表（如果需要）
Write-Host "[6/7] 检查数据库表..." -ForegroundColor Yellow
try {
    & $pythonCmd server/init_db.py 2>&1 | Out-Null
    Write-Host "  数据库表检查完成" -ForegroundColor Green
} catch {
    Write-Host "  数据库表初始化失败，但继续执行" -ForegroundColor Yellow
}

# 启动服务器
Write-Host "[7/7] 启动FastAPI服务器..." -ForegroundColor Yellow

# 创建启动脚本
$serverScript = @"
import sys
import os
sys.path.insert(0, r'$ScriptPath')
os.chdir(r'$ScriptPath')
os.environ['PYTHONPATH'] = r'$ScriptPath'

import uvicorn
uvicorn.run('server.app.server:app', host='0.0.0.0', port=$ServerPort, reload=True)
"@

$serverScriptPath = Join-Path $env:TEMP "start_server_$(Get-Random).py"
$serverScript | Out-File -FilePath $serverScriptPath -Encoding utf8

$serverJob = Start-Job -ScriptBlock {
    param($pythonCmd, $scriptPath)
    Set-Location (Split-Path -Parent $scriptPath)
    & $pythonCmd $scriptPath 2>&1
} -ArgumentList $pythonCmd, $serverScriptPath

Start-Sleep -Seconds 8

# 检查服务器是否启动成功
$maxRetries = 5
$retryCount = 0
$serverRunning = $false

while ($retryCount -lt $maxRetries -and -not $serverRunning) {
    $serverRunning = Test-Port -Port $ServerPort
    if (-not $serverRunning) {
        $retryCount++
        Start-Sleep -Seconds 2
    }
}

if ($serverRunning) {
    Write-Host "  FastAPI服务器已启动: http://localhost:$ServerPort" -ForegroundColor Green
    Write-Host "  API文档: http://localhost:$ServerPort/docs" -ForegroundColor Cyan
} else {
    Write-Host "  警告: 服务器可能未成功启动" -ForegroundColor Yellow
    Write-Host "  正在检查服务器日志..." -ForegroundColor Yellow
    $serverOutput = Receive-Job $serverJob -ErrorAction SilentlyContinue
    if ($serverOutput) {
        Write-Host "  服务器输出（最后20行）:" -ForegroundColor Yellow
        $serverOutput[-20..-1] | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
    }
    Write-Host "  提示: 可以手动运行查看详细错误: $pythonCmd -m uvicorn server.app.server:app --host 0.0.0.0 --port $ServerPort" -ForegroundColor Yellow
}

# 启动frpc（如果存在）
if (Test-Path $FrpcConfig) {
    Write-Host ""
    Write-Host "[可选] 启动frpc内网穿透..." -ForegroundColor Yellow
    $frpcPath = Join-Path $ScriptPath (Split-Path -Parent $FrpcConfig)
    $frpcExe = Join-Path $frpcPath "frpc.exe"
    
    if (Test-Path $frpcExe) {
        $frpcJob = Start-Job -ScriptBlock {
            param($exe, $config)
            Set-Location (Split-Path -Parent $exe)
            & $exe -c $config
        } -ArgumentList $frpcExe, (Join-Path $ScriptPath $FrpcConfig)
        
        Start-Sleep -Seconds 2
        Write-Host "  frpc已启动" -ForegroundColor Green
    } else {
        Write-Host "  未找到frpc.exe，跳过内网穿透" -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "[可选] 未找到frpc配置文件，跳过内网穿透" -ForegroundColor Yellow
}

# 启动前端Expo服务器（可选）
$frontendJob = $null
if ($StartFrontend) {
    Write-Host ""
    Write-Host "[可选] 启动前端Expo服务器..." -ForegroundColor Yellow
    $clientPath = Join-Path $ScriptPath "client"
    if (Test-Path $clientPath) {
        $frontendJob = Start-Job -ScriptBlock {
            param($clientPath)
            Set-Location $clientPath
            npm start
        } -ArgumentList $clientPath
        Start-Sleep -Seconds 3
        Write-Host "  Expo服务器已启动，终端会显示二维码" -ForegroundColor Green
        Write-Host "  提示: 使用Expo Go应用扫描二维码" -ForegroundColor Cyan
    } else {
        Write-Host "  未找到client目录，跳过前端启动" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  启动完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "后端服务器: http://localhost:$ServerPort" -ForegroundColor Cyan
Write-Host "API文档: http://localhost:$ServerPort/docs" -ForegroundColor Cyan
if ($StartFrontend) {
    Write-Host ""
    Write-Host "前端Expo服务器已启动，请查看另一个终端窗口的二维码" -ForegroundColor Green
    Write-Host "或运行: cd client && npm start" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "按 Ctrl+C 停止所有服务" -ForegroundColor Yellow
Write-Host ""
Write-Host "提示: 使用 -StartFrontend 参数同时启动前端服务器" -ForegroundColor Gray
Write-Host ""

# 等待用户中断
try {
    while ($true) {
        Start-Sleep -Seconds 1
        # 检查服务器是否还在运行
        if (-not (Test-Port -Port $ServerPort)) {
            Write-Host "服务器已停止" -ForegroundColor Red
            break
        }
    }
} finally {
    # 清理
    Write-Host ""
    Write-Host "正在停止服务..." -ForegroundColor Yellow
    if ($serverJob) {
        Stop-Job $serverJob -ErrorAction SilentlyContinue
        Remove-Job $serverJob -ErrorAction SilentlyContinue
    }
    if ($frpcJob) {
        Stop-Job $frpcJob -ErrorAction SilentlyContinue
        Remove-Job $frpcJob -ErrorAction SilentlyContinue
    }
    if ($frontendJob) {
        Stop-Job $frontendJob -ErrorAction SilentlyContinue
        Remove-Job $frontendJob -ErrorAction SilentlyContinue
    }
    Write-Host "服务已停止" -ForegroundColor Green
}

