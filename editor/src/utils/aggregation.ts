// src/utils/aggregation.ts

import * as d3 from 'd3';
import * as turf from '@turf/turf';
import { AggregationType, ThematicPoint, PhysicalEdge, ParsedSpec, AggregatedEdges } from 'streetweave';
import { calculateMidpoint, calculateDistances, findClosestPoints, filterPointsInBuffer, createBuffer } from './geoHelpers';


/**
 * Aggregates values based on the selected aggregation type.
 * @param points The points to aggregate.
 * @param aggregationType The type of aggregation ('sum', 'mean', 'min', 'max').
 * @param thematicData The original thematic data (used to determine attributes).
 * @returns An object with aggregated values for each attribute.
 */
export const aggregateValues = (
  points: ThematicPoint[],
  aggregationType: AggregationType,
  thematicData: ThematicPoint[]
): Record<string, number | undefined> => {
  const attributes =
    thematicData.length > 0
      ? Object.keys(thematicData[0]).filter(k => k !== 'lat' && k !== 'lon')
      : [];

  const aggregatedValues: Record<string, number | undefined> = {};

  attributes.forEach(attr => {
    const values = points
      .map(point => point[attr])
      .filter(val => typeof val === 'number');

    let value = undefined;
    switch (aggregationType) {
      case 'sum':
        value = d3.sum(values);
        break;
      case 'mean':
        value = values.length ? d3.mean(values) : 0;
        break;
      case 'min':
        value = values.length ? d3.min(values) : 0;
        break;
      case 'max':
        value = values.length ? d3.max(values) : 0;
        break;
      default:
        value = 0;
    }
    if(!value) value = 0;
    aggregatedValues[attr] = value;
  });

  return aggregatedValues;
};

/**
 * Aggregates thematic data for edge segments based on point-in-polygon containment (using a buffer).
 * @param edgesData The raw edge data from the physical layer.
 * @param thematicData The thematic point data.
 * @param aggregationType The type of aggregation.
 * @returns An array of updated edge data with aggregated properties.
 */
const aggregationContainsSegment = (
  edgesData: PhysicalEdge[],
  thematicData: ThematicPoint[],
  aggregationType: AggregationType
): PhysicalEdge[] => {
  const bboxWidth = 5000; // meters

  return edgesData.map(edge => {
    const pointA = [edge.point0.lat, edge.point0.lon];
    const pointB = [edge.point1.lat, edge.point1.lon];

    const line = turf.lineString([pointA, pointB]);
    const bbox = turf.buffer(line, bboxWidth, { units: 'meters' });

    if (!bbox) {
      // Return original edge with an empty aggregated attributes object if buffer fails
      return {point0: edge.point0, point1: edge.point1, bearing: 0, length: 0, attributes: {}};
    }

    const pointsInBoundingBox = thematicData.filter(point => {
      const thematicPoint = turf.point([point.lon, point.lat]);
      return turf.booleanPointInPolygon(thematicPoint, bbox);
    });
    const aggregated = aggregateValues(pointsInBoundingBox, aggregationType, thematicData);
    edge.attributes = aggregated;

    return edge;
  });
};

/**
 * Aggregates thematic data for each edge segment based on nearest neighbors to the midpoint.
 * @param edgesData The array of raw edge data.
 * @param environmentalData The thematic point data.
 * @param aggregationType The type of aggregation.
 * @returns An array of updated edge data with aggregated attributes.
 */
const aggregateSegmentNearestNeighbor = (
  edgesData: PhysicalEdge[], // Raw edges data
  environmentalData: ThematicPoint[],
  aggregationType: AggregationType
): PhysicalEdge[] => {
  return edgesData.map(edge => {
    const pointA = { lat: edge.point0.lat, lon: edge.point0.lon };
    const pointB = { lat: edge.point1.lat, lon: edge.point1.lon };
    const midpointCoords = calculateMidpoint(pointA, pointB);
    const centroid = turf.point([midpointCoords.lon, midpointCoords.lat]);

    const distances = calculateDistances(centroid, environmentalData);
    const closestPoints = findClosestPoints(distances, environmentalData, 100);
    const aggregatedValues = aggregateValues(closestPoints, aggregationType, environmentalData);
    edge.attributes = aggregatedValues;
    // const existingBearing = edge[2] && typeof edge[2] === 'object' && 'Bearing' in edge[2] ? edge[2] : { Bearing: null };
    // const existingLength = edge[3] && typeof edge[3] === 'object' && 'Length' in edge[3] ? edge[3] : { Length: null };

    return edge;
  });
};

/**
 * Aggregates thematic data for edge segments based on a buffer around their midpoint.
 * @param edgesData The raw edge data.
 * @param environmentalData The thematic point data.
 * @param bufferDistance The buffer distance in meters.
 * @param aggregationType The type of aggregation.
 * @returns An array of updated edge data with aggregated attributes.
 */
const aggregateSegmentBuffer = (
  edgesData: PhysicalEdge[], // Raw edges data
  environmentalData: ThematicPoint[],
  bufferDistance: number,
  aggregationType: AggregationType
): PhysicalEdge[] => {
  // console.log(edgesData);
  // let edges: ProcessedEdge[] = [];
  return edgesData.map(edge => {
    const pointA = { lat: edge.point0.lat, lon: edge.point0.lon };
    const pointB = { lat: edge.point1.lat, lon: edge.point1.lon };
    const midpoint = calculateMidpoint(pointA, pointB);
    const midpointTurf = turf.point([midpoint.lon, midpoint.lat]);

    const buffer = createBuffer(midpointTurf, bufferDistance);
    if (!buffer) {
      // Return original edge with an empty aggregated attributes object if buffer fails
      return {point0: edge.point0, point1: edge.point1, bearing: 0, length: 0, attributes: undefined};
    }

    const pointsInBuffer = filterPointsInBuffer(buffer, environmentalData);
    const calculatedAggregatedValues = aggregateValues(pointsInBuffer, aggregationType, environmentalData);

    const finalAggregatedAttributes: Record<string, number | undefined> = {...calculatedAggregatedValues};
    edge.attributes = finalAggregatedAttributes;

    return edge;
      // existingBearing,
      // existingLength,
    // ] as ProcessedEdge;
  });
};

/**
 * General purpose function to apply spatial aggregation based on spec.
 * @param physicalData The initial physical layer data. For 'area' it's GeoJSONData, for 'segment'/'node' it's an array of raw edges.
 * @param thematicData The thematic data.
 * @param layerSpec The parsed layer specification.
 * @returns The aggregated data, either GeoJSONData or ProcessedEdge[].
 */
export async function applySpatialAggregation(
  physicalData: PhysicalEdge[],
  thematicData: ThematicPoint[],
  layerSpec: ParsedSpec
): Promise<AggregatedEdges> {

  let attributeStats: Record<string, { min: number; max: number }> = {};

  if (layerSpec.unit.type === 'segment' || layerSpec.unit.type === 'node') {
    let edgesData : PhysicalEdge[];
    if (layerSpec.relation?.spatial === 'contains') {
      edgesData = aggregationContainsSegment(physicalData, thematicData, layerSpec.relation.type!);
    } else if (layerSpec.relation?.spatial === 'nn') {
      edgesData = aggregateSegmentNearestNeighbor(physicalData, thematicData, layerSpec.relation.type!);
    } else if (layerSpec.relation?.spatial === 'buffer') {
      edgesData = aggregateSegmentBuffer(physicalData, thematicData, layerSpec.relation.value!, layerSpec.relation.type!);
    }
    else {
      return {edges: physicalData, attributeStats};
    }

    
    edgesData.forEach(edge => {
      for (const key in edge.attributes) {
        if(attributeStats[key] == undefined)
          attributeStats[key] = {min: Infinity, max: -Infinity}

        const value = edge.attributes[key];
        let finalValue: number = value ? value : 0; 
        if (attributeStats[key].min === undefined || finalValue < attributeStats[key].min) {
          attributeStats[key].min = finalValue;
        }
        if (attributeStats[key].max === undefined || finalValue > attributeStats[key].max) {
          attributeStats[key].max = finalValue;
        }
      }
    });

    return {edges: edgesData, attributeStats};
  }
  // Return unchanged if no aggregation matches or if unit is not recognized
  return {edges: physicalData, attributeStats};
}

/**
 * Transforms raw edge data (from physical layer) into unique nodes with aggregated attributes.
 * This is specifically for 'node' unit processing.
 * @param aggregatedEdges The edges data after initial aggregation.
 * @returns A list of unique nodes with their aggregated attributes.
 */
export const processEdgesToNodes = (aggregatedEdges: PhysicalEdge[]): Record<string, any>[] => {
  const NodesMap: Record<string, any> = {};

  aggregatedEdges.forEach((edge: PhysicalEdge) => {
    const firstNode = edge.point0;
    const secondNode = edge.point1;
    const aggregatedAttributes = edge.attributes;

    // Process both nodes of the edge
    [firstNode, secondNode].forEach(node => {
      const key = `${node.lat},${node.lon}`;
      if (!NodesMap[key]) {
        NodesMap[key] = { lat: node.lat, lon: node.lon, sums: {}, count: 0 };
      }

      // Aggregate numeric attributes from the edge onto the node
      for (const [attrKey, attrValue] of Object.entries(aggregatedAttributes || {})) {
        if (typeof attrValue === 'number') {
          if (!NodesMap[key].sums[attrKey]) {
            NodesMap[key].sums[attrKey] = 0;
          }
          NodesMap[key].sums[attrKey] += attrValue;
        }
      }
      NodesMap[key].count += 1;
    });
  });

  // Convert NodeMap to a list of nodes with averaged attributes
  return Object.values(NodesMap).map((node: any) => {
    const averagedAttrs: Record<string, number | null> = {};
    for (const [attrKey, sumValue] of Object.entries(node.sums)) {
      averagedAttrs[attrKey] = (sumValue as number) / node.count;
    }
    return {
      lat: node.lat,
      lon: node.lon,
      attributes: averagedAttrs
    };
  });
};