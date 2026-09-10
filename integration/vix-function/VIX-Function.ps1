param(
  [ValidateSet('Install','Configure','Status','Start','Submit')]
  [string]$Action = 'Status',
  [string]$MaterialLabel = '',
  [string]$SourceDigest = '',
  [string]$RunId = '',
  [string]$File = ''
)

$ErrorActionPreference = 'Stop'
$functionProtocol = 'vix-function/1'
$mirrorServiceProtocol = 'vix-mirror-service/1'
$mirrorFileProtocol = 'vix-mirror-file/1'
$exchangeProtocol = 'vix-data-exchange/1'
$installRoot = Join-Path $env:LOCALAPPDATA 'VIX\function'
$installedScript = Join-Path $installRoot 'VIX-Function.ps1'
$configPath = Join-Path $installRoot 'config.json'
$runRoot = Join-Path $installRoot 'runs'

function Write-Json($Value) {
  $Value | ConvertTo-Json -Depth 100 -Compress
}

function Get-Sha256([string]$Value) {
  $algorithm = [Security.Cryptography.SHA256]::Create()
  try { ($algorithm.ComputeHash([Text.Encoding]::UTF8.GetBytes($Value)) | ForEach-Object { $_.ToString('x2') }) -join '' }
  finally { $algorithm.Dispose() }
}

function Read-Config {
  if (-not (Test-Path -LiteralPath $configPath)) { throw 'VIX Function is not configured.' }
  $config = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
  if ([string]$config.protocol -ne 'vix-function-config/1') { throw 'Unsupported VIX Function configuration.' }
  $secure = ConvertTo-SecureString ([string]$config.writeTokenCipher)
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
  @{ url = ([string]$config.siteUrl).TrimEnd('/'); token = $token }
}

function Invoke-Mirror($Method, $Path, $Body = $null, [string]$ContentType = 'application/json; charset=utf-8') {
  $config = Read-Config
  $headers = @{ Authorization = 'Bearer ' + $config.token; Accept = 'application/json' }
  $parameters = @{ Method = $Method; Uri = $config.url + $Path; Headers = $headers; UseBasicParsing = $true }
  if ($null -ne $Body) {
    $raw = if ($Body -is [string]) { $Body } else { $Body | ConvertTo-Json -Depth 100 -Compress }
    $parameters['ContentType'] = $ContentType
    $parameters['Body'] = [Text.Encoding]::UTF8.GetBytes($raw)
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
  if ((Resolve-Path -LiteralPath $PSCommandPath).Path -ne $installedScript) {
    Copy-Item -LiteralPath $PSCommandPath -Destination $installedScript -Force
  }
  $siteUrl = (Read-Host 'Personal Mirror Site URL').Trim().TrimEnd('/')
  $parsedUrl = $null
  if (-not [Uri]::TryCreate($siteUrl, [UriKind]::Absolute, [ref]$parsedUrl) -or $parsedUrl.Scheme -ne 'https') {
    throw 'Personal Mirror Site URL must use HTTPS.'
  }
  $writeToken = Read-Host 'Mirror protocol write token' -AsSecureString
  @{ protocol = 'vix-function-config/1'; siteUrl = $siteUrl; writeTokenCipher = (ConvertFrom-SecureString $writeToken) } |
    ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $configPath -Encoding UTF8
  Write-Output 'VIX Function configured.'
  exit 0
}

if ($Action -eq 'Status') {
  $capabilities = Invoke-Mirror 'GET' '/api/mirror/capabilities'
  if ([string]$capabilities.protocol -ne $mirrorServiceProtocol) { throw 'Mirror Site protocol is incompatible.' }
  Write-Json @{ protocol = $functionProtocol; siteProtocol = $capabilities.protocol; capabilities = $capabilities.capabilities }
  exit 0
}

if ($Action -eq 'Start') {
  if (-not $MaterialLabel.Trim() -or -not $SourceDigest.Trim()) { throw 'Start requires -MaterialLabel and -SourceDigest.' }
  New-Item -ItemType Directory -Force -Path $runRoot | Out-Null
  $runHash = Get-Sha256 ($SourceDigest.Trim() + '|' + $MaterialLabel.Trim())
  $runId = 'run_' + $runHash.Substring(0, 32)
  $snapshot = Invoke-Mirror 'GET' '/api/mirror/snapshot'
  if ([string]$snapshot.protocol -ne $exchangeProtocol -or [string]$snapshot.kind -ne 'snapshot') {
    throw 'Personal Mirror snapshot is incompatible.'
  }
  $context = @{
    protocol = 'vix-function-context/1'
    functionProtocol = $functionProtocol
    mirrorFileProtocol = $mirrorFileProtocol
    runId = $runId
    source = @{ label = $MaterialLabel.Trim(); digest = $SourceDigest.Trim() }
    snapshot = $snapshot
    resultContract = @{
      protocol = $mirrorFileProtocol
      layers = @{
        existing = 'Layer 1: source-relevant existing entries with entryId, evidence, importance, and optional repaired gloss.'
        candidates = 'Layer 2: absent vocabulary, phrases, and contextual usages with candidateId, domainKey, collectionKeys, evidence, and a substantive Traditional Chinese gloss.'
      }
    }
  }
  $contextPath = Join-Path $runRoot ($runId + '-context.json')
  $context | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $contextPath -Encoding UTF8
  Write-Json @{ protocol = 'vix-function-start/1'; runId = $runId; contextFile = $contextPath; contextProtocol = 'vix-function-context/1' }
  exit 0
}

if ($Action -eq 'Submit') {
  if (-not $RunId -or -not (Test-Path -LiteralPath $File)) { throw 'Submit requires -RunId and -File.' }
  $jsonText = Get-Content -LiteralPath $File -Raw -Encoding UTF8
  $document = $jsonText | ConvertFrom-Json
  if ([string]$document.protocol -ne $mirrorFileProtocol) { throw 'Result does not use the Mirror file protocol.' }
  if ([string]$document.documentId -ne $RunId) { throw 'RunId does not match the Mirror file documentId.' }
  if ($null -eq $document.layers -or $null -eq $document.layers.existing -or $null -eq $document.layers.candidates) {
    throw 'Mirror file must contain both layers.'
  }
  $safeName = (([string]$document.title).Trim() -replace '[\\/\x00-\x1f]', '-')
  if (-not $safeName) { $safeName = $RunId }
  if ($safeName.Length -gt 150) { $safeName = $safeName.Substring(0, 150) }
  $fileName = $safeName + '.vix-mirror.json'
  $created = $null
  try { $created = Invoke-Mirror 'POST' '/api/mirror/nodes' @{ name = $fileName; kind = 'file'; parentId = '' } }
  catch {
    $catalog = Invoke-Mirror 'GET' ('/api/mirror/nodes?q=' + [Uri]::EscapeDataString($fileName))
    $existing = @($catalog.data.nodes | Where-Object { $_.kind -eq 'file' -and $_.name -eq $fileName }) | Select-Object -First 1
    if ($null -eq $existing) { throw }
    $created = @{ data = @{ node = $existing } }
  }
  $nodeId = [string]$created.data.node.id
  $response = Invoke-Mirror 'PUT' ('/api/mirror/files/' + [Uri]::EscapeDataString($nodeId)) $jsonText 'application/vnd.vix-mirror+json'
  $contextPath = Join-Path $runRoot (($RunId -replace '[^A-Za-z0-9_-]', '_') + '-context.json')
  if (Test-Path -LiteralPath $contextPath) { Remove-Item -LiteralPath $contextPath -Force }
  Write-Json @{ protocol = $functionProtocol; submitted = $true; nodeId = $nodeId; mirror = $response }
}
