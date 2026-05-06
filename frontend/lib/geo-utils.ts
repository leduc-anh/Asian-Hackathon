import type mapboxgl from "mapbox-gl";
import type { FeatureCollection } from "@/types/building";

/**
 * Normalize raw height/floor strings into valid numbers.
 */
export const normalizeHeight = (rawHeight: string, rawFloors: string) => {
  let h = parseFloat(rawHeight) || 12;
  let f = parseInt(rawFloors, 10) || Math.max(1, Math.floor(h / 3));
  if (h < 1) h = 1;
  if (f < 1) f = 1;
  return { height: h, floors: f };
};

/**
 * Compute the area of a ring of [lng, lat] pairs using the shoelace formula.
 */
export function ringArea(ring: number[][]): number {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) * 0.5;
}

/**
 * Given a Geometry, return the single Polygon (or the largest if MultiPolygon).
 */
export function pickPrimaryPolygon(
  geometry: GeoJSON.Geometry,
): GeoJSON.Polygon | null {
  if (geometry.type === "Polygon") {
    return geometry;
  }

  if (geometry.type !== "MultiPolygon" || geometry.coordinates.length === 0) {
    return null;
  }

  const sortedByArea = [...geometry.coordinates].sort((a, b) => {
    const areaA = ringArea(a[0] ?? []);
    const areaB = ringArea(b[0] ?? []);
    return areaB - areaA;
  });

  return {
    type: "Polygon",
    coordinates: sortedByArea[0],
  };
}

/**
 * Offset a geographic point by a given distance (meters) and bearing (degrees).
 */
export function getLngLatOffsetByMeters(
  origin: mapboxgl.LngLat,
  distanceMeters: number,
  bearingDegrees: number,
): { lng: number; lat: number } {
  const earthRadius = 6_378_137;
  const bearing = (bearingDegrees * Math.PI) / 180;
  const latRad = (origin.lat * Math.PI) / 180;
  const deltaLat = (distanceMeters * Math.cos(bearing)) / earthRadius;
  const deltaLng =
    (distanceMeters * Math.sin(bearing)) /
    (earthRadius * Math.max(Math.cos(latRad), 1e-6));

  return {
    lng: origin.lng + (deltaLng * 180) / Math.PI,
    lat: origin.lat + (deltaLat * 180) / Math.PI,
  };
}

/**
 * Build a FeatureCollection of "roof" features for pyramid/tiered buildings.
 */
export const createRoofCollection = (
  data: FeatureCollection,
): FeatureCollection => {
  const roofFeatures: any[] = [];
  data.features.forEach((feature) => {
    const { height, roofType } = feature.properties || {};
    if (!height || roofType === "flat") return;

    const poly = pickPrimaryPolygon(feature.geometry);
    if (!poly) return;

    if (roofType === "pyramid") {
      roofFeatures.push({
        ...feature,
        id: `roof-${feature.id}`,
        properties: {
          ...feature.properties,
          parentId: feature.id,
          roofBase: height,
          roofHeight: height + 6,
        },
      });
    } else if (roofType === "tiered") {
      roofFeatures.push({
        ...feature,
        id: `roof-${feature.id}`,
        properties: {
          ...feature.properties,
          parentId: feature.id,
          roofBase: height,
          roofHeight: height + 4,
        },
      });
    }
  });
  return { type: "FeatureCollection", features: roofFeatures };
};
