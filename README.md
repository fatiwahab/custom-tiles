# Favorite Tiles

A lightweight Manifest V3 extension that turns the new-tab page in Chrome, Brave, and other Chromium browsers into a personal grid of website tiles.

## Install unpacked

1. Download or clone this repository.
2. Open `chrome://extensions` (or `brave://extensions` in Brave).
3. Turn on **Developer mode**.
4. Choose **Load unpacked** and select the project folder.
5. Open a new tab. The browser may ask you to approve permissions for the one-time starter import and favicon display.

The extension imports up to 15 available most-visited sites on first use. You can then add, edit, remove, and reorder tiles. Tile choices are stored locally in this browser and are never sent anywhere. Manually customized shortcuts from the browser's built-in new-tab page are not exposed by the browser API and cannot be imported.

Each tile can use one of the 10 color combinations from the supplied template, or a custom background and text color.

## Tile behavior

New tiles open in the same tab by default. Edit a tile to choose **Same tab** or **New tab**. Each tile has its own name, color, and opening behavior.
