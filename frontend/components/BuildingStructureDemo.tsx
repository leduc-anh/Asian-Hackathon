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
import { 
  ChevronLeft, 
  ChevronRight, 
  Box, 
  Upload, 
  Hexagon, 
  Wind, 
  Thermometer, 
  CloudSun, 
  CloudRain, 
  Cloud, 
  Droplets, 
  Zap,
  LayoutGrid,
  Home,
  FolderKanban,
  User,
  Bell,
  Search,
  Settings,
  HelpCircle,
  LogOut,
  MoreVertical,
  X,
  Maximize2,
  Minimize2
} from "lucide-react";

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
      // and syncs the model transform atomically — avoids flicker from
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

  // ── AQI heatmap: draw PM2.5 concentration cloud around a location ──
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

  // ── Fetch env data from backend, then update map + particles ──
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

  // ── OWM tile key (free tier, covers all of Vietnam) ──
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

      // ── SETUP 3D WIND PARTICLES ──
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
          // GLTF textures are sRGB-encoded — without this setting,
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

          // l = translate to geo position × rotateZ × scale(s, -s, s) × rotateX(PI/2)
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

          // ── UPDATE 3D WIND PARTICLES ──
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
              const baseDirZ = Math.cos(angleRad);
              const windSpeedBase = env.wind.speed * 12.0; // Scaled for visual effect

              const dt = 0.016;
              for (let i = 0; i < wData.length; i++) {
                const p = wData[i];

                // 1. Vertical Wind Profile (Power Law)
                // Represents wind speed increasing with height (urban roughness)
                const alpha = 0.25;
                const hRef = 30;
                const zRel = Math.max(1, p.position.y);
                const verticalMultiplier = Math.pow(zRel / hRef, alpha);
                const localWindSpeed = windSpeedBase * verticalMultiplier;

                const U_x = baseDirX * localWindSpeed;
                const U_z = baseDirZ * localWindSpeed;

                let vx = U_x;
                let vz = U_z;
                let vy = Math.sin(p.position.x * 0.04 + t * 1.6) * 3.0; // Ambient turbulence

                for (const obs of obstacles) {
                  const dx = p.position.x - obs.x;
                  const dz = p.position.z - obs.z;
                  const r2 = dx * dx + dz * dz;
                  const R = obs.r;
                  const H = obs.h;
                  const r = Math.sqrt(r2);

                  // Project into wind-aligned coordinates (v = along-wind, u = cross-wind)
                  const vRel = dx * baseDirX + dz * baseDirZ; 
                  const uRel = dx * (-baseDirZ) + dz * baseDirX;

                  if (r < R * 6) {
                    // 2. URock/Röckle-inspired Diagnostic Zones
                    const isBehind = vRel > R * 0.5;
                    const isBeside = Math.abs(uRel) < R * 1.5;

                    if (isBehind && isBeside) {
                      const cavityLength = H * 1.5;
                      const wakeLength = H * 5.0;

                      if (vRel < cavityLength && p.position.y < H * 1.1) {
                        // Cavity: Recirculation (reverse wind)
                        vx *= -0.3;
                        vz *= -0.3;
                        vy += 4.5; // Updraft in cavity zone
                      } else if (vRel < wakeLength && p.position.y < H * 1.6) {
                        // Wake: Velocity deficit
                        const wakeFactor = 0.35 + 0.45 * (vRel / wakeLength);
                        vx *= wakeFactor;
                        vz *= wakeFactor;
                      }
                    }

                    // 3. Potential Flow & Steering (Upwind and Near-Side)
                    if (r < R * 2.5) {
                      const U_dot_p = U_x * dx + U_z * dz;
                      const term = (R * R) / (r2 * r2);
                      vx += term * (r2 * U_x - 2 * U_dot_p * dx) * 0.5;
                      vz += term * (r2 * U_z - 2 * U_dot_p * dz) * 0.5;

                      // Tangential steering (hugging the edges)
                      const invR = 1 / Math.max(r, 1e-4);
                      const nx = dx * invR;
                      const nz = dz * invR;
                      const tx = -nz;
                      const tz = nx;
                      const flowSign = Math.sign(U_x * tx + U_z * tz) || 1;
                      const nearEdge = Math.max(0, 1 - Math.abs(r - R * 1.05) / (R * 1.2));
                      vx += tx * flowSign * nearEdge * 28;
                      vz += tz * flowSign * nearEdge * 28;

                      // Upwind displacement (pushing up when hitting facade)
                      if (vRel < 0 && r < R * 1.6 && p.position.y < H) {
                        const pushUp = Math.abs(vRel / R) * 8.5;
                        vy += pushUp;
                      }
                    }

                    // 4. Collision Avoidance (Physical constraint)
                    if (r < R * 0.88 && p.position.y < H) {
                      const nx = dx / r;
                      const nz = dz / r;
                      p.position.x = obs.x + nx * R * 0.9;
                      p.position.z = obs.z + nz * R * 0.9;
                      vx += nx * 55;
                      vz += nz * 55;
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
          // No shadows — no shadow-casting lights configured.
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

      // Model stays at scene origin — the render callback encodes all
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
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-14 z-50 bg-black/90 backdrop-blur-xl border-b border-white/10 px-4 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center group hover:border-white/40 transition-all duration-300">
            <Box className="w-4 h-4 text-white group-hover:scale-110 transition-transform" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight leading-none mb-1">AeroTwin</h1>
            <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-bold leading-none">Urban Intelligence</p>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-1 bg-white/5 p-1 rounded-full border border-white/10">
          <button className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold text-white bg-white/10 shadow-sm border border-white/5 transition-all">
            <Home className="w-3.5 h-3.5" strokeWidth={2} />
            Trang chủ
          </button>
          <button className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold text-white/60 hover:text-white hover:bg-white/5 transition-all">
            <FolderKanban className="w-3.5 h-3.5" strokeWidth={2} />
            Dự án
          </button>
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center bg-white/5 border border-white/10 rounded-full px-3 py-1.5 gap-2 mr-2">
            <Search className="w-3.5 h-3.5 text-white/40" />
            <span className="text-[11px] text-white/40 font-medium">Tìm kiếm dữ liệu...</span>
          </div>
          
          <button className="p-2 text-white/60 hover:text-white transition-colors relative group">
            <Bell className="w-5 h-5" strokeWidth={1.5} />
            <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-cyan-400 rounded-full border border-black group-hover:scale-125 transition-transform" />
          </button>
          
          <div className="h-6 w-[1px] bg-white/10 mx-1" />
          
          <div className="flex items-center gap-3 pl-1">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-white leading-none mb-0.5">Tonny</p>
              <p className="text-[10px] text-white/30 font-medium leading-none tracking-wide">Administrator</p>
            </div>
            <div className="w-9 h-9 rounded-full border border-white/20 bg-gradient-to-tr from-zinc-800 to-zinc-950 flex items-center justify-center overflow-hidden hover:border-white/40 transition-colors cursor-pointer">
               <User className="w-5 h-5 text-white/60" />
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside 
        className={`fixed left-0 top-14 bottom-0 z-40 flex flex-col bg-black border-r border-white/10 shadow-[20px_0_40px_rgba(0,0,0,0.4)] transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) ${
          isSidebarCollapsed ? "w-16" : "w-[300px]"
        }`}
      >
        <div className="flex-1 overflow-y-auto py-6 scrollbar-hide">
          <div className="px-3 space-y-6">
            
            {/* Project Info Section */}
            {!isSidebarCollapsed && (
              <div className="px-2 mb-6">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Dự án hiện tại</p>
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 group hover:border-white/20 transition-all cursor-pointer">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors">TP.HCM Digital Twin</h3>
                    <MoreVertical className="w-4 h-4 text-white/30" />
                  </div>
                  <p className="text-[11px] text-white/40 font-medium leading-relaxed">{statusMessage}</p>
                </div>
              </div>
            )}

            {/* Core Controls */}
            <div className="space-y-1">
              {!isSidebarCollapsed && <p className="px-2 text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Thao tác</p>}
              
              <button
                type="button"
                onClick={() => setStatusMessage("Chuẩn bị import dữ liệu dự án...")}
                className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group ${
                  isSidebarCollapsed ? "justify-center" : "gap-3 px-3 hover:bg-white/5"
                }`}
                title={isSidebarCollapsed ? "Import dữ liệu" : ""}
              >
                <Upload className="w-5 h-5 text-white/60 group-hover:text-white group-hover:scale-110 transition-all" strokeWidth={1.5} />
                {!isSidebarCollapsed && (
                  <span className="text-sm font-semibold text-white/70 group-hover:text-white">Import dữ liệu</span>
                )}
              </button>

              <button
                type="button"
                onClick={startPolygonDraw}
                className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group ${
                  isSidebarCollapsed ? "justify-center" : "gap-3 px-3 hover:bg-white/5"
                }`}
                title={isSidebarCollapsed ? "Vẽ polygon" : ""}
              >
                <Hexagon className="w-5 h-5 text-white/60 group-hover:text-white group-hover:scale-110 transition-all" strokeWidth={1.5} />
                {!isSidebarCollapsed && (
                  <span className="text-sm font-semibold text-white/70 group-hover:text-white">Vẽ polygon</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setOperationMode("import")}
                className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group ${
                  operationMode === "import" 
                    ? "bg-white/10 text-white" 
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                } ${isSidebarCollapsed ? "justify-center" : "gap-3 px-3"}`}
                title={isSidebarCollapsed ? "Import mô hình" : ""}
              >
                <Box className={`w-5 h-5 ${operationMode === "import" ? "text-white" : "text-white/60 group-hover:text-white group-hover:scale-110 transition-all"}`} strokeWidth={1.5} />
                {!isSidebarCollapsed && (
                  <span className="text-sm font-semibold">Import mô hình 3D</span>
                )}
              </button>
            </div>

            {/* Environmental Data Section */}
            <div className="space-y-1">
              {!isSidebarCollapsed && <p className="px-2 text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Môi trường</p>}
              
              <button
                type="button"
                onClick={() => switchEnvTab(activeEnvTab === "wind" ? null : "wind")}
                className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group ${
                  activeEnvTab === "wind" ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 shadow-[0_0_20px_rgba(34,211,238,0.1)]" : "text-white/60 hover:bg-white/5 hover:text-white"
                } ${isSidebarCollapsed ? "justify-center" : "gap-3 px-3"}`}
                title={isSidebarCollapsed ? "Gió" : ""}
              >
                <Wind className="w-5 h-5" strokeWidth={1.5} />
                {!isSidebarCollapsed && <span className="text-sm font-semibold">Dữ liệu Gió</span>}
              </button>

              <button
                type="button"
                onClick={() => switchEnvTab(activeEnvTab === "temp" ? null : "temp")}
                className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group ${
                  activeEnvTab === "temp" ? "bg-orange-500/20 text-orange-400 border border-orange-500/20" : "text-white/60 hover:bg-white/5 hover:text-white"
                } ${isSidebarCollapsed ? "justify-center" : "gap-3 px-3"}`}
                title={isSidebarCollapsed ? "Nhiệt độ" : ""}
              >
                <Thermometer className="w-5 h-5" strokeWidth={1.5} />
                {!isSidebarCollapsed && <span className="text-sm font-semibold">Nhiệt độ</span>}
              </button>

              <button
                type="button"
                onClick={() => switchEnvTab(activeEnvTab === "clouds" ? null : "clouds")}
                className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group ${
                  activeEnvTab === "clouds" ? "bg-blue-500/20 text-blue-400 border border-blue-500/20" : "text-white/60 hover:bg-white/5 hover:text-white"
                } ${isSidebarCollapsed ? "justify-center" : "gap-3 px-3"}`}
                title={isSidebarCollapsed ? "Thời tiết" : ""}
              >
                <CloudSun className="w-5 h-5" strokeWidth={1.5} />
                {!isSidebarCollapsed && <span className="text-sm font-semibold">Thời tiết</span>}
              </button>

              <button
                type="button"
                onClick={() => switchEnvTab(activeEnvTab === "rain" ? null : "rain")}
                className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group ${
                  activeEnvTab === "rain" ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/20" : "text-white/60 hover:bg-white/5 hover:text-white"
                } ${isSidebarCollapsed ? "justify-center" : "gap-3 px-3"}`}
                title={isSidebarCollapsed ? "Mưa" : ""}
              >
                <CloudRain className="w-5 h-5" strokeWidth={1.5} />
                {!isSidebarCollapsed && <span className="text-sm font-semibold">Lượng mưa</span>}
              </button>

              <button
                type="button"
                onClick={() => switchEnvTab(activeEnvTab === "clouds" ? null : "clouds")}
                className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group ${
                  activeEnvTab === "clouds" ? "bg-zinc-500/20 text-zinc-300 border border-zinc-500/20" : "text-white/60 hover:bg-white/5 hover:text-white"
                } ${isSidebarCollapsed ? "justify-center" : "gap-3 px-3"}`}
                title={isSidebarCollapsed ? "Mây" : ""}
              >
                <Cloud className="w-5 h-5" strokeWidth={1.5} />
                {!isSidebarCollapsed && <span className="text-sm font-semibold">Độ che phủ mây</span>}
              </button>

              <button
                type="button"
                onClick={() => switchEnvTab(activeEnvTab === "aqi" ? null : "aqi")}
                className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group ${
                  activeEnvTab === "aqi" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20" : "text-white/60 hover:bg-white/5 hover:text-white"
                } ${isSidebarCollapsed ? "justify-center" : "gap-3 px-3"}`}
                title={isSidebarCollapsed ? "Chất lượng không khí" : ""}
              >
                <Droplets className="w-5 h-5" strokeWidth={1.5} />
                {!isSidebarCollapsed && <span className="text-sm font-semibold">Chất lượng không khí</span>}
              </button>

              <button
                type="button"
                onClick={() => setShowWindSim(!showWindSim)}
                className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group ${
                  showWindSim ? "bg-violet-500/20 text-violet-400 border border-violet-500/20" : "text-white/60 hover:bg-white/5 hover:text-white"
                } ${isSidebarCollapsed ? "justify-center" : "gap-3 px-3"}`}
                title={isSidebarCollapsed ? "Gió 3D" : ""}
              >
                <Zap className="w-5 h-5" strokeWidth={1.5} />
                {!isSidebarCollapsed && <span className="text-sm font-semibold">Mô phỏng Gió 3D</span>}
              </button>
            </div>

            {/* Windy Controls */}
            {windyUrl && (
              <div className="space-y-1">
                {!isSidebarCollapsed && <p className="px-2 text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Windy Overlay</p>}
                
                <button
                  type="button"
                  onClick={windyDisplayMode === "full" ? closeWindyFullToPanel : openWindyFull}
                  className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group text-white/60 hover:bg-white/5 hover:text-white ${
                    isSidebarCollapsed ? "justify-center" : "gap-3 px-3"
                  }`}
                >
                  {windyDisplayMode === "full" ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                  {!isSidebarCollapsed && (
                    <span className="text-sm font-semibold">{windyDisplayMode === "full" ? "Thu nhỏ Windy" : "Mở rộng Windy"}</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => switchEnvTab(null)}
                  className={`w-full flex items-center p-3 rounded-xl transition-all duration-200 group text-white/60 hover:bg-rose-500/10 hover:text-rose-400 ${
                    isSidebarCollapsed ? "justify-center" : "gap-3 px-3"
                  }`}
                >
                  <X className="w-5 h-5" strokeWidth={1.5} />
                  {!isSidebarCollapsed && <span className="text-sm font-semibold">Tắt lớp phủ</span>}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Toggle */}
        <div className="p-3 border-t border-white/5 flex items-center justify-between">
           {!isSidebarCollapsed && (
             <div className="flex items-center gap-2 px-2">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">System Live</span>
             </div>
           )}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className={`p-2 rounded-lg bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all ${isSidebarCollapsed ? "w-full flex justify-center" : ""}`}
          >
            {isSidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>
      </aside>

      {/* Main Map Container */}
      <div 
        className={`fixed inset-0 pt-14 transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) ${
          isSidebarCollapsed ? "pl-16" : "pl-[300px]"
        }`}
      >
        <div ref={containerRef} className="h-full w-full" />
      </div>

      {/* Property Editor Panel (Floating) */}
      {!isSidebarCollapsed && selectedFeatureId && (
        <div className="fixed right-6 top-20 bottom-6 w-[340px] z-30 flex flex-col gap-4 overflow-y-auto rounded-2xl border border-white/10 bg-black/80 backdrop-blur-2xl p-5 shadow-2xl animate-in fade-in slide-in-from-right-4 duration-500">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold text-white tracking-tight">Thuộc tính khối</h3>
            <button onClick={() => setSelectedFeatureId(null)} className="p-2 text-white/40 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Cao (m)</label>
                  <input
                    type="number"
                    min={1}
                    value={heightInput}
                    onChange={(event) => setHeightInput(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white outline-none focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/10 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Số tầng</label>
                  <input
                    type="number"
                    min={1}
                    value={floorsInput}
                    onChange={(event) => setFloorsInput(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white outline-none focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/10 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Kiểu mái</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["flat", "pyramid", "tiered"] as RoofProfile[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setRoofTypeInput(type)}
                      className={`py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all border ${
                        roofTypeInput === type 
                          ? "bg-white text-black border-white shadow-lg" 
                          : "bg-white/5 text-white/40 border-white/10 hover:border-white/20"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <button
                onClick={applySelectedProperties}
                className="w-full py-3 rounded-xl bg-white text-black text-sm font-bold shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Cập nhật thay đổi
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={startShapeEdit}
                  className="py-2.5 rounded-xl border border-white/10 bg-white/5 text-xs font-bold text-white/70 hover:bg-white/10 transition-all"
                >
                  Chỉnh điểm
                </button>
                <button
                  onClick={deleteSelectedFeature}
                  className="py-2.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-xs font-bold text-rose-400 hover:bg-rose-500/20 transition-all"
                >
                  Xóa khối
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">GeoJSON Data</h4>
              <div className="p-4 rounded-xl bg-black border border-white/5 text-[10px] font-mono text-cyan-400/80 overflow-auto max-h-[200px] scrollbar-hide">
                <pre>{payloadPreview}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Model Import Panel (Floating) */}
      {!isSidebarCollapsed && operationMode === "import" && (
        <div className="fixed right-6 top-20 w-[340px] z-30 flex flex-col gap-6 rounded-2xl border border-white/10 bg-black/80 backdrop-blur-2xl p-6 shadow-2xl animate-in fade-in slide-in-from-right-4 duration-500">
           <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white tracking-tight">Nhập mô hình 3D</h3>
            <button onClick={() => setOperationMode("draw")} className="p-2 text-white/40 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-6">
            <label className="group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/10 bg-white/5 p-8 transition-all hover:bg-white/10 hover:border-white/20 cursor-pointer">
              <Upload className="w-10 h-10 text-white/20 group-hover:text-white group-hover:scale-110 transition-all mb-4" />
              <span className="text-sm font-bold text-white/80 mb-1">Tải lên mô hình</span>
              <span className="text-[10px] text-white/30 font-medium uppercase tracking-widest">Định dạng .GLB / .GLTF</span>
              <input type="file" accept=".glb,.gltf" onChange={handleModelFileImport} className="hidden" />
            </label>

            {modelFileName && (
              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center gap-3">
                <Box className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-cyan-400 truncate">{modelFileName}</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Tỉ lệ</label>
                  <input
                    type="number"
                    min={0.01}
                    step={0.1}
                    value={modelScaleInput}
                    onChange={(e) => setModelScaleInput(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white outline-none focus:border-white/40 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/30">Xoay (độ)</label>
                  <input
                    type="number"
                    value={modelRotationInput}
                    onChange={(e) => setModelRotationInput(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white outline-none focus:border-white/40 transition-all"
                  />
                </div>
              </div>
              <button
                onClick={applyModelScale}
                className="w-full py-3 rounded-xl bg-white text-black text-sm font-bold shadow-xl hover:bg-zinc-200 transition-all"
              >
                Cập nhật mô hình
              </button>
              <button
                onClick={clearImportedModel}
                className="w-full py-3 rounded-xl border border-rose-500/20 bg-rose-500/10 text-sm font-bold text-rose-400 hover:bg-rose-500/20 transition-all"
              >
                Xóa mô hình
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Windy Overlay (Floating Window) */}
      {windyUrl && windyDisplayMode === "panel" && (
        <div className="fixed right-6 bottom-6 w-[400px] h-[300px] z-30 rounded-2xl border border-white/10 bg-black/80 backdrop-blur-2xl p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <Wind className="w-4 h-4 text-cyan-400" />
              <span className="text-[11px] font-bold text-white uppercase tracking-widest">Windy Live</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={openWindyFull} className="p-1.5 text-white/40 hover:text-white transition-colors">
                <Maximize2 className="w-4 h-4" />
              </button>
              <button onClick={() => switchEnvTab(null)} className="p-1.5 text-white/40 hover:text-rose-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <iframe src={windyUrl} className="w-full h-[calc(100%-40px)] rounded-xl border border-white/5 shadow-inner" />
        </div>
      )}

      {/* Windy Full Screen Overlay */}
      {windyUrl && windyDisplayMode === "full" && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in duration-500">
          <div className="w-full h-full max-w-6xl max-h-[800px] rounded-3xl border border-white/10 bg-black shadow-2xl overflow-hidden relative">
            <div className="absolute top-6 right-6 z-10 flex gap-2">
              <button 
                onClick={closeWindyFullToPanel}
                className="p-3 rounded-2xl bg-black/80 backdrop-blur-md border border-white/10 text-white/60 hover:text-white transition-all shadow-xl hover:scale-110 active:scale-95"
              >
                <Minimize2 className="w-6 h-6" />
              </button>
              <button 
                onClick={() => switchEnvTab(null)}
                className="p-3 rounded-2xl bg-black/80 backdrop-blur-md border border-white/10 text-white/60 hover:text-rose-400 transition-all shadow-xl hover:scale-110 active:scale-95"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <iframe src={windyUrl} className="w-full h-full" />
          </div>
        </div>
      )}

      {/* Loading State Overlay */}
      {isLoadingEnv && (
        <div className="fixed inset-0 z-[100] bg-black/20 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
          <div className="bg-black/80 border border-white/10 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in zoom-in duration-300">
            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <span className="text-sm font-bold text-white tracking-tight">Đang tải dữ liệu môi trường...</span>
          </div>
        </div>
      )}
    </section>
  );
}

