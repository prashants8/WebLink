param(
  [switch]$Reinstall
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "Stopping Node.js processes..."
try {
  Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
} catch {
  Write-Host "Node.js process cleanup skipped: $($_.Exception.Message)"
}

$targets = @(
  ".next",
  "node_modules\.cache"
)

if ($Reinstall) {
  $targets += @(
    "node_modules",
    "package-lock.json"
  )
}

foreach ($target in $targets) {
  $fullPath = Join-Path $root $target
  if (Test-Path -LiteralPath $fullPath) {
    Write-Host "Removing $target"
    Remove-Item -LiteralPath $fullPath -Recurse -Force
  }
}

$lockFiles = @(
  ".next\lock",
  ".next\trace",
  "node_modules\.cache\webpack"
)

foreach ($lockFile in $lockFiles) {
  $fullPath = Join-Path $root $lockFile
  if (Test-Path -LiteralPath $fullPath) {
    Write-Host "Removing stale file $lockFile"
    Remove-Item -LiteralPath $fullPath -Recurse -Force
  }
}

Write-Host "Cleanup complete."
