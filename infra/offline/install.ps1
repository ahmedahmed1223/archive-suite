$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
Get-Content SHA256SUMS | ForEach-Object {
  $hash, $path = $_ -split '  ', 2
  if ((Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash.ToLowerInvariant() -ne $hash) { throw "SHA256SUMS verification failed: $path" }
}
node verify-bundle.mjs .
Get-ChildItem images -Filter *.tar | ForEach-Object { docker image load --input $_.FullName | Out-Null }
if (-not (Test-Path .env)) { $env:ARCHIVE_VERSION = (Get-Content VERSION -Raw).Trim(); node generate-env.mjs .env }
docker compose --env-file .env -f compose.v1.yml config --quiet
Write-Host 'تم التحميل والتحقق. شغّل: docker compose --env-file .env -f compose.v1.yml up -d'
