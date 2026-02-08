#!/bin/bash
set -e

echo "🚀 Deploying tg-wholesale-miniapp to Vercel..."

# 1. Install dependencies
echo "📦 Installing dependencies..."
npm install

# 2. Test build locally
echo "🔨 Testing build..."
npm run build

# 3. Deploy to Vercel
echo "🌐 Deploying to Vercel..."
npx vercel --yes --prod \
  -e TELEGRAM_BOT_TOKEN="8205527010:AAF2JAcXYwLSGfNpos_n4FwTsj9xrimUCTc" \
  -e SESSION_SECRET="7f6cb45a3ae22211a2da36f89f9cfb8b03cebc08dc2ee54b2a9f57a12fd2f416" \
  -e NEXT_PUBLIC_SUPABASE_URL="https://viaapbshcjhqisxbknyc.supabase.co" \
  -e SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpYWFwYnNoY2pocWlzeGJrbnljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1Mzc2MjgsImV4cCI6MjA4NjExMzYyOH0.5phDPgi7V4FnleSKvEDsQZtXWTXcCero7bDwrfKvEVo"

echo ""
echo "✅ Deployed! Copy the URL above and use it to configure your Telegram Bot:"
echo "   1. Go to @BotFather in Telegram"
echo "   2. Send /mybots → choose your bot → Bot Settings → Menu Button → Configure"
echo "   3. Set URL: <YOUR_VERCEL_URL>"
echo "   4. Or: /setmenubutton → send the URL"
echo ""
echo "📱 To set up Mini App:"
echo "   Send to @BotFather: /newapp → choose bot → paste your Vercel URL"
