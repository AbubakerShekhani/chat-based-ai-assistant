<script setup lang="ts">
import {
  LMap,
  LTileLayer,
  LPolyline,
  LCircleMarker,
  LPopup,
  LControlZoom,
} from "@vue-leaflet/vue-leaflet";
import "leaflet/dist/leaflet.css";
import { ref, computed, watch, nextTick, onMounted } from "vue";
import { useData } from "vitepress";
import type { Map as LeafletMap } from "leaflet";

// --- Enhanced Types ---
interface FlightData {
  date: string;
  time: string;
  origin: string;
  destination: string;
  flightNumber: string;
  departureDateTime: string;
  arrivalDateTime: string;
  airline: string;
  aircraft?: string | null;
  class?: string | null;
  seat?: string | null;
}

interface Route {
  key: string;
  from: string;
  to: string;
  count: number;
  flights: FlightData[];
  coordinates: [number, number][];
  thickness: number;
  opacity: number;
}

interface Airport {
  code: string;
  lat: number;
  lng: number;
  name: string;
  city: string;
  country: string;
  flightCount: number;
  size: number;
}

interface Props {
  flights: FlightData[];
  height?: string;
}

// Type for Vue-Leaflet map ref
interface MapRef {
  leafletObject: LeafletMap;
}

// --- Constants ---
const LIGHT_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const DARK_TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

const LIGHT_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const DARK_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

// Airport coordinates database - ONLY airport IATA codes
const AIRPORT_COORDINATES: Record<string, Omit<Airport, "flightCount" | "size">> = {
  SIN: {
    code: "SIN",
    lat: 1.3644,
    lng: 103.9915,
    name: "Singapore Changi Airport",
    city: "Singapore",
    country: "Singapore",
  },
  CGK: {
    code: "CGK",
    lat: -6.1256,
    lng: 106.6559,
    name: "Soekarno-Hatta International Airport",
    city: "Jakarta",
    country: "Indonesia",
  },
  BOS: {
    code: "BOS",
    lat: 42.3656,
    lng: -71.0096,
    name: "Logan International Airport",
    city: "Boston",
    country: "USA",
  },
  SFO: {
    code: "SFO",
    lat: 37.6213,
    lng: -122.379,
    name: "San Francisco International Airport",
    city: "San Francisco",
    country: "USA",
  },
  DXB: {
    code: "DXB",
    lat: 25.2532,
    lng: 55.3657,
    name: "Dubai International Airport",
    city: "Dubai",
    country: "UAE",
  },
  HKG: {
    code: "HKG",
    lat: 22.308,
    lng: 113.9185,
    name: "Hong Kong International Airport",
    city: "Hong Kong",
    country: "Hong Kong",
  },
  IST: {
    code: "IST",
    lat: 41.2619,
    lng: 28.7411,
    name: "Istanbul Airport",
    city: "Istanbul",
    country: "Turkey",
  },
  NCE: {
    code: "NCE",
    lat: 43.6584,
    lng: 7.2159,
    name: "Nice Côte d'Azur Airport",
    city: "Nice",
    country: "France",
  },
  LAX: {
    code: "LAX",
    lat: 33.9425,
    lng: -118.4081,
    name: "Los Angeles International Airport",
    city: "Los Angeles",
    country: "USA",
  },
  BLR: {
    code: "BLR",
    lat: 12.9491,
    lng: 77.6678,
    name: "Kempegowda International Airport",
    city: "Bangalore",
    country: "India",
  },
  MAA: {
    code: "MAA",
    lat: 12.9941,
    lng: 80.1709,
    name: "Chennai International Airport",
    city: "Chennai",
    country: "India",
  },
  KNO: {
    code: "KNO",
    lat: 3.6422,
    lng: 98.8853,
    name: "Kualanamu International Airport",
    city: "Medan",
    country: "Indonesia",
  },
  BKK: {
    code: "BKK",
    lat: 13.69,
    lng: 100.7501,
    name: "Suvarnabhumi Airport",
    city: "Bangkok",
    country: "Thailand",
  },
  PEN: {
    code: "PEN",
    lat: 5.2971,
    lng: 100.2777,
    name: "Penang International Airport",
    city: "Penang",
    country: "Malaysia",
  },
  ICN: {
    code: "ICN",
    lat: 37.4602,
    lng: 126.4407,
    name: "Incheon International Airport",
    city: "Seoul",
    country: "South Korea",
  },
  TPA: {
    code: "TPA",
    lat: 27.9755,
    lng: -82.5332,
    name: "Tampa International Airport",
    city: "Tampa",
    country: "USA",
  },
  ATL: {
    code: "ATL",
    lat: 33.6407,
    lng: -84.4277,
    name: "Hartsfield-Jackson Atlanta International Airport",
    city: "Atlanta",
    country: "USA",
  },
  GRU: {
    code: "GRU",
    lat: -23.4356,
    lng: -46.4731,
    name: "São Paulo/Guarulhos International Airport",
    city: "São Paulo",
    country: "Brazil",
  },
  FCO: {
    code: "FCO",
    lat: 41.8003,
    lng: 12.2389,
    name: "Leonardo da Vinci International Airport",
    city: "Rome",
    country: "Italy",
  },
  FRA: {
    code: "FRA",
    lat: 50.0379,
    lng: 8.5622,
    name: "Frankfurt Airport",
    city: "Frankfurt",
    country: "Germany",
  },
  MUC: {
    code: "MUC",
    lat: 48.3537,
    lng: 11.775,
    name: "Munich Airport",
    city: "Munich",
    country: "Germany",
  },
  CDG: {
    code: "CDG",
    lat: 49.0097,
    lng: 2.5479,
    name: "Charles de Gaulle Airport",
    city: "Paris",
    country: "France",
  },
  TXL: {
    code: "TXL",
    lat: 52.5597,
    lng: 13.2877,
    name: "Berlin Tegel Airport",
    city: "Berlin",
    country: "Germany",
  },
  MXP: {
    code: "MXP",
    lat: 45.6306,
    lng: 8.7281,
    name: "Milan Malpensa Airport",
    city: "Milan",
    country: "Italy",
  },
  AMS: {
    code: "AMS",
    lat: 52.3105,
    lng: 4.7683,
    name: "Amsterdam Airport Schiphol",
    city: "Amsterdam",
    country: "Netherlands",
  },
  HNL: {
    code: "HNL",
    lat: 21.3099,
    lng: -157.8581,
    name: "Daniel K. Inouye International Airport",
    city: "Honolulu",
    country: "USA",
  },
};

// --- Props ---
const props = withDefaults(defineProps<Props>(), {
  flights: () => [],
  height: "100%",
});

// --- State ---
const selectedRoute = ref<Route | null>(null);
const showRouteDetails = ref(false);
const mapRef = ref<MapRef | null>(null);
const isMapReady = ref(false);
const currentZoom = ref(2);
const isZooming = ref(false);
const initialZoom = ref<number>(2);

// --- Theme & Computed ---
const { isDark } = useData();

// Tile layer configuration based on theme
const tileUrl = computed(() => (isDark.value ? DARK_TILE_URL : LIGHT_TILE_URL));
const tileAttribution = computed(() => (isDark.value ? DARK_ATTRIBUTION : LIGHT_ATTRIBUTION));

// Route and airport colors based on theme
const routeColor = computed(() => (isDark.value ? "#60a5fa" : "#3b82f6"));
const airportFillColor = computed(() => (isDark.value ? "#f59e0b" : "#d97706"));
const airportBorderColor = computed(() => (isDark.value ? "#fbbf24" : "#92400e"));

// Process flight data into routes with proper validation
const routes = computed((): Route[] => {
  const routeMap = new Map<string, Route>();

  props.flights.forEach(flight => {
    // Validate that both origin and destination are actual airports
    if (!AIRPORT_COORDINATES[flight.origin] || !AIRPORT_COORDINATES[flight.destination]) {
      console.warn(
        `Skipping flight with invalid airport codes: ${flight.origin} -> ${flight.destination} (Flight: ${flight.flightNumber})`,
      );
      return;
    }

    const routeKey = `${flight.origin}-${flight.destination}`;
    const reverseKey = `${flight.destination}-${flight.origin}`;

    // Check if reverse route exists (to combine bidirectional routes)
    const existingRoute = routeMap.get(routeKey) || routeMap.get(reverseKey);

    if (existingRoute) {
      existingRoute.count++;
      existingRoute.flights.push(flight);
      // Recalculate thickness and opacity
      existingRoute.thickness = Math.min(Math.max(existingRoute.count, 1), 10);
      existingRoute.opacity = Math.min(0.3 + existingRoute.count * 0.1, 0.9);
    } else {
      const fromAirport = AIRPORT_COORDINATES[flight.origin];
      const toAirport = AIRPORT_COORDINATES[flight.destination];

      routeMap.set(routeKey, {
        key: routeKey,
        from: flight.origin,
        to: flight.destination,
        count: 1,
        flights: [flight],
        coordinates: [
          [fromAirport.lat, fromAirport.lng],
          [toAirport.lat, toAirport.lng],
        ],
        thickness: 1,
        opacity: 0.4,
      });
    }
  });

  return Array.from(routeMap.values());
});

// Simplified routes for performance during zoom
const simplifiedRoutes = computed((): Route[] => {
  if (isZooming.value || currentZoom.value < 3) {
    // Show fewer routes or simplified versions during zoom
    return routes.value.filter(route => route.count > 1).slice(0, 20);
  }
  return routes.value;
});

// Process airports with flight counts and sizing
const airports = computed((): Airport[] => {
  const airportMap = new Map<string, Airport>();

  props.flights.forEach(flight => {
    // Process origin airport
    if (AIRPORT_COORDINATES[flight.origin]) {
      const existing = airportMap.get(flight.origin);
      if (existing) {
        existing.flightCount++;
      } else {
        const airportData = AIRPORT_COORDINATES[flight.origin];
        airportMap.set(flight.origin, {
          ...airportData,
          flightCount: 1,
          size: 0, // Will be calculated below
        });
      }
    }

    // Process destination airport
    if (AIRPORT_COORDINATES[flight.destination]) {
      const existing = airportMap.get(flight.destination);
      if (existing) {
        existing.flightCount++;
      } else {
        const airportData = AIRPORT_COORDINATES[flight.destination];
        airportMap.set(flight.destination, {
          ...airportData,
          flightCount: 1,
          size: 0, // Will be calculated below
        });
      }
    }
  });

  // Calculate sizes based on flight counts
  return Array.from(airportMap.values()).map(airport => ({
    ...airport,
    size: Math.min(Math.max(airport.flightCount * 0.5, 3), 12),
  }));
});

// Simplified airports for performance during zoom
const simplifiedAirports = computed((): Airport[] => {
  if (isZooming.value || currentZoom.value < 3) {
    // Show fewer airports during zoom
    return airports.value.filter(airport => airport.flightCount > 2).slice(0, 15);
  }
  return airports.value;
});

// Calculate appropriate zoom levels based on data
const zoomLevels = computed(() => {
  if (airports.value.length === 0) {
    return { minZoom: 1, maxZoom: 18, initialZoom: 2 };
  }

  const lats = airports.value.map(a => a.lat);
  const lngs = airports.value.map(a => a.lng);

  const latSpread = Math.max(...lats) - Math.min(...lats);
  const lngSpread = Math.max(...lngs) - Math.min(...lngs);
  const maxSpread = Math.max(latSpread, lngSpread);

  // Calculate appropriate zoom levels based on geographic spread
  let calculatedInitialZoom: number;
  let minZoomOut: number;

  if (maxSpread > 120) {
    // Global spread
    calculatedInitialZoom = 2;
    minZoomOut = 1;
  } else if (maxSpread > 60) {
    // Continental spread
    calculatedInitialZoom = 3;
    minZoomOut = 2;
  } else if (maxSpread > 30) {
    // Regional spread
    calculatedInitialZoom = 4;
    minZoomOut = 3;
  } else if (maxSpread > 10) {
    // Country spread
    calculatedInitialZoom = 5;
    minZoomOut = 4;
  } else {
    // City/local spread
    calculatedInitialZoom = 6;
    minZoomOut = 5;
  }

  return {
    minZoom: minZoomOut,
    maxZoom: 18,
    initialZoom: calculatedInitialZoom,
  };
});
// Calculate map bounds for initial view
const mapBounds = computed((): [[number, number], [number, number]] | null => {
  if (airports.value.length === 0) return null;

  const lats = airports.value.map(a => a.lat);
  const lngs = airports.value.map(a => a.lng);

  // Add padding based on the spread to ensure nice initial view
  const latSpread = Math.max(...lats) - Math.min(...lats);
  const lngSpread = Math.max(...lngs) - Math.min(...lngs);
  const padding = Math.max(Math.min(Math.max(latSpread, lngSpread) * 0.2, 10), 2);

  return [
    [Math.min(...lats) - padding, Math.min(...lngs) - padding], // Southwest
    [Math.max(...lats) + padding, Math.max(...lngs) + padding], // Northeast
  ];
});

// Statistics
const statistics = computed(() => ({
  totalFlights: props.flights.length,
  uniqueRoutes: routes.value.length,
  airportsVisited: airports.value.length,
  countriesVisited: new Set(airports.value.map(a => a.country)).size,
}));

// --- Event Handlers ---
const handleRouteClick = (route: Route): void => {
  selectedRoute.value = route;
  showRouteDetails.value = true;
};

const closeRouteDetails = (): void => {
  showRouteDetails.value = false;
  selectedRoute.value = null;
};

const onMapReady = async (): Promise<void> => {
  isMapReady.value = true;
  await nextTick();

  if (mapBounds.value && mapRef.value?.leafletObject) {
    const map: LeafletMap = mapRef.value.leafletObject as LeafletMap;

    // Set zoom limits based on calculated values
    const { minZoom, maxZoom, initialZoom: calcInitialZoom } = zoomLevels.value;
    map.setMinZoom(minZoom);
    map.setMaxZoom(maxZoom);
    initialZoom.value = calcInitialZoom;

    // Aggressive performance optimizations
    if (map.options) {
      map.options.fadeAnimation = false;
      map.options.zoomAnimation = true;
      map.options.markerZoomAnimation = false;
      map.options.preferCanvas = true;
    }

    // Track zoom events for performance optimization
    map.on("zoomstart", () => {
      isZooming.value = true;
    });

    map.on("zoomend", () => {
      currentZoom.value = map.getZoom();
      // Debounce zoom end to prevent rapid updates
      setTimeout(() => {
        isZooming.value = false;
      }, 150);
    });

    map.on("zoom", () => {
      currentZoom.value = map.getZoom();
    });

    // Fit bounds to show all data with calculated zoom level
    const bounds = mapBounds.value;
    map.fitBounds(bounds, {
      padding: [20, 20],
      animate: false,
      maxZoom: calcInitialZoom,
    });

    // Store the initial zoom level after fitting bounds
    setTimeout(() => {
      const fittedZoom = map.getZoom();
      // Set minimum zoom to prevent zooming out beyond this initial view
      map.setMinZoom(Math.max(minZoom, fittedZoom - 1));
      currentZoom.value = fittedZoom;
      initialZoom.value = fittedZoom;
    }, 100);
  }
};

// --- Utility Functions ---
const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString();
};

const formatTime = (timeString: string): string => {
  return timeString.substring(0, 5); // Extract HH:MM from HH:MM:SS
};

// --- Watchers ---
watch(isDark, async (): Promise<void> => {
  // Debounce theme changes to prevent performance issues
  await nextTick();
});

// --- Lifecycle ---
onMounted((): void => {
  // Additional performance optimizations can be added here if needed
  // Leaflet canvas optimization is handled through map options
});
</script>

<template>
  <div class="flight-map-container" :style="{ height: props.height }">
    <!-- Map -->
    <LMap
      ref="mapRef"
      :zoom="zoomLevels.initialZoom"
      :center="[20, 0]"
      :options="{
        zoomControl: false,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true,
        dragging: true,
        touchZoom: true,
        // Zoom restrictions will be set dynamically in onMapReady
        minZoom: zoomLevels.minZoom,
        maxZoom: zoomLevels.maxZoom,
        // Aggressive performance optimizations
        preferCanvas: true,
        zoomAnimation: true,
        fadeAnimation: false,
        markerZoomAnimation: false,
        // Reduce rendering overhead significantly
        updateWhenZooming: false,
        updateWhenIdle: true,
        // Optimized zoom settings for smoothness
        zoomAnimationThreshold: 2,
        wheelDebounceTime: 40,
        wheelPxPerZoomLevel: 80,
        // Disable expensive features during interaction
        bounceAtZoomLimits: false,
        worldCopyJump: false,
      }"
      :class="[
        'map-instance w-full h-full rounded-lg border',
        isDark ? 'border-gray-700' : 'border-gray-200',
      ]"
      @ready="onMapReady"
    >
      <!-- Tile Layer -->
      <LTileLayer
        :url="tileUrl"
        :attribution="tileAttribution"
        :options="{
          maxZoom: 19,
          // Aggressive tile optimizations
          updateWhenZooming: false,
          updateWhenIdle: true,
          keepBuffer: 1,
          maxNativeZoom: 16,
          // Reduce tile loading during zoom
          reuseTiles: true,
        }"
      />

      <!-- Zoom Control -->
      <LControlZoom position="topright" />

      <!-- Flight Routes with level-of-detail optimization -->
      <template v-if="isMapReady && !isZooming">
        <LPolyline
          v-for="route in simplifiedRoutes"
          :key="route.key"
          :lat-lngs="route.coordinates"
          :color="routeColor"
          :weight="route.thickness"
          :opacity="route.opacity"
          :options="{
            className: 'flight-route',
            // Aggressive performance optimizations
            smoothFactor: currentZoom < 5 ? 3.0 : 1.0,
            noClip: true,
            interactive: !isZooming,
            bubblingMouseEvents: false,
            // Reduce path complexity at low zoom
            simplifyThreshold: currentZoom < 4 ? 5 : 1,
          }"
          @click="() => handleRouteClick(route)"
        />
      </template>

      <!-- Airports with level-of-detail optimization -->
      <template v-if="isMapReady && !isZooming">
        <LCircleMarker
          v-for="airport in simplifiedAirports"
          :key="airport.code"
          :lat-lng="[airport.lat, airport.lng]"
          :radius="airport.size"
          :color="airportBorderColor"
          :fill-color="airportFillColor"
          :weight="currentZoom < 4 ? 1 : 2"
          :opacity="1"
          :fill-opacity="0.8"
          :options="{
            className: 'airport-marker',
            interactive: !isZooming,
            bubblingMouseEvents: false,
            pane: 'markerPane',
          }"
        >
          <LPopup
            v-if="currentZoom > 3"
            :options="{
              className: 'custom-popup',
              closeButton: true,
              autoClose: true,
              closeOnEscapeKey: true,
              keepInView: true,
              autoPan: false,
            }"
          >
            <div class="popup-content" :class="isDark ? 'text-gray-100' : 'text-gray-800'">
              <h3 class="font-bold text-sm mb-2">{{ airport.code }}</h3>
              <p class="text-xs mb-1">{{ airport.name }}</p>
              <p class="text-xs mb-1">{{ airport.city }}, {{ airport.country }}</p>
              <p class="text-xs opacity-75">{{ airport.flightCount }} flights</p>
            </div>
          </LPopup>
        </LCircleMarker>
      </template>
    </LMap>

    <!-- Statistics Panel -->
    <div
      class="stats-panel"
      :class="[
        'border',
        isDark
          ? 'bg-gray-800/90 text-gray-100 border-gray-700'
          : 'bg-white/90 text-gray-800 border-gray-200',
      ]"
    >
      <h3 class="text-lg font-semibold mb-2">✈️ Flight Statistics</h3>
      <div class="space-y-1 text-sm">
        <p><strong>Total Flights:</strong> {{ statistics.totalFlights }}</p>
        <p><strong>Unique Routes:</strong> {{ statistics.uniqueRoutes }}</p>
        <p><strong>Airports Visited:</strong> {{ statistics.airportsVisited }}</p>
        <p><strong>Countries:</strong> {{ statistics.countriesVisited }}</p>
      </div>
    </div>

    <!-- Legend -->
    <div
      class="legend-panel"
      :class="[
        'border',
        isDark
          ? 'bg-gray-800/90 text-gray-100 border-gray-700'
          : 'bg-white/90 text-gray-800 border-gray-200',
      ]"
    >
      <h4 class="text-sm font-semibold mb-2">Legend</h4>
      <div class="space-y-1 text-xs">
        <div class="flex items-center gap-2">
          <div class="w-3 h-0.5 opacity-60" :class="isDark ? 'bg-blue-400' : 'bg-blue-500'"></div>
          <span>Flight Routes</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 rounded-full" :class="isDark ? 'bg-amber-400' : 'bg-amber-600'"></div>
          <span>Airports</span>
        </div>
        <p class="text-xs opacity-75 mt-1">Thicker lines = more frequent routes</p>
      </div>
    </div>

    <!-- Route Details Modal -->
    <div
      v-if="showRouteDetails && selectedRoute"
      class="modal-overlay fixed inset-0 z-50 bg-black/50 flex items-center justify-center backdrop-blur-sm"
      @click="closeRouteDetails"
    >
      <div
        class="modal-content p-6 rounded-lg shadow-xl max-w-md w-full mx-4 max-h-96 overflow-y-auto"
        :class="[
          'border',
          isDark
            ? 'bg-gray-800 text-gray-100 border-gray-700'
            : 'bg-white text-gray-800 border-gray-200',
        ]"
        @click.stop
      >
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-semibold">{{ selectedRoute.from }} → {{ selectedRoute.to }}</h3>
          <button
            class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            @click="closeRouteDetails"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div class="mb-4">
          <p class="text-sm mb-2">
            <strong>{{ selectedRoute.count }}</strong> flights on this route
          </p>
          <div class="text-xs space-y-1">
            <p><strong>From:</strong> {{ AIRPORT_COORDINATES[selectedRoute.from]?.name }}</p>
            <p><strong>To:</strong> {{ AIRPORT_COORDINATES[selectedRoute.to]?.name }}</p>
          </div>
        </div>

        <div class="space-y-2">
          <h4 class="text-sm font-medium">Flight History:</h4>
          <div class="space-y-1 max-h-48 overflow-y-auto">
            <div
              v-for="(flight, index) in selectedRoute.flights.slice(0, 10)"
              :key="index"
              class="text-xs p-2 rounded transition-colors"
              :class="isDark ? 'bg-gray-700' : 'bg-gray-50'"
            >
              <div class="flex justify-between items-center">
                <span class="font-medium">{{ flight.flightNumber }}</span>
                <span>{{ formatDate(flight.date) }}</span>
              </div>
              <div class="flex justify-between text-xs opacity-75">
                <span>{{ formatTime(flight.time) }}</span>
                <span>{{ flight.airline }}</span>
              </div>
            </div>
            <div
              v-if="selectedRoute.flights.length > 10"
              class="text-xs text-center opacity-75 py-2"
            >
              ... and {{ selectedRoute.flights.length - 10 }} more flights
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.flight-map-container {
  position: relative;
  width: 100%;
  min-height: 400px;
  border-radius: 0.5rem;
  overflow: hidden;
}

.map-instance {
  height: 100%;
  z-index: 1;
}

.stats-panel {
  position: absolute;
  bottom: 1rem;
  left: 1rem;
  padding: 1rem;
  border-radius: 0.5rem;
  box-shadow:
    0 10px 15px -3px rgb(0 0 0 / 0.1),
    0 4px 6px -4px rgb(0 0 0 / 0.1);
  max-width: 18rem;
  backdrop-filter: blur(4px);
  z-index: 1000;
}

.legend-panel {
  position: absolute;
  bottom: 2.5rem;
  right: 1rem;
  padding: 0.75rem;
  border-radius: 0.5rem;
  box-shadow:
    0 10px 15px -3px rgb(0 0 0 / 0.1),
    0 4px 6px -4px rgb(0 0 0 / 0.1);
  backdrop-filter: blur(4px);
  z-index: 1000;
}

.modal-content {
  z-index: 1001;
}

/* Optimized Leaflet Styles for Performance */
:deep(.custom-popup .leaflet-popup-content-wrapper) {
  background: var(--vp-c-bg) !important;
  border-color: var(--vp-c-border) !important;
}

:deep(.custom-popup .leaflet-popup-tip) {
  background: var(--vp-c-bg) !important;
  border-color: var(--vp-c-border) !important;
}

/* Smooth route interactions without performance overhead */
:deep(.flight-route) {
  cursor: pointer;
  /* Remove expensive transforms and use simpler hover effects */
  transition: opacity 0.15s ease-out;
}

:deep(.flight-route:hover) {
  opacity: 1 !important;
  /* Remove transform and filter for better performance */
}

/* Stable airport markers without jitter */
:deep(.airport-marker) {
  cursor: pointer;
  /* Prevent transform-based animations that cause jitter */
  transition: none;
  /* Ensure stable positioning */
  pointer-events: auto;
}

:deep(.airport-marker:hover) {
  /* Use only opacity changes to avoid jitter */
  opacity: 0.9;
}

/* Optimized Leaflet controls */
:deep(.leaflet-control-zoom) {
  border: none !important;
  box-shadow:
    0 4px 6px -1px rgb(0 0 0 / 0.1),
    0 2px 4px -2px rgb(0 0 0 / 0.1) !important;
}

:deep(.leaflet-control-zoom a) {
  background: var(--vp-c-bg) !important;
  border-color: var(--vp-c-border) !important;
  transition: background-color 0.15s ease;
}

:deep(.leaflet-control-zoom a:hover) {
  background: var(--vp-c-bg-soft) !important;
}

/* High-performance Leaflet optimizations */
:deep(.leaflet-zoom-animated) {
  /* Use GPU acceleration with 3D transforms */
  transform: translate3d(0, 0, 0);
  backface-visibility: hidden;
  perspective: 1000px;
}

/* Optimized route rendering */
:deep(.flight-route) {
  cursor: pointer;
  /* Use will-change for better GPU optimization */
  will-change: opacity;
  transition: opacity 0.1s ease-out;
  /* Force hardware acceleration */
  transform: translate3d(0, 0, 0);
}

:deep(.flight-route:hover) {
  opacity: 1 !important;
}

/* High-performance airport markers */
:deep(.airport-marker) {
  cursor: pointer;
  /* GPU acceleration for markers */
  will-change: opacity;
  transform: translate3d(0, 0, 0);
  backface-visibility: hidden;
}

:deep(.airport-marker:hover) {
  opacity: 0.9;
}

/* Optimized marker pane for smooth zooming */
:deep(.leaflet-marker-pane) {
  transform: translate3d(0, 0, 0);
  will-change: transform;
  backface-visibility: hidden;
}

/* Smooth overlay pane */
:deep(.leaflet-overlay-pane) {
  transform: translate3d(0, 0, 0);
  will-change: transform;
}

/* Optimize vector rendering */
:deep(.leaflet-overlay-pane svg) {
  /* Enable hardware acceleration for SVG */
  transform: translate3d(0, 0, 0);
  will-change: transform;
}

/* Prevent sub-pixel rendering issues */
:deep(.leaflet-container) {
  transform: translate3d(0, 0, 0);
  image-rendering: optimizeSpeed;
  image-rendering: -webkit-optimize-contrast;
}

:deep(.leaflet-popup-pane) {
  /* Stable popup positioning */
  pointer-events: none;
}

:deep(.leaflet-popup) {
  pointer-events: auto;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .flight-map-container {
    min-height: 350px;
  }

  .stats-panel {
    position: static;
    margin: 1rem 0;
    max-width: none;
  }

  .legend-panel {
    position: static;
    margin: 1rem 0;
    max-width: none;
  }
}

/* Full viewport option */
.flight-map-container.full-viewport {
  height: 100vh !important;
  min-height: 100vh;
}
</style>
