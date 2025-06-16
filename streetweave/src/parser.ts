// parser.ts
import { ParsedSpec, AggregationType, SpatialRelationType } from './types';
import { defaultParsedSpec } from './defaults';
import Ajv from 'ajv'; // Import Ajv

import parsedSpecSchema from './schema.json'; // Adjust path as necessary

const ajv = new Ajv({ allErrors: true }); // Initialize Ajv with allErrors option
const validate = ajv.compile(parsedSpecSchema); // Compile the schema once

export function parseSpecification(specJson: any): ParsedSpec[] {
  // Assuming the top-level JSON can be an array of layer specifications
  // or a single layer specification object.
  const layerSpecs = Array.isArray(specJson) ? specJson : [specJson];

  const parsedAndValidatedSpecs: ParsedSpec[] = [];

  for (const spec of layerSpecs) {
    const isValid = validate(spec); // Validate against the schema

    if (!isValid) {
      console.error('JSON Schema Validation Errors for a layer:', validate.errors);
      continue;
    }

    const parsedSingleSpec = parseSingleLayerJson(spec);
    if (parsedSingleSpec) {
      parsedAndValidatedSpecs.push(parsedSingleSpec);
    }
  }

  return parsedAndValidatedSpecs;
}

const parseSingleLayerJson = (spec: any): ParsedSpec | null => {
  let parsedSpec: ParsedSpec = { ...defaultParsedSpec }; // Create a fresh copy for each layer

  try {
    // Unit and UnitDivide
    if (spec.unit) {
      parsedSpec.unit = spec.unit;
      if (spec.unitDivide) {
        const numValue = Number(spec.unitDivide);
        if (!isNaN(numValue)) {
          parsedSpec.unitDivide = numValue;
        }
      }
    }

    // Data Layer Paths
    if (spec.data) {
      if (spec.data.physicalLayer) {
        parsedSpec.physicalLayerPath = spec.data.physicalLayer;
      }
      if (spec.data.thematicLayer) {
        parsedSpec.thematicLayerPath = spec.data.thematicLayer;
      }
    }

    // Relation
    if (spec.relation) {
      if (spec.relation.spatial && ['nn', 'buffer', 'contains'].includes(spec.relation.spatial)) {
        parsedSpec.spatialRelation = spec.relation.spatial as SpatialRelationType;
      }
      if (typeof spec.relation.value === 'number') {
        parsedSpec.spatialRelationValue = spec.relation.value;
      }
      if (spec.relation.type && ['sum', 'mean', 'min', 'max'].includes(spec.relation.type)) {
        parsedSpec.aggregationType = spec.relation.type as AggregationType;
      }
    }

    // Zoom
    if (typeof spec.zoom === 'number') {
      parsedSpec.zoom = spec.zoom;
    } else {
      // Re-apply default zoom logic if not explicitly set in JSON
      if (parsedSpec.unit === 'segment' || parsedSpec.unit === 'node') {
        parsedSpec.zoom = 18;
      } else {
        parsedSpec.zoom = 10;
      }
    }

    // Method
    if (spec.method) {
      parsedSpec.method = spec.method;
      if (typeof spec.methodRow === 'number') {
        parsedSpec.methodRow = spec.methodRow;
      }
      if (typeof spec.methodColumn === 'number') {
        parsedSpec.methodColumn = spec.methodColumn;
      }

      if (parsedSpec.method === 'line' || parsedSpec.method === 'rect' || parsedSpec.method === 'matrix') {
        if (spec.lineColor) {
          parsedSpec.lineColor = spec.lineColor;
        }
        if (spec.lineType) {
          parsedSpec.lineType = spec.lineType;
        }
        if (spec.lineStrokeWidth !== undefined) {
          const asNum = Number(spec.lineStrokeWidth);
          if (!Number.isNaN(asNum)) {
            parsedSpec.lineStrokeWidth = asNum;
          } else {
            parsedSpec.lineStrokeWidth = spec.lineStrokeWidth;
          }
        }
        if (spec.lineHeight !== undefined) {
          const asNum = Number(spec.lineHeight);
          if (!Number.isNaN(asNum)) {
            parsedSpec.lineHeight = asNum;
          } else {
            parsedSpec.lineHeight = spec.lineHeight;
          }
        }
        if (spec.lineOpacity !== undefined) {
          const asNum = Number(spec.lineOpacity);
          if (!Number.isNaN(asNum)) {
            parsedSpec.lineOpacity = asNum;
          } else {
            parsedSpec.lineOpacity = spec.lineOpacity;
          }
        }
      }
    }

    // Map
    if (spec.map) {
      if (spec.map.streetColor) {
        parsedSpec.streetColor = spec.map.streetColor;
      }
      if (typeof spec.map.streetWidth === 'number') {
        parsedSpec.streetWidth = spec.map.streetWidth;
      }
    }

    // Chart (Vega-Lite spec)
    if (spec.chart) {
      // Assuming chart is already a parsed JSON object (from the input JSON)
      parsedSpec.chart = spec.chart;
    }

    // Orientation
    if (spec.orientation) {
      parsedSpec.orientation = spec.orientation;
    }

    // Alignment
    if (spec.alignment) {
      parsedSpec.alignment = spec.alignment;
    }

    // Query
    if (spec.query) {
      if (spec.query.address) {
        parsedSpec.queryAddress = spec.query.address;
      }
      if (typeof spec.query.radius === 'number') {
        parsedSpec.queryRadius = spec.query.radius;
      }
    }

    return parsedSpec;
  } catch (error) {
    console.error('Failed to parse the JSON specification:', error);
    return null;
  }
};