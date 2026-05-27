# toolrepair - one-shot installer for Windows (PowerShell 5.1+).
#
# Usage:
#   powershell -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair/main/install.ps1 | iex"
#
# What it does:
#   1. Verifies node >=18 is installed.
#   2. Clones the repo to ~/.toolrepair (or pulls if already cloned).
#   3. Creates a .cmd wrapper in ~/.local/bin as `toolrepair`.
#   4. Runs `toolrepair install` against the auto-detected platform.
#
# Uninstall: Remove-Item -Recurse -Force ~/.toolrepair, ~/.local/bin/toolrepair.cmd

$ErrorActionPreference = 'Stop'

$RepoUrl = if ($env:TOOLREPAIR_REPO_URL) { $env:TOOLREPAIR_REPO_URL } else { 'https://github.com/TeFuirnever/ahmad-awais-deepseek-v4-toolrepair.git' }
$InstallDir = if ($env:TOOLREPAIR_HOME) { $env:TOOLREPAIR_HOME } else { Join-Path $env:USERPROFILE '.toolrepair' }
$BinDir = if ($env:TOOLREPAIR_BIN_DIR) { $env:TOOLREPAIR_BIN_DIR } else { Join-Path $env:USERPROFILE '.local\bin' }
$LinkName = 'toolrepair'

function Say($msg) { Write-Host "toolrepair: $msg" }
function Fail($msg) { Write-Error "toolrepair: error: $msg"; exit 1 }

# 1. node check
try {
    $nodeVersion = (node -v)
} catch {
    Fail "node not found. Install Node.js >=18 first (https://nodejs.org)."
}
$nodeMajor = $nodeVersion -replace '^v(\d+).*', '$1'
if ([int]$nodeMajor -lt 18) {
    Fail "node >=18 required, found $nodeVersion. Upgrade Node.js."
}
Say "node $($nodeVersion.TrimStart('v')) detected"

# 2. git check + clone or update
if (Test-Path (Join-Path $InstallDir '.git')) {
    Say "updating $InstallDir"
    Push-Location $InstallDir
    git pull --ff-only --quiet
    Pop-Location
} else {
    try { git --version | Out-Null } catch { Fail "git not found. Install git first." }
    Say "cloning to $InstallDir"
    git clone --depth 1 --quiet $RepoUrl $InstallDir
}

# 3. create .cmd wrapper
if (-not (Test-Path $BinDir)) {
    New-Item -ItemType Directory -Path $BinDir -Force | Out-Null
}
$cmdContent = "@node `"%USERPROFILE%\.toolrepair\bin\cli.js`" %*"
$cmdPath = Join-Path $BinDir "$LinkName.cmd"
Set-Content -Path $cmdPath -Value $cmdContent -Encoding ASCII
Say "created $cmdPath"

# PATH hint
$pathNeedsFix = $true
$pathParts = $env:PATH -split ';' | Where-Object { $_ -ne '' }
foreach ($part in $pathParts) {
    if ($part -ieq $BinDir) { $pathNeedsFix = $false; break }
}
if ($pathNeedsFix) {
    Say "WARN: $BinDir is not on PATH -- add it:"
    Write-Host "  PowerShell: `$env:PATH = `"$BinDir;`$env:PATH`"" -ForegroundColor Yellow
    Write-Host "  cmd.exe:     setx PATH `"%PATH%;$BinDir`"" -ForegroundColor Yellow
    Say "         Then restart your terminal."
}

# 4. auto-install for detected platform
Say "running 'toolrepair install' (auto-detect platform)"
& node (Join-Path $InstallDir 'bin\cli.js') install
if ($LASTEXITCODE -ne 0) {
    Fail "install command failed -- re-run manually after fixing PATH."
}

if ($pathNeedsFix) {
    Say "install complete, but '$LinkName' is not yet on PATH -- add $BinDir to PATH then run 'toolrepair verify'."
} else {
    Say "done. Run 'toolrepair verify' to confirm."
}
