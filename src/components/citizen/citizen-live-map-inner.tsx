'use client';

import * as React from 'react';
import Link from 'next/link';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ExternalLink, MapPinOff } from 'lucide-react';
import type { CitizenStatusPin } from '@/services/live-status-map-service';

interface CitizenLiveMapInnerProps {
  pins: CitizenStatusPin[];
  className?: string;
  defaultCenter?: [number, number];
  defaultZoom?: number;
}

export function getStatusPinColor(status: string): string {
  switch (status.toUpperCase()) {
    case 'RESOLVED':
    case 'CLOSED':
      return '#15803d'; // emerald-700
    case 'IN_PROGRESS':
      return '#4f46e5'; // indigo-600
    case 'ASSIGNED':
      return '#2563eb'; // blue-600
    case 'REJECTED':
    case 'DUPLICATE':
      return '#64748b'; // slate-500
    case 'PENDING_DEPT_REVIEW':
    case 'AI_PROCESSING':
    case 'SUBMITTED':
    default:
      return '#d97706'; // amber-600
  }
}

function createStatusMarkerIcon(status: string) {
  const bg = getStatusPinColor(status);
  const html = `
    <div style="
      position: relative;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: translate(-50%, -100%);
    ">
      <div style="
        width: 26px;
        height: 26px;
        border-radius: 50% 50% 50% 0;
        background: ${bg};
        border: 2px solid #ffffff;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.28);
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #ffffff;
          transform: rotate(45deg);
        "></div>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'citizen-status-leaflet-marker',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  });
}

function MapBoundsController({ coords }: { coords: [number, number][] }) {
  const map = useMap();

  React.useEffect(() => {
    if (coords.length === 0) return;
    if (coords.length === 1) {
      map.setView(coords[0], 14, { animate: true });
    } else {
      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15, animate: true });
    }
  }, [map, coords]);

  return null;
}

export default function CitizenLiveMapInner({
  pins,
  className = 'h-[340px] sm:h-[420px] lg:h-[460px] w-full rounded-xl overflow-hidden border border-[#E5E2D9]',
  defaultCenter = [12.9716, 77.5946],
  defaultZoom = 12,
}: CitizenLiveMapInnerProps) {
  const coords = React.useMemo<[number, number][]>(
    () => pins.map((pin) => [pin.lat, pin.lng]),
    [pins],
  );

  if (pins.length === 0) {
    return (
      <div
        className={`${className} bg-[#F8F6F1] flex flex-col items-center justify-center p-6 text-center`}
      >
        <div className="w-12 h-12 rounded-full bg-white border border-[#E5E2D9] flex items-center justify-center text-[#6E6B64] mb-3">
          <MapPinOff className="w-6 h-6" aria-hidden="true" />
        </div>
        <p className="text-sm font-bold text-[#131E20]">No geotagged complaints to pin</p>
        <p className="text-xs text-[#6E6B64] max-w-sm mt-1">
          Only your own complaints with GPS coordinates appear on the map. Area-wide counts remain visible below.
        </p>
      </div>
    );
  }

  return (
    <div className={`${className} relative z-0`}>
      <MapContainer
        center={coords[0] || defaultCenter}
        zoom={defaultZoom}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapBoundsController coords={coords} />
        {pins.map((pin) => (
          <Marker
            key={pin.id}
            position={[pin.lat, pin.lng]}
            icon={createStatusMarkerIcon(pin.status)}
          >
            <Popup>
              <div className="p-1 min-w-[190px] text-[#131E20]">
                <div className="font-mono text-xs font-bold text-[#3468A1] mb-1">
                  {pin.ticketId}
                </div>
                <div className="text-xs text-[#6E6B64] mb-1">
                  Status: <strong className="text-[#131E20]">{pin.status.replace(/_/g, ' ')}</strong>
                </div>
                <div className="text-xs text-[#6E6B64] mb-2">
                  Priority: <strong className="text-[#131E20]">{pin.priority}</strong>
                </div>
                <Link
                  href={`/citizen/complaints/${pin.id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#3468A1] hover:underline"
                >
                  <span>View complaint</span>
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
