#!/bin/bash
echo "🧹 Rydder prosjekt..."
rm -rf .next node_modules package-lock.json

echo "📦 Installerer dependencies..."
npm install

echo "🔍 Kjører lint..."
npm run lint || { echo "❌ Lint-feil funnet. Fiks disse først."; exit 1; }

echo "⚒️ Bygger prosjekt..."
npm run build || { echo "❌ Build feilet."; exit 1; }

echo "🚀 Starter utviklingsserver..."
npm run dev &

# Vent et par sekunder så vi er sikre på at serveren kjører
sleep 5

echo "💾 Git commit av stabilt checkpoint..."
git add .
git commit -m "Stable checkpoint after successful super.sh run" || echo "⚠️ Ingen endringer å committe"
git push origin main || echo "⚠️ Kunne ikke pushe (sjekk git-remote eller nettverk)"

echo "✅ Ferdig!"
