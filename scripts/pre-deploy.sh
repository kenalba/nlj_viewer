#!/bin/bash

# Pre-deployment verification script
echo "🔍 Running pre-deployment checks..."

# Check if build succeeds
echo "📦 Building project..."
if ! npm run build; then
    echo "❌ Build failed! Please fix build errors before deploying."
    exit 1
fi

# Run tests
echo "🧪 Running tests..."
if ! npm test -- --run; then
    echo "❌ Tests failed! Please fix test failures before deploying."
    exit 1
fi

# Check for critical lint errors (only no-explicit-any and other serious issues)
echo "🔧 Checking for critical lint issues..."
if npm run lint 2>&1 | grep -E "(error|✖)" | grep -v "react-refresh/only-export-components"; then
    echo "⚠️  Found lint issues. Consider fixing these before deployment."
    echo "ℹ️  Build and tests passed, so deployment can proceed."
else
    echo "✅ No critical lint issues found."
fi

echo "✅ Pre-deployment checks completed successfully!"
echo "🚀 Ready for deployment!"