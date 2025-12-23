# Vagaro POS Extension for Shopify

This is a Shopify POS UI Extension that displays Vagaro appointments directly in the Shopify POS app, allowing staff to add them to the cart for checkout.

## Prerequisites

1. **Shopify Partner Account** - Required to create and deploy Shopify apps
2. **Shopify CLI 3.0+** - Install with `npm install -g @shopify/cli`
3. **POS Pro Subscription** - Required for POS UI extensions
4. **Development Store** - Create one from your Partner Dashboard
5. **Mobile Device** - iOS or Android with Shopify POS app for testing

## Setup Instructions

### Step 1: Configure the App

1. Copy this folder to a new location outside of the main project
2. Update `shopify.app.toml`:
   - Replace `YOUR_CLIENT_ID` with your app's client ID from Partner Dashboard
   - Replace `YOUR_REPLIT_URL` with your deployed Replit URL (e.g., `vagaro-x-shopify-sync.replit.app`)

### Step 2: Update Backend URL

Edit `extensions/vagaro-appointments/src/config.ts`:
```typescript
export const CONFIG = {
  BACKEND_URL: 'https://your-actual-replit-url.replit.app',
};
```

Replace with your actual deployed Replit URL. This URL is used by both the Tile and Modal components.

### Step 3: Install Dependencies

```bash
cd shopify-pos-extension
npm install
cd extensions/vagaro-appointments
npm install
```

### Step 4: Connect to Shopify

```bash
npm run shopify app dev
```

This will:
- Prompt you to log in to your Partner account
- Create/connect to a Shopify app
- Start a local development server
- Create a tunnel for testing

### Step 5: Test on Device

1. In terminal, press `p` to open Developer Console
2. Click "View mobile" to get a QR code
3. Scan the QR code with your phone camera
4. The extension will install in preview mode in Shopify POS

### Step 6: Add Tile to Smart Grid

1. In Shopify POS, go to Settings
2. Find "Smart Grid" settings
3. Add the "Vagaro Appointments" tile

## How It Works

1. **Tile Display**: Shows count of pending Vagaro appointments
2. **Tap to Open**: Opens a modal with the full appointment list
3. **Add to Cart**: Tap any appointment to add it directly to the POS cart
4. **Auto-sync**: Appointments are fetched from your Vagaro sync backend

## API Endpoints Used

The extension calls these endpoints on your Replit backend:

- `GET /api/pos/pending-appointments` - Fetches pending appointments
- `POST /api/pos/mark-loaded/:id` - Marks appointment as loaded to cart

## Deployment

```bash
npm run shopify app deploy
```

Then in Partner Dashboard:
1. Go to your app > Versions
2. Select the deployed version
3. Click "Release"

## Troubleshooting

- **Extension not showing**: Make sure to add the tile from Smart Grid settings
- **API errors**: Check that your Replit backend is deployed and accessible
- **CORS errors**: The backend includes CORS headers for cross-origin requests

## Security Note

For production, update the CORS headers in `server/routes.ts` to restrict access to your specific Shopify store domain instead of using `*`.
