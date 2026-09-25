'use client';

import * as React from 'react';
import Link from 'next/link';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPinOff, ExternalLink, ShieldAlert, Tag, Calendar, MapPin } from 'lucide-react';

export interface ComplaintMapItem {
  id: string;
  ticketId: string;
  title: string;
  category?: { name: string } | null;
  priority?: string | null;
  status: string;
  createdAt?: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string | null;
  } | null;
}

interface ComplaintsMapInnerProps {
  complaints: ComplaintMapItem[];
  detailRoutePrefix?: string;
  className?: string;
  defaultCenter?: [number, number];
  defaultZoom?: number;
}

// Helper component to adjust bounds to fit all visible markers
function MapBoundsAdjuster({ markers }: { markers: [number, number][] }) {
  const map = useMap();

  React.useEffect(() => {
    if (markers.length === 0) return;

    if (markers.length === 1) {
      map.setView(markers[0], 14, { animate: true });
    } else {
      const bounds = L.latLngBounds(markers);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15, animate: true });
    }
  }, [map, markers]);

  return null;
}

// Priority color resolver
function getPriorityColor(priority?: string | null): { bg: string; border: string; ring: string } {
  switch (priority?.toUpperCase()) {
    case 'CRITICAL':
      return { bg: '#dc2626', border: '#991b1b', ring: '#fca5a5' }; // Red
    case 'HIGH':
      return { bg: '#ea580c', border: '#9a3412', ring: '#fdba74' }; // Amber/Orange
    case 'MEDIUM':
      return { bg: '#d97706', border: '#854d0e', ring: '#fde047' }; // Yellow/Gold
    case 'LOW':
    default:
      return { bg: '#2563eb', border: '#1e40af', ring: '#93c5fd' }; // Blue
  }
}

// Create custom SVG DivIcon per priority level to avoid broken marker image assets
function createPriorityMarkerIcon(priority?: string | null) {
  const colors = getPriorityColor(priority);
  const html = `
    <div style="
      position: relative;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: translate(-50%, -100%);
    ">
      <div style="
        width: 28px;
        height: 28px;
        border-radius: 50% 50% 50% 0;
        background: ${colors.bg};
        border: 2px solid #ffffff;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2);
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #ffffff;
          transform: rotate(45deg);
        "></div>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-leaflet-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
}

export default function ComplaintsMapInner({
  complaints,
  detailRoutePrefix = '/officer/complaints',
  className = 'h-[500px] w-full rounded-xl overflow-hidden shadow-sm border border-slate-200',
  defaultCenter = [12.9716, 77.5946], // Default: Bengaluru City
  defaultZoom = 12,
}: ComplaintsMapInnerProps) {
  // Filter valid geographic coordinates (non-zero lat/lng)
  const validMapItems = React.useMemo(() => {
    return complaints.filter((c) => {
      const lat = c.location?.latitude;
      const lng = c.location?.longitude;
      return (
        typeof lat === 'number' &&
        typeof lng === 'number' &&
        !isNaN(lat) &&
        !isNaN(lng) &&
        (lat !== 0 || lng !== 0)
      );
    });
  }, [complaints]);

  const markerCoords: [number, number][] = React.useMemo(() => {
    return validMapItems.map((c) => [c.location!.latitude, c.location!.longitude]);
  }, [validMapItems]);

  if (validMapItems.length === 0) {
    return (
      <div className={`${className} bg-slate-50 flex flex-col items-center justify-center p-8 text-center border-dashed`}>
        <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3 shadow-inner">
          <MapPinOff className="w-7 h-7" />
        </div>
        <h4 className="font-semibold text-slate-800 text-base">No Geographic Location Data Available</h4>
        <p className="text-sm text-slate-500 max-w-md mt-1">
          None of the {complaints.length} currently listed complaints contain valid GPS coordinates (latitude & longitude).
        </p>
        <div className="mt-4 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-1.5">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Location coordinates are auto-captured when citizens submit complaints via GPS/landmark picker.</span>
        </div>
      </div>
    );
  }

  const initialCenter = markerCoords[0] || defaultCenter;

  return (
    <div className={`${className} relative z-0`}>
      <MapContainer
        center={initialCenter}
        zoom={defaultZoom}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapBoundsAdjuster markers={markerCoords} />

        {validMapItems.map((complaint) => {
          const lat = complaint.location!.latitude;
          const lng = complaint.location!.longitude;
          const icon = createPriorityMarkerIcon(complaint.priority);

          return (
            <Marker key={complaint.id} position={[lat, lng]} icon={icon}>
              <Popup className="custom-leaflet-popup">
                <div className="p-1 max-w-[260px] text-slate-800">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-2">
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 font-mono">
                      {complaint.ticketId}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        complaint.priority === 'CRITICAL'
                          ? 'bg-rose-100 text-rose-800'
                          : complaint.priority === 'HIGH'
                          ? 'bg-amber-100 text-amber-800'
                          : complaint.priority === 'MEDIUM'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {complaint.priority || 'MEDIUM'}
                    </span>
                  </div>

                  <h5 className="font-semibold text-slate-900 text-sm leading-snug mb-2 line-clamp-2">
                    {complaint.title}
                  </h5>

                  <div className="space-y-1.5 text-xs text-slate-600 mb-3">
                    {complaint.category && (
                      <div className="flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{complaint.category.name}</span>
                      </div>
                    )}
                    {complaint.location?.address && (
                      <div className="flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{complaint.location.address}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-500 capitalize">
                      Status: <strong className="text-slate-700">{complaint.status.replace(/_/g, ' ')}</strong>
                    </span>
                    <Link
                      href={`${detailRoutePrefix}/${complaint.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      <span>View</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
