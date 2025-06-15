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
  unit: string;
  unitDivide: number;
  zoom: number;
  method?: string;
  shape?: string;
  fillAttribute?: string;
  strokeColor?: string;
  strokeWidth?: number;
  fillOpacity?: number;
  strokeOpacity?: string | number;
  domain?: number[];
  range?: string[];
  lineColor?: string;
  lineType?: string;
  lineTypeVal?: string;
  lineStrokeWidth?: string | number;
  height?: string | number;
  radius?: number;
  blur?: number;
  xField?: string;
  yField?: string;
  pointColor?: string;
  chart?: any;
  orientation?: string;
  alignment?: string;
  physicalLayerPath?: string;
  thematicLayerPath?: string;
  spatialRelation?: string;
  operation?: string;
  AggregationType?: AggregationType; 
  bufferValue?: number;
  roadDirection?: string;
  address?: string;
  roadRadius?: number;
  radiusUnit?: string;
  background?: string;
  streetName?: string;
  streetColor?: string;
  streetWidth?: number;
  methodRow?: number;
  methodColumn?: number;
  colorScheme?: string; 
  valueField?: string; 
  pointRadius?: number;
}