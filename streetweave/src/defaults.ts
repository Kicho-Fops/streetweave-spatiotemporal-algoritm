import { ParsedSpec } from './types';

export const defaultParsedSpec: ParsedSpec = {
  unit: "segment",
  unitDivide: 1,
  zoom: 18,
  method: "line",
  lineOpacity: 1,
  lineColor: "red",
  lineType: undefined,
  lineStrokeWidth: 5,
  lineHeight: 5,
  orientation: "parallel",
  alignment: "left",
  physicalLayerPath: undefined,
  thematicLayerPath: undefined,
  spatialRelation: "buffer",
  spatialRelationValue: 50,
  aggregationType: "mean",
  streetColor: undefined,
  streetWidth: undefined,
  methodRow: undefined, 
  methodColumn: undefined, 
  queryAddress: undefined,
  queryRadius: undefined
};