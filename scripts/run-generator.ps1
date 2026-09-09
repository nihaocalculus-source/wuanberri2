# Wuanberri lesson-content generator
#
# Prompts for an API key locally (NEVER paste it in chat — chat
# transcripts are stored and a pasted token should be considered
# compromised). The key is set as an env var for this process only,
# so it never lands on disk in the project.
#
# Usage (from C:\Users\nihao\wuanberri):
#   pwsh -File scripts/run-generator.ps1 -Subject calculus
#   pwsh -File scripts/run-generator.ps1 -All
#
# Cost: ~$0.30 per subject with gpt-4o-mini, ~$2 for all 6 existing
# subjects. Re-runnable: existing files are skipped.

[CmdletBinding()]
param(
  [string]$Subject,
  [switch]$All,
  [switch]$DryRun,
  [switch]$Force,
  [ValidateSet('openai','anthropic')]
  [string]$Provider = 'openai'
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not $Subject -and -not $All) {
  Write-Host "Specify -Subject <name> or -All." -ForegroundColor Yellow
  Write-Host "Subjects: calculus, physics, linear-algebra, differential-equations, discrete-math, statistics"
  exit 1
}

$keyName = if ($Provider -eq 'openai') { 'OPENAI_API_KEY' } else { 'ANTHROPIC_API_KEY' }
if (-not (Test-Path "env:$keyName") -or [string]::IsNullOrEmpty((Get-Item "env:$keyName").Value)) {
  Write-Host "Enter your $Provider API key (input is masked):" -ForegroundColor Cyan
  $secure = Read-Host -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) | Out-Null
  }
  if ([string]::IsNullOrWhiteSpace($plain)) {
    Write-Host "No key entered. Aborting." -ForegroundColor Red
    exit 1
  }
  Set-Item -Path "env:$keyName" -Value $plain
}

# Verify Node.js is available
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js is not installed (or not on PATH)." -ForegroundColor Red
  Write-Host ""
  Write-Host "  1. Download the LTS installer from https://nodejs.org/"
  Write-Host "  2. Run it with default options (adds node.exe to PATH)"
  Write-Host "  3. Close and reopen PowerShell so the new PATH is picked up"
  Write-Host "  4. Re-run this script"
  Write-Host ""
  exit 1
}
try {
  $nodeVersion = (node --version) 2>&1
  Write-Host "Using $nodeVersion" -ForegroundColor DarkGray
} catch {}

$args = @()
if ($Subject) { $args += @('--subject', $Subject) }
if ($All) { $args += '--all' }
if ($DryRun) { $args += '--dry-run' }
if ($Force) { $args += '--force' }

Write-Host "Running: node scripts/generate-lessons.mjs $($args -join ' ')" -ForegroundColor Green
& node scripts/generate-lessons.mjs @args
exit $LASTEXITCODE
