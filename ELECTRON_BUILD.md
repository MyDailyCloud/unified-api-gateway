# Electron Build Guide

This project supports building cross-platform desktop applications using Electron.

## Prerequisites

- Node.js 18+ 
- npm or yarn
- For macOS builds: Xcode Command Line Tools
- For Windows builds: Visual Studio Build Tools
- For Linux builds: Required system libraries

## Development

```bash
# Start development server with Electron
npm run electron:dev
```

## Building

### Compile Electron TypeScript first
```bash
npm run electron:compile
```

### Build for specific platform
```bash
# macOS
npm run electron:build:mac

# Windows
npm run electron:build:win

# Linux  
npm run electron:build:linux

# All platforms (requires appropriate OS or CI)
npm run electron:build:all
```

## Output

Built applications are placed in the `release/` directory:

| Platform | Format | File |
|----------|--------|------|
| macOS | DMG | `AI SDK Gateway-{version}.dmg` |
| macOS | ZIP | `AI SDK Gateway-{version}-mac.zip` |
| Windows | NSIS Installer | `AI SDK Gateway-{version}-setup.exe` |
| Windows | Portable | `AI SDK Gateway-{version}-portable.exe` |
| Linux | AppImage | `AI SDK Gateway-{version}.AppImage` |
| Linux | DEB | `ai-sdk-gateway_{version}_amd64.deb` |
| Linux | RPM | `ai-sdk-gateway-{version}.x86_64.rpm` |

## GitHub Actions

Automated builds are triggered by:
- Pushing a tag starting with `v` (e.g., `v1.0.0`)
- Manual workflow dispatch

### Creating a Release

```bash
# Create and push a tag
git tag v1.0.0
git push origin v1.0.0
```

This will automatically:
1. Build for macOS, Windows, and Linux
2. Upload artifacts to the GitHub release

### Manual Build

Go to Actions → Build Electron App → Run workflow

## Code Signing (Optional)

### macOS
Set these secrets in GitHub:
- `MAC_CERTS`: Base64 encoded .p12 certificate
- `MAC_CERTS_PASSWORD`: Certificate password

### Windows
Set these secrets for EV code signing:
- `WIN_CSC_LINK`: Base64 encoded certificate
- `WIN_CSC_KEY_PASSWORD`: Certificate password

## Project Structure

```
├── electron/
│   ├── main.ts          # Main process entry
│   ├── preload.ts       # Preload script for IPC
│   ├── tsconfig.json    # Electron TypeScript config
│   └── env.d.ts         # Type declarations
├── build/
│   └── entitlements.mac.plist  # macOS entitlements
├── electron-builder.yml  # Build configuration
└── .github/
    └── workflows/
        └── electron-build.yml  # CI/CD workflow
```

## NPM Scripts

The following scripts should be available in `package.json`:

| Script | Description |
|--------|-------------|
| `npm run electron:dev` | Start development with hot-reload |
| `npm run electron:compile` | Compile Electron TypeScript |
| `npm run electron:build` | Build for current platform |
| `npm run electron:build:mac` | Build for macOS |
| `npm run electron:build:win` | Build for Windows |
| `npm run electron:build:linux` | Build for Linux |
| `npm run electron:build:all` | Build for all platforms |
| `npm run electron:pack` | Package without installer (for testing) |

## Generating Icons

Before building, generate the application icons:

```bash
# On macOS/Linux
cd build
chmod +x generate-icons.sh
./generate-icons.sh

# Or use npm package
npm install -g electron-icon-builder
electron-icon-builder --input=build/icon.svg --output=build/
```

See `build/icons/README.md` for detailed instructions.

## Troubleshooting

### "Cannot find module" errors
Make sure to run `npm run electron:compile` before building.

### macOS notarization fails
Set up Apple Developer credentials and update `electron-builder.yml`.

### Windows SmartScreen warning
Code sign your application with an EV certificate.

### Linux permission denied on AppImage
```bash
chmod +x AI\ SDK\ Gateway-*.AppImage
```
