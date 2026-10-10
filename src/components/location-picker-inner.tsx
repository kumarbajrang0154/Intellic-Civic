'use client';

import * as React from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface LocationPickerInnerProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
  className?: string;
  defaultCenter?: [number, number];
  defaultZoom?: number;
}

// Marker icon using styled DivIcon
function createPickerMarkerIcon() {
  const html = `
    <div style="
      position: relative;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: translate(-50%, -100%);
    ">
      <div style="
        width: 32px;
        height: 32px;
        border-radius: 50% 50% 50% 0;
        background: #2563eb;
        border: 2px solid #ffffff;
        box-shadow: 0 4px 8px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.2);
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #ffffff;
          transform: rotate(45deg);
        "></div>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-location-picker-marker',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
  });
}

function MapClickHandler({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapCenterController({ center }: { center: [number, number] }) {
  const map = useMap();
  React.useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [map, center]);
  return null;
}

import { WifiOff, MapPin } from 'lucide-react';

export default function LocationPickerInner({
  latitude,
  longitude,
  onChange,
  className = 'h-[260px] w-full rounded-xl overflow-hidden shadow-sm border border-slate-200',
  defaultCenter = [12.9716, 77.5946], // Bengaluru
  defaultZoom = 13,
}: LocationPickerInnerProps) {
  const [isOnline, setIsOnline] = React.useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const hasCoordinates =
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    (latitude !== 0 || longitude !== 0);

  const currentCenter: [number, number] = hasCoordinates
    ? [latitude, longitude]
    : defaultCenter;

  const icon = React.useMemo(() => createPickerMarkerIcon(), []);

  const markerRef = React.useRef<L.Marker | null>(null);

  const eventHandlers = React.useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const latLng = marker.getLatLng();
          onChange(latLng.lat, latLng.lng);
        }
      },
    }),
    [onChange],
  );

  if (!isOnline) {
    return (
      <div className={`${className} bg-slate-900 text-slate-100 p-4 flex flex-col justify-center items-center rounded-xl border border-slate-700 select-none`}>
        <div className="flex items-center gap-2 mb-1.5 text-amber-400">
          <WifiOff className="w-5 h-5" />
          <span className="font-semibold text-sm">Offline Mode: Map Tiles Skipped</span>
        </div>
        <p className="text-xs text-slate-400 text-center max-w-sm mb-3">
          Map tiles are skipped while offline. Your GPS coordinates will still be saved with your complaint.
        </p>
        {hasCoordinates ? (
          <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 rounded-lg px-3.5 py-2 font-mono text-xs text-emerald-400">
            <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Captured Coordinates: {latitude!.toFixed(5)}, {longitude!.toFixed(5)}</span>
          </div>
        ) : (
          <div className="text-xs text-slate-500 italic">No GPS coordinates captured yet. Click &ldquo;Use My Location&rdquo; above.</div>
        )}
      </div>
    );
  }

  return (
    <div className={`${className} relative z-0 overflow-hidden rounded-xl min-w-0`}>
      <MapContainer
        center={currentCenter}
        zoom={defaultZoom}
        scrollWheelZoom={false}
        className="h-full w-full cursor-crosshair overflow-hidden rounded-xl"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapClickHandler onSelect={onChange} />
        <MapCenterController center={currentCenter} />

        {hasCoordinates && (
          <Marker
            position={[latitude, longitude]}
            icon={icon}
            draggable={true}
            eventHandlers={eventHandlers}
            ref={markerRef}
          />
        )}
      </MapContainer>

      {/* Floating help instruction badge */}
      <div className="absolute bottom-2 left-2 right-2 bg-slate-900/80 backdrop-blur-sm text-white text-[11px] px-3 py-1.5 rounded-lg z-[1000] pointer-events-none flex items-center justify-between">
        <span>Click anywhere on the map or drag the pin to set incident location</span>
        {hasCoordinates && (
          <span className="font-mono text-[10px] text-blue-300">
            {latitude.toFixed(5)}, {longitude.toFixed(5)}
          </span>
        )}
      </div>
    </div>
  );
}
