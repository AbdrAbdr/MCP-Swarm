#!/bin/bash
#
# MCP Swarm One-Click Installer for macOS/Linux
# 
# Just run: curl -fsSL https://raw.githubusercontent.com/AbdrAbdr/Swarm_MCP/main/install.sh | bash
# Or: ./install.sh
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Helpers
ok() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
err() { echo -e "${RED}✗${NC} $1"; }
step() { echo -e "${YELLOW}►${NC} $1"; }
header() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo ""
}

# Banner
clear
echo ""
echo -e "${MAGENTA}  ╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${MAGENTA}  ║                                                           ║${NC}"
echo -e "${MAGENTA}  ║   🐝 MCP Swarm One-Click Installer                       ║${NC}"
echo -e "${MAGENTA}  ║                                                           ║${NC}"
echo -e "${MAGENTA}  ║   Universal AI Agent Coordination Platform                ║${NC}"
echo -e "${MAGENTA}  ║                                                           ║${NC}"
echo -e "${MAGENTA}  ╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Detect OS
OS="linux"
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
fi

# Step 1: Check Node.js
header "Step 1: Checking Node.js"

NODE_INSTALLED=false
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    ok "Node.js found: $NODE_VERSION"
    NODE_INSTALLED=true
fi

if [ "$NODE_INSTALLED" = false ]; then
    warn "Node.js not found!"
    echo ""
    echo "Node.js is required. Choose installation method:"
    echo ""
    echo -e "  ${CYAN}1) Auto-install (recommended)${NC}"
    if [ "$OS" = "macos" ]; then
        echo -e "     ${GRAY}Uses Homebrew or downloads from nodejs.org${NC}"
    else
        echo -e "     ${GRAY}Uses package manager (apt/yum/pacman)${NC}"
    fi
    echo -e "  ${CYAN}2) Open nodejs.org to download manually${NC}"
    echo -e "  ${CYAN}3) Exit${NC}"
    echo ""
    
    read -p "Choose [1/2/3]: " choice
    
    case $choice in
        1)
            if [ "$OS" = "macos" ]; then
                # macOS - try Homebrew first
                if command -v brew &> /dev/null; then
                    step "Installing Node.js via Homebrew..."
                    brew install node
                    ok "Node.js installed!"
                else
                    # Try to install Homebrew first
                    step "Installing Homebrew first..."
                    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
                    step "Installing Node.js via Homebrew..."
                    brew install node
                    ok "Node.js installed!"
                fi
            else
                # Linux - detect package manager
                if command -v apt-get &> /dev/null; then
                    step "Installing Node.js via apt..."
                    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
                    sudo apt-get install -y nodejs
                elif command -v dnf &> /dev/null; then
                    step "Installing Node.js via dnf..."
                    sudo dnf install -y nodejs
                elif command -v yum &> /dev/null; then
                    step "Installing Node.js via yum..."
                    curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
                    sudo yum install -y nodejs
                elif command -v pacman &> /dev/null; then
                    step "Installing Node.js via pacman..."
                    sudo pacman -S nodejs npm
                else
                    err "Could not detect package manager. Please install Node.js manually."
                    echo "Visit: https://nodejs.org"
                    exit 1
                fi
                ok "Node.js installed!"
            fi
            
            # Verify installation
            if command -v node &> /dev/null; then
                NODE_VERSION=$(node --version)
                ok "Node.js verified: $NODE_VERSION"
            else
                err "Installation may require terminal restart. Please run this script again."
                exit 1
            fi
            ;;
        2)
            step "Opening nodejs.org..."
            if [ "$OS" = "macos" ]; then
                open "https://nodejs.org"
            else
                xdg-open "https://nodejs.org" 2>/dev/null || echo "Visit: https://nodejs.org"
            fi
            echo ""
            echo "After installing Node.js, run this script again."
            exit 0
            ;;
        *)
            echo "Exiting."
            exit 0
            ;;
    esac
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    ok "npm found: v$NPM_VERSION"
else
    err "npm not found. Please reinstall Node.js from https://nodejs.org"
    exit 1
fi

# Step 2: Choose Mode
header "Step 2: Choose Mode"

echo -e "  ${GREEN}1) Remote (Recommended)${NC}"
echo -e "     ${GRAY}Uses cloud server, minimal setup, works everywhere${NC}"
echo ""
echo -e "  ${YELLOW}2) Local + Hub${NC}"
echo -e "     ${GRAY}Full local install with cloud sync${NC}"
echo ""

read -p "Choose [1/2] (default: 1): " mode_choice
MODE="remote"
if [ "$mode_choice" = "2" ]; then
    MODE="local"
fi
ok "Mode: $MODE"

# Step 3: Telegram
header "Step 3: Telegram Notifications (Optional)"

echo "Get notified about tasks, agents, CI errors via Telegram."
echo ""
echo -e "${GRAY}To get your Telegram User ID:${NC}"
echo -e "${GRAY}  1. Open Telegram and find @MyCFSwarmBot${NC}"
echo -e "${GRAY}  2. Send /start${NC}"
echo -e "${GRAY}  3. Bot will show your User ID${NC}"
echo ""

read -p "Enter Telegram User ID (or press Enter to skip): " TELEGRAM_ID

if [ -n "$TELEGRAM_ID" ]; then
    ok "Telegram ID: $TELEGRAM_ID"
else
    echo -e "${GRAY}Telegram: skipped${NC}"
fi

# Step 4: Detect IDEs
header "Step 4: Detecting IDEs"

HOME_DIR="$HOME"

declare -A IDE_CONFIGS
if [ "$OS" = "macos" ]; then
    IDE_CONFIGS["Claude Desktop"]="$HOME_DIR/Library/Application Support/Claude/claude_desktop_config.json"
else
    IDE_CONFIGS["Claude Desktop"]="$HOME_DIR/.config/claude/claude_desktop_config.json"
fi
IDE_CONFIGS["Cursor"]="$HOME_DIR/.cursor/mcp.json"
IDE_CONFIGS["Windsurf"]="$HOME_DIR/.codeium/windsurf/mcp_config.json"
IDE_CONFIGS["OpenCode"]="$HOME_DIR/.opencode/config.json"
IDE_CONFIGS["VS Code"]="$HOME_DIR/.vscode/mcp.json"

FOUND_IDES=()
for ide in "${!IDE_CONFIGS[@]}"; do
    path="${IDE_CONFIGS[$ide]}"
    if [ -f "$path" ]; then
        ok "$ide found"
        FOUND_IDES+=("$ide")
    else
        echo -e "  ${GRAY}$ide: not found${NC}"
    fi
done

# Step 5: Generate Config
header "Step 5: MCP Configuration"

if [ "$MODE" = "remote" ]; then
    if [ -n "$TELEGRAM_ID" ]; then
        CONFIG_JSON=$(cat <<EOF
{
  "mcpServers": {
    "mcp-swarm": {
      "command": "npx",
      "args": [
        "mcp-swarm-remote",
        "--url",
        "https://mcp-swarm-server.unilife-ch.workers.dev/mcp",
        "--telegram-user-id",
        "$TELEGRAM_ID"
      ]
    }
  }
}
EOF
)
    else
        CONFIG_JSON=$(cat <<EOF
{
  "mcpServers": {
    "mcp-swarm": {
      "command": "npx",
      "args": [
        "mcp-swarm-remote",
        "--url",
        "https://mcp-swarm-server.unilife-ch.workers.dev/mcp"
      ]
    }
  }
}
EOF
)
    fi
else
    if [ -n "$TELEGRAM_ID" ]; then
        CONFIG_JSON=$(cat <<EOF
{
  "mcpServers": {
    "mcp-swarm": {
      "command": "npx",
      "args": ["mcp-swarm"],
      "env": {
        "SWARM_HUB_URL": "wss://mcp-swarm-hub.unilife-ch.workers.dev/ws",
        "TELEGRAM_USER_ID": "$TELEGRAM_ID"
      }
    }
  }
}
EOF
)
    else
        CONFIG_JSON=$(cat <<EOF
{
  "mcpServers": {
    "mcp-swarm": {
      "command": "npx",
      "args": ["mcp-swarm"],
      "env": {
        "SWARM_HUB_URL": "wss://mcp-swarm-hub.unilife-ch.workers.dev/ws"
      }
    }
  }
}
EOF
)
    fi
fi

echo "Configuration to add:"
echo ""
echo -e "${GRAY}────────────────────────────────────────────────────────────${NC}"
echo -e "${CYAN}$CONFIG_JSON${NC}"
echo -e "${GRAY}────────────────────────────────────────────────────────────${NC}"
echo ""

# Step 6: Install to IDEs
header "Step 6: Install to IDEs"

if [ ${#FOUND_IDES[@]} -gt 0 ]; then
    echo "Found ${#FOUND_IDES[@]} IDE(s). Install MCP Swarm to them?"
    echo ""
    read -p "Auto-install? [Y/n]: " do_install
    
    if [ "$do_install" != "n" ] && [ "$do_install" != "N" ]; then
        for ide in "${FOUND_IDES[@]}"; do
            path="${IDE_CONFIGS[$ide]}"
            
            # Check if jq is available for proper JSON merging
            if command -v jq &> /dev/null; then
                # Use jq for proper merge
                if [ -f "$path" ]; then
                    existing=$(cat "$path")
                    merged=$(echo "$existing" | jq --argjson new "$CONFIG_JSON" '.mcpServers["mcp-swarm"] = $new.mcpServers["mcp-swarm"]')
                    echo "$merged" > "$path"
                else
                    mkdir -p "$(dirname "$path")"
                    echo "$CONFIG_JSON" > "$path"
                fi
                ok "$ide: Updated successfully"
            else
                # Fallback: just show warning
                warn "$ide: Install 'jq' for auto-merge, or copy config manually"
            fi
        done
    else
        echo -e "${GRAY}Manual install: Copy the config above to your IDE config files${NC}"
    fi
else
    warn "No IDEs found. Copy the config manually when you install an IDE."
fi

# Step 7: Done
header "✅ Installation Complete!"

echo "Next steps:"
echo ""
echo -e "  ${CYAN}1. Restart your IDE${NC}"
echo -e "  ${CYAN}2. Tell your AI: \"Use MCP Swarm. Register as agent.\"${NC}"
echo ""

if [ -n "$TELEGRAM_ID" ]; then
    echo -e "${GREEN}📱 Telegram notifications: User $TELEGRAM_ID${NC}"
    echo ""
fi

echo -e "${GRAY}📖 Documentation: https://github.com/AbdrAbdr/Swarm_MCP${NC}"
echo -e "${GRAY}💬 Telegram Bot: @MyCFSwarmBot${NC}"
echo ""
