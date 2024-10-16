
import React, { useState } from 'react';
import './App.css';
import TextEditor from './components/TextEditor';
import MapVisualization from './components/MapVisualization';

interface ParsedSpec {
  name: string;
  // geojsonPath: string;
  unit: string;
  zoom: number;
  method: string;
  fillAttribute?: string;
  strokeColor?: string;
  strokeWidth?: number;
  fillOpacity?: number;
  strokeOpacity?: number;
  domain?: number[]; 
  range?: string[];  
  lineColor?: string; 
  lineType?: string;  
  lineTypeVal?: string; 
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
}

const App: React.FC = () => {
  const [parsedSpec, setParsedSpec] = useState<ParsedSpec[]>([]); // Support for multiple layers

  // Function to parse a single layer specification
  const parseSingleLayer = (spec: string): ParsedSpec | null => {
    try {
      // Parse unit (either area or segment)
      const unitMatch = spec.match(/unit\s*==\s*(\w+)/);
      const unit = unitMatch ? unitMatch[1] : 'area'; // Default to 'area' if not found

      // Parse geojson path
      // const dataMatch = spec.match(/data\(([^)]+)\)/);
      // const geojsonPath = dataMatch ? `/${dataMatch[1]}`.trim() : '';
      // Parse physical and thematic layer paths
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


      // Parse for `relation`
      let spatialRelation: string | undefined;
      let operation: string | undefined;
      let AggregationType: string | undefined;
      const relationMatch = spec.match(/relation\(([^)]+)\)/);
      if (relationMatch) {
        const relationContent = relationMatch[1].trim();
        const relationParts = relationContent.split(',').map(part => part.trim());

        relationParts.forEach(part => {
          const [key, value] = part.split('=').map(p => p.trim());
          if (key === 'spatialRelation') {
            spatialRelation = value;
          } else if (key === 'operation') {
            operation = value;
          } else if (key === 'type') {
            AggregationType = value;
          }
        });
      }


      // Parse zoom level, if provided, otherwise default based on unit
      const zoomMatch = spec.match(/zoom\((\d+)\)/);
      const zoom = zoomMatch
        ? parseInt(zoomMatch[1], 10)
        : unit === 'segment' ? 19 : 10; // Default zoom: 19 for segment, 10 for area

      // Parse method (e.g., fill or line)
      const methodMatch = spec.match(/method\s*=\s*(\w+)/);
      const method = methodMatch ? methodMatch[1] : '';

      let radius: number | undefined;
      let blur: number | undefined;

      // Parse for `heatmap` method with fixed radius and blur values
      if (method === 'heatmap') {
        const radiusMatch = spec.match(/radius\s*=\s*(\d+)/);
        radius = radiusMatch ? parseInt(radiusMatch[1], 10) : 25; // Default to 25 if not provided

        const blurMatch = spec.match(/blur\s*=\s*(\d+)/);
        blur = blurMatch ? parseInt(blurMatch[1], 10) : 15; // Default blur is 15
      }

      let fillAttribute = '';
      let strokeColor = 'black'; // Default stroke color
      let strokeWidth = 1;
      let fillOpacity: number | undefined;
      let strokeOpacity: number | undefined;
      let lineColor: string | undefined;
      let lineType: string | undefined;
      let lineTypeVal: string | undefined;
      let domain: number[] | undefined; // Added for domain
      let range: string[] | undefined;  // Added for range
      let xField: string | undefined;
      let yField: string | undefined;
      let pointColor: string | undefined;

      // Parse for `fill` method
      if (method === 'fill') {
        const fillMatch = spec.match(/color\((\w+)\)/);
        fillAttribute = fillMatch ? fillMatch[1] : '';

        // Parse stroke color and width
        const strokeColorMatch = spec.match(/stroke\(color\s*=\s*(\w+)/);
        strokeColor = strokeColorMatch ? strokeColorMatch[1] : 'black';
        const strokeWidthMatch = spec.match(/width\s*=\s*(\d+)/);
        strokeWidth = strokeWidthMatch ? parseInt(strokeWidthMatch[1], 10) : 1;

        // Parse fill opacity
        const fillOpacityMatch = spec.match(/(?:[^stroke]\s*)opacity\s*=\s*(\d*\.?\d+)/);
        fillOpacity = fillOpacityMatch ? parseFloat(fillOpacityMatch[1]) : undefined;

        // Parse stroke opacity
        const strokeOpacityMatch = spec.match(/stroke\(.*opacity\s*=\s*(\d*\.?\d+)/);
        strokeOpacity = strokeOpacityMatch ? parseFloat(strokeOpacityMatch[1]) : undefined;

        // Parse domain if provided
        const domainMatch = spec.match(/domain\(\[([^\]]+)\]\)/);
        domain = domainMatch ? domainMatch[1].split(',').map(Number) : undefined;

        // Parse range if provided
        const rangeMatch = spec.match(/range\(\[([^\]]+)\]\)/);
        range = rangeMatch ? rangeMatch[1].split(',').map(color => color.trim().replace(/['"]+/g, '')) : undefined;
      }

      // Parse for `line` method
      if (method === 'line') {
        // Parse line color (rand[min,max] or a specific color)
        const lineColorMatch = spec.match(/color\(([^)]+)\)/);
        lineColor = lineColorMatch ? lineColorMatch[1].trim() : 'red'; // Default to red

        // Parse line type (dashed, etc.)
        const lineTypeMatch = spec.match(/type\s*=\s*(\w+)\(([^)]+)\)/);
        if (lineTypeMatch) {
          lineType = lineTypeMatch[1];    // e.g., dashed
          lineTypeVal = lineTypeMatch[2]; // e.g., rand[0,10]
        }

        // Parse line opacity
        const lineOpacityMatch = spec.match(/opacity\s*=\s*(\d*\.?\d+)/);
        strokeOpacity = lineOpacityMatch ? parseFloat(lineOpacityMatch[1]) : undefined;
      }

       // Parse for `point` method
      if (method === 'point') {
        // Parse x and y positions for point data
        const xMatch = spec.match(/x\s*=\s*"([^"]+)"/);
        xField = xMatch ? xMatch[1] : '';

        const yMatch = spec.match(/y\s*=\s*"([^"]+)"/);
        yField = yMatch ? yMatch[1] : '';

        // Parse color for point
        const colorMatch = spec.match(/color\s*=\s*"([^"]+)"/);
        pointColor = colorMatch ? colorMatch[1] : 'red'; // Default to red
      }

      //chart spec
      let chart: any | undefined;
      const chartMatch = spec.match(/\.chart\(([\s\S]*?)\)\s*\.orientation/); // Match everything inside `.chart()` and before `.orientation`

      if (chartMatch) {
        try {
          const chartContent = chartMatch[1];
          chart = JSON.parse(chartContent); // Parse the JSON as Vega-Lite spec
        } catch (error) {
          console.error('Failed to parse Vega-Lite spec inside `.chart()`: ', error);
        }
      }


      // Parse orientation and alignment
      let orientation: string | undefined;
      const orientationMatch = spec.match(/\.orientation\(['"]([^'"]+)['"]\)/);
      if (orientationMatch) {
        orientation = orientationMatch[1];
      }

      let alignment: string | undefined;
      const alignmentMatch = spec.match(/\.alignment\(['"]([^'"]+)['"]\)/);
      if (alignmentMatch) {
        alignment = alignmentMatch[1];
      }
    

      // Return the parsed specification for this layer
      return {
        // geojsonPath,
        method,
        unit, 
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
        xField, 
        yField, 
        pointColor,
        chart,      // Parsed Vega-Lite spec
        orientation, // Parsed orientation
        alignment,
        physicalLayerPath,
        thematicLayerPath,
        spatialRelation,
        operation,
        AggregationType
      };
    } catch (error) {
      console.error('Failed to parse the specification:', error);
      return null;
    }
  };

  // Function to parse multiple layers
  const parseSpecification = (spec: string): ParsedSpec[] => {
    const layers = spec.split(/Layer\d+\s*=\s*/).filter(Boolean); // Split by "LayerX ="
    return layers.map(layerSpec => parseSingleLayer(layerSpec)).filter(Boolean) as ParsedSpec[];
  };

  // Function to handle applying the spec from the text editor
  const applySpec = (spec: string) => {
    const parsedLayers = parseSpecification(spec);
    if (parsedLayers.length > 0) {
      setParsedSpec(parsedLayers); // Set the parsed layers
    }
  };

  return (
    <div className="grid-container">
      <div className="grid-item editor">
        <TextEditor onApply={applySpec} />
      </div>
      <div className="grid-item visualization">
        {parsedSpec.length > 0 && <MapVisualization parsedSpec={parsedSpec} />}
      </div>
    </div>
  );
};

export default App;

//That works Last
