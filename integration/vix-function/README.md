# VIX Function

VIX Function is a local, version-independent sidecar for exact `VIX:` / `VIX：` routing. It reads the latest hidden Personal Mirror snapshot and submits a validated two-layer `vix-mirror-file/1` document to the Mirror Site.

The function no longer depends on Bridge runs, WebMCP, a VIX release number, or a seed generation. Compatibility is negotiated through `vix-function/1`, `vix-data-exchange/1`, `vix-mirror-service/1`, and advertised capabilities.

Install and configure it locally:

```powershell
.\VIX-Function.ps1 -Action Install
.\VIX-Function.ps1 -Action Configure
```

Configuration stores the Site URL and a protocol-scoped Mirror write token. The token is encrypted with the current Windows user profile and is never placed in prompt instructions.
