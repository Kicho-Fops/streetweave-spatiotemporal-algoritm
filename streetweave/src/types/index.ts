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
  unit: "segment" | "node" | "point";
  splits: number;

  // New 'data' object structure
  data: { // Required by schema
    physicalLayer: string; // Required by schema
    thematicLayer: string; // Required by schema
  };

  // New 'relation' object structure
  relation?: { // Optional as per schema, but internal properties have defaults
    spatial?: SpatialRelationType; // Has default in schema
    value?: number; // Has default in schema
    type?: AggregationType; // Has default in schema
  };

  zoom?: [number, number]; // Changed to array of two numbers as per schema

  method?: "line" | "rect" | "matrix"; // Restricted enum, optional with default in schema
  lineOpacity?: number; // Optional with default in schema
  lineColor?: string; // Optional with default in schema
  lineType?: string; // Optional with default in schema ("solid")
  lineStrokeWidth?: number; // Optional with default in schema
  lineHeight?: number; // Optional with default in schema

  // New 'map' object structure
  map?: { // Optional
    streetColor?: string;
    streetWidth?: number;
  };

  orientation?: "parallel" | "perpendicular"; // Optional with enum
  alignment?: "left" | "center" | "right"; // Optional with enum

  // New 'query' object structure
  query?: { // Optional
    address?: string; // Optional in schema
    radius?: number; // Optional in schema
  };

  chart?: any;
  methodRow?: number;
  methodColumn?: number;

}