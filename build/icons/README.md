# Application Icons

This directory contains the application icons for different platforms.

## Icon Files Required

### macOS
- `icon.icns` - macOS icon bundle (512x512 and lower resolutions)

### Windows  
- `icon.ico` - Windows icon (256x256 and lower resolutions)

### Linux
- `icons/` directory with PNG files at various sizes:
  - 16x16.png
  - 32x32.png
  - 48x48.png
  - 64x64.png
  - 128x128.png
  - 256x256.png
  - 512x512.png

## Generating Icons

### From SVG Source

Use the `icon.svg` as the source file. You can convert it using:

#### Using ImageMagick (cross-platform)
```bash
# Generate PNGs
convert -background none icon.svg -resize 16x16 icons/16x16.png
convert -background none icon.svg -resize 32x32 icons/32x32.png
convert -background none icon.svg -resize 48x48 icons/48x48.png
convert -background none icon.svg -resize 64x64 icons/64x64.png
convert -background none icon.svg -resize 128x128 icons/128x128.png
convert -background none icon.svg -resize 256x256 icons/256x256.png
convert -background none icon.svg -resize 512x512 icons/512x512.png
convert -background none icon.svg -resize 512x512 icon.png

# Generate ICO (Windows)
convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico

# Generate ICNS (macOS) - requires iconutil on macOS
mkdir icon.iconset
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
```

#### Using electron-icon-builder (npm)
```bash
npm install -g electron-icon-builder
electron-icon-builder --input=icon.svg --output=./
```

#### Online Tools
- [CloudConvert](https://cloudconvert.com/svg-to-icns)
- [iConvert Icons](https://iconverticons.com/online/)

## Icon Design

The current icon represents:
- **AI** - Central node with "AI" text
- **Gateway** - Network topology connecting multiple endpoints
- **Color Scheme** - Indigo to violet gradient (matches the app theme)
