export interface ParsedSpec {
  name?: string;
  unit: string;
  unitDivide: number;
  zoom: number;
  method: string;
  shape: string;
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
  AggregationType?: string;
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
}

export function parseSpecification(spec: string): ParsedSpec[] {
  const layers = spec.split(/Layer\d+\s*=\s*/).filter(Boolean);
  return layers.map(parseSingleLayer).filter(Boolean) as ParsedSpec[];
}

function parseSingleLayer(spec: string): ParsedSpec | null {
  // ... full parsing logic from original App.tsx goes here

    

  return null;
}