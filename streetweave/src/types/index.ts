// src/types/index.ts

export type ThematicPoint = {
  Lat: number;
  Lon: number;
  [key: string]: number;
};

// More specific GeoJSONFeature type
export type GeoJSONFeature = { // Renamed from CustomGeoJSONFeature to simply GeoJSONFeature as it's the primary one now
  type: "Feature"; // Must be literal "Feature"
  geometry: {
    type: string; // This can remain broad if you handle specific geometry types later
    coordinates: any;
  };
  properties: Record<string, any> | null | undefined;
};

// More specific GeoJSONData type, aligning with Leaflet's expectations
export type GeoJSONData = { // Renamed from CustomGeoJSONData to simply GeoJSONData
  type: "FeatureCollection"; // Must be literal "FeatureCollection"
  features: GeoJSONFeature[];
  edges?: any[]; // This is a custom property, not standard GeoJSON
};

export type AggregationType = 'sum' | 'mean' | 'min' | 'max';
export type SpatialRelationType = 'buffer' | 'nn' | 'contains';

export type SegmentData = {
  lat: number;
  lon: number;
};

// Define a type for the processed edge data after aggregation
export type ProcessedEdge = [
  SegmentData, // Point A
  SegmentData, // Point B
  { Bearing: number | null }, // Bearing property (can be null if not present)
  { Length: number | null }, // Length property (can be null if not present)
  Record<string, number | null> // Aggregated attributes (always an object)
];


// Define an interface for the properties added to an edge for styling (internal to renderers)
export interface EdgeStyleProps {
  __spikeColor?: string;
  __spikeWidth?: number;
  __spikeheight?: number;
  __spikeOpacity?: number;
  __rectColor?: string;
  __rectWidth?: number;
  __rectOpacity?: number;
  __shapeColor?: string;
  __shapeWidth?: number;
  __height?: number;
  __shapeOpacity?: number;
}

// DEFINING ParsedSpec here
export interface ParsedSpec {
  name?: string;
  unit: {
    type: "segment" | "node" | "point";
    splits: number; 
    method?: "line" | "rect" | "matrix"; // Optional due to default in schema
    opacity?: string | number; // Optional due to default in schema, oneOf string/number
    color?: string; // Optional due to default in schema
    style?: string; // Optional due to default in schema
    width?: string | number; // Optional due to default in schema, oneOf string/number
    height?: string | number; // Optional due to default in schema, oneOf string/number
    chart?: any; // Optional/nullable
    rows?: number; // Optional/nullable
    columns?: number; // Optional/nullable
    orientation?: "parallel" | "perpendicular"; // Optional due to default in schema
    alignment?: "left" | "center" | "right"; // Optional due to default in schema
  };
  data: {
    physical: {
      path: string; // Required within physical
    };
    thematic: {
      path: string; // Required within thematic
      latColumn: string;
      lonColumn: string;
    };
  };
  relation?: { // Optional
    spatial?: SpatialRelationType; // Optional due to default
    value?: number; // Optional due to default
    type?: AggregationType; // Optional due to default
  };
  zoom?: [number, number]; // Optional due to default
  map?: {
    streetColor?: string; // Optional/nullable
    streetWidth?: number; // Optional/nullable
  };
  query?: {
    address?: string; // Optional/nullable
    radius?: number; // Optional/nullable
  };
}