#!/bin/bash

echo "=== Shopify POS Extension Deploy Script ==="
echo ""

cd "$(dirname "$0")"

echo "Step 1: Stashing any local changes..."
git stash
echo ""

echo "Step 2: Pulling latest from remote..."
git pull
echo ""

echo "Step 3: Installing dependencies..."
npm install
echo ""

echo "Step 4: Deploying to Shopify..."
npx shopify app deploy --force
echo ""

echo "=== Deploy Complete ==="
