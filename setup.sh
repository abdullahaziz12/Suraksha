#!/bin/bash
# Suraksha Backend Setup Script
# This script sets up the complete backend environment

echo "╔════════════════════════════════════════════╗"
echo "║    🛡️  Suraksha Backend Setup             ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 14+ first."
    exit 1
fi

echo "✅ Node.js detected: $(node -v)"
echo "✅ NPM detected: $(npm -v)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║    Setup Complete! Ready to launch        ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "To start the server, run:"
echo ""
echo "  npm start              # Production mode"
echo "  npm run dev            # Development mode (with auto-reload)"
echo ""
echo "Server will be available at: http://localhost:3000"
echo ""
