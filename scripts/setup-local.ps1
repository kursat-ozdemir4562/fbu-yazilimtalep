[CmdletBinding()]
param(
    [switch]$SkipDatabase
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
    [Environment]::GetEnvironmentVariable('Path', 'User')
if (-not $env:Jwt__Secret -and $env:JWT_SECRET) { $env:Jwt__Secret = $env:JWT_SECRET }

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$solutionPath = Join-Path $projectRoot 'FbuLabSoftware.sln'
$frontendPath = Join-Path $projectRoot 'frontend'
$apiProject = Join-Path $projectRoot 'backend\src\FbuLabSoftware.Api\FbuLabSoftware.Api.csproj'
$infrastructureProject = Join-Path $projectRoot 'backend\src\FbuLabSoftware.Infrastructure\FbuLabSoftware.Infrastructure.csproj'
$storagePath = Join-Path $projectRoot 'storage\development'

Write-Host 'Backend paketleri geri yükleniyor...'
dotnet restore $solutionPath
if ($LASTEXITCODE -ne 0) { throw 'dotnet restore başarısız oldu.' }

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw 'npm bulunamadı. Node.js LTS kurulumunu tamamlayıp terminali yeniden açın.'
}

Write-Host 'Frontend paketleri kuruluyor...'
Push-Location $frontendPath
try {
    if (Test-Path -LiteralPath (Join-Path $frontendPath 'package-lock.json')) {
        npm ci
    }
    else {
        npm install
    }
    if ($LASTEXITCODE -ne 0) { throw 'Frontend paket kurulumu başarısız oldu.' }
}
finally {
    Pop-Location
}

New-Item -ItemType Directory -Path $storagePath -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $storagePath 'uploads') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $storagePath 'student-imports') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $storagePath 'logs') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $projectRoot '.local') -Force | Out-Null

$requiredVariables = @(
    'INITIAL_ADMIN_PASSWORD',
    'INITIAL_ACADEMIC_PASSWORD',
    'INITIAL_FACULTY_USER_PASSWORD'
)
$missingVariables = @($requiredVariables | Where-Object {
    [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($_, 'Process')) -and
    [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($_, 'User')) -and
    [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($_, 'Machine'))
})

if ($missingVariables.Count -gt 0) {
    $names = $missingVariables -join ', '
    throw "Gerekli development değişkenleri tanımlı değil: $names. README içindeki 'Yerel sırlar' bölümünü izleyin."
}

if (-not $SkipDatabase) {
    Push-Location $projectRoot
    try {
        Write-Host 'InitialCreate migration veritabanına uygulanıyor...'
        dotnet tool restore --tool-manifest (Join-Path $projectRoot '.config\dotnet-tools.json')
        if ($LASTEXITCODE -ne 0) { throw 'dotnet-ef aracı geri yüklenemedi.' }

        dotnet ef database update --project $infrastructureProject --startup-project $apiProject --context AppDbContext
        if ($LASTEXITCODE -ne 0) { throw 'Veritabanı migration işlemi başarısız oldu.' }

        Write-Host 'Development seed verileri hazırlanıyor...'
        $env:ASPNETCORE_ENVIRONMENT = 'Development'
        dotnet run --project $apiProject --no-launch-profile -- --seed-only
        if ($LASTEXITCODE -ne 0) { throw 'Development seed işlemi başarısız oldu.' }
    }
    finally {
        Pop-Location
    }
}

Write-Host ''
Write-Host 'Yerel kurulum tamamlandı.' -ForegroundColor Green
Write-Host 'Uygulamayı başlatmak için: .\scripts\start-local.ps1'
