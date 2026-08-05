[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
    [Environment]::GetEnvironmentVariable('Path', 'User')

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$solutionPath = Join-Path $projectRoot 'FbuLabSoftware.sln'
$frontendPath = Join-Path $projectRoot 'frontend'

Write-Host 'Backend restore ve build...'
dotnet restore $solutionPath
if ($LASTEXITCODE -ne 0) { throw 'Backend restore başarısız.' }
dotnet build $solutionPath --no-restore --configuration Release
if ($LASTEXITCODE -ne 0) { throw 'Backend build başarısız.' }

Write-Host 'Backend unit testleri...'
dotnet test (Join-Path $projectRoot 'backend\tests\FbuLabSoftware.UnitTests\FbuLabSoftware.UnitTests.csproj') --no-build --configuration Release
if ($LASTEXITCODE -ne 0) { throw 'Backend unit testleri başarısız.' }

Write-Host 'Backend integration testleri...'
dotnet test (Join-Path $projectRoot 'backend\tests\FbuLabSoftware.IntegrationTests\FbuLabSoftware.IntegrationTests.csproj') --no-build --configuration Release
if ($LASTEXITCODE -ne 0) { throw 'Backend integration testleri başarısız.' }

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw 'npm.cmd bulunamadı. Node.js LTS kurulumunu tamamlayın.'
}

Push-Location $frontendPath
try {
    if (Test-Path -LiteralPath (Join-Path $frontendPath 'package-lock.json')) { npm ci } else { npm install }
    if ($LASTEXITCODE -ne 0) { throw 'Frontend paket kurulumu başarısız.' }

    Write-Host 'Frontend lint...'
    npm run lint
    if ($LASTEXITCODE -ne 0) { throw 'Frontend lint başarısız.' }

    Write-Host 'Frontend testleri...'
    npm run test -- --run
    if ($LASTEXITCODE -ne 0) { throw 'Frontend testleri başarısız.' }

    Write-Host 'Frontend production build...'
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build başarısız.' }
}
finally {
    Pop-Location
}

Write-Host 'Tüm build, lint ve test adımları başarılı.' -ForegroundColor Green
