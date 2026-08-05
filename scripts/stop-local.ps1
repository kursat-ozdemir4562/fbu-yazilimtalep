[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$stateFile = Join-Path $projectRoot '.local\processes.json'

if (-not (Test-Path -LiteralPath $stateFile)) {
    Write-Host 'Bu projeye ait kayıtlı çalışan süreç bulunamadı.'
    exit 0
}

$state = Get-Content -Raw -LiteralPath $stateFile | ConvertFrom-Json
$stopped = 0
$allProcesses = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue)

function Get-ProjectProcessTree {
    param([Parameter(Mandatory)][int]$RootProcessId)

    $result = [System.Collections.Generic.List[object]]::new()
    $children = @($allProcesses | Where-Object ParentProcessId -eq $RootProcessId)
    foreach ($child in $children) {
        foreach ($descendant in @(Get-ProjectProcessTree -RootProcessId $child.ProcessId)) {
            $result.Add($descendant)
        }
        $result.Add($child)
    }

    $root = $allProcesses | Where-Object ProcessId -eq $RootProcessId | Select-Object -First 1
    if ($null -ne $root) {
        $result.Add($root)
    }
    return $result
}

$candidateProcesses = [System.Collections.Generic.List[object]]::new()
foreach ($rootProcessId in @($state.backendPid, $state.frontendPid)) {
    foreach ($candidate in @(Get-ProjectProcessTree -RootProcessId ([int]$rootProcessId))) {
        if (-not ($candidateProcesses | Where-Object ProcessId -eq $candidate.ProcessId)) {
            $candidateProcesses.Add($candidate)
        }
    }
}

foreach ($process in $candidateProcesses) {
    $processId = [int]$process.ProcessId
    if ($null -eq $process) {
        continue
    }

    $commandLine = [string]$process.CommandLine
    $belongsToProject = $commandLine.IndexOf($projectRoot, [StringComparison]::OrdinalIgnoreCase) -ge 0 -or
        $commandLine.IndexOf('FbuLabSoftware.Api', [StringComparison]::OrdinalIgnoreCase) -ge 0 -or
        ($commandLine.IndexOf('vite', [StringComparison]::OrdinalIgnoreCase) -ge 0 -and
            $commandLine.IndexOf('5173', [StringComparison]::OrdinalIgnoreCase) -ge 0)

    if (-not $belongsToProject) {
        Write-Warning "PID $processId bu projeye ait görünmediği için durdurulmadı."
        continue
    }

    Stop-Process -Id $processId -Force -ErrorAction Stop
    $stopped++
}

Remove-Item -LiteralPath $stateFile -Force
Write-Host "$stopped proje süreci güvenli şekilde durduruldu." -ForegroundColor Green
