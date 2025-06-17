// src/utils/geoHelpers.ts

import * as d3 from 'd3';
import * as turf from '@turf/turf';
import { Feature, MultiPolygon, Point, Polygon } from 'geojson';
import { ProcessedEdge, ThematicPoint } from 'streetweave';


/**
 * Calculates the centroid of a Polygon or MultiPolygon geometry using Turf.js.
 * @param geometry The Polygon or MultiPolygon geometry.
 * @returns A Turf.js Point feature representing the centroid.
 * @throws Error if the geometry is not a Polygon or MultiPolygon.
 */
export const calculateCentroid = (geometry: { type: string; coordinates: any[] }): Feature<Point> => {
  if (geometry.type === 'MultiPolygon') {
    return turf.centroid(turf.multiPolygon(geometry.coordinates));
  } else if (geometry.type === 'Polygon') {
    return turf.centroid(turf.polygon(geometry.coordinates));
  } else {
    throw new Error('Expected Polygon or MultiPolygon geometry');
  }
};

/**
 * Calculates the midpoint between two {lat, lon} objects.
 * @param coord1 The first coordinate.
 * @param coord2 The second coordinate.
 * @returns The midpoint coordinate.
 */
export function calculateMidpoint(
  coord1: { lat: number; lon: number },
  coord2: { lat: number; lon: number }
): { lat: number; lon: number } {
  return {
    lat: (coord1.lat + coord2.lat) / 2,
    lon: (coord1.lon + coord2.lon) / 2,
  };
}

/**
 * Calculates Euclidean distance using Turf.js.
 * @param point1 The first Turf.js Point feature.
 * @param point2 The second Turf.js Point feature.
 * @returns The distance in kilometers.
 */
export const calculateDistance = (point1: Feature<Point>, point2: Feature<Point>): number => {
  return turf.distance(point1, point2, { units: 'kilometers' });
};

/**
 * Computes distances from a centroid to thematic data points.
 * @param centroid The centroid point.
 * @param thematicData The array of thematic points.
 * @returns An array of objects with index and distance.
 */
export const calculateDistances = (
  centroid: Feature<Point>,
  thematicData: ThematicPoint[]
): { index: number; distance: number }[] => {
  return thematicData.map((point, index) => {
    const pointCoords = turf.point([point.lon, point.lat]);
    const distance = calculateDistance(centroid, pointCoords);
    return { index, distance };
  });
};

/**
 * Finds the closest points in thematicData based on distance.
 * @param distances An array of objects with index and distance.
 * @param thematicData The array of thematic points.
 * @param numberOfPoints The number of closest points to return (default: 50).
 * @returns An array of the closest thematic points.
 */
export const findClosestPoints = (
  distances: { index: number; distance: number }[],
  thematicData: ThematicPoint[],
  numberOfPoints = 50
): ThematicPoint[] => {
  const sorted = [...distances].sort((a, b) => a.distance - b.distance);
  return sorted.slice(0, numberOfPoints).map(d => thematicData[d.index]);
};

/**
 * Creates a buffer around a given point.
 * @param point The Turf.js Point feature.
 * @param bufferDistance The buffer distance in kilometers.
 * @returns A Turf.js Polygon or MultiPolygon feature representing the buffer, or null if invalid.
 */
export function createBuffer(point: Feature<Point>, bufferDistance: number): Feature<Polygon | MultiPolygon> | null {
  const buffered = turf.buffer(point, bufferDistance, { units: 'kilometers' });
  if (!buffered || !buffered.geometry ||
    (buffered.geometry.type !== 'Polygon' && buffered.geometry.type !== 'MultiPolygon')) {
    return null;
  }
  return buffered as Feature<Polygon | MultiPolygon>;
}

/**
 * Filters thematic points that fall within a given buffer.
 * @param buffer The buffer polygon.
 * @param points The array of thematic points.
 * @returns An array of thematic points within the buffer.
 */
export function filterPointsInBuffer(
  buffer: Feature<Polygon | MultiPolygon>,
  points: ThematicPoint[]
): ThematicPoint[] {
  return points.filter(point => {
    const pointCoords = turf.point([point.lon, point.lat]);
    return turf.booleanPointInPolygon(pointCoords, buffer);
  });
}

/**
 * Converts a bearing (in degrees) to one of 8 cardinal directions.
 * @param bearing The bearing in degrees.
 * @returns The cardinal direction string.
 */
export function getCardinalDirection(bearing: number): string {
  const directions = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
  const index = Math.floor((bearing + 22.5) / 45) % 8;
  return directions[index];
}

/**
 * Offsets a geographic point by a given bearing and distance.
 * @param lat Latitude of the original point.
 * @param lon Longitude of the original point.
 * @param bearing Bearing in degrees.
 * @param distance Distance in meters.
 * @returns The new [latitude, longitude] coordinates.
 */
export function offsetPoint(lat: number, lon: number, bearing: number, distance: number): [number, number] {
  const R = 6378137; // Earth's radius in meters
  const toRad = Math.PI / 180;
  const toDeg = 180 / Math.PI;
  const lat1 = lat * toRad;
  const lon1 = lon * toRad;
  const brng = bearing * toRad;
  const dR = distance / R;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(dR) +
    Math.cos(lat1) * Math.sin(dR) * Math.cos(brng)
  );
  const lon2 = lon1 + Math.atan2(
    Math.sin(brng) * Math.sin(dR) * Math.cos(lat1),
    Math.cos(dR) - Math.sin(lat1) * Math.sin(lat2)
  );
  return [lat2 * toDeg, lon2 * toDeg];
}

/**
 * Calculates bearing between two geographic points.
 * @param lat1 Latitude of point 1.
 * @param lon1 Longitude of point 1.
 * @param lat2 Latitude of point 2.
 * @param lon2 Longitude of point 2.
 * @returns Bearing in degrees (0-360).
 */
export function bearingBetweenPoints(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = Math.PI / 180;
  const toDeg = 180 / Math.PI;

  const φ1 = lat1 * toRad;
  const φ2 = lat2 * toRad;
  const Δλ = (lon2 - lon1) * toRad;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) -
            Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  return (Math.atan2(y, x) * toDeg + 360) % 360;
}

/**
 * Normalizes a segment's direction based on its bearing.
 * If bearing > 180, it flips start/end points and adjusts bearing.
 * @param segment The segment array [start, end, {Bearing}, ...extras].
 */
export function normalizeSegment(segment: ProcessedEdge): ProcessedEdge { // Using any[] here as the full ProcessedEdge type might not be suitable for raw input
  const start = segment.point0;
  const end = segment.point1;
  let bearing = segment.bearing; // Access Bearing property safely

  if (typeof bearing !== 'number') {
    // If bearing is not a number, calculate it and assign
    bearing = bearingBetweenPoints(start.lat, start.lon, end.lat, end.lon);
    segment.bearing = bearing;
  }

  bearing = ((bearing % 360) + 360) % 360; // Normalize to [0, 360)

  if (bearing >= 180) {
    const temp = { lat: start.lat, lon: start.lon };
    start.lat = end.lat;
    start.lon = end.lon;
    end.lat = temp.lat;
    end.lon = temp.lon;
    bearing -= 180;
  }
  segment.bearing = bearing;
  return segment;
}

export async function loadThematicData(
  path: string,
  latColumnName: string,
  lonColumnName: string
): Promise<ThematicPoint[]> {
  const processedData: ThematicPoint[] = [];

  const thematicData: Array<Record<string, any>> = await d3.csv(`/data/${path}`,  d3.autoType);

  for (const d of thematicData) {
    const newRow: Record<string, any> = { ...d }; // Start with a copy of the original row

    let lat: number | null = null;
    let lon: number | null = null;

    // Process latitude
    if (d[latColumnName] !== undefined && d[latColumnName] !== null) {
      const parsedLat = parseFloat(d[latColumnName]);
      if (!isNaN(parsedLat)) {
        lat = parsedLat;
      }
    }

    // Process longitude
    if (d[lonColumnName] !== undefined && d[lonColumnName] !== null) {
      const parsedLon = parseFloat(d[lonColumnName]);
      if (!isNaN(parsedLon)) {
        lon = parsedLon;
      }
    }

    if (lat !== null && lon !== null) {
      newRow.lat = lat;
      newRow.lon = lon;
      processedData.push(newRow as ThematicPoint);
    } else {
      console.warn(`Skipping row due to invalid/missing lat/lon: Original data for latCol '${latColumnName}': '${d[latColumnName]}', lonCol '${lonColumnName}': '${d[lonColumnName]}'`, d);
    }
  }
  return processedData;
}