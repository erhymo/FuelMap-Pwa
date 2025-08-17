#!/bin/bash
echo "🚀 Starter FuelMap path-fix..."

# DashboardContent
sed -i '' 's|../src/lib/firebase|../lib/firebase|g' components/DashboardContent.tsx
sed -i '' 's|../src/lib/log|../lib/log|g' components/DashboardContent.tsx

# Login
sed -i '' 's|../src/lib/firebase|../lib/firebase|g' components/Login.tsx

# Admin
sed -i '' 's|../../src/lib/firebase|../../lib/firebase|g' app/admin/page.tsx
sed -i '' 's|../../src/lib/log|../../lib/log|g' app/admin/page.tsx

# MapView
sed -i '' 's|../../src/lib/firebase|../../lib/firebase|g' app/dashboard/MapView.tsx

# Sjekk at alt ser bra ut
echo "🔍 Sjekker imports..."
grep -r "src/lib" app components || echo "✅ Ingen feil imports igjen!"

# Bygg prosjektet
npm run build
