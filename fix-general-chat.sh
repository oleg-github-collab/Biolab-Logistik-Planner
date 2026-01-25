#!/bin/bash

echo "=== Fixing General Chat ==="
echo ""
echo "This script will call the API endpoint to add all users to general chat"
echo ""

# Get server URL from environment or use localhost
SERVER_URL="${SERVER_URL:-http://localhost:5001}"
echo "Server URL: $SERVER_URL"
echo ""

# You need to provide your authentication token
echo "Please login to your application, open DevTools (F12), go to Application > Local Storage"
echo "Copy the value of 'token' and paste it here:"
read -p "Token: " TOKEN

if [ -z "$TOKEN" ]; then
    echo "Error: Token is required"
    exit 1
fi

echo ""
echo "Calling fix-general-chat endpoint..."
echo ""

curl -X POST "${SERVER_URL}/api/admin/fix-general-chat" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -v

echo ""
echo ""
echo "Done! Please refresh your messenger to see the changes."
