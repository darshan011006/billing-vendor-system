#!/bin/bash
# Double-click to push this project to https://github.com/darshan011006/billing-vendor-system
cd "$(dirname "$0")"
echo "=== Pushing BillDesk to GitHub ==="
if ! xcode-select -p >/dev/null 2>&1; then
  echo "Git is not installed. macOS will now offer to install the Command Line Tools."
  echo "Click Install, wait for it to finish, then double-click this file again."
  xcode-select --install
  read -p "Press Enter to close"; exit 1
fi
git remote remove origin 2>/dev/null
git remote add origin https://github.com/darshan011006/billing-vendor-system.git
git branch -M main
echo ""
echo "If asked to sign in: Username = your GitHub username (darshan011006)."
echo "Password = a GitHub personal access token, NOT your GitHub password."
echo "Make one at https://github.com/settings/tokens/new (tick 'repo'), then paste it (it stays hidden)."
echo ""
if git push -u origin main; then
  echo ""
  echo "Done: https://github.com/darshan011006/billing-vendor-system"
else
  echo ""
  echo "Push failed. Check the token, or ask Claude to push instead after adding bhuvankumarp as a collaborator."
fi
read -p "Press Enter to close"
