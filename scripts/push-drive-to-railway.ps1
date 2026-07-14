# One-time: push Drive persistence secrets to Railway (never commit values).
# Usage:
#   railway login
#   railway link   # chọn project huy-locket / service web
#   powershell -ExecutionPolicy Bypass -File scripts/push-drive-to-railway.ps1
#
# After this, every deploy keeps Drive ON via Neon + env fallback.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "== Huy Locket: push Drive env to Railway ==" -ForegroundColor Cyan

# 1) Neon connection string (required for durable OAuth in Neon)
$neonUrl = $env:DATABASE_URL
if (-not $neonUrl) {
  $neonUrl = $env:NEON_DATABASE_URL
}
if (-not $neonUrl) {
  Write-Host ""
  Write-Host "Paste Neon DATABASE_URL (Console → huy-locket-drive → Connect → pooled):" -ForegroundColor Yellow
  $neonUrl = Read-Host
}
$neonUrl = $neonUrl.Trim().Trim('"').Trim("'")
if (-not $neonUrl -or $neonUrl -notmatch "^postgres") {
  throw "DATABASE_URL invalid"
}
# serverless-friendly
$neonUrl = $neonUrl -replace "[&?]channel_binding=require", ""
if ($neonUrl -notmatch "sslmode=") {
  $sep = if ($neonUrl.Contains("?")) { "&" } else { "?" }
  $neonUrl = "$neonUrl${sep}sslmode=require"
}

# 2) Optional: local OAuth snapshot (gitignored) as env fallback
$cfgPath = Join-Path $root "data\gdrive-config.json"
$clientId = $env:GOOGLE_OAUTH_CLIENT_ID
$clientSecret = $env:GOOGLE_OAUTH_CLIENT_SECRET
$refresh = $env:GOOGLE_OAUTH_REFRESH_TOKEN
$folderId = $env:GOOGLE_DRIVE_FOLDER_ID

if (Test-Path $cfgPath) {
  $cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
  if (-not $clientId) { $clientId = $cfg.oauth.clientId }
  if (-not $clientSecret) { $clientSecret = $cfg.oauth.clientSecret }
  if (-not $refresh) { $refresh = $cfg.oauth.refreshToken }
  if (-not $folderId) { $folderId = $cfg.folderId }
  Write-Host "Loaded OAuth snapshot from data/gdrive-config.json (local only)" -ForegroundColor Green
}

# Service name on Railway (web runs server.mjs)
$service = if ($env:RAILWAY_SERVICE) { $env:RAILWAY_SERVICE } else { "huy-locket" }

Write-Host "Setting variables on service: $service" -ForegroundColor Cyan

railway whoami 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Not logged in. Opening railway login..." -ForegroundColor Yellow
  railway login
}

# Set vars (triggers redeploy unless --skip-deploys)
railway variable set "DATABASE_URL=$neonUrl" -s $service
if ($clientId) {
  railway variable set "GOOGLE_OAUTH_CLIENT_ID=$clientId" -s $service
}
if ($clientSecret) {
  railway variable set "GOOGLE_OAUTH_CLIENT_SECRET=$clientSecret" -s $service
}
if ($refresh) {
  railway variable set "GOOGLE_OAUTH_REFRESH_TOKEN=$refresh" -s $service
}
if ($folderId) {
  railway variable set "GOOGLE_DRIVE_FOLDER_ID=$folderId" -s $service
}

Write-Host ""
Write-Host "OK. After deploy, Drive should show ON without re-linking Google." -ForegroundColor Green
Write-Host "Open /admin/google-drive and click 'Lam moi trang thai'." -ForegroundColor Green
