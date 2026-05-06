import type { FeatureCollection, EnvTab, OWMLayerConfig } from "@/types/building";

// ── Mapbox Layer / Source IDs ──
export const SOURCE_ID = "user-buildings-source";
export const LAYER_ID = "user-buildings-3d";
export const OUTLINE_LAYER_ID = "user-buildings-outline";
export const ROOF_SOURCE_ID = "user-buildings-roof-source";
export const ROOF_LAYER_ID = "user-buildings-roof-layer";
export const MODEL_LAYER_ID = "user-model-layer";
export const CONTEXT_LAYER_ID = "mapbox-buildings-context";

// ── Initial Empty FeatureCollection ──
export const initialData: FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

// ── OpenWeatherMap Tile Configurations ──
const OWM_KEY =
  process.env.NEXT_PUBLIC_OPENWEATHERMAP_KEY ??
  "ce6c5aeeba2c0ced069fb23e43e38a56";

export const OWM_LAYERS: Record<EnvTab, OWMLayerConfig> = {
  temp: {
    sourceId: "owm-temp-src",
    layerId: "owm-temp-layer",
    tile: `https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${OWM_KEY}`,
  },
  wind: {
    sourceId: "owm-wind-src",
    layerId: "owm-wind-layer",
    tile: `https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${OWM_KEY}`,
  },
  clouds: {
    sourceId: "owm-clouds-src",
    layerId: "owm-clouds-layer",
    tile: `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${OWM_KEY}`,
  },
  rain: {
    sourceId: "owm-rain-src",
    layerId: "owm-rain-layer",
    tile: `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${OWM_KEY}`,
  },
  aqi: {
    sourceId: "owm-pressure-src",
    layerId: "owm-pressure-layer",
    tile: `https://tile.openweathermap.org/map/pressure_new/{z}/{x}/{y}.png?appid=${OWM_KEY}`,
  },
};
