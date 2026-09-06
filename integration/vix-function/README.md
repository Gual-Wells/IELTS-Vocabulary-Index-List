# Local VIX function

Run once in Windows PowerShell:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\VIX-Function.ps1 -Action Configure
```

The script installs itself under `%LOCALAPPDATA%\VIX\function` and stores the Agent Token encrypted with Windows DPAPI for the current Windows user. Personalized instructions contain no secret.

Automation commands:

```powershell
powershell.exe -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\VIX\function\VIX-Function.ps1" -Action Start -MaterialLabel "Paper" -SourceDigest "sha256:..."
powershell.exe -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\VIX\function\VIX-Function.ps1" -Action Submit -RunId "vmr_..." -File ".\mirror-result.json"
```

`Start` prints a compact descriptor and writes the frozen Context to its `contextFile`. Process that file locally; do not print the complete corpus into a chat or terminal transcript. A successful `Submit` removes the temporary Context file.
