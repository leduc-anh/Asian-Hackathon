import type mapboxgl from "mapbox-gl";
import type { EnvData } from "@/types/building";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

/**
 * Fetch environmental data (wind + pollution) from the backend for a given lat/lng.
 */
export async function fetchEnvDataFromApi(
  lat: number,
  lng: number,
): Promise<EnvData> {
  const res = await fetch(`${API_BASE}/api/env/current?lat=${lat}&lng=${lng}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<EnvData>;
}

/**
 * Update or create AQI heatmap layer on a Mapbox map.
 */
export function updateAQIHeatmap(
  map: mapboxgl.Map,
  lng: number,
  lat: number,
  pm25: number,
): void {
  if (!map.isStyleLoaded()) return;

  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  const spread = 0.004;
  for (let i = 0; i < 40; i++) {
    const angle = (i / 40) * Math.PI * 2;
    const dist = Math.random() * spread;
    features.push({
      type: "Feature",
      properties: {
        intensity: pm25 * (1 - dist / spread) * (0.5 + Math.random() * 0.5),
      },
      geometry: {
        type: "Point",
        coordinates: [
          lng + Math.cos(angle) * dist,
          lat + Math.sin(angle) * dist * 0.7,
        ],
      },
    });
  }
  features.push({
    type: "Feature",
    properties: { intensity: pm25 },
    geometry: { type: "Point", coordinates: [lng, lat] },
  });

  const geojson: GeoJSON.FeatureCollection<GeoJSON.Point> = {
    type: "FeatureCollection",
    features,
  };

  const existing = map.getSource("aqi-source") as
    | mapboxgl.GeoJSONSource
    | undefined;
  if (existing) {
    existing.setData(geojson);
  } else {
    map.addSource("aqi-source", { type: "geojson", data: geojson });
    map.addLayer({
      id: "aqi-heatmap",
      type: "heatmap",
      source: "aqi-source",
      paint: {
        "heatmap-weight": [
          "interpolate",
          ["linear"],
          ["get", "intensity"],
          0,
          0,
          100,
          1,
        ],
        "heatmap-intensity": 1.5,
        "heatmap-radius": 70,
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0,
          "rgba(0,255,128,0)",
          0.25,
          "rgba(255,255,0,0.4)",
          0.5,
          "rgba(255,140,0,0.6)",
          0.75,
          "rgba(255,50,0,0.75)",
          1.0,
          "rgba(200,0,0,0.88)",
        ],
        "heatmap-opacity": 0.7,
      },
    });
  }
}
