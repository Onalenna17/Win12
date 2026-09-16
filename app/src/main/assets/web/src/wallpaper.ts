import type { WallpaperItem } from "./types";
import { AURORA, BLOOM, DAWN, DUSK, FOREST, FROSTED, LAKE } from "./wallpaperData";

export const WALLPAPERS: WallpaperItem[] = [
  {
    id: "default",
    name: "Win12 Bloom",
    category: "Default",
    css: `url('${BLOOM}')`,
  },
  {
    id: "aurora",
    name: "Aurora Flow",
    category: "Default",
    css: `url('${AURORA}')`,
  },
  {
    id: "nature-dawn",
    name: "Dawn Ridge",
    category: "Nature",
    css: `url('${DAWN}')`,
  },
  {
    id: "nature-forest",
    name: "Deep Forest",
    category: "Nature",
    css: `url('${FOREST}')`,
  },
  {
    id: "nature-lake",
    name: "Glacier Lake",
    category: "Nature",
    css: `url('${LAKE}')`,
  },
  {
    id: "nature-dusk",
    name: "Desert Dusk",
    category: "Nature",
    css: `url('${DUSK}')`,
  },
  {
    id: "abstract-glass",
    name: "Frosted Glass",
    category: "Abstract",
    css: `url('${FROSTED}')`,
  },
  {
    id: "abstract-mesh",
    name: "Geometric Mesh",
    category: "Abstract",
    css: "conic-gradient(from 180deg at 50% 50%, #0ea5e9, #6366f1, #ec4899, #0ea5e9)",
  },
  {
    id: "abstract-dusk",
    name: "Solar Flare",
    category: "Abstract",
    css: "linear-gradient(160deg, #3a1c71 0%, #d76d77 55%, #ffaf7b 100%)",
  },
  {
    id: "abstract-ocean",
    name: "Midnight Ocean",
    category: "Abstract",
    css: "linear-gradient(160deg, #0f2027 0%, #203a43 55%, #2c5364 100%)",
  },
];

export function wallpaperById(id: string): WallpaperItem {
  return WALLPAPERS.find((w) => w.id === id) || WALLPAPERS[0];
}
