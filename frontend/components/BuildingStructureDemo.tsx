"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import MapboxGeocoder from "@mapbox/mapbox-gl-geocoder";
import * as THREE from "three";
import {
  GLTFLoader,
  type GLTF,
} from "three/examples/jsm/loaders/GLTFLoader.js";

import { Header } from "@/components/layout";
import { Sidebar } from "@/components/layout";
import { PropertyEditorPanel, ModelImportPanel } from "@/components/panels";
import { WindyOverlay, LoadingOverlay } from "@/components/overlays";

type FeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.Polygon | GeoJSON.MultiPolygon
>;
type RoofProfile = "flat" | "pyramid" | "tiered";
type EnvTab = "temp" | "wind" | "aqi" | "clouds" | "rain";

interface EnvData {
  wind: { speed: number; deg: number };
  pollution: { pm2_5: number };
}

interface ModelPlacement {
  lng: number;
  lat: number;
  altitude: number;
  rotation: number;
  scale: number;
}

interface WindParticle3D {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  smoothVelocity: THREE.Vector3;
  trail: THREE.Vector3[];
  life: number;
  maxLife: number;
}

const initialData: FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

const SOURCE_ID = "user-buildings-source";
const LAYER_ID = "user-buildings-3d";
const OUTLINE_LAYER_ID = "user-buildings-outline";
const ROOF_SOURCE_ID = "user-buildings-roof-source";
const ROOF_LAYER_ID = "user-buildings-roof-layer";
const MODEL_LAYER_ID = "user-model-layer";
const CONTEXT_LAYER_ID = "mapbox-buildings-context";

const normalizeHeight = (rawHeight: string, rawFloors: string) => {
  let h = parseFloat(rawHeight) || 12;
  let f = parseInt(rawFloors, 10) || Math.max(1, Math.floor(h / 3));
  if (h < 1) h = 1;
  if (f < 1) f = 1;
  return { height: h, floors: f };
};

const createRoofCollection = (data: FeatureCollection): FeatureCollection => {
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

function ringArea(ring: number[][]) {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) * 0.5;
}

function pickPrimaryPolygon(
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

function getLngLatOffsetByMeters(
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

export function BuildingStructureDemo() {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isAutoSwitchingModeRef = useRef(false);
  const isSnapModeRef = useRef(false);
  const selectedFeatureIdRef = useRef<string | null>(null);
  const threeSceneRef = useRef<THREE.Scene | null>(null);
  const threeRendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const threeCameraRef = useRef<THREE.Camera>(new THREE.Camera());
  const importedModelRef = useRef<THREE.Object3D | null>(null);
  const modelPlacementRef = useRef<ModelPlacement | null>(null);
  const modelMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const windMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const windTrailRef = useRef<THREE.LineSegments | null>(null);
  const windDataRef = useRef<WindParticle3D[]>([]);
  const activeEnvTabRef = useRef<EnvTab | null>(null);
  const showWindSimRef = useRef(true);
  const windAnchorRef = useRef<mapboxgl.LngLat | null>(null);
  const envDataRef = useRef<EnvData | null>(null);
  const [envData, setEnvData] = useState<EnvData | null>(null);
  const [isLoadingEnv, setIsLoadingEnv] = useState(false);
  const [activeEnvTab, setActiveEnvTab] = useState<EnvTab | null>(null);
  const [windyUrl, setWindyUrl] = useState<string | null>(null);
  const [featureCount, setFeatureCount] = useState(0);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(
    null,
  );
  const [heightInput, setHeightInput] = useState("24");
  const [floorsInput, setFloorsInput] = useState("8");
  const [roofTypeInput, setRoofTypeInput] = useState<RoofProfile>("flat");
  const [statusMessage, setStatusMessage] = useState(
    "Chưa có tòa nhà nào được chọn. Vẽ polygon rồi bấm vào tòa nhà để chỉnh sửa.",
  );
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [modelFileName, setModelFileName] = useState<string | null>(null);
  const [modelScaleInput, setModelScaleInput] = useState("1");
  const [modelRotationInput, setModelRotationInput] = useState("0");
  const [payloadPreview, setPayloadPreview] = useState<string>(
    JSON.stringify(initialData, null, 2),
  );
  const [operationMode, setOperationMode] = useState<"draw" | "import">("draw");
  const [showWindSim, setShowWindSim] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [windyDisplayMode, setWindyDisplayMode] = useState<"full" | "panel">(
    "full",
  );

  const mapToken = useMemo(
    () =>
      (
        process.env.NEXT_PUBLIC_MAPBOX_TOKEN ??
        process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ??
        ""
      ).trim(),
    [],
  );

  useEffect(() => {
    selectedFeatureIdRef.current = selectedFeatureId;
  }, [selectedFeatureId]);

  useEffect(() => {
    activeEnvTabRef.current = activeEnvTab;
  }, [activeEnvTab]);

  useEffect(() => {
    showWindSimRef.current = showWindSim;
  }, [showWindSim]);

  useEffect(() => {
    envDataRef.current = envData;
  }, [envData]);

  const syncImportedModelTransform = () => {
    const map = mapRef.current;
    const placement = modelPlacementRef.current;
    if (!map || !placement) {
      return;
    }
    // Update the draggable marker DOM position and visual rotation handle
    if (modelMarkerRef.current) {
      modelMarkerRef.current.setLngLat([placement.lng, placement.lat]);
      const el = modelMarkerRef.current.getElement() as any;
      if (el && el._rotContainer) {
        el._rotContainer.style.transform = `rotate(${placement.rotation || 0}deg)`;
      }
    }
    map.triggerRepaint();
  };

  const ensureModelMarker = () => {
    const map = mapRef.current;
    if (!map || modelMarkerRef.current) {
      return;
    }

    const markerEl = document.createElement("div");
    markerEl.className =
      "group relative flex h-6 w-6 cursor-move items-center justify-center rounded-full border-2 border-white bg-cyan-500/90 shadow-lg";

    const rotContainer = document.createElement("div");
    rotContainer.className = "absolute inset-0 pointer-events-none";
    const initRot = modelPlacementRef.current?.rotation || 0;
    rotContainer.style.transform = `rotate(${initRot}deg)`;
    markerEl.appendChild(rotContainer);

    const rotHandle = document.createElement("div");
    rotHandle.className =
      "absolute -right-6 top-1/2 -mt-1.5 h-3 w-3 cursor-pointer rounded-full bg-indigo-500 ring-2 ring-white shadow-md pointer-events-auto transition-transform hover:scale-125";
    rotContainer.appendChild(rotHandle);

    let isRotating = false;

    rotHandle.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      e.preventDefault();
      isRotating = true;
      map.dragPan.disable();
    });

    window.addEventListener("mousemove", (e) => {
      if (!isRotating || !modelPlacementRef.current) return;
      const rect = markerEl.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const angle =
        Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);

      modelPlacementRef.current.rotation = angle;
      setModelRotationInput(String(Math.round(angle)));
      rotContainer.style.transform = `rotate(${angle}deg)`;
      map.triggerRepaint();
    });

    window.addEventListener("mouseup", () => {
      if (isRotating) {
        isRotating = false;
        map.dragPan.enable();
      }
    });

    (markerEl as any)._rotContainer = rotContainer;

    const marker = new mapboxgl.Marker({
      element: markerEl,
      draggable: true,
      anchor: "center",
    })
      .setLngLat(map.getCenter())
      .addTo(map);

    marker.on("drag", () => {
      const placement = modelPlacementRef.current;
      if (!placement) {
        return;
      }
      const point = marker.getLngLat();
      // Only update placement data. The render loop reads this every frame
      // and syncs the model transform atomically to avoid flicker from
      // calling setLngLat() or triggerRepaint() during active drag.
      placement.lng = point.lng;
      placement.lat = point.lat;
    });

    marker.on("dragstart", () => {
      setStatusMessage("Đang kéo model 3D đến vị trí mới...");
    });

    marker.on("dragend", () => {
      const pl = modelPlacementRef.current;
      if (pl) fetchEnvData(pl.lat, pl.lng);
      setStatusMessage("Đã đặt model 3D tại vị trí mới.");
    });

    modelMarkerRef.current = marker;
  };

  // AQI heatmap: draw PM2.5 concentration cloud around a location
  const updateAQIHeatmap = (lng: number, lat: number, pm25: number) => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
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
  };

  // Fetch env data from backend, then update map + particles
  const fetchEnvData = async (lat: number, lng: number) => {
    setIsLoadingEnv(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
      const res = await fetch(`${base}/api/env/current?lat=${lat}&lng=${lng}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: EnvData = await res.json();
      setEnvData(data);
      updateAQIHeatmap(lng, lat, data.pollution.pm2_5);
    } catch (err) {
      console.warn("fetchEnvData error:", err);
    } finally {
      setIsLoadingEnv(false);
    }
  };

  // OWM tile key (free tier, covers all of Vietnam)
  const OWM_KEY =
    process.env.NEXT_PUBLIC_OPENWEATHERMAP_KEY ??
    "ce6c5aeeba2c0ced069fb23e43e38a56";

  const OWM_LAYERS: Record<
    EnvTab,
    { sourceId: string; layerId: string; tile: string }
  > = {
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

  // Register all OWM sources + layers once the map has loaded (all hidden at start)
  const initOWMLayers = () => {
    const map = mapRef.current;
    if (!map) return;
    for (const cfg of Object.values(OWM_LAYERS)) {
      if (!map.getSource(cfg.sourceId)) {
        map.addSource(cfg.sourceId, {
          type: "raster",
          tiles: [cfg.tile],
          tileSize: 256,
          attribution: "\u00a9 OpenWeatherMap",
        });
      }
      if (!map.getLayer(cfg.layerId)) {
        map.addLayer({
          id: cfg.layerId,
          type: "raster",
          source: cfg.sourceId,
          paint: { "raster-opacity": 0 },
        });
      }
    }
  };

  // Switch the visible environment tab (using Windy API embed for professional visuals)
  const switchEnvTab = (tab: EnvTab | null) => {
    const map = mapRef.current;
    if (!map) {
      setStatusMessage(
        "Map chưa sẵn sàng. Kiểm tra NEXT_PUBLIC_MAPBOX_TOKEN rồi reload trang.",
      );
      return;
    }

    if (tab === null) {
      setActiveEnvTab(null);
      setWindyUrl(null);
      return;
    }

    const center = map.getCenter();
    const zoom = Math.round(map.getZoom());
    let overlay = "wind";
    if (tab === "temp") overlay = "temp";
    if (tab === "aqi") overlay = "pm2p5";
    if (tab === "clouds") overlay = "clouds";
    if (tab === "rain") overlay = "rain";

    // Build the Windy API embed URL with user's current coordinates
    const wUrl = `https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=mm&metricTemp=default&metricWind=default&zoom=${Math.max(5, zoom - 1)}&overlay=${overlay}&product=ecmwf&level=surface&lat=${center.lat}&lon=${center.lng}&detailLat=${center.lat}&detailLon=${center.lng}&marker=true`;

    setWindyUrl(wUrl);
    setWindyDisplayMode("full");
    setActiveEnvTab(tab);
  };

  const closeWindyFullToPanel = () => {
    if (!windyUrl) return;
    setWindyDisplayMode("panel");
  };

  const openWindyFull = () => {
    if (!windyUrl) return;
    setWindyDisplayMode("full");
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    if (!mapToken) {
      setStatusMessage(
        "Thiếu NEXT_PUBLIC_MAPBOX_TOKEN trong frontend/.env nên bản đồ chưa hiển thị.",
      );
      setPayloadPreview(
        "Thiếu NEXT_PUBLIC_MAPBOX_TOKEN trong frontend/.env để hiển thị bản đồ.",
      );
      return;
    }

    mapboxgl.accessToken = mapToken;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/standard",
      center: [106.70098, 10.77653],
      zoom: 14,
      pitch: 58,
      bearing: -15,
      antialias: true,
    });

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: false,
        trash: true,
      },
      defaultMode: "simple_select",
    });

    map.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: true }),
      "top-right",
    );
    map.addControl(draw, "top-right");

    const geocoder = new MapboxGeocoder({
      accessToken: mapToken,
      mapboxgl: mapboxgl as unknown as typeof import("mapbox-gl"),
      marker: false,
      placeholder: "Search địa điểm để bay nhanh...",
      flyTo: {
        zoom: 16,
        speed: 1,
        curve: 1.2,
      },
    });
    map.addControl(geocoder, "top-right");

    const refreshSourceFromDraw = () => {
      const data = draw.getAll() as FeatureCollection;
      const safeFeatures = data.features.map((feature) => {
        const rawHeight = String(feature.properties?.height ?? "");
        const rawFloors = String(feature.properties?.floors ?? "");
        const normalized = normalizeHeight(rawHeight, rawFloors);

        return {
          ...feature,
          properties: {
            ...(feature.properties ?? {}),
            source: "user_drawn",
            height: normalized.height,
            floors: normalized.floors,
            roofType: String(feature.properties?.roofType ?? "flat"),
          },
        };
      });

      const normalizedCollection: FeatureCollection = {
        type: "FeatureCollection",
        features: safeFeatures,
      };

      const source = map.getSource(SOURCE_ID) as
        | mapboxgl.GeoJSONSource
        | undefined;
      if (source) {
        source.setData(normalizedCollection);
      }

      const roofSource = map.getSource(ROOF_SOURCE_ID) as
        | mapboxgl.GeoJSONSource
        | undefined;
      if (roofSource) {
        roofSource.setData(createRoofCollection(normalizedCollection));
      }

      setFeatureCount(safeFeatures.length);
      setPayloadPreview(JSON.stringify(normalizedCollection, null, 2));

      if (selectedFeatureIdRef.current) {
        const selected = safeFeatures.find(
          (feature) => String(feature.id) === selectedFeatureIdRef.current,
        );
        if (selected) {
          setHeightInput(String(selected.properties?.height ?? "24"));
          setFloorsInput(String(selected.properties?.floors ?? "8"));
          setRoofTypeInput(
            String(selected.properties?.roofType ?? "flat") as RoofProfile,
          );
        }
      }
    };

    const handleCreate = (event: { features: GeoJSON.Feature[] }) => {
      event.features.forEach((feature) => {
        const normalized = normalizeHeight("24", "8");

        draw.setFeatureProperty(
          feature.id as string,
          "height",
          normalized.height,
        );
        draw.setFeatureProperty(
          feature.id as string,
          "floors",
          normalized.floors,
        );
        draw.setFeatureProperty(feature.id as string, "roofType", "flat");
      });

      const firstFeatureId = event.features[0]?.id;
      if (firstFeatureId) {
        const id = String(firstFeatureId);
        setSelectedFeatureId(id);
        setHeightInput("24");
        setFloorsInput("8");
        setRoofTypeInput("flat");
        setIsDrawMode(false);
        setStatusMessage(
          "Đã khép kín polygon, hệ thống tự thoát mode vẽ. Bây giờ bạn có thể bấm vào tòa nhà để di chuyển/chỉnh sửa.",
        );

        if (!isAutoSwitchingModeRef.current) {
          isAutoSwitchingModeRef.current = true;
          window.setTimeout(() => {
            try {
              if (draw.getMode() !== "simple_select") {
                draw.changeMode("simple_select");
              }
            } finally {
              isAutoSwitchingModeRef.current = false;
            }
          }, 0);
        }
      }

      refreshSourceFromDraw();
    };

    const handleSelectionChange = (event: { features: GeoJSON.Feature[] }) => {
      const selected = event.features[0];
      if (!selected) {
        setSelectedFeatureId(null);
        setStatusMessage(
          "Chưa chọn tòa nhà nào. Hãy click vào một polygon để chỉnh sửa.",
        );
        return;
      }

      const id = String(selected.id);
      setSelectedFeatureId(id);
      setHeightInput(String(selected.properties?.height ?? "24"));
      setFloorsInput(String(selected.properties?.floors ?? "8"));
      setRoofTypeInput(
        String(selected.properties?.roofType ?? "flat") as RoofProfile,
      );
      setStatusMessage(`Đang chọn tòa nhà ID: ${id}`);
    };

    const handleModeChange = (event: { mode: string }) => {
      const drawing = event.mode === "draw_polygon";
      setIsDrawMode(drawing);
      if (drawing) {
        setStatusMessage(
          "Đang ở chế độ vẽ polygon: click các điểm, double-click để kết thúc.",
        );
      }
    };

    map.on("load", () => {
      const scene = new THREE.Scene();
      const ambientLight = new THREE.AmbientLight("#ffffff", 2.0);
      const directionalLight = new THREE.DirectionalLight("#ffffff", 2.5);
      directionalLight.position.set(0.5, -1, 1).normalize();
      const fillLight = new THREE.DirectionalLight("#ffffff", 0.8);
      fillLight.position.set(-1, 1, 0.5).normalize();
      scene.add(ambientLight);
      scene.add(directionalLight);
      scene.add(fillLight);

      // SETUP 3D WIND PARTICLES
      const windCount = 1000;
      const windTrailLength = 8;
      // Use a sphere that we will scale into a soft ellipsoid, avoiding the "rigid stick" look
      const windGeo = new THREE.SphereGeometry(0.25, 6, 6);
      // windGeo.rotateX(Math.PI / 2); // Not strictly needed for a sphere, but keeps orientation logic consistent if scaled
      const windMat = new THREE.MeshPhongMaterial({
        color: 0xffffff, // Color is overridden by instanceColor
        transparent: true,
        opacity: 0.9,
        shininess: 120,
      });
      const windMesh = new THREE.InstancedMesh(windGeo, windMat, windCount);
      windMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

      const trailSegmentCount = windTrailLength - 1;
      const trailVertexCount = windCount * trailSegmentCount * 2;
      const trailGeometry = new THREE.BufferGeometry();
      trailGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(trailVertexCount * 3), 3),
      );
      trailGeometry.setAttribute(
        "color",
        new THREE.BufferAttribute(new Float32Array(trailVertexCount * 3), 3),
      );
      const trailMaterial = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const windTrail = new THREE.LineSegments(trailGeometry, trailMaterial);
      windTrail.frustumCulled = false;
      windTrail.visible = false;
      const wData: WindParticle3D[] = [];
      for (let i = 0; i < windCount; i++) {
        const seed = new THREE.Vector3(
          (Math.random() - 0.5) * 400,
          Math.random() * 200,
          (Math.random() - 0.5) * 400,
        );
        wData.push({
          position: seed.clone(),
          velocity: new THREE.Vector3(0, 0, 0),
          smoothVelocity: new THREE.Vector3(0, 0, 0),
          trail: Array.from({ length: windTrailLength }, () => seed.clone()),
          life: Math.random() * 800,
          maxLife: 600 + Math.random() * 400,
        });
      }
      windDataRef.current = wData;
      windMeshRef.current = windMesh;
      windTrailRef.current = windTrail;
      windMesh.visible = false;
      scene.add(windMesh);
      scene.add(windTrail);

      threeSceneRef.current = scene;

      const customLayer: mapboxgl.CustomLayerInterface = {
        id: MODEL_LAYER_ID,
        type: "custom",
        renderingMode: "3d",
        onAdd: (_map, gl) => {
          const renderer = new THREE.WebGLRenderer({
            canvas: map.getCanvas(),
            context: gl,
            antialias: true,
          });
          renderer.autoClear = false;
          // Fix: Three.js r152+ defaults to LinearSRGBColorSpace.
          // GLTF textures are sRGB-encoded; without this setting,
          // orange textures appear as dark brown (gamma not applied).
          renderer.outputColorSpace = THREE.SRGBColorSpace;
          renderer.toneMapping = THREE.ACESFilmicToneMapping;
          renderer.toneMappingExposure = 1.0;
          threeRendererRef.current = renderer;
        },
        render: (_gl, matrix) => {
          const renderer = threeRendererRef.current;
          const camera = threeCameraRef.current;
          const currentScene = threeSceneRef.current;
          if (!renderer || !currentScene || !camera) {
            return;
          }

          const placement = modelPlacementRef.current;
          let windCenterMerc = null;
          let s = 1;
          let currentRotZ = new THREE.Matrix4();

          if (placement) {
            windCenterMerc = mapboxgl.MercatorCoordinate.fromLngLat(
              [placement.lng, placement.lat],
              placement.altitude,
            );
            s =
              Math.max(0.01, placement.scale) *
              windCenterMerc.meterInMercatorCoordinateUnits();
            currentRotZ = new THREE.Matrix4().makeRotationAxis(
              new THREE.Vector3(0, 0, 1),
              -(placement.rotation || 0) * (Math.PI / 180),
            );
            windAnchorRef.current = null; // Reset anchor if model is present
          } else {
            // Use a sticky anchor for wind simulation if no model is placed
            if (!windAnchorRef.current) {
              windAnchorRef.current = map.getCenter();
            }
            windCenterMerc = mapboxgl.MercatorCoordinate.fromLngLat(
              windAnchorRef.current,
              0,
            );
            s = windCenterMerc.meterInMercatorCoordinateUnits() * 1.0;
          }

          const rotX = new THREE.Matrix4().makeRotationAxis(
            new THREE.Vector3(1, 0, 0),
            Math.PI / 2,
          );

          // l = translate to geo position x rotateZ x scale(s, -s, s) x rotateX(PI/2)
          const l = new THREE.Matrix4()
            .makeTranslation(
              windCenterMerc.x,
              windCenterMerc.y,
              windCenterMerc.z,
            )
            .multiply(currentRotZ)
            .scale(new THREE.Vector3(s, -s, s))
            .multiply(rotX);

          camera.projectionMatrix = new THREE.Matrix4()
            .fromArray(matrix as number[])
            .multiply(l);

          // Decouple wind geometry from Mapbox's rotZ(-rotation) transformation!
          if (windMeshRef.current) {
            const lNoRot = new THREE.Matrix4()
              .makeTranslation(
                windCenterMerc.x,
                windCenterMerc.y,
                windCenterMerc.z,
              )
              .scale(new THREE.Vector3(s, -s, s))
              .multiply(rotX);

            windMeshRef.current.matrixAutoUpdate = false;
            windMeshRef.current.matrix.copy(
              l.clone().invert().multiply(lNoRot),
            );

            if (windTrailRef.current) {
              windTrailRef.current.matrixAutoUpdate = false;
              windTrailRef.current.matrix.copy(
                l.clone().invert().multiply(lNoRot),
              );
            }
          }

          renderer.resetState();
          renderer.render(currentScene, camera);

          // Do not force repaint unconditionally.
          // Continuous repaint here can saturate CPU/GPU and make UI feel unclickable.

          // UPDATE 3D WIND PARTICLES
          const wMesh = windMeshRef.current;
          const wTrail = windTrailRef.current;
          const wData = windDataRef.current;
          const env = envDataRef.current;

          if (wMesh && wData && env) {
            // 1. Collect Obstacles
            const obstacles: { x: number; z: number; r: number; h: number }[] =
              [];

            const mapCenterForWind = map.getCenter();
            const windCenterMercForPhysics = modelPlacementRef.current
              ? mapboxgl.MercatorCoordinate.fromLngLat(
                  [
                    modelPlacementRef.current.lng,
                    modelPlacementRef.current.lat,
                  ],
                  modelPlacementRef.current.altitude,
                )
              : mapboxgl.MercatorCoordinate.fromLngLat(
                  windAnchorRef.current || map.getCenter(),
                  0,
                );
            const physicsScale =
              windCenterMercForPhysics.meterInMercatorCoordinateUnits() *
              (modelPlacementRef.current
                ? modelPlacementRef.current.scale
                : 1.0);

            // Add Imported Model
            if (modelPlacementRef.current) {
              let bRadius = 25;
              let bHeight = 60;
              if (importedModelRef.current) {
                if (!importedModelRef.current.userData.bRadius) {
                  const box = new THREE.Box3().setFromObject(
                    importedModelRef.current,
                  );
                  const size = box.getSize(new THREE.Vector3());
                  importedModelRef.current.userData.bRadius = Math.max(
                    10,
                    Math.max(size.x, size.z) / 2,
                  );
                  importedModelRef.current.userData.bHeight = size.y;
                }
                bRadius = importedModelRef.current.userData.bRadius;
                bHeight = importedModelRef.current.userData.bHeight || 60;
              }
              obstacles.push({ x: 0, z: 0, r: bRadius * 1.5, h: bHeight });
            }

            // Add Drawn Buildings
            if (drawRef.current) {
              const features = drawRef.current.getAll().features;
              for (const feat of features) {
                if (feat.geometry.type === "Polygon") {
                  const coords = feat.geometry.coordinates[0];
                  if (!coords || coords.length === 0) continue;

                  let avgLng = 0,
                    avgLat = 0;
                  let validCount = 0;
                  for (const c of coords) {
                    if (
                      Array.isArray(c) &&
                      typeof c[0] === "number" &&
                      typeof c[1] === "number"
                    ) {
                      avgLng += c[0];
                      avgLat += c[1];
                      validCount++;
                    }
                  }
                  if (validCount === 0) continue;

                  avgLng /= validCount;
                  avgLat /= validCount;

                  const obsMerc = mapboxgl.MercatorCoordinate.fromLngLat([
                    avgLng,
                    avgLat,
                  ]);
                  const ox =
                    (obsMerc.x - windCenterMercForPhysics.x) / physicsScale;
                  const oz =
                    (obsMerc.y - windCenterMercForPhysics.y) / physicsScale;

                  const v0 = mapboxgl.MercatorCoordinate.fromLngLat(
                    coords[0] as [number, number],
                  );
                  const dist =
                    Math.sqrt(
                      (v0.x - obsMerc.x) ** 2 + (v0.y - obsMerc.y) ** 2,
                    ) / physicsScale;
                  const h = feat.properties?.height ?? 24;
                  obstacles.push({ x: ox, z: oz, r: (dist + 5) * 1.5, h: h });
                }
              }
            }

            const shouldShow = showWindSimRef.current && obstacles.length > 0;

            if (!shouldShow) {
              if (wMesh) wMesh.visible = false;
              if (wTrail) wTrail.visible = false;
              if (obstacles.length === 0) windAnchorRef.current = null;
            } else {
              wMesh.visible = true;
              if (wTrail) wTrail.visible = true;
              const t = Date.now() * 0.001;
              const dummy = new THREE.Object3D();
              const colorObj = new THREE.Color();
              const trailColor = new THREE.Color();

              const trailPosAttr = wTrail
                ? (wTrail.geometry.getAttribute(
                    "position",
                  ) as THREE.BufferAttribute)
                : null;
              const trailColorAttr = wTrail
                ? (wTrail.geometry.getAttribute(
                    "color",
                  ) as THREE.BufferAttribute)
                : null;
              const trailSegmentCount = 7;

              const globalWindDeg = env.wind.deg || 180;
              const angleRad = (globalWindDeg % 360) * (Math.PI / 180);
              const baseDirX = -Math.sin(angleRad);
              // Meteorological wind direction is "from" direction (0° = from North).
              // Our local Z axis follows Mercator Y (positive toward South), so use +cos.
              const baseDirZ = Math.cos(angleRad);

              // ── §4.1 Atmospheric Boundary Layer (ABL) Profile ──
              // V_H = V_ref × (H / δ)^a
              // Urban terrain: δ = 370m, a = 0.22 (per Vietnamese urban planning standards)
              const ABL_DELTA = 370; // boundary layer thickness (m) for urban terrain
              const ABL_ALPHA = 0.22; // power-law exponent for urban terrain
              const V_REF = 60; // reference free-stream speed at boundary layer top
              const H_REF = 10; // meteorological station reference height (m)

              // ── §4.2 Wind Angle Discount Factors from 43 CFD scenarios ──
              // Interpolated from: 0°→0%, 22.5°→38.5%, 45°→63.6%, 67.5°→90.9%, 90°→100%
              const ANGLE_BREAKPOINTS = [0, 22.5, 45, 67.5, 90];
              const ANGLE_FACTORS = [0, 0.385, 0.636, 0.909, 1.0];
              const lerpAngleFactor = (angleDeg: number): number => {
                const a = Math.min(90, Math.abs(angleDeg % 180));
                for (let j = 1; j < ANGLE_BREAKPOINTS.length; j++) {
                  if (a <= ANGLE_BREAKPOINTS[j]) {
                    const t0 = ANGLE_BREAKPOINTS[j - 1];
                    const t1 = ANGLE_BREAKPOINTS[j];
                    const f0 = ANGLE_FACTORS[j - 1];
                    const f1 = ANGLE_FACTORS[j];
                    return f0 + (f1 - f0) * ((a - t0) / (t1 - t0));
                  }
                }
                return 1.0;
              };

              const dt = 0.016;
              for (let i = 0; i < wData.length; i++) {
                const p = wData[i];

                // ── ABL: wind speed varies with height ──
                // Clamp height to [1, ABL_DELTA] to avoid zero/negative values
                const particleH = Math.max(
                  1,
                  Math.min(p.position.y, ABL_DELTA),
                );
                const ablFactor = Math.pow(particleH / ABL_DELTA, ABL_ALPHA);
                const U_mag = V_REF * ablFactor;

                const U_x = baseDirX * U_mag;
                const U_z = baseDirZ * U_mag;

                let vx = U_x;
                let vz = U_z;
                let vy =
                  Math.sin(p.position.x * 0.04 + t * 1.6) * 5.0 * ablFactor;

                for (const obs of obstacles) {
                  const relX = p.position.x - obs.x;
                  const relZ = p.position.z - obs.z;
                  const r2 = relX * relX + relZ * relZ;
                  const R2 = obs.r * obs.r;
                  const r = Math.sqrt(r2);

                  if (r2 > 1 && r2 < R2 * 16) {
                    const U_dot_p = U_x * relX + U_z * relZ;
                    const term = R2 / (r2 * r2);
                    vx += term * (r2 * U_x - 2 * U_dot_p * relX);
                    vz += term * (r2 * U_z - 2 * U_dot_p * relZ);

                    // Add tangential steering around obstacle to create smoother curved streamlines.
                    // This makes particles "hug" building edges instead of cutting sharply.
                    const invR = 1 / Math.max(r, 1e-4);
                    const nx = relX * invR;
                    const nz = relZ * invR;
                    const tx = -nz;
                    const tz = nx;
                    const flowSign = Math.sign(U_x * tx + U_z * tz) || 1;
                    const nearEdge = Math.max(
                      0,
                      1 - Math.abs(r - obs.r * 1.05) / (obs.r * 1.6),
                    );
                    const swirlStrength = nearEdge * 36;
                    vx += tx * flowSign * swirlStrength;
                    vz += tz * flowSign * swirlStrength;

                    // Soft radial repulsion avoids particles penetrating buildings,
                    // but keeps them close enough for visual "bám sát" effect.
                    const repulse =
                      Math.max(0, (obs.r * 0.9 - r) / Math.max(obs.r, 1e-4)) *
                      45;
                    vx += nx * repulse;
                    vz += nz * repulse;

                    const distFromCenter = Math.sqrt(r2);
                    // Updraft only occurs when wind hits building and clambers over it.
                    // Strongest at building top, fading out above and below.
                    const heightDiff = p.position.y - obs.h;
                    if (p.position.y < obs.h + 20) {
                      const updraftFactor = Math.max(
                        0,
                        1.0 - Math.abs(heightDiff) / 40,
                      );
                      vy += Math.max(
                        0,
                        (obs.r * 2 - distFromCenter) * 2.5 * updraftFactor,
                      );
                    }

                    // ── §4.2 Wake Recirculation Zone ──
                    // L (wake length) ∝ building height × width, with angle discount.
                    // Compute angle between wind direction and obstacle-to-particle vector.
                    const windAngleToObs =
                      Math.atan2(
                        U_x * nz - U_z * nx, // cross product (sin of angle)
                        U_x * nx + U_z * nz, // dot product (cos of angle)
                      ) *
                      (180 / Math.PI);
                    const wakeAngleFactor = lerpAngleFactor(
                      Math.abs(windAngleToObs),
                    );

                    // Wake length scales with building dimensions and angle factor
                    // Using obs.h for height, obs.r*2 as approximate width
                    const wakeL = obs.h * 0.8 * wakeAngleFactor;
                    const wakeW = obs.r * 1.5 * wakeAngleFactor;

                    // Check if particle is in the downwind wake zone
                    // Project particle position onto wind direction to find downwind distance
                    const downwindDist = -(relX * baseDirX + relZ * baseDirZ);
                    const crosswindDist = Math.abs(
                      -relX * baseDirZ + relZ * baseDirX,
                    );

                    if (
                      downwindDist > 0 &&
                      downwindDist < wakeL &&
                      crosswindDist < wakeW
                    ) {
                      // Inside wake zone: create low-velocity recirculation
                      const wakeFade = 1 - downwindDist / wakeL;
                      const wakeIntensity = wakeFade * 0.7;

                      // Reduce forward velocity (deceleration in wake)
                      vx *= 1 - wakeIntensity * 0.8;
                      vz *= 1 - wakeIntensity * 0.8;

                      // Add reverse recirculation component (vortex behind building)
                      vx -= baseDirX * V_REF * wakeIntensity * 0.3;
                      vz -= baseDirZ * V_REF * wakeIntensity * 0.3;

                      // Add lateral turbulent fluctuation in wake
                      const turbFreq =
                        t * 2.5 + p.position.x * 0.05 + p.position.z * 0.05;
                      const turbulence =
                        Math.sin(turbFreq) * V_REF * wakeIntensity * 0.15;
                      vx += -baseDirZ * turbulence;
                      vz += baseDirX * turbulence;

                      // Slight downwash in the near-wake region
                      if (p.position.y > 2) {
                        vy -= wakeIntensity * 8.0 * wakeFade;
                      }
                    }
                  }
                }

                // Inertial blending removes jitter and creates smooth, continuous curves.
                const targetVel = new THREE.Vector3(vx, vy, vz);
                p.smoothVelocity.lerp(targetVel, 0.12);
                p.velocity.copy(p.smoothVelocity);

                // Apply velocity to position
                p.position.x += p.velocity.x * dt;
                p.position.y += p.velocity.y * dt;
                p.position.z += p.velocity.z * dt;
                p.life += 1;

                p.trail.push(p.position.clone());
                if (p.trail.length > 8) {
                  p.trail.shift();
                }

                // Respawn if out of bounds or dead
                if (
                  p.life > p.maxLife ||
                  Math.abs(p.position.x) > 400 ||
                  Math.abs(p.position.z) > 400 ||
                  p.position.y > 300 ||
                  p.position.y < 0
                ) {
                  p.life = 0;
                  p.maxLife = 600 + Math.random() * 400;
                  const spawnDist = 350;
                  if (Math.abs(baseDirX) > Math.abs(baseDirZ)) {
                    p.position.set(
                      baseDirX > 0 ? -spawnDist : spawnDist,
                      Math.random() * 150,
                      (Math.random() - 0.5) * spawnDist * 2,
                    );
                  } else {
                    p.position.set(
                      (Math.random() - 0.5) * spawnDist * 2,
                      Math.random() * 150,
                      baseDirZ > 0 ? -spawnDist : spawnDist,
                    );
                  }
                  // Reset momentum completely upon respawn
                  p.velocity.set(baseDirX * 60, 0, baseDirZ * 60);
                  p.smoothVelocity.copy(p.velocity);
                  p.trail = Array.from({ length: 8 }, () => p.position.clone());
                }

                dummy.position.copy(p.position);
                // Look towards the future position
                dummy.lookAt(
                  p.position.x + p.velocity.x,
                  p.position.y + p.velocity.y,
                  p.position.z + p.velocity.z,
                );

                const spd = Math.sqrt(
                  p.velocity.x ** 2 + p.velocity.y ** 2 + p.velocity.z ** 2,
                );
                const speedRatio = Math.min(1, Math.max(0, (spd - 22) / 68));

                // Keep particle head subtle; the curved trail will be the dominant shape.
                dummy.scale.set(0.28, 0.28, 2.6 + speedRatio * 2.4);
                dummy.updateMatrix();
                wMesh.setMatrixAt(i, dummy.matrix);

                // Color mapping: Blue (slow) -> Green (med) -> Yellow -> Red (fast)
                colorObj.setHSL(0.65 - speedRatio * 0.65, 1.0, 0.5);
                wMesh.setColorAt(i, colorObj);

                if (trailPosAttr && trailColorAttr) {
                  const baseVertex = i * trailSegmentCount * 2;
                  for (
                    let seg = 1;
                    seg < p.trail.length && seg <= trailSegmentCount;
                    seg++
                  ) {
                    const a = p.trail[seg - 1];
                    const b = p.trail[seg];
                    const v0 = baseVertex + (seg - 1) * 2;
                    const v1 = v0 + 1;
                    trailPosAttr.setXYZ(v0, a.x, a.y, a.z);
                    trailPosAttr.setXYZ(v1, b.x, b.y, b.z);

                    const fade = seg / Math.max(p.trail.length - 1, 1);
                    trailColor.setHSL(
                      0.65 - speedRatio * 0.65,
                      1.0,
                      0.35 + fade * 0.25,
                    );
                    trailColorAttr.setXYZ(
                      v0,
                      trailColor.r * fade,
                      trailColor.g * fade,
                      trailColor.b * fade,
                    );
                    trailColorAttr.setXYZ(
                      v1,
                      trailColor.r * fade,
                      trailColor.g * fade,
                      trailColor.b * fade,
                    );
                  }
                }
              }
              wMesh.instanceMatrix.needsUpdate = true;
              if (wMesh.instanceColor) wMesh.instanceColor.needsUpdate = true;
              if (trailPosAttr) trailPosAttr.needsUpdate = true;
              if (trailColorAttr) trailColorAttr.needsUpdate = true;
              map.triggerRepaint();
            }
          }
        },
      };

      map.setLight({
        anchor: "viewport",
        color: "#f8fafc",
        intensity: 0.4,
        position: [1.2, 205, 35],
      });

      map.setFog({
        range: [0.8, 8],
        color: "#f8fbff",
        "high-color": "#dbeafe",
        "horizon-blend": 0.12,
        "space-color": "#f1f5f9",
        "star-intensity": 0,
      });

      const styleSources = map.getStyle().sources as Record<string, unknown>;
      if (styleSources.composite && !map.getLayer(CONTEXT_LAYER_ID)) {
        map.addLayer({
          id: CONTEXT_LAYER_ID,
          source: "composite",
          "source-layer": "building",
          type: "fill-extrusion",
          minzoom: 14,
          paint: {
            "fill-extrusion-color": [
              "interpolate",
              ["linear"],
              ["coalesce", ["get", "height"], 0],
              0,
              "#a8b0be",
              25,
              "#9aa5b5",
              60,
              "#8f9aac",
              120,
              "#7e889b",
            ],
            "fill-extrusion-height": ["coalesce", ["get", "height"], 0],
            "fill-extrusion-base": ["coalesce", ["get", "min_height"], 0],
            "fill-extrusion-opacity": 0.35,
            "fill-extrusion-vertical-gradient": true,
          },
        });
      }

      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: initialData,
      });

      map.addSource(ROOF_SOURCE_ID, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      map.addLayer({
        id: LAYER_ID,
        type: "fill-extrusion",
        source: SOURCE_ID,
        paint: {
          "fill-extrusion-color": [
            "interpolate",
            ["linear"],
            ["coalesce", ["to-number", ["get", "height"]], 12],
            0,
            "#8dd3c7",
            20,
            "#5cb2c4",
            40,
            "#4e93d1",
            80,
            "#4f46e5",
          ],
          "fill-extrusion-height": [
            "coalesce",
            ["to-number", ["get", "height"]],
            12,
          ],
          "fill-extrusion-opacity": 0.94,
          "fill-extrusion-vertical-gradient": true,
          "fill-extrusion-base": 0,
        },
      });

      map.addLayer({
        id: OUTLINE_LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        paint: {
          "line-color": "#0f172a",
          "line-width": 2,
          "line-opacity": 0.95,
        },
      });

      map.addLayer({
        id: ROOF_LAYER_ID,
        type: "fill-extrusion",
        source: ROOF_SOURCE_ID,
        paint: {
          "fill-extrusion-color": [
            "match",
            ["get", "roofType"],
            "pyramid",
            "#7c3aed",
            "tiered",
            "#0ea5e9",
            "#64748b",
          ],
          "fill-extrusion-base": ["coalesce", ["get", "roofBase"], 0],
          "fill-extrusion-height": ["coalesce", ["get", "roofHeight"], 0],
          "fill-extrusion-opacity": 0.95,
        },
      });

      if (!map.getLayer(MODEL_LAYER_ID)) {
        map.addLayer(customLayer);
      }

      // Register OWM tile layers (all start hidden; tabs control visibility)
      initOWMLayers();

      // Initial env data fetch for map center (gets wind dir + PM2.5 for particles)
      const c = map.getCenter();
      fetchEnvData(c.lat, c.lng);

      const bindFeatureLayerSelection = (layerId: string) => {
        map.on("mouseenter", layerId, () => {
          map.getCanvas().style.cursor = "pointer";
        });

        map.on("mouseleave", layerId, () => {
          map.getCanvas().style.cursor = "";
          if (!map.dragPan.isEnabled()) {
            map.dragPan.enable();
          }
        });

        map.on("mousedown", layerId, (event) => {
          map.dragPan.disable();
          const rawId =
            event.features?.[0]?.properties?.parentId ??
            event.features?.[0]?.id;
          if (rawId && drawRef.current) {
            const selectedId = String(rawId);
            setSelectedFeatureId(selectedId);
            drawRef.current.changeMode("simple_select", {
              featureIds: [selectedId],
            });
          }
        });
      };

      bindFeatureLayerSelection(LAYER_ID);
      bindFeatureLayerSelection(OUTLINE_LAYER_ID);
      bindFeatureLayerSelection(ROOF_LAYER_ID);

      map.on("mouseup", () => {
        if (!map.dragPan.isEnabled()) {
          map.dragPan.enable();
        }
      });

      refreshSourceFromDraw();
    });

    map.on("draw.create", handleCreate);
    map.on("draw.selectionchange", handleSelectionChange);
    map.on("draw.modechange", handleModeChange);
    map.on("draw.update", refreshSourceFromDraw);
    map.on("draw.delete", () => {
      setSelectedFeatureId(null);
      setStatusMessage("Đã xóa feature đang chọn (nếu có).");
      refreshSourceFromDraw();
    });

    mapRef.current = map;
    drawRef.current = draw;

    return () => {
      if (modelMarkerRef.current) {
        modelMarkerRef.current.remove();
        modelMarkerRef.current = null;
      }
      if (windTrailRef.current) {
        windTrailRef.current.geometry.dispose();
        (windTrailRef.current.material as THREE.Material).dispose();
        windTrailRef.current = null;
      }
      if (threeRendererRef.current) {
        threeRendererRef.current.dispose();
        threeRendererRef.current = null;
      }
      importedModelRef.current = null;
      modelPlacementRef.current = null;
      threeSceneRef.current = null;
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
    };
  }, [mapToken]);

  const startPolygonDraw = () => {
    if (!drawRef.current) {
      return;
    }
    drawRef.current.changeMode("draw_polygon");
    setIsDrawMode(true);
    setStatusMessage(
      "Đang vẽ polygon mới. Click điểm đầu -> ... -> double-click để kết thúc.",
    );
  };

  const handleModelFileImport = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const map = mapRef.current;
    const scene = threeSceneRef.current;
    if (!map || !scene) {
      setStatusMessage("Map chưa sẵn sàng để import model.");
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension !== "glb" && extension !== "gltf") {
      setStatusMessage("Chỉ hỗ trợ file .gltf hoặc .glb.");
      return;
    }

    setStatusMessage(`Đang import model ${file.name}...`);

    try {
      const loader = new GLTFLoader();
      const rawBuffer = await file.arrayBuffer();

      const gltf = await new Promise<GLTF>((resolve, reject) => {
        const onLoad = (loaded: GLTF) => {
          resolve(loaded);
        };

        const onError = (error: unknown) => {
          reject(error);
        };

        if (extension === "gltf") {
          const text = new TextDecoder().decode(rawBuffer);
          loader.parse(text, "", onLoad, onError);
          return;
        }

        loader.parse(rawBuffer, "", onLoad, onError);
      });

      if (importedModelRef.current) {
        scene.remove(importedModelRef.current);
      }

      const model = gltf.scene;
      model.traverse((child: THREE.Object3D) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
          // No shadows - no shadow-casting lights configured.
          mesh.castShadow = false;
          mesh.receiveShadow = false;
          const materials = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
          for (const mat of materials) {
            if (!mat) continue;
            const m = mat as THREE.Material;
            m.side = THREE.DoubleSide;
            m.depthWrite = true;
            m.depthTest = true;
            m.polygonOffset = true;
            m.polygonOffsetFactor = 2;
            m.polygonOffsetUnits = 1;
            m.needsUpdate = true;
          }
        }
      });

      // Model stays at scene origin; the render callback encodes all
      // transform (position / scale / rotation) into camera.projectionMatrix.
      model.position.set(0, 0, 0);
      model.scale.set(1, 1, 1);
      model.rotation.set(0, 0, 0);

      scene.add(model);
      importedModelRef.current = model;

      const center = map.getCenter();
      const spawn = getLngLatOffsetByMeters(center, 40, map.getBearing());
      const scale = Number.parseFloat(modelScaleInput) || 1;

      modelPlacementRef.current = {
        lng: spawn.lng,
        lat: spawn.lat,
        altitude: 0,
        scale: Math.max(0.01, scale),
        rotation: Number.parseFloat(modelRotationInput) || 0,
      };

      ensureModelMarker();
      syncImportedModelTransform();
      // Trigger a one-time repaint so the model appears immediately.
      // (We removed triggerRepaint from the render loop to avoid infinite repaint.)
      map.triggerRepaint();
      setModelFileName(file.name);
      setStatusMessage(
        "Model đã xuất hiện trước mặt bạn. Kéo chấm cyan trên map để đặt đúng vị trí.",
      );
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : JSON.stringify(error);
      console.error("[GLTFLoader] Import lỗi:", error);
      setStatusMessage(`❌ Import thất bại: ${msg}`);
    }
  };

  const applyModelScale = () => {
    const placement = modelPlacementRef.current;
    if (!placement || !importedModelRef.current) {
      setStatusMessage("Hãy import model trước khi chỉnh tỉ lệ.");
      return;
    }

    const nextScale = Number.parseFloat(modelScaleInput);
    if (!Number.isFinite(nextScale) || nextScale <= 0) {
      setStatusMessage("Scale phải là số dương (ví dụ 1 hoặc 0.25).");
      return;
    }
    const nextRot = Number.parseFloat(modelRotationInput) || 0;

    placement.scale = nextScale;
    placement.rotation = nextRot;
    syncImportedModelTransform();
    setStatusMessage(
      `Đã cập nhật model: scale x${nextScale}, rotation ${nextRot}°.`,
    );
  };

  const clearImportedModel = () => {
    const scene = threeSceneRef.current;
    if (!scene || !importedModelRef.current) {
      setStatusMessage("Hiện chưa có model nào để xóa.");
      return;
    }

    scene.remove(importedModelRef.current);
    importedModelRef.current = null;
    modelPlacementRef.current = null;
    setModelFileName(null);

    if (modelMarkerRef.current) {
      modelMarkerRef.current.remove();
      modelMarkerRef.current = null;
    }

    const map = mapRef.current;
    if (map) {
      map.triggerRepaint();
    }

    setStatusMessage("Đã xóa model 3D đã import.");
  };

  const applySelectedProperties = () => {
    if (!drawRef.current || !selectedFeatureId) {
      setStatusMessage("Hãy chọn một tòa nhà trước khi cập nhật thông số.");
      return;
    }

    const normalized = normalizeHeight(heightInput, floorsInput);
    drawRef.current.setFeatureProperty(
      selectedFeatureId,
      "height",
      normalized.height,
    );
    drawRef.current.setFeatureProperty(
      selectedFeatureId,
      "floors",
      normalized.floors,
    );
    drawRef.current.setFeatureProperty(
      selectedFeatureId,
      "roofType",
      roofTypeInput,
    );

    setHeightInput(String(normalized.height));
    setFloorsInput(String(normalized.floors));
    setStatusMessage(
      `Đã cập nhật tòa nhà ${selectedFeatureId}: ${normalized.height}m, ${normalized.floors} tầng.`,
    );

    const map = mapRef.current;
    const draw = drawRef.current;
    if (!map || !draw) {
      return;
    }

    const data = draw.getAll() as FeatureCollection;
    const safeFeatures = data.features.map((feature) => {
      const rawHeight = String(feature.properties?.height ?? "");
      const rawFloors = String(feature.properties?.floors ?? "");
      const fix = normalizeHeight(rawHeight, rawFloors);
      return {
        ...feature,
        properties: {
          ...(feature.properties ?? {}),
          source: "user_drawn",
          height: fix.height,
          floors: fix.floors,
          roofType: String(feature.properties?.roofType ?? "flat"),
        },
      };
    });

    const source = map.getSource(SOURCE_ID) as
      | mapboxgl.GeoJSONSource
      | undefined;
    if (source) {
      source.setData({ type: "FeatureCollection", features: safeFeatures });

      const roofSource = map.getSource(ROOF_SOURCE_ID) as
        | mapboxgl.GeoJSONSource
        | undefined;
      if (roofSource) {
        roofSource.setData(
          createRoofCollection({
            type: "FeatureCollection",
            features: safeFeatures,
          }),
        );
      }

      setPayloadPreview(
        JSON.stringify(
          { type: "FeatureCollection", features: safeFeatures },
          null,
          2,
        ),
      );
    }
  };

  const startShapeEdit = () => {
    if (!drawRef.current || !selectedFeatureId) {
      setStatusMessage("Chọn một tòa nhà trước khi sửa hình.");
      return;
    }

    drawRef.current.changeMode("direct_select", {
      featureId: selectedFeatureId,
    });
    setStatusMessage(
      "Đang ở chế độ sửa hình: kéo các đỉnh polygon để chỉnh footprint.",
    );
  };

  const finishShapeEdit = () => {
    if (!drawRef.current || !selectedFeatureId) {
      return;
    }
    drawRef.current.changeMode("simple_select", {
      featureIds: [selectedFeatureId],
    });
    setStatusMessage("Đã thoát chế độ sửa hình.");
  };

  const deleteSelectedFeature = () => {
    if (!drawRef.current || !selectedFeatureId) {
      setStatusMessage("Chọn một tòa nhà trước khi xóa.");
      return;
    }

    drawRef.current.delete(selectedFeatureId);
    setSelectedFeatureId(null);
    setStatusMessage("Đã xóa tòa nhà đang chọn.");

    const map = mapRef.current;
    const draw = drawRef.current;
    if (!map || !draw) return;

    const data = draw.getAll() as FeatureCollection;
    const safeFeatures = data.features.map((feature) => {
      const rawHeight = String(feature.properties?.height ?? "");
      const rawFloors = String(feature.properties?.floors ?? "");
      const fix = normalizeHeight(rawHeight, rawFloors);
      return {
        ...feature,
        properties: {
          ...(feature.properties ?? {}),
          source: "user_drawn",
          height: fix.height,
          floors: fix.floors,
          roofType: String(feature.properties?.roofType ?? "flat"),
        },
      };
    });

    const source = map.getSource(SOURCE_ID) as
      | mapboxgl.GeoJSONSource
      | undefined;
    if (source)
      source.setData({ type: "FeatureCollection", features: safeFeatures });

    const roofSource = map.getSource(ROOF_SOURCE_ID) as
      | mapboxgl.GeoJSONSource
      | undefined;
    if (roofSource)
      roofSource.setData(
        createRoofCollection({
          type: "FeatureCollection",
          features: safeFeatures,
        }),
      );

    setFeatureCount(safeFeatures.length);
  };

  return (
    <section className="relative h-screen w-full bg-black overflow-hidden font-sans antialiased text-white">
      <Header />

      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        statusMessage={statusMessage}
        operationMode={operationMode}
        onSetOperationMode={setOperationMode}
        activeEnvTab={activeEnvTab}
        onSwitchEnvTab={switchEnvTab}
        showWindSim={showWindSim}
        onToggleWindSim={() => setShowWindSim(!showWindSim)}
        windyUrl={windyUrl}
        windyDisplayMode={windyDisplayMode}
        onCloseWindyFullToPanel={closeWindyFullToPanel}
        onOpenWindyFull={openWindyFull}
        onStartPolygonDraw={startPolygonDraw}
        onImportData={() =>
          setStatusMessage("Chuẩn bị import dữ liệu dự án...")
        }
      />

      {/* Main Map Container */}
      <div
        className={`fixed inset-0 pt-16 transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) ${
          isSidebarCollapsed ? "pl-16" : "pl-[300px]"
        }`}
      >
        <div ref={containerRef} className="h-full w-full" />
      </div>

      {/* Property Editor Panel */}
      {!isSidebarCollapsed && selectedFeatureId && (
        <PropertyEditorPanel
          selectedFeatureId={selectedFeatureId}
          heightInput={heightInput}
          floorsInput={floorsInput}
          roofTypeInput={roofTypeInput}
          payloadPreview={payloadPreview}
          onHeightChange={setHeightInput}
          onFloorsChange={setFloorsInput}
          onRoofTypeChange={setRoofTypeInput}
          onApply={applySelectedProperties}
          onStartShapeEdit={startShapeEdit}
          onDelete={deleteSelectedFeature}
          onClose={() => setSelectedFeatureId(null)}
        />
      )}

      {/* Model Import Panel */}
      {!isSidebarCollapsed && operationMode === "import" && (
        <ModelImportPanel
          modelFileName={modelFileName}
          modelScaleInput={modelScaleInput}
          modelRotationInput={modelRotationInput}
          onScaleChange={setModelScaleInput}
          onRotationChange={setModelRotationInput}
          onFileImport={handleModelFileImport}
          onApplyScale={applyModelScale}
          onClearModel={clearImportedModel}
          onClose={() => setOperationMode("draw")}
        />
      )}

      {/* Windy Overlay */}
      {windyUrl && (
        <WindyOverlay
          windyUrl={windyUrl}
          windyDisplayMode={windyDisplayMode}
          onCloseWindyFullToPanel={closeWindyFullToPanel}
          onOpenWindyFull={openWindyFull}
          onSwitchEnvTab={switchEnvTab}
        />
      )}

      {/* Loading Overlay */}
      {isLoadingEnv && <LoadingOverlay />}
    </section>
  );
}
