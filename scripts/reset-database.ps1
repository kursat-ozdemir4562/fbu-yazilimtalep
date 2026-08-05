[CmdletBinding()]
param(
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
    [Environment]::GetEnvironmentVariable('Path', 'User')
if (-not $env:Jwt__Secret -and $env:JWT_SECRET) { $env:Jwt__Secret = $env:JWT_SECRET }

$environmentName = if ($env:ASPNETCORE_ENVIRONMENT) { $env:ASPNETCORE_ENVIRONMENT } else { 'Development' }
if ($environmentName -ne 'Development') {
    throw "Veritabanı sıfırlama yalnızca Development ortamında çalışır. Geçerli ortam: $environmentName"
}

if (-not $Force) {
    Write-Warning 'FbuLabSoftwareDb development veritabanı ve içindeki tüm yerel veriler silinecek.'
    $confirmation = Read-Host 'Devam etmek için tam olarak SIFIRLA yazın'
    if ($confirmation -cne 'SIFIRLA') {
        Write-Host 'İşlem iptal edildi.'
        exit 0
    }
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$apiProject = Join-Path $projectRoot 'backend\src\FbuLabSoftware.Api\FbuLabSoftware.Api.csproj'
$infrastructureProject = Join-Path $projectRoot 'backend\src\FbuLabSoftware.Infrastructure\FbuLabSoftware.Infrastructure.csproj'
$env:ASPNETCORE_ENVIRONMENT = 'Development'

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
    throw "Seed kullanıcıları oluşturulamaz; eksik environment variable: $($missingVariables -join ', ')."
}

Push-Location $projectRoot
try {
    dotnet tool restore --tool-manifest (Join-Path $projectRoot '.config\dotnet-tools.json')
    if ($LASTEXITCODE -ne 0) { throw 'dotnet-ef aracı geri yüklenemedi.' }

    dotnet ef database drop --force --project $infrastructureProject --startup-project $apiProject --context AppDbContext
    if ($LASTEXITCODE -ne 0) { throw 'Development veritabanı silinemedi.' }

    dotnet ef database update --project $infrastructureProject --startup-project $apiProject --context AppDbContext
    if ($LASTEXITCODE -ne 0) { throw 'Migration işlemi başarısız oldu.' }

    dotnet run --project $apiProject --no-launch-profile -- --seed-only
    if ($LASTEXITCODE -ne 0) { throw 'Development seed işlemi başarısız oldu.' }
}
finally {
    Pop-Location
}

Write-Host 'Development veritabanı InitialCreate migration ve seed verileriyle yeniden oluşturuldu.' -ForegroundColor Green
