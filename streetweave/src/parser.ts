import { ParsedSpec, AggregationType } from './types';

export function parseSpecification(spec: string): ParsedSpec[] {
  const layers = spec.split(/Layer\d+\s*=\s*/).filter(Boolean);
  return layers.map(parseSingleLayer).filter(Boolean) as ParsedSpec[];
}

const parseSingleLayer = (spec: string): ParsedSpec | null => {
    try {
      const unitRegex = /unit\s*=\s*(\w+)(?:\/(\d+(?:\.\d+)?))?/;
      const unitMatch = spec.match(unitRegex);

      const unit = unitMatch ? unitMatch[1] : 'segment';
      const unitDivide = unitMatch && unitMatch[2] ? parseFloat(unitMatch[2]) : 1;

      const dataMatch = spec.match(/data\(([^)]+)\)/);
      let physicalLayerPath: string | undefined;
      let thematicLayerPath: string | undefined;

      if (dataMatch) {
        const dataContent = dataMatch[1].trim();
        const dataParts = dataContent.split(',').map(part => part.trim());

        dataParts.forEach(part => {
          const [key, value] = part.split('=').map(p => p.trim());
          if (key === 'physicalLayer') {
            physicalLayerPath = value;
          } else if (key === 'thematicLayer') {
            thematicLayerPath = value;
          }
        });
      }

      let spatialRelation: string | undefined;
      let operation: string | undefined;
      let AggregationType: AggregationType | undefined; // Use AggregationType here
      let bufferValue: number | undefined;

      const relationMatch = spec.match(/\.relation\(\s*spatialRelation\s*=\s*(.*?),\s*operation\s*=\s*(.*?),\s*type\s*=\s*(.*?)\)/);
        if (relationMatch) {
            spatialRelation = relationMatch[1].trim() ? relationMatch[1].trim() : 'buffer(50)';
            operation = relationMatch[2].trim() ? relationMatch[2].trim() : 'aggregation';

            const aggregationTypeStr = relationMatch[3].trim();
            // Explicitly cast the string to AggregationType to satisfy TypeScript
            // Ensure the string matches one of the literal types in AggregationType
            if (['sum', 'mean', 'min', 'max'].includes(aggregationTypeStr)) {
                AggregationType = aggregationTypeStr as AggregationType;
            } else {
                AggregationType = 'mean'; // Default value if not recognized
            }

            // Handling buffer case
            const bufferMatch = spatialRelation.match(/^buffer\((\d+)\)$/);
            if (bufferMatch) {
              spatialRelation = 'buffer';
              bufferValue = parseInt(bufferMatch[1], 10);
            } else {
              spatialRelation = spatialRelation;
            }
        } else { // Defaults if no .relation() is found
          spatialRelation = 'buffer';
          bufferValue = 50;
          AggregationType = 'mean'; // Default type AggregationType
          operation = 'aggregation';
        }

      const zoomMatch = spec.match(/zoom\((\d+)\)/);
      const zoom = zoomMatch
      ? parseInt(zoomMatch[1], 10)
      : unit === 'segment'
        ? 18
        : unit === 'node'
          ? 18
          : 10;

      let method: string | undefined;
      let methodRow: number | undefined;
      let methodColumn: number | undefined;
      const methodRegex = /method\s*=\s*([a-zA-Z]\w*)(?:\(\s*(\d+)\s*,\s*(\d+)\s*\))?/;
      const m = spec.match(methodRegex);

      if (m) {
        method = m[1];
        methodRow = m[2] ? +m[2] : undefined;
        methodColumn = m[3] ? +m[3] : undefined;
      }else{
        method = 'line';
      }

      const shapeMatch = spec.match(/shape\s*=\s*(\w+)/);
      const shape = shapeMatch ? shapeMatch[1] : '';

      let radius: number | undefined;
      let blur: number | undefined;
      let colorScheme: string | undefined; // Added colorScheme
      let valueField: string | undefined; // Added valueField

      if (method === 'heatmap') {
        const radiusMatch = spec.match(/radius\s*=\s*(\d+)/);
        radius = radiusMatch ? parseInt(radiusMatch[1], 10) : 25;

        const blurMatch = spec.match(/blur\s*=\s*(\d+)/);
        blur = blurMatch ? parseInt(blurMatch[1], 10) : 15;

        const colorSchemeMatch = spec.match(/colorScheme\s*=\s*([a-zA-Z_]+)/);
        colorScheme = colorSchemeMatch ? colorSchemeMatch[1].trim() : undefined;

        const valueFieldMatch = spec.match(/valueField\s*=\s*([a-zA-Z_]+)/);
        valueField = valueFieldMatch ? valueFieldMatch[1].trim() : undefined;
      }

      let fillAttribute: string | undefined = undefined; // Initialize with undefined
      let strokeColor: string | undefined = 'black'; // Default stroke color
      let strokeWidth: number | undefined = 1;
      let fillOpacity: number | undefined;
      let strokeOpacity: string | number | undefined;
      let lineColor: string | undefined;
      let lineType: string | undefined;
      let lineTypeVal: string | undefined;
      let lineStrokeWidth: string | number | undefined;
      let height: string | number | undefined;
      let domain: number[] | undefined;
      let range: string[] | undefined;
      let xField: string | undefined;
      let yField: string | undefined;
      let pointColor: string | undefined;

      if (method === 'fill') {
        const fillMatch = spec.match(/color\((\w+)\)/);
        fillAttribute = fillMatch ? fillMatch[1] : undefined; // Use undefined if not found

        const strokeColorMatch = spec.match(/stroke\(color\s*=\s*(\w+)/);
        strokeColor = strokeColorMatch ? strokeColorMatch[1] : 'black';
        const strokeWidthMatch = spec.match(/width\s*=\s*(\d+)/);
        strokeWidth = strokeWidthMatch ? parseInt(strokeWidthMatch[1], 10) : 1;

        const fillOpacityMatch = spec.match(/(?:[^stroke]\s*)opacity\s*=\s*(\d*\.?\d+)/);
        fillOpacity = fillOpacityMatch ? parseFloat(fillOpacityMatch[1]) : undefined;

        const strokeOpacityMatch = spec.match(/stroke\(.*opacity\s*=\s*(\d*\.?\d+)/);
        strokeOpacity = strokeOpacityMatch ? parseFloat(strokeOpacityMatch[1]) : undefined;

        const domainMatch = spec.match(/domain\(\[([^\]]+)\]\)/);
        domain = domainMatch ? domainMatch[1].split(',').map(Number) : undefined;

        const rangeMatch = spec.match(/range\(\[([^\]]+)\]\)/);
        range = rangeMatch ? rangeMatch[1].split(',').map(color => color.trim().replace(/['"]+/g, '')) : undefined;
      }

      if (method === 'line' || method === 'rect' || method === 'matrix' || shape === 'spike' || shape === 'rect') {
        const lineColorMatch = spec.match(/color\s*=\s*([^,\)\s]+)/);
        lineColor = lineColorMatch ? lineColorMatch[1].trim() : 'red';

        const lineTypeMatch = spec.match(/type\s*=\s*(\w+)\(([^)]+)\)/);
        if (lineTypeMatch) {
          lineType = lineTypeMatch[1];
          lineTypeVal = lineTypeMatch[2];
        }

        const lineStrokeWidthMatch = spec.match(/width\s*=\s*([^,\)\s]+)/)
        if(lineStrokeWidthMatch){
          const rawWidth = lineStrokeWidthMatch[1].trim();
          const asNum = Number(rawWidth);
          if (!Number.isNaN(asNum)) {
            lineStrokeWidth = asNum;
          } else {
            lineStrokeWidth = rawWidth;
          }
        }else{
          lineStrokeWidth = 5;
        }

        const heightMatch = spec.match(/height\s*=\s*([^,\)\s]+)/);
        if (heightMatch) {
          const rawHeight = heightMatch[1].trim();
          const asNum = Number(rawHeight);
          if (!Number.isNaN(asNum)) {
            height = asNum;
          } else {
            height = rawHeight;
          }
        } else {
          height = 'red'; // Default value, consistent with original parsing logic
        }

        const lineOpacityMatch = spec.match(/opacity\s*=\s*([^,\)\s]+)/);
        if (lineOpacityMatch) {
          const raw = lineOpacityMatch[1].trim();
          const asNum = Number(raw);

          if (!Number.isNaN(asNum)) {
            strokeOpacity = asNum;
          } else {
            strokeOpacity = raw;
          }
        } else {
          strokeOpacity = 1;
        }
      }

      let background, streetName, streetColor;
      const mapMatch = spec.match(/\.map\(([^)]+)\)/);
      if (mapMatch) {
        const mapContent = mapMatch[1];

        const bgMatch = mapContent.match(/background\s*=\s*([^,]+)/);
        if (bgMatch) {
          background = bgMatch[1].trim();
        }

        const snMatch = mapContent.match(/street-name\s*=\s*([^,]+)/);
        if (snMatch) {
          streetName = snMatch[1].trim();
        }

        const scMatch = mapContent.match(/street-color\s*=\s*([^,]+)/);
        if (scMatch) {
          streetColor = scMatch[1].trim();
        }
      }

      if (method === 'point') {
        const xMatch = spec.match(/x\s*=\s*"([^"]+)"/);
        xField = xMatch ? xMatch[1] : undefined; // Default to undefined
        const yMatch = spec.match(/y\s*=\s*"([^"]+)"/);
        yField = yMatch ? yMatch[1] : undefined; // Default to undefined
        const colorMatch = spec.match(/color\s*=\s*"([^"]+)"/);
        pointColor = colorMatch ? colorMatch[1] : 'red';
      }

      let chart: any | undefined;
      const chartMatch = spec.match(/\.chart\(([\s\S]*?)\)\s*\.orientation/);
      if (chartMatch) {
        try {
          const chartContent = chartMatch[1];
          chart = JSON.parse(chartContent);
        } catch (error) {
          console.error('Failed to parse Vega-Lite spec inside `.chart()`: ', error);
        }
      }

      let orientation: string | undefined;
      const orientationMatch = spec.match(/\.orientation\(\s*([^,\)\s]+)\s*\)/);
      if (orientationMatch) {
        orientation = orientationMatch[1];
      }else{
        orientation = 'parallel';
      }

      let alignment: string | undefined;
      const alignmentMatch = spec.match(/\.alignment\(\s*([^,\)\s]+)\s*\)/);
      if (alignmentMatch) {
        alignment = alignmentMatch[1];
      }else{
        alignment = 'left';
      }

      let roadDirection: string |undefined;
      let address: string |undefined;
      let roadRadius: number | undefined;
      let radiusUnit: string |undefined;
      let streetWidth: number |undefined;

      const queryMatch = spec.match(/\.query\(([^)]+)\)/);
      if (queryMatch) {
        const queryContent = queryMatch[1];

        const rdMatch = queryContent.match(/road direction\s*=\s*([^,]+)/);
        if (rdMatch) {
          roadDirection = rdMatch[1].trim();
        }

        const addressMatch = queryContent.match(/address\s*=\s*"([^"]+)"/);
        if (addressMatch) {
          address = addressMatch[1].trim();
        }

        const radiusMatch = queryContent.match(/radius\s*=\s*(\d+(?:\.\d+)?)\s*([a-zA-Z]+)/);
        if (radiusMatch) {
          const raw = radiusMatch[1];
          const asNum = Number(raw);
          if (!Number.isNaN(asNum)) {
            roadRadius = asNum;
          } else {
            roadRadius = undefined;
          }
          radiusUnit = radiusMatch[2].trim();
        }

        const streetWidthMatch = queryContent.match(/street_width\s*=\s*(\d+(?:\.\d+)?)/);
        if (streetWidthMatch) {
          streetWidth = parseFloat(streetWidthMatch[1].trim());
        }
      }

      return {
        method,
        shape,
        unit,
        unitDivide,
        zoom,
        radius,
        blur,
        fillAttribute,
        strokeColor,
        strokeWidth,
        fillOpacity,
        strokeOpacity,
        domain,
        range,
        lineColor,
        lineType,
        lineTypeVal,
        lineStrokeWidth,
        height,
        xField,
        yField,
        pointColor,
        chart,
        orientation,
        alignment,
        physicalLayerPath,
        thematicLayerPath,
        spatialRelation,
        operation,
        AggregationType,
        bufferValue,
        roadDirection,
        address,
        roadRadius,
        radiusUnit,
        background,
        streetName,
        streetColor,
        streetWidth,
        methodRow,
        methodColumn,
        colorScheme, // Include colorScheme
        valueField,   // Include valueField
      };
    } catch (error) {
      console.error('Failed to parse the specification:', error);
      return null;
    }
  };