#!/bin/bash
set -e

echo "Initializing Ralph LRS configuration..."

# Create the config directory structure (Ralph looks in home directory when running as root)
mkdir -p /root/.config/ralph

# Copy config files to the expected location
cp /app/config/auth.json /root/.config/ralph/auth.json
cp /app/config/settings.yml /root/.config/ralph/settings.yml

echo "Configuration files copied successfully:"
ls -la /root/.config/ralph/

echo "Starting Ralph LRS server..."
exec ralph runserver --backend es