import { test, expect } from '@playwright/test';
import {
  computeHeatmapClusters,
  extractHeatPoints,
  getHeatmapIntensityColor,
  gisHeatmapQuerySchema,
  isValidGisCoordinate,
  type GisComplaintInput,
} from '@/lib/gis-heatmap';

test.describe('GIS Heatmap Coordinate Aggregation & Density Clustering', () => {
  test('isValidGisCoordinate and extractHeatPoints exclude invalid, NaN, and (0,0) coordinates', () => {
    expect(isValidGisCoordinate(11.0168, 76.9558)).toBe(true);
    expect(isValidGisCoordinate(0, 0)).toBe(false);
    expect(isValidGisCoordinate(95, 77)).toBe(false);
    expect(isValidGisCoordinate(12, 200)).toBe(false);
    expect(isValidGisCoordinate(NaN, 77)).toBe(false);

    const complaints: GisComplaintInput[] = [
      {
        id: 'c_ok_crit',
        priority: 'CRITICAL',
        location: { latitude: 11.0168, longitude: 76.9558 },
      },
      {
        id: 'c_zero',
        priority: 'HIGH',
        location: { latitude: 0, longitude: 0 },
      },
      {
        id: 'c_null',
        priority: 'LOW',
        location: null,
      },
      {
        id: 'c_ok_low',
        priority: 'LOW',
        location: { latitude: 11.03, longitude: 76.97 },
      },
    ];

    const points = extractHeatPoints(complaints);
    expect(points).toHaveLength(2);
    expect(points[0].id).toBe('c_ok_crit');
    expect(points[0].weight).toBe(2.0);
    expect(points[1].id).toBe('c_ok_low');
    expect(points[1].weight).toBe(0.7);
  });

  test('computeHeatmapClusters groups proximate complaints and normalizes intensities', () => {
    const points = extractHeatPoints([
      { id: 'p1', priority: 'CRITICAL', location: { latitude: 11.016, longitude: 76.956 } },
      { id: 'p2', priority: 'HIGH', location: { latitude: 11.017, longitude: 76.957 } },
      { id: 'p3', priority: 'LOW', location: { latitude: 11.15, longitude: 77.1 } },
    ]);

    const clusters = computeHeatmapClusters(points, 0.005);
    expect(clusters).toHaveLength(2);
    expect(clusters[0].count).toBe(2);
    expect(clusters[0].totalWeight).toBe(3.5);
    expect(clusters[0].intensity).toBe(1);
    expect(clusters[0].criticalOrHighCount).toBe(2);
    expect(clusters[0].color).toBe('#DC2626');

    expect(clusters[1].count).toBe(1);
    expect(clusters[1].totalWeight).toBe(0.7);
    expect(clusters[1].intensity).toBe(0.2);
    expect(clusters[1].color).toBe('#3468A1');

    expect(getHeatmapIntensityColor(0.8)).toBe('#DC2626');
    expect(getHeatmapIntensityColor(0.55)).toBe('#D98E2B');
    expect(getHeatmapIntensityColor(0.3)).toBe('#3B8F68');
    expect(getHeatmapIntensityColor(0.1)).toBe('#3468A1');
  });

  test('gisHeatmapQuerySchema coerces cellSizeDeg and rejects out-of-range or invalid enums', () => {
    const valid = gisHeatmapQuerySchema.safeParse({
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      cellSizeDeg: '0.01',
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.cellSizeDeg).toBe(0.01);
    }

    expect(
      gisHeatmapQuerySchema.safeParse({ cellSizeDeg: '5' }).success,
    ).toBe(false);
    expect(
      gisHeatmapQuerySchema.safeParse({ status: 'INVALID_STATUS' }).success,
    ).toBe(false);
  });
});

