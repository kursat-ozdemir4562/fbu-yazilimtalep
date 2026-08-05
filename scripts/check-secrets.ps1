[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$findings = [System.Collections.Generic.List[string]]::new()

$forbiddenNames = @(
    '.env',
    '.env.local',
    '.env.development.local',
    'appsettings.Production.json'
)
$forbiddenExtensions = @('.pfx', '.p12', '.pem', '.key', '.mdf', '.ldf')
$studentNamePattern = '(?i)(öğrenci|ogrenci|student).*(list|liste|import).*\.(xlsx|xls|csv)$'

$candidateFiles = git -C $projectRoot ls-files --cached --others --exclude-standard
if ($LASTEXITCODE -ne 0) { throw 'Git dosya listesi alınamadı.' }

foreach ($relativePath in $candidateFiles) {
    $normalized = $relativePath.Replace('\', '/')
    $name = [IO.Path]::GetFileName($relativePath)
    $extension = [IO.Path]::GetExtension($relativePath).ToLowerInvariant()

    if ($forbiddenNames -contains $name) {
        $findings.Add("Yasak yerel ayar dosyası: $normalized")
    }
    if ($forbiddenExtensions -contains $extension) {
        $findings.Add("Hassas/yerel dosya uzantısı: $normalized")
    }
    if ($normalized -match $studentNamePattern -and $normalized -ne 'docs/Ogrenci-Listesi-Sablonu.xlsx') {
        $findings.Add("Olası öğrenci verisi dosyası: $normalized")
    }

    $fullPath = Join-Path $projectRoot $relativePath
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) { continue }
    if ((Get-Item -LiteralPath $fullPath).Length -gt 2MB) { continue }
    if ($extension -in @('.xlsx', '.xls', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.zip')) { continue }

    $content = Get-Content -Raw -LiteralPath $fullPath -ErrorAction SilentlyContinue
    if ($null -eq $content) { continue }

    if ($content -match '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----') {
        $findings.Add("Private key içeriği: $normalized")
    }
    $quotedSecretPattern = '(?im)^[ \t]*(?:(?:const|let|var|string)[ \t]+)?["'']?(password|passwd|api[_-]?key|client[_-]?secret|jwt[_-]?secret)["'']?[ \t]*[:=][ \t]*["''](?![ \t]*(?:\$\{|<|CHANGE_ME|REPLACE_ME|your[-_]|.*(?:test|example|placeholder)))[^"'']{12,}["'']'
    $plainSecretPattern = '(?im)^[ \t]*(password|passwd|api[_-]?key|client[_-]?secret|jwt[_-]?secret)[ \t]*[:=][ \t]*(?!\$\{|<|CHANGE_ME|REPLACE_ME|your[-_])[-A-Za-z0-9_+/=.]{12,}[ \t]*$'
    if ($content -match $quotedSecretPattern -or $content -match $plainSecretPattern) {
        $findings.Add("Olası sabit hassas değer: $normalized")
    }
    if ($content -match '(?i)(Server|Data Source)\s*=[^;\r\n]+;[^\r\n]*(User ID|UID)\s*=[^;\r\n]+;[^\r\n]*(Password|PWD)\s*=(?!\$\{)[^;\r\n]+') {
        $findings.Add("Kimlik bilgili connection string: $normalized")
    }
}

if ($findings.Count -gt 0) {
    Write-Host 'Secret taraması başarısız:' -ForegroundColor Red
    $findings | Sort-Object -Unique | ForEach-Object { Write-Host " - $_" }
    exit 1
}

Write-Host 'Secret taraması temiz: gerçek parola, anahtar, credential, öğrenci listesi veya yerel veritabanı bulunmadı.' -ForegroundColor Green
