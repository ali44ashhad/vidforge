#!/bin/bash
# Installs Mukta (Devanagari + Latin) and Mukta Mahee (Gurmukhi + Latin) so thumbnails/banners/captions can mix Hindi/Punjabi with English words.
set -e
D=/var/www/vidforge/fonts; mkdir -p "$D" /usr/local/share/fonts/mukta
for f in Mukta-ExtraBold Mukta-Bold Mukta-Regular; do curl -fsSL "https://raw.githubusercontent.com/google/fonts/main/ofl/mukta/$f.ttf" -o "$D/$f.ttf"; done
for f in MuktaMahee-ExtraBold MuktaMahee-Bold MuktaMahee-Regular; do curl -fsSL "https://raw.githubusercontent.com/google/fonts/main/ofl/muktamahee/$f.ttf" -o "$D/$f.ttf"; done
cp "$D"/*.ttf /usr/local/share/fonts/mukta/ && fc-cache -f >/dev/null
fc-list | grep -c Mukta
