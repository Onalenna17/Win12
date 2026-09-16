# Asset Provenance

WIN12 is an independent desktop-shell project. No supplied Microsoft wallpaper license was available, and no Microsoft wallpaper was downloaded or redistributed.

| Asset | Origin | Use |
| --- | --- | --- |
| `public/images/win12-bloom.jpg` | Original AI-generated artwork created for this project in the previous implementation | Retained legacy artwork; not the new Blue Arc default |
| `public/images/win12-blue-glass-portrait.jpg` | Original AI-generated glass composition created for WIN12 | Portrait Bloom and Blue Glass option |
| `public/images/win12-alpine.jpg` | Original AI-generated alpine landscape created for WIN12 | Nature option |
| `public/images/win12-geometric.svg` | Original hand-authored WIN12 vector composition | Dark geometric background; 3840 x 2160 view box, resolution independent |
| `public/images/win12-daylight.svg` | Original hand-authored WIN12 vector composition | Default Administrator PC light wallpaper; 3840 x 2160 view box, resolution independent |
| `public/images/win12-daylight-portrait.svg` | Original hand-authored WIN12 vector composition | Dedicated 2160 x 3840 portrait variant |
| `public/images/win12-blue-arc.svg` | Original hand-authored WIN12 glass composition | Signature dark-blue 3840 x 2160 landscape background |
| `public/images/win12-blue-arc-portrait.svg` | Original hand-authored WIN12 glass composition | Signature 2160 x 3840 portrait background |
| `src/components/Icons.tsx` | Original WIN12 SVG built-in application icons | PC-style desktop/system apps |
| Lucide UI symbols | Installed `lucide-react` package, ISC license | Window controls and system-service affordances |
| Android application icons | Loaded at runtime from the installed package through PackageManager at 256 x 256 | Actual discovered applications only; not redistributed in the web asset bundle |
| User wallpaper | Selected by the user after rights confirmation | Locally saved image; maximum 3840-pixel edge when imported |
| PC sound scheme | Original PCM synthesis in `src/lib/audio.ts` and `PcSoundScheme.kt` | Ten startup/window/notification/error/file-operation effects; not Microsoft sound assets |

Raster generation did not provide verified native 4K source files. They are not advertised as 4K or as official Windows assets. The SVG wallpapers remain sharp at 4K and higher, and users can supply their own licensed high-resolution raster imagery. Verify raster dimensions and licensing requirements before a production distribution that promises a specific resolution.

Neither generated backgrounds, generic fallback icons, nor label-based app candidate checks imply Microsoft, Google, Deriv, or MetaQuotes endorsement.