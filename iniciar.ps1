$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

# Prefer the project-local Node 24 in .runtime; otherwise accept a Node 24 already on PATH.
$runtime = Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot '.runtime') -Directory -Filter 'node-v24*-win-x64' -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
if ($runtime) { $env:Path = $runtime.FullName + ';' + $env:Path }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 24 nao encontrado. Instale o Node.js 24 para executar o site.' }
$version = & node -v
if ($version -notlike 'v24.*') { throw "Este projeto usa Node.js 24, mas foi encontrado $version." }

if (-not (Test-Path -LiteralPath 'node_modules\next\dist\bin\next')) {
  $env:COREPACK_ENABLE_DOWNLOAD_PROMPT = '0'
  & corepack pnpm install --frozen-lockfile
  if ($LASTEXITCODE -ne 0) { throw 'Falha ao instalar as dependencias.' }
}

Write-Host 'Zangraf local: http://127.0.0.1:3000 - mantenha este terminal aberto.'
& node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 3000
exit $LASTEXITCODE
