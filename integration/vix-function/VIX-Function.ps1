param(
  [ValidateSet('Install','Configure','Status','Start','Submit')]
  [string]$Action = 'Status',
  [string]$MaterialLabel = '',
  [string]$SourceDigest = '',
  [string]$RunId = '',
  [string]$File = ''
)

$ErrorActionPreference = 'Stop'
$installRoot = Join-Path $env:LOCALAPPDATA 'VIX\function'
$installedScript = Join-Path $installRoot 'VIX-Function.ps1'
$configPath = Join-Path $installRoot 'config.json'
$runRoot = Join-Path $installRoot 'runs'

function Write-Json($Value) {
  $Value | ConvertTo-Json -Depth 100 -Compress
}

function Read-Config {
  if (-not (Test-Path -LiteralPath $configPath)) { throw 'VIX Function is not configured.' }
  $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
  $secure = ConvertTo-SecureString ([string]$config.agentTokenCipher)
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
  @{ url = ([string]$config.bridgeUrl).TrimEnd('/'); token = $token }
}

function Invoke-Bridge($Method, $Path, $Body = $null, $IdempotencyKey = '') {
  $config = Read-Config
  $headers = @{ Authorization = 'Bearer ' + $config.token; Accept = 'application/json' }
  if ($IdempotencyKey) { $headers['Idempotency-Key'] = $IdempotencyKey }
  $parameters = @{ Method = $Method; Uri = $config.url + $Path; Headers = $headers; UseBasicParsing = $true }
  if ($null -ne $Body) {
    $parameters['ContentType'] = 'application/json'
    $parameters['Body'] = ($Body | ConvertTo-Json -Depth 100 -Compress)
  }
  Invoke-RestMethod @parameters
}

if ($Action -eq 'Install') {
  New-Item -ItemType Directory -Force -Path $installRoot | Out-Null
  Copy-Item -LiteralPath $PSCommandPath -Destination $installedScript -Force
  Write-Output $installedScript
  exit 0
}

if ($Action -eq 'Configure') {
  New-Item -ItemType Directory -Force -Path $installRoot | Out-Null
  if ((Resolve-Path -LiteralPath $PSCommandPath).Path -ne $installedScript) { Copy-Item -LiteralPath $PSCommandPath -Destination $installedScript -Force }
  $bridgeUrl = (Read-Host 'Bridge URL').Trim().TrimEnd('/')
  $parsedUrl = $null
  if (-not [Uri]::TryCreate($bridgeUrl, [UriKind]::Absolute, [ref]$parsedUrl) -or $parsedUrl.Scheme -ne 'https') { throw 'Bridge URL must use HTTPS.' }
  $agentToken = Read-Host 'Agent Token' -AsSecureString
  $cipher = ConvertFrom-SecureString $agentToken
  @{ protocol = 'vix-function-config/1'; bridgeUrl = $bridgeUrl; agentTokenCipher = $cipher } |
    ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $configPath -Encoding UTF8
  Write-Output 'VIX Function configured.'
  exit 0
}

if ($Action -eq 'Status') {
  Write-Json (Invoke-Bridge 'GET' '/v1/status')
  exit 0
}

if ($Action -eq 'Start') {
  if (-not $MaterialLabel.Trim() -or -not $SourceDigest.Trim()) { throw 'Start requires -MaterialLabel and -SourceDigest.' }
  $seed = $SourceDigest + '|' + $MaterialLabel
  $sha = [Security.Cryptography.SHA256]::Create()
  try { $hash = ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($seed)) | ForEach-Object { $_.ToString('x2') }) -join '' }
  finally { $sha.Dispose() }
  $body = @{ materialLabel = $MaterialLabel; sourceDigest = $SourceDigest; idempotencyKey = 'sha256:' + $hash }
  $response = Invoke-Bridge 'POST' '/v1/runs' $body ('sha256:' + $hash)
  New-Item -ItemType Directory -Force -Path $runRoot | Out-Null
  $safeRunId = ([string]$response.runId) -replace '[^A-Za-z0-9_-]', '_'
  $contextPath = Join-Path $runRoot ($safeRunId + '-context.json')
  $response.context | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $contextPath -Encoding UTF8
  Write-Json @{
    protocol = 'vix-function-start/1'
    runId = [string]$response.runId
    contextFile = $contextPath
    contextRevision = [string]$response.context.revision
    reused = [bool]$response.reused
  }
  exit 0
}

if ($Action -eq 'Submit') {
  if (-not $RunId -or -not (Test-Path -LiteralPath $File)) { throw 'Submit requires -RunId and -File.' }
  $body = Get-Content -LiteralPath $File -Raw | ConvertFrom-Json
  if ([string]$body.runId -ne $RunId) { throw 'RunId does not match the result file.' }
  $response = Invoke-Bridge 'PUT' ('/v1/runs/' + [Uri]::EscapeDataString($RunId) + '/result') $body
  $safeRunId = $RunId -replace '[^A-Za-z0-9_-]', '_'
  $contextPath = Join-Path $runRoot ($safeRunId + '-context.json')
  if (Test-Path -LiteralPath $contextPath) { Remove-Item -LiteralPath $contextPath -Force }
  Write-Json $response
}
