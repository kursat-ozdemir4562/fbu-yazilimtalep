[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
    [Environment]::GetEnvironmentVariable('Path', 'User')
if (-not $env:Jwt__Secret -and $env:JWT_SECRET) { $env:Jwt__Secret = $env:JWT_SECRET }

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$stateDirectory = Join-Path $projectRoot '.local'
$stateFile = Join-Path $stateDirectory 'processes.json'
$logDirectory = Join-Path $projectRoot 'storage\development\logs'
$apiProject = Join-Path $projectRoot 'backend\src\FbuLabSoftware.Api\FbuLabSoftware.Api.csproj'
$frontendPath = Join-Path $projectRoot 'frontend'
$quotedApiProject = '"' + $apiProject + '"'

function Test-PortAvailable {
    param([Parameter(Mandatory)][int]$Port)
    $listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
    return $null -eq $listener
}

if (Test-Path -LiteralPath $stateFile) {
    $savedState = Get-Content -Raw -LiteralPath $stateFile | ConvertFrom-Json
    $running = @(@($savedState.backendPid, $savedState.frontendPid) | Where-Object {
        Get-Process -Id $_ -ErrorAction SilentlyContinue
    })
    if ($running.Count -gt 0) {
        throw 'Bu projeye ait bir yerel çalışma oturumu zaten açık. Önce .\scripts\stop-local.ps1 çalıştırın.'
    }
    Remove-Item -LiteralPath $stateFile -Force
}

foreach ($port in @(5173, 7000, 7001)) {
    if (-not (Test-PortAvailable -Port $port)) {
        throw "$port portu kullanımda. Güvenli olması için uygulama farklı bir porta otomatik geçirilmedi."
    }
}

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw 'npm.cmd bulunamadı. Node.js LTS kurulumunu tamamlayıp terminali yeniden açın.'
}

New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

$env:ASPNETCORE_ENVIRONMENT = 'Development'
$backend = Start-Process -FilePath 'dotnet' `
    -ArgumentList @('run', '--project', $quotedApiProject, '--no-launch-profile', '--urls', 'https://localhost:7001;http://localhost:7000') `
    -WorkingDirectory $projectRoot `
    -RedirectStandardOutput (Join-Path $logDirectory 'backend.stdout.log') `
    -RedirectStandardError (Join-Path $logDirectory 'backend.stderr.log') `
    -WindowStyle Hidden `
    -PassThru

try {
    $frontend = Start-Process -FilePath 'npm.cmd' `
        -ArgumentList @('run', 'dev', '--', '--host', 'localhost', '--port', '5173', '--strictPort') `
        -WorkingDirectory $frontendPath `
        -RedirectStandardOutput (Join-Path $logDirectory 'frontend.stdout.log') `
        -RedirectStandardError (Join-Path $logDirectory 'frontend.stderr.log') `
        -WindowStyle Hidden `
        -PassThru
}
catch {
    Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
    throw
}

[ordered]@{
    projectRoot = $projectRoot
    backendPid = $backend.Id
    frontendPid = $frontend.Id
    startedAtUtc = [DateTime]::UtcNow.ToString('O')
} | ConvertTo-Json | Set-Content -LiteralPath $stateFile -Encoding UTF8

$ready = $false
$deadline = [DateTime]::UtcNow.AddSeconds(45)
while ([DateTime]::UtcNow -lt $deadline) {
    if (-not (Get-Process -Id $backend.Id -ErrorAction SilentlyContinue) -or
        -not (Get-Process -Id $frontend.Id -ErrorAction SilentlyContinue)) {
        break
    }
    if (-not (Test-PortAvailable -Port 7001) -and -not (Test-PortAvailable -Port 5173)) {
        try {
            $healthJson = & curl.exe --silent --show-error --fail --insecure `
                'https://localhost:7001/api/health'
            if ($LASTEXITCODE -ne 0) {
                throw 'Backend sağlık kontrolü başarısız.'
            }
            $health = $healthJson | ConvertFrom-Json
            $frontendResponse = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:5173' -TimeoutSec 3
            if ($health.status -eq 'Healthy' -and $frontendResponse.StatusCode -eq 200) {
                $ready = $true
                break
            }
        }
        catch {
            # Processes are still starting; retry until the deadline.
        }
    }
    Start-Sleep -Seconds 1
}

if (-not $ready) {
    & (Join-Path $PSScriptRoot 'stop-local.ps1')
    throw "Uygulama 45 saniye içinde hazır duruma gelemedi. Ayrıntılar için $logDirectory içindeki hata loglarını kontrol edin."
}

Write-Host 'FBU Laboratuvar Yazılım Talep Sistemi başlatıldı.' -ForegroundColor Green
Write-Host "Backend PID : $($backend.Id)"
Write-Host "Frontend PID: $($frontend.Id)"
Write-Host 'Frontend     : http://localhost:5173'
Write-Host 'Backend      : https://localhost:7001'
Write-Host 'Swagger      : https://localhost:7001/swagger'
Write-Host 'Health       : https://localhost:7001/api/health'
Write-Host "Loglar       : $logDirectory"
