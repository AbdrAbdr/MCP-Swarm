<# 
.SYNOPSIS
    MCP Swarm One-Click Installer for Windows
.DESCRIPTION
    Downloads and installs MCP Swarm with all dependencies.
    Just run: .\install.ps1
.NOTES
    Requires PowerShell 5.1+ (included in Windows 10/11)
#>

$ErrorActionPreference = "Stop"

# Colors
function Write-Color($Text, $Color = "White") {
    Write-Host $Text -ForegroundColor $Color
}

function Write-Header($Text) {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step($Text) {
    Write-Host "► $Text" -ForegroundColor Yellow
}

function Write-OK($Text) {
    Write-Host "✓ $Text" -ForegroundColor Green
}

function Write-Warn($Text) {
    Write-Host "⚠ $Text" -ForegroundColor Yellow
}

function Write-Err($Text) {
    Write-Host "✗ $Text" -ForegroundColor Red
}

# Banner
Clear-Host
Write-Host ""
Write-Host "  ╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "  ║                                                           ║" -ForegroundColor Magenta
Write-Host "  ║   🐝 MCP Swarm One-Click Installer                       ║" -ForegroundColor Magenta
Write-Host "  ║                                                           ║" -ForegroundColor Magenta
Write-Host "  ║   Universal AI Agent Coordination Platform                ║" -ForegroundColor Magenta
Write-Host "  ║                                                           ║" -ForegroundColor Magenta
Write-Host "  ╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""

# Step 1: Check Node.js
Write-Header "Step 1: Checking Node.js"

$nodeInstalled = $false
$nodeVersion = ""

try {
    $nodeVersion = & node --version 2>$null
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
    Write-Host "Node.js is required. Choose installation method:" -ForegroundColor White
    Write-Host ""
    Write-Host "  1) Auto-install via winget (recommended)" -ForegroundColor Cyan
    Write-Host "  2) Open nodejs.org to download manually" -ForegroundColor Cyan
    Write-Host "  3) Exit" -ForegroundColor Cyan
    Write-Host ""
    
    $choice = Read-Host "Choose [1/2/3]"
    
    switch ($choice) {
        "1" {
            Write-Step "Installing Node.js via winget..."
            try {
                winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
                Write-OK "Node.js installed! Please restart this script."
                Write-Host ""
                Write-Host "Run again: .\install.ps1" -ForegroundColor Yellow
                exit 0
            } catch {
                Write-Err "winget failed. Please install Node.js manually from https://nodejs.org"
                Start-Process "https://nodejs.org"
                exit 1
            }
        }
        "2" {
            Write-Step "Opening nodejs.org..."
            Start-Process "https://nodejs.org"
            Write-Host ""
            Write-Host "After installing Node.js, run this script again: .\install.ps1" -ForegroundColor Yellow
            exit 0
        }
        default {
            Write-Host "Exiting." -ForegroundColor Gray
            exit 0
        }
    }
}

# Check npm
try {
    $npmVersion = & npm --version 2>$null
    Write-OK "npm found: v$npmVersion"
} catch {
    Write-Err "npm not found. Please reinstall Node.js from https://nodejs.org"
    exit 1
}

# Step 2: Installation Mode
Write-Header "Step 2: Choose Mode"

Write-Host "  1) Remote (Recommended)" -ForegroundColor Green
Write-Host "     Uses cloud server, minimal setup, works everywhere" -ForegroundColor Gray
Write-Host ""
Write-Host "  2) Local + Hub" -ForegroundColor Yellow  
Write-Host "     Full local install with cloud sync" -ForegroundColor Gray
Write-Host ""

$mode = Read-Host "Choose [1/2] (default: 1)"
if ($mode -ne "2") { $mode = "remote" } else { $mode = "local" }

Write-OK "Mode: $mode"

# Step 3: Telegram
Write-Header "Step 3: Telegram Notifications (Optional)"

Write-Host "Get notified about tasks, agents, CI errors via Telegram." -ForegroundColor White
Write-Host ""
Write-Host "To get your Telegram User ID:" -ForegroundColor Gray
Write-Host "  1. Open Telegram and find @MyCFSwarmBot" -ForegroundColor Gray
Write-Host "  2. Send /start" -ForegroundColor Gray
Write-Host "  3. Bot will show your User ID" -ForegroundColor Gray
Write-Host ""

$telegramId = Read-Host "Enter Telegram User ID (or press Enter to skip)"

if ($telegramId) {
    Write-OK "Telegram ID: $telegramId"
} else {
    Write-Host "Telegram: skipped" -ForegroundColor Gray
}

# Step 4: Detect IDEs
Write-Header "Step 4: Detecting IDEs"

$ideConfigs = @(
    @{
        Name = "Claude Desktop"
        Path = "$env:APPDATA\Claude\claude_desktop_config.json"
    },
    @{
        Name = "Cursor"
        Path = "$env:USERPROFILE\.cursor\mcp.json"
    },
    @{
        Name = "Windsurf"
        Path = "$env:USERPROFILE\.codeium\windsurf\mcp_config.json"
    },
    @{
        Name = "OpenCode"
        Path = "$env:USERPROFILE\.opencode\config.json"
    },
    @{
        Name = "VS Code"
        Path = "$env:USERPROFILE\.vscode\mcp.json"
    }
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

# Step 5: Generate Config
Write-Header "Step 5: MCP Configuration"

# Build config
if ($mode -eq "remote") {
    $args = @("mcp-swarm-remote", "--url", "https://mcp-swarm-server.unilife-ch.workers.dev/mcp")
    if ($telegramId) {
        $args += "--telegram-user-id"
        $args += $telegramId
    }
    $mcpSwarmConfig = @{
        command = "npx"
        args = $args
    }
} else {
    $env = @{
        SWARM_HUB_URL = "wss://mcp-swarm-hub.unilife-ch.workers.dev/ws"
    }
    if ($telegramId) {
        $env["TELEGRAM_USER_ID"] = $telegramId
    }
    $mcpSwarmConfig = @{
        command = "npx"
        args = @("mcp-swarm")
        env = $env
    }
}

$configSnippet = @{
    mcpServers = @{
        "mcp-swarm" = $mcpSwarmConfig
    }
} | ConvertTo-Json -Depth 10

Write-Host "Configuration to add:" -ForegroundColor White
Write-Host ""
Write-Host "────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host $configSnippet -ForegroundColor Cyan
Write-Host "────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""

# Step 6: Install to IDEs
Write-Header "Step 6: Install to IDEs"

if ($foundIDEs.Count -gt 0) {
    Write-Host "Found $($foundIDEs.Count) IDE(s). Install MCP Swarm to them?" -ForegroundColor White
    Write-Host ""
    $install = Read-Host "Auto-install? [Y/n]"
    
    if ($install -ne "n" -and $install -ne "N") {
        foreach ($ide in $foundIDEs) {
            try {
                # Read existing config
                $existingConfig = @{}
                if (Test-Path $ide.Path) {
                    $content = Get-Content $ide.Path -Raw -ErrorAction SilentlyContinue
                    if ($content) {
                        $existingConfig = $content | ConvertFrom-Json -AsHashtable -ErrorAction SilentlyContinue
                        if (-not $existingConfig) { $existingConfig = @{} }
                    }
                }
                
                # Ensure mcpServers exists
                if (-not $existingConfig.ContainsKey("mcpServers")) {
                    $existingConfig["mcpServers"] = @{}
                }
                
                # Add/update mcp-swarm
                $existingConfig["mcpServers"]["mcp-swarm"] = $mcpSwarmConfig
                
                # Create directory if needed
                $dir = Split-Path $ide.Path -Parent
                if (-not (Test-Path $dir)) {
                    New-Item -ItemType Directory -Path $dir -Force | Out-Null
                }
                
                # Write config
                $existingConfig | ConvertTo-Json -Depth 10 | Set-Content $ide.Path -Encoding UTF8
                
                Write-OK "$($ide.Name): Updated successfully"
            } catch {
                Write-Err "$($ide.Name): Failed - $($_.Exception.Message)"
            }
        }
    } else {
        Write-Host "Manual install: Copy the config above to your IDE config files" -ForegroundColor Gray
    }
} else {
    Write-Warn "No IDEs found. Copy the config manually when you install an IDE."
}

# Step 7: Done
Write-Header "✅ Installation Complete!"

Write-Host "Next steps:" -ForegroundColor White
Write-Host ""
Write-Host "  1. Restart your IDE" -ForegroundColor Cyan
Write-Host "  2. Tell your AI: `"Use MCP Swarm. Register as agent.`"" -ForegroundColor Cyan
Write-Host ""

if ($telegramId) {
    Write-Host "📱 Telegram notifications: User $telegramId" -ForegroundColor Green
    Write-Host ""
}

Write-Host "📖 Documentation: https://github.com/AbdrAbdr/Swarm_MCP" -ForegroundColor Gray
Write-Host "💬 Telegram Bot: @MyCFSwarmBot" -ForegroundColor Gray
Write-Host ""

# Keep window open
Write-Host "Press any key to exit..." -ForegroundColor DarkGray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
