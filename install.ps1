# MCP Swarm One-Click Installer for Windows
# Run: powershell -ExecutionPolicy Bypass -File install.ps1

$ErrorActionPreference = "Stop"

function Write-OK($Text) { Write-Host "[OK] $Text" -ForegroundColor Green }
function Write-Warn($Text) { Write-Host "[!] $Text" -ForegroundColor Yellow }
function Write-Err($Text) { Write-Host "[X] $Text" -ForegroundColor Red }
function Write-Step($Text) { Write-Host ">>> $Text" -ForegroundColor Yellow }

function Write-Header($Text) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

# Banner
Clear-Host
Write-Host ""
Write-Host "  =============================================" -ForegroundColor Magenta
Write-Host "  |                                           |" -ForegroundColor Magenta
Write-Host "  |   MCP Swarm One-Click Installer          |" -ForegroundColor Magenta
Write-Host "  |   Universal AI Agent Coordination        |" -ForegroundColor Magenta
Write-Host "  |                                           |" -ForegroundColor Magenta
Write-Host "  =============================================" -ForegroundColor Magenta
Write-Host ""

# Step 1: Check Node.js
Write-Header "Step 1: Checking Node.js"

$nodeInstalled = $false
try {
    $nodeVersion = node --version 2>$null
    if ($nodeVersion) {
        $nodeInstalled = $true
        Write-OK "Node.js found: $nodeVersion"
    }
} catch {
    $nodeInstalled = $false
}

if (-not $nodeInstalled) {
    Write-Warn "Node.js not found!"
    Write-Host ""
    Write-Host "Node.js is required. Choose:" -ForegroundColor White
    Write-Host "  1) Auto-install via winget" -ForegroundColor Cyan
    Write-Host "  2) Open nodejs.org" -ForegroundColor Cyan
    Write-Host "  3) Exit" -ForegroundColor Cyan
    Write-Host ""
    
    $choice = Read-Host "Choose [1/2/3]"
    
    if ($choice -eq "1") {
        Write-Step "Installing Node.js via winget..."
        winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
        Write-OK "Node.js installed! Restart this script."
        Read-Host "Press Enter to exit"
        exit 0
    } elseif ($choice -eq "2") {
        Start-Process "https://nodejs.org"
        Write-Host "After install, run this script again." -ForegroundColor Yellow
        Read-Host "Press Enter to exit"
        exit 0
    } else {
        exit 0
    }
}

# Check npm
try {
    $npmVersion = npm --version 2>$null
    Write-OK "npm found: v$npmVersion"
} catch {
    Write-Err "npm not found. Reinstall Node.js"
    exit 1
}

# Step 2: Choose Mode
Write-Header "Step 2: Choose Mode"

Write-Host "  1) Remote (Recommended) - Cloud server" -ForegroundColor Green
Write-Host "  2) Local + Hub - Full local" -ForegroundColor Yellow
Write-Host ""

$modeChoice = Read-Host "Choose [1/2] (default: 1)"
if ($modeChoice -eq "2") { $mode = "local" } else { $mode = "remote" }
Write-OK "Mode: $mode"

# Step 2.5: Server URLs
Write-Header "Step 2.5: Your Cloudflare Server URLs"

Write-Host "You need to deploy your own Cloudflare Workers first!" -ForegroundColor Yellow
Write-Host "See: https://github.com/AbdrAbdr/Swarm_MCP#-cloudflare-workers--its-free" -ForegroundColor Cyan
Write-Host ""

if ($mode -eq "remote") {
    Write-Host "Enter your MCP Server URL (from cloudflare/mcp-server deploy)" -ForegroundColor White
    Write-Host "Example: https://mcp-swarm-server.myaccount.workers.dev/mcp" -ForegroundColor Gray
    $serverUrl = Read-Host "MCP Server URL"
    
    if (-not $serverUrl) {
        Write-Err "Server URL is required! Deploy your server first."
        Write-Host "Instructions: https://github.com/AbdrAbdr/Swarm_MCP#-cloudflare-workers--its-free" -ForegroundColor Cyan
        exit 1
    }
    Write-OK "Server: $serverUrl"
} else {
    Write-Host "Enter your Hub URL (from cloudflare/hub deploy)" -ForegroundColor White
    Write-Host "Example: wss://mcp-swarm-hub.myaccount.workers.dev/ws" -ForegroundColor Gray
    $hubUrl = Read-Host "Hub URL"
    
    if (-not $hubUrl) {
        Write-Err "Hub URL is required! Deploy your hub first."
        Write-Host "Instructions: https://github.com/AbdrAbdr/Swarm_MCP#-cloudflare-workers--its-free" -ForegroundColor Cyan
        exit 1
    }
    Write-OK "Hub: $hubUrl"
}

# Step 3: Telegram
Write-Header "Step 3: Telegram (Optional)"

Write-Host "Create your own bot via @BotFather in Telegram" -ForegroundColor White
Write-Host "Then deploy cloudflare/telegram-bot" -ForegroundColor Gray
Write-Host "Send /start to your bot to get your User ID" -ForegroundColor Gray
Write-Host ""

$telegramId = Read-Host "Telegram User ID (Enter to skip)"

if ($telegramId) {
    Write-OK "Telegram: $telegramId"
} else {
    Write-Host "Telegram: skipped" -ForegroundColor Gray
}

# Step 4: Detect IDEs
Write-Header "Step 4: Detecting IDEs"

$ideConfigs = @(
    @{ Name = "Claude Desktop"; Path = "$env:APPDATA\Claude\claude_desktop_config.json" },
    @{ Name = "Cursor"; Path = "$env:USERPROFILE\.cursor\mcp.json" },
    @{ Name = "Windsurf"; Path = "$env:USERPROFILE\.codeium\windsurf\mcp_config.json" },
    @{ Name = "OpenCode"; Path = "$env:USERPROFILE\.opencode\config.json" },
    @{ Name = "VS Code"; Path = "$env:USERPROFILE\.vscode\mcp.json" }
)

$foundIDEs = @()
foreach ($ide in $ideConfigs) {
    if (Test-Path $ide.Path) {
        Write-OK "$($ide.Name) found"
        $foundIDEs += $ide
    } else {
        Write-Host "  $($ide.Name): not found" -ForegroundColor DarkGray
    }
}

# Step 5: Build Config JSON string
Write-Header "Step 5: Configuration"

if ($mode -eq "remote") {
    if ($telegramId) {
        $configJson = @"
{
  "mcpServers": {
    "mcp-swarm": {
      "command": "npx",
      "args": ["mcp-swarm-remote", "--url", "$serverUrl", "--telegram-user-id", "$telegramId"]
    }
  }
}
"@
        $mcpSwarmJson = @"
{
      "command": "npx",
      "args": ["mcp-swarm-remote", "--url", "$serverUrl", "--telegram-user-id", "$telegramId"]
    }
"@
    } else {
        $configJson = @"
{
  "mcpServers": {
    "mcp-swarm": {
      "command": "npx",
      "args": ["mcp-swarm-remote", "--url", "$serverUrl"]
    }
  }
}
"@
        $mcpSwarmJson = @"
{
      "command": "npx",
      "args": ["mcp-swarm-remote", "--url", "$serverUrl"]
    }
"@
    }
} else {
    if ($telegramId) {
        $configJson = @"
{
  "mcpServers": {
    "mcp-swarm": {
      "command": "npx",
      "args": ["mcp-swarm"],
      "env": {
        "SWARM_HUB_URL": "$hubUrl",
        "TELEGRAM_USER_ID": "$telegramId"
      }
    }
  }
}
"@
    } else {
        $configJson = @"
{
  "mcpServers": {
    "mcp-swarm": {
      "command": "npx",
      "args": ["mcp-swarm"],
      "env": {
        "SWARM_HUB_URL": "$hubUrl"
      }
    }
  }
}
"@
    }
}

Write-Host "Config to add:" -ForegroundColor White
Write-Host "----------------------------------------" -ForegroundColor DarkGray
Write-Host $configJson -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor DarkGray
Write-Host ""

# Step 6: Install
Write-Header "Step 6: Install to IDEs"

if ($foundIDEs.Count -gt 0) {
    Write-Host "Found $($foundIDEs.Count) IDE(s)." -ForegroundColor White
    $doInstall = Read-Host "Auto-install? [Y/n]"
    
    if ($doInstall -ne "n" -and $doInstall -ne "N") {
        foreach ($ide in $foundIDEs) {
            try {
                $idePath = $ide.Path
                
                # Read existing config as text
                $existingJson = "{}"
                if (Test-Path $idePath) {
                    $existingJson = Get-Content $idePath -Raw -ErrorAction SilentlyContinue
                    if (-not $existingJson) { $existingJson = "{}" }
                }
                
                # Parse with PowerShell 5 compatible method
                $existing = $existingJson | ConvertFrom-Json
                
                # Ensure mcpServers exists
                if (-not (Get-Member -InputObject $existing -Name "mcpServers" -MemberType Properties)) {
                    $existing | Add-Member -NotePropertyName "mcpServers" -NotePropertyValue ([PSCustomObject]@{})
                }
                
                # Parse mcp-swarm config
                $mcpSwarm = $configJson | ConvertFrom-Json
                $mcpSwarmValue = $mcpSwarm.mcpServers."mcp-swarm"
                
                # Add/update mcp-swarm
                if (Get-Member -InputObject $existing.mcpServers -Name "mcp-swarm" -MemberType Properties) {
                    $existing.mcpServers."mcp-swarm" = $mcpSwarmValue
                } else {
                    $existing.mcpServers | Add-Member -NotePropertyName "mcp-swarm" -NotePropertyValue $mcpSwarmValue
                }
                
                # Create directory if needed
                $dir = Split-Path $idePath -Parent
                if (-not (Test-Path $dir)) {
                    New-Item -ItemType Directory -Path $dir -Force | Out-Null
                }
                
                # Write back
                $existing | ConvertTo-Json -Depth 10 | Set-Content $idePath -Encoding UTF8
                Write-OK "$($ide.Name): Updated"
            } catch {
                Write-Err "$($ide.Name): Failed - $_"
            }
        }
    }
} else {
    Write-Warn "No IDEs found. Copy config manually."
}

# Done
Write-Header "Done!"

Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1. Restart your IDE" -ForegroundColor Cyan
Write-Host "  2. Say: Use MCP Swarm. Register as agent." -ForegroundColor Cyan
Write-Host ""

if ($telegramId) {
    Write-Host "Telegram: User $telegramId" -ForegroundColor Green
    Write-Host ""
}

Write-Host "Docs: https://github.com/AbdrAbdr/Swarm_MCP" -ForegroundColor Gray
Write-Host "Bot: @MyCFSwarmBot" -ForegroundColor Gray
Write-Host ""

Read-Host "Press Enter to exit"
