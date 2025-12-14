#!/bin/bash

# AI SDK Gateway Icon Generator
# Requires: ImageMagick (convert), iconutil (macOS only)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🎨 Generating AI SDK Gateway icons..."

# Check for ImageMagick
if ! command -v convert &> /dev/null; then
    echo "❌ ImageMagick is required. Install it first:"
    echo "   macOS: brew install imagemagick"
    echo "   Ubuntu: sudo apt install imagemagick"
    echo "   Windows: choco install imagemagick"
    exit 1
fi

# Create icons directory
mkdir -p icons

# Generate PNG icons from SVG
echo "📐 Generating PNG icons..."
convert -background none icon.svg -resize 16x16 icons/16x16.png
convert -background none icon.svg -resize 32x32 icons/32x32.png
convert -background none icon.svg -resize 48x48 icons/48x48.png
convert -background none icon.svg -resize 64x64 icons/64x64.png
convert -background none icon.svg -resize 128x128 icons/128x128.png
convert -background none icon.svg -resize 256x256 icons/256x256.png
convert -background none icon.svg -resize 512x512 icons/512x512.png
convert -background none icon.svg -resize 512x512 icon.png

echo "✅ PNG icons generated"

# Generate Windows ICO
echo "🪟 Generating Windows icon..."
convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
echo "✅ icon.ico generated"

# Generate macOS ICNS (only on macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🍎 Generating macOS icon..."
    mkdir -p icon.iconset
    cp icons/16x16.png icon.iconset/icon_16x16.png
    cp icons/32x32.png icon.iconset/icon_16x16@2x.png
    cp icons/32x32.png icon.iconset/icon_32x32.png
    cp icons/64x64.png icon.iconset/icon_32x32@2x.png
    cp icons/128x128.png icon.iconset/icon_128x128.png
    cp icons/256x256.png icon.iconset/icon_128x128@2x.png
    cp icons/256x256.png icon.iconset/icon_256x256.png
    cp icons/512x512.png icon.iconset/icon_256x256@2x.png
    cp icons/512x512.png icon.iconset/icon_512x512.png
    iconutil -c icns icon.iconset
    rm -rf icon.iconset
    echo "✅ icon.icns generated"
else
    echo "⚠️  Skipping macOS icon (iconutil only available on macOS)"
    echo "   Run this script on macOS to generate icon.icns"
fi

echo ""
echo "🎉 Icon generation complete!"
echo ""
echo "Generated files:"
ls -la icon.* icons/
