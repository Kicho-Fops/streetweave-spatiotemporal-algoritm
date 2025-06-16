import { ParsedSpec, AggregationType, SpatialRelationType } from './types';
import { defaultParsedSpec } from './defaults';
import { RegexPatterns } from './regex';

export function parseSpecification(spec: string): ParsedSpec[] {
  const layers = spec.split(/Layer\d+\s*=\s*/).filter(Boolean);
  return layers.map(parseSingleLayer).filter(Boolean) as ParsedSpec[];
}

const parseSingleLayer = (spec: string): ParsedSpec | null => {

  let parsedSpec = defaultParsedSpec;

  try {
    const unitRegex = RegexPatterns.unit;
    const unitMatch = spec.match(unitRegex);

    parsedSpec.unit = unitMatch ? unitMatch[1] : parsedSpec.unit;
    parsedSpec.unitDivide = unitMatch && unitMatch[2] ? parseFloat(unitMatch[2]) : parsedSpec.unitDivide;

    const dataMatch = spec.match(RegexPatterns.data);

    if (dataMatch) {
      const dataContent = dataMatch[1].trim();
      const dataParts = dataContent.split(',').map(part => part.trim());

      dataParts.forEach(part => {
        const [key, value] = part.split('=').map(p => p.trim().replace(/^"(.*)"$/, '$1'));
        if (key === 'physicalLayer') {
          parsedSpec.physicalLayerPath = value;
        } else if (key === 'thematicLayer') {
          parsedSpec.thematicLayerPath = value;
        }
      });
    }

    const relationMatch = spec.match(RegexPatterns.relation);
    console.log('--- Debugging Regex Match ---');
    console.log('Input spec string:', spec);
    console.log('Regex being used:', RegexPatterns.relation); // <--- Crucial check!
    console.log('Type of Regex being used:', typeof RegexPatterns.relation); // Should be 'object'

    if (relationMatch && relationMatch.groups && relationMatch.groups.params) {
      const paramsString = relationMatch.groups.params;

        // Regex to find individual key-value pairs within the paramsString
        const paramRegex = /(?<key>\w+)\s*=\s*(?:")?(?<value>[^",]*)(?:")?/g;
        let match;

        while ((match = paramRegex.exec(paramsString)) !== null) {
          if (match.groups) {
            const key = match.groups.key;
            const rawValue = match.groups.value.trim(); // Trim whitespace

            switch (key) {
              case 'spatial':
                if (['nn', 'buffer', 'contains'].includes(rawValue)) {
                  parsedSpec.spatialRelation = rawValue as SpatialRelationType;
                }
                break;
              case 'value':
                // Convert the string value to a number
                const numValue = Number(rawValue);
                if (!isNaN(numValue)) {
                  parsedSpec.spatialRelationValue = numValue;
                }
                break;
              case 'type': // Your regex has 'type', not 'aggregation'
                if (['sum', 'mean', 'min', 'max'].includes(rawValue)) {
                  parsedSpec.aggregationType = rawValue as AggregationType;
                }
                break;
              default:
                // Handle unexpected keys or log a warning
                console.warn(`Unknown parameter: ${key}`);
            }
          }
        }
    }

    const zoomMatch = spec.match(RegexPatterns.zoom);
    const zoom = zoomMatch
      ? parseInt(zoomMatch[1], 10)
      : parsedSpec.unit === 'segment'
        ? 18
        : parsedSpec.unit === 'node'
          ? 18
          : 10;
    parsedSpec.zoom = zoom;

    const methodRegex = RegexPatterns.method;
    const m = spec.match(methodRegex);

    if (m) {
      parsedSpec.method = m[1];
      parsedSpec.methodRow = m[2] ? +m[2] : undefined;
      parsedSpec.methodColumn = m[3] ? +m[3] : undefined;
    }

    if (parsedSpec.method === 'line' || parsedSpec.method === 'rect' || parsedSpec.method === 'matrix') {
      const lineColorMatch = spec.match(RegexPatterns.lineColor);
      parsedSpec.lineColor = lineColorMatch ? lineColorMatch[1].trim() : parsedSpec.lineColor;

      const lineTypeMatch = spec.match(RegexPatterns.lineType);
      if (lineTypeMatch) {
        parsedSpec.lineType = lineTypeMatch[1];
      }

      const lineStrokeWidthMatch = spec.match(RegexPatterns.lineStrokeWidth)
      if (lineStrokeWidthMatch) {
        const rawWidth = lineStrokeWidthMatch[1].trim();
        const asNum = Number(rawWidth);
        if (!Number.isNaN(asNum)) {
          parsedSpec.lineStrokeWidth = asNum;
        } else {
          parsedSpec.lineStrokeWidth = rawWidth;
        }
      }

      const heightMatch = spec.match(RegexPatterns.lineHeight);
      if (heightMatch) {
        const rawHeight = heightMatch[1].trim();
        const asNum = Number(rawHeight);
        if (!Number.isNaN(asNum)) {
          parsedSpec.lineHeight = asNum;
        } else {
          parsedSpec.lineHeight = rawHeight;
        }
      }

      const lineOpacityMatch = spec.match(RegexPatterns.lineOpacity);
      if (lineOpacityMatch) {
        const raw = lineOpacityMatch[1].trim();
        const asNum = Number(raw);

        if (!Number.isNaN(asNum)) {
          parsedSpec.lineOpacity = asNum;
        } else {
          parsedSpec.lineOpacity = raw;
        }
      }
    }

    const mapMatch = spec.match(RegexPatterns.map);
    if (mapMatch) {
      const mapContent = mapMatch[1];

      const scMatch = mapContent.match(RegexPatterns.mapStreetColor);
      if (scMatch) {
        parsedSpec.streetColor = scMatch[1].trim();
      }

      const swMatch = mapContent.match(RegexPatterns.mapStreetWidth);
      if (swMatch) {
        parsedSpec.streetWidth = parseFloat(swMatch[1].trim());
      }
    }

    const chartMatch = spec.match(RegexPatterns.chart);
    if (chartMatch) {
      try {
        const chartContent = chartMatch[1];
        parsedSpec.chart = JSON.parse(chartContent);
      } catch (error) {
        console.error('Failed to parse Vega-Lite spec inside `.chart()`: ', error);
      }
    }

    const orientationMatch = spec.match(RegexPatterns.orientation);
    if (orientationMatch) {
      parsedSpec.orientation = orientationMatch[1];
    }

    const alignmentMatch = spec.match(RegexPatterns.alignment);
    if (alignmentMatch) {
      parsedSpec.alignment = alignmentMatch[1];
    }

    const queryMatch = spec.match(RegexPatterns.query);
    if(queryMatch) {
      const queryContent = queryMatch[1];
      if(queryContent.length > 0){
        const addressMatch = queryContent.match(RegexPatterns.queryAddress);
        if (addressMatch) {
          parsedSpec.queryAddress = addressMatch[1].trim();
        }

        const radiusMatch = queryContent.match(RegexPatterns.queryRadius);
        if (radiusMatch) {
          const raw = radiusMatch[1];
          const asNum = Number(raw);
          if (!Number.isNaN(asNum)) {
            parsedSpec.queryRadius = asNum;
          }
        }
      }
    }

    return parsedSpec;
  } catch (error) {
    console.error('Failed to parse the specification:', error);
    return null;
  }
};