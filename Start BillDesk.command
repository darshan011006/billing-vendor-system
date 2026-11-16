#!/bin/bash
# Double-click to run BillDesk (Billing & Vendor Management) on http://localhost:3000
cd "$(dirname "$0")"
exec > >(tee -a run.log) 2>&1
echo ""
echo "=== BillDesk · Next.js + PostgreSQL + MongoDB · $(date) ==="

NODE_OK=0
if command -v node >/dev/null 2>&1; then
  MAJOR=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
  [ "$MAJOR" -ge 20 ] && NODE_OK=1
fi
if [ "$NODE_OK" -eq 0 ]; then
  if [ ! -x ".tools/node/bin/node" ]; then
    echo "Node.js 20+ not found - downloading a private copy into .tools/ (about 40 MB)..."
    ARCH=$(uname -m); [ "$ARCH" = "x86_64" ] && ARCH=x64
    mkdir -p .tools && curl -fSL "https://nodejs.org/dist/v20.18.1/node-v20.18.1-darwin-$ARCH.tar.gz" | tar -xz -C .tools \
      && mv ".tools/node-v20.18.1-darwin-$ARCH" .tools/node
  fi
  export PATH="$PWD/.tools/node/bin:$PATH"
fi
echo "Using Node $(node -v), npm $(npm -v)"

if [ ! -d node_modules/next ]; then
  echo "Installing packages (first run only, 1-2 minutes)..."
  npm install --no-audit --no-fund || { echo "npm install failed"; read -p "Press Enter to close"; exit 1; }
fi

# open the browser once the app answers
( for i in $(seq 1 180); do
    if curl -s -o /dev/null http://localhost:3000/login; then open http://localhost:3000; break; fi
    sleep 2
  done ) &

npm run dev
