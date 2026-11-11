'use client';

import * as React from 'react';
import Link from 'next/link';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPinOff,
  ExternalLink,
  ShieldAlert,
  Tag,
  Calendar,
  MapPin,
  Flame,
  Layers,
} from 'lucide-react';
import { getStaffComplaintText } from '@/lib/complaint-language';
import { useStaffComplaintLanguage } from '@/lib/use-staff-language';
import { OriginalLanguageBadge } from '@/components/ui/original-language-badge';
import { extractHeatPoints, type HeatPoint } from '@/lib/gis-heatmap';

export type MapViewMode = 'markers' | 'heatmap' | 'both';

export interface ComplaintMapItem {
  id: string;
  ticketId: string;
  title: string;
  description?: string;
  language?: string | null;
  titleEn?: string | null;
  descriptionEn?: string | null;
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
  initialViewMode?: MapViewMode;
  showLayerToggle?: boolean;
}

const HEATMAP_GRADIENT_STOPS: ReadonlyArray<{ stop: number; rgb: [number, number, number] }> = [
  { stop: 0.0, rgb: [52, 104, 161] }, // #3468A1 civic blue
  { stop: 0.35, rgb: [59, 143, 104] }, // #3B8F68 civic emerald
  { stop: 0.65, rgb: [217, 142, 43] }, // #D98E2B civic amber
  { stop: 1.0, rgb: [220, 38, 38] }, // #DC2626 critical red
];

function buildHeatmapPalette(): Uint8ClampedArray {
  const palette = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let lower = HEATMAP_GRADIENT_STOPS[0];
    let upper = HEATMAP_GRADIENT_STOPS[HEATMAP_GRADIENT_STOPS.length - 1];
    for (let s = 0; s < HEATMAP_GRADIENT_STOPS.length - 1; s++) {
      if (t >= HEATMAP_GRADIENT_STOPS[s].stop && t <= HEATMAP_GRADIENT_STOPS[s + 1].stop) {
        lower = HEATMAP_GRADIENT_STOPS[s];
        upper = HEATMAP_GRADIENT_STOPS[s + 1];
        break;
      }
    }
    const span = Math.max(0.0001, upper.stop - lower.stop);
    const localT = (t - lower.stop) / span;
    const base = i * 4;
    palette[base] = Math.round(lower.rgb[0] + (upper.rgb[0] - lower.rgb[0]) * localT);
    palette[base + 1] = Math.round(lower.rgb[1] + (upper.rgb[1] - lower.rgb[1]) * localT);
    palette[base + 2] = Math.round(lower.rgb[2] + (upper.rgb[2] - lower.rgb[2]) * localT);
    palette[base + 3] = i === 0 ? 0 : Math.min(215, Math.round(55 + t * 175));
  }
  return palette;
}

const HEATMAP_PALETTE = buildHeatmapPalette();

function LeafletCanvasHeatmapLayer({ points }: { points: HeatPoint[] }) {
  const map = useMap();

  React.useEffect(() => {
    const pane = map.getPanes().overlayPane;
    if (!pane) return;

    const canvas = L.DomUtil.create('canvas', 'leaflet-heatmap-layer') as HTMLCanvasElement;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none';
    pane.appendChild(canvas);

    const draw = () => {
      const size = map.getSize();
      if (size.x <= 0 || size.y <= 0) return;

      canvas.width = size.x;
      canvas.height = size.y;

      const topLeft = map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(canvas, topLeft);

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.clearRect(0, 0, size.x, size.y);

      if (points.length === 0) return;

      const zoom = map.getZoom();
      const radius = Math.max(18, Math.min(44, Math.round(14 + zoom * 1.8)));

      for (const pt of points) {
        const containerPt = map.latLngToContainerPoint([pt.lat, pt.lng]);
        if (
          containerPt.x < -radius ||
          containerPt.y < -radius ||
          containerPt.x > size.x + radius ||
          containerPt.y > size.y + radius
        ) {
          continue;
        }

        const alpha = Math.min(0.85, 0.22 + pt.weight * 0.24);
        const grad = ctx.createRadialGradient(
          containerPt.x,
          containerPt.y,
          0,
          containerPt.x,
          containerPt.y,
          radius,
        );
        grad.addColorStop(0, `rgba(0, 0, 0, ${alpha.toFixed(3)})`);
        grad.addColorStop(0.55, `rgba(0, 0, 0, ${(alpha * 0.45).toFixed(3)})`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(containerPt.x, containerPt.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      const image = ctx.getImageData(0, 0, size.x, size.y);
      const data = image.data;
      for (let idx = 0; idx < data.length; idx += 4) {
        const density = data[idx + 3];
        if (density > 0) {
          const pIdx = density * 4;
          data[idx] = HEATMAP_PALETTE[pIdx];
          data[idx + 1] = HEATMAP_PALETTE[pIdx + 1];
          data[idx + 2] = HEATMAP_PALETTE[pIdx + 2];
          data[idx + 3] = HEATMAP_PALETTE[pIdx + 3];
        }
      }
      ctx.putImageData(image, 0, 0);
    };

    draw();
    map.on('moveend zoomend viewreset resize', draw);

    return () => {
      map.off('moveend zoomend viewreset resize', draw);
      if (canvas.parentNode === pane) {
        pane.removeChild(canvas);
      }
    };
  }, [map, points]);

  return null;
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
  initialViewMode = 'markers',
  showLayerToggle = false,
}: ComplaintsMapInnerProps) {
  const staffLanguage = useStaffComplaintLanguage();
  const [viewMode, setViewMode] = React.useState<MapViewMode>(initialViewMode);

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

  const heatPoints = React.useMemo(() => extractHeatPoints(validMapItems), [validMapItems]);

  const markerCoords: [number, number][] = React.useMemo(() => {
    return validMapItems.map((c) => [c.location!.latitude, c.location!.longitude]);
  }, [validMapItems]);

  const showHeatmap = viewMode === 'heatmap' || viewMode === 'both';
  const showMarkers = viewMode === 'markers' || viewMode === 'both';

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
    <div className={`${className} relative z-0 overflow-hidden rounded-xl min-w-0`}>
      {showLayerToggle && (
        <div
          role="group"
          aria-label="Map layer mode"
          className="absolute top-3 right-3 z-[400] inline-flex items-center rounded-lg border border-[#E5E2D9] bg-[#F2EFE6]/95 p-0.5 shadow-sm backdrop-blur-sm"
        >
          {(
            [
              { id: 'markers', label: 'Pins', icon: MapPin },
              { id: 'heatmap', label: 'Heatmap', icon: Flame },
              { id: 'both', label: 'Both', icon: Layers },
            ] as const
          ).map((mode) => {
            const Icon = mode.icon;
            const active = viewMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                aria-pressed={active}
                onClick={() => setViewMode(mode.id)}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3468A1] ${
                  active
                    ? 'bg-[#3468A1] text-white shadow-xs'
                    : 'text-[#131E20] hover:bg-white/80'
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {showHeatmap && (
        <div className="absolute bottom-3 left-3 z-[400] rounded-lg border border-[#E5E2D9] bg-[#F2EFE6]/95 px-2.5 py-1.5 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-2 text-[11px] font-medium text-[#131E20]">
            <span>Low</span>
            <div
              className="h-2 w-24 rounded-full"
              style={{
                background: 'linear-gradient(to right, #3468A1, #3B8F68, #D98E2B, #DC2626)',
              }}
              aria-hidden="true"
            />
            <span>Hotspot</span>
          </div>
        </div>
      )}

      <MapContainer
        center={initialCenter}
        zoom={defaultZoom}
        scrollWheelZoom={true}
        className="h-full w-full overflow-hidden rounded-xl"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapBoundsAdjuster markers={markerCoords} />

        {showHeatmap && <LeafletCanvasHeatmapLayer points={heatPoints} />}

        {showMarkers &&
          validMapItems.map((complaint) => {
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

                  <h5 className="font-semibold text-slate-900 text-sm leading-snug mb-2 line-clamp-2 flex items-center gap-1.5">
                    <span>{getStaffComplaintText(complaint, staffLanguage).displayTitle}</span>
                    {getStaffComplaintText(complaint, staffLanguage).isTitleFallback && <OriginalLanguageBadge />}
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
