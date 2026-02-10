---
description: Install S.P.A. Agent Framework (spa-agents package) in current project
model: Haiku
---

# Install S.P.A. Agent Framework

Installing package `spa-agents` from GitHub repository...

```bash
# Initialize project if needed
if [ ! -f pyproject.toml ]; then
    echo "📦 No pyproject.toml found, initializing project..."
    uv init --no-readme --no-pin-python
    echo "✅ Project initialized"
fi

# Install spa-agents package from GitHub
echo "📦 Installing spa-agents from GitHub..."
uv add "git+https://github.com/emssik/agents.spa.git#subdirectory=src/modules"

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Installation successful!"
    echo ""

    # Verify installation by importing all modules
    echo "🔍 Verifying installation..."
    VERIFY_OUTPUT=$(uv run python -c "
from claude_code_client import ClaudeCodeClient
from communication_client import CommunicationClient
from processes import Context, execute_command, ensure_health
print('✅ All modules imported successfully')
" 2>&1)
    VERIFY_EXIT=$?

    if [ $VERIFY_EXIT -eq 0 ]; then
        echo "$VERIFY_OUTPUT"
        echo ""
        echo "🎉 S.P.A. Agent Framework installed successfully!"
        echo ""
        echo "Package 'spa-agents' includes:"
        echo "  • claude_code_client - Claude Code CLI client"
        echo "  • communication_client - Multi-platform messaging"
        echo "  • processes - Workflow utilities"
        echo ""
        echo "Next steps:"
        echo "  1. Copy workflow templates: mkdir -p src/workflows"
        echo "  2. Use /process-feature to create custom workflows"
        echo "  3. Run /health --autofix before starting workflows"
        echo ""
        echo "Documentation: https://github.com/emssik/agents.spa"
    else
        echo "❌ Verification failed - modules cannot be imported:"
        echo ""
        echo "$VERIFY_OUTPUT"
        echo ""
        echo "🔧 Troubleshooting:"
        echo "  1. Run: uv sync"
        echo "  2. Check src/modules/ structure is correct"
        echo "  3. Verify pyproject.toml packages configuration"
        exit 1
    fi
else
    echo ""
    echo "❌ Installation failed"
    echo "   Check error messages above"
    echo "   Repository: https://github.com/emssik/agents.spa"
fi
```
