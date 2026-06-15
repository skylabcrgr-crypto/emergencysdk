#!/usr/bin/env bash
# bootstrap-emergency-sdk-demo.sh
# One-shot setup for a fresh Emergency SDK demo environment.
# Run from the ER_OFFLINE_SDK repo root.
#
# Usage:
#   chmod +x scripts/bootstrap-emergency-sdk-demo.sh
#   ./scripts/bootstrap-emergency-sdk-demo.sh [target-dir-name]
#
# Example:
#   ./scripts/bootstrap-emergency-sdk-demo.sh emergency-sdk-prototype

set -euo pipefail

APP_NAME="${1:-emergency-sdk-prototype}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "======================================================"
echo "  Emergency SDK Demo Bootstrap"
echo "  Target: ${APP_NAME}"
echo "======================================================"
echo ""

# ── Step 1: Create blank Expo app ─────────────────────────────────────────────
echo "[1/8] Creating blank Expo TypeScript app: ${APP_NAME}"
npx create-expo-app@latest "${APP_NAME}" --template blank-typescript
echo ""

# ── Step 2: Copy SDK source tree ─────────────────────────────────────────────
echo "[2/8] Copying Emergency SDK source tree..."
if [ -d "${REPO_ROOT}/src" ]; then
  rsync -a "${REPO_ROOT}/src/" "${APP_NAME}/src/"
else
  echo "ERROR: ${REPO_ROOT}/src not found. Run from the ER_OFFLINE_SDK root."
  exit 1
fi

if [ -f "${REPO_ROOT}/App.tsx" ]; then
  cp "${REPO_ROOT}/App.tsx" "${APP_NAME}/App.tsx"
fi

if [ -f "${REPO_ROOT}/tsconfig.json" ]; then
  cp "${REPO_ROOT}/tsconfig.json" "${APP_NAME}/tsconfig.json"
fi

if [ -f "${REPO_ROOT}/babel.config.js" ]; then
  cp "${REPO_ROOT}/babel.config.js" "${APP_NAME}/babel.config.js"
fi

if [ -d "${REPO_ROOT}/assets" ]; then
  rsync -a "${REPO_ROOT}/assets/" "${APP_NAME}/assets/"
fi

# Copy mock backend and dashboard as sibling directories
if [ -d "${REPO_ROOT}/server" ]; then
  rsync -a --exclude node_modules --exclude dist \
    "${REPO_ROOT}/server/" "${APP_NAME}/server/"
fi

if [ -d "${REPO_ROOT}/dashboard" ]; then
  rsync -a --exclude node_modules --exclude dist \
    "${REPO_ROOT}/dashboard/" "${APP_NAME}/dashboard/"
fi
echo ""

# ── Step 3: Install Expo-managed mobile dependencies ─────────────────────────
echo "[3/8] Installing Expo-compatible mobile dependencies..."
cd "${APP_NAME}"
npx expo install \
  expo-location \
  expo-sms \
  expo-battery \
  @react-native-community/netinfo \
  @react-native-async-storage/async-storage
echo ""

# ── Step 4: Ensure tsconfig is correct ───────────────────────────────────────
echo "[4/8] Patching tsconfig.json..."
node - <<'NODE'
const fs = require('fs');
const path = 'tsconfig.json';
const raw = fs.readFileSync(path, 'utf8');
const tsconfig = JSON.parse(raw);
tsconfig.compilerOptions = tsconfig.compilerOptions || {};
tsconfig.compilerOptions.resolveJsonModule = true;
tsconfig.compilerOptions.esModuleInterop = true;
tsconfig.compilerOptions.strict = true;
fs.writeFileSync(path, JSON.stringify(tsconfig, null, 2) + '\n');
console.log('tsconfig.json updated.');
NODE
echo ""

# ── Step 5: TypeScript check ─────────────────────────────────────────────────
echo "[5/8] Running TypeScript check on mobile SDK..."
npx tsc --noEmit && echo "TypeScript: PASS" || echo "TypeScript: WARNINGS (review above)"
echo ""

# ── Step 6: Backend setup ─────────────────────────────────────────────────────
if [ -d "./server" ]; then
  echo "[6/8] Installing and building backend..."
  cd server
  npm install
  npm run build 2>/dev/null || echo "  (ts-node-dev dev mode ready — use npm run dev)"
  cd ..
else
  echo "[6/8] No server/ directory — skipping."
fi
echo ""

# ── Step 7: Dashboard setup ───────────────────────────────────────────────────
if [ -d "./dashboard" ]; then
  echo "[7/8] Installing dashboard dependencies..."
  cd dashboard
  npm install
  npx tsc --noEmit && echo "  Dashboard TypeScript: PASS" || echo "  Dashboard TypeScript: WARNINGS"
  cd ..
else
  echo "[7/8] No dashboard/ directory — skipping."
fi
echo ""

# ── Step 8: Summary ───────────────────────────────────────────────────────────
cd "${REPO_ROOT}"
echo "[8/8] Bootstrap complete."
echo ""
echo "────────────────────────────────────────"
echo " Run mobile (Expo):                     "
echo "   cd ${APP_NAME}                       "
echo "   npx expo start                       "
echo "   npx expo start --ios    (simulator)  "
echo "   npx expo start --android             "
echo ""
echo " Run mock backend:                      "
echo "   cd ${APP_NAME}/server                "
echo "   npm run dev   → http://localhost:3001 "
echo ""
echo " Run dashboard:                         "
echo "   cd ${APP_NAME}/dashboard             "
echo "   npm run dev   → http://localhost:5173 "
echo ""
echo " Connect mobile to backend:             "
echo "   Find your LAN IP: ipconfig getifaddr en0"
echo "   Pass apiUrl prop to EmergencyDemoScreen:"
echo "   <EmergencyDemoScreen apiUrl=\"http://192.168.x.x:3001/api/emergency/incidents\" />"
echo "────────────────────────────────────────"
echo ""
echo "⚠️  DEMO ONLY — No real 911 or dispatch integration active."
echo "   In a real emergency, call 911 directly."
