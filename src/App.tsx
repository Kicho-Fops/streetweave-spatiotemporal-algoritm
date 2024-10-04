import React, { useState } from 'react';
import './App.css';
import TextEditor from './components/TextEditor';
import MapVisualization from './components/MapVisualization';

interface ParsedSpec {
  geojsonPath: string;
  unit: string; // Added for unit parsing
  zoom: number;
  method: string;
  fillAttribute?: string;
  strokeColor?: string;
  strokeWidth?: number;
  fillOpacity?: number;
  strokeOpacity?: number;
  domain?: number[]; // Added for domain parsing
  range?: string[];  // Added for range parsing
  lineColor?: string; // Line color for line method
  lineType?: string;  // Line type (e.g., dashed)
  lineTypeVal?: string; // Value for line type, e.g., rand[0,10]
}

const App: React.FC = () => {
  const [parsedSpec, setParsedSpec] = useState<ParsedSpec | null>(null);

  // Function to parse the custom syntax from the text editor
  const parseSpecification = (spec: string): ParsedSpec | null => {
    try {

      // Parse unit (either area or segment)
      const unitMatch = spec.match(/unit\s*==\s*(\w+)/);
      const unit = unitMatch ? unitMatch[1] : 'area'; // Default to 'area' if not found

      // Parse geojson path
      const dataMatch = spec.match(/data\(([^)]+)\)/);
      const geojsonPath = dataMatch ? `/${dataMatch[1]}`.trim() : '';

      // Parse zoom level, if provided, otherwise default based on unit
      const zoomMatch = spec.match(/zoom\((\d+)\)/);
      const zoom = zoomMatch
        ? parseInt(zoomMatch[1], 10)
        : unit === 'segment' ? 19 : 10; // Default zoom: 19 for segment, 10 for area

      // Parse method (e.g., fill or line)
      const methodMatch = spec.match(/method\s*=\s*(\w+)/);
      const method = methodMatch ? methodMatch[1] : '';

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

      console.log('Parsed GeoJSON Path:', geojsonPath);
      console.log('Parsed Method:', method);
      if (method === 'fill') {
        console.log('Parsed Fill Attribute:', fillAttribute);
        console.log('Parsed Stroke Color:', strokeColor);
        console.log('Parsed Stroke Width:', strokeWidth);
        console.log('Parsed Fill Opacity:', fillOpacity);
        console.log('Parsed Stroke Opacity:', strokeOpacity);
        console.log('Parsed Domain:', domain);
        console.log('Parsed Range:', range);
      } else if (method === 'line') {
        console.log('Parsed Line Color:', lineColor);
        console.log('Parsed Line Type:', lineType);
        console.log('Parsed Line Type Value:', lineTypeVal);
        console.log('Parsed Stroke Opacity for line:', strokeOpacity);
      }

      // Return the parsed specification
      return {
        geojsonPath,
        method,
        unit, // Include the parsed unit
        zoom,
        fillAttribute,
        strokeColor,
        strokeWidth,
        fillOpacity,
        strokeOpacity,
        domain, // Include parsed domain
        range,  // Include parsed range
        lineColor,
        lineType,
        lineTypeVal
      };
    } catch (error) {
      console.error('Failed to parse the specification:', error);
      return null;
    }
  };

  // Function to handle applying the spec from the text editor
  const applySpec = (spec: string) => {
    const parsed = parseSpecification(spec);
    if (parsed) {
      setParsedSpec(parsed); // Pass the parsed spec to MapVisualization
    }
  };

  return (
    <div className="grid-container">
      <div className="grid-item editor">
        <TextEditor onApply={applySpec} />
      </div>
      <div className="grid-item visualization">
        {parsedSpec && <MapVisualization parsedSpec={parsedSpec} />}
      </div>
    </div>
  );
};

export default App;

//LAST THAT WORK!!