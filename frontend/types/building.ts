import type * as THREE from "three";

// ── GeoJSON Domain Types ──
export type FeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.Polygon | GeoJSON.MultiPolygon
>;

export type RoofProfile = "flat" | "pyramid" | "tiered";

export type EnvTab = "temp" | "wind" | "aqi" | "clouds" | "rain";

// ── Environment Data ──
export interface EnvData {
  wind: { speed: number; deg: number };
  pollution: { pm2_5: number };
}

// ── 3D Model Placement ──
export interface ModelPlacement {
  lng: number;
  lat: number;
  altitude: number;
  rotation: number;
  scale: number;
}

// ── Wind Simulation Particle ──
export interface WindParticle3D {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  smoothVelocity: THREE.Vector3;
  trail: THREE.Vector3[];
  life: number;
  maxLife: number;
}

// ── OWM Layer Configuration ──
export interface OWMLayerConfig {
  sourceId: string;
  layerId: string;
  tile: string;
}

// ── Operation Mode ──
export type OperationMode = "draw" | "import";

// ── Windy Display Mode ──
export type WindyDisplayMode = "full" | "panel";
