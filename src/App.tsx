import React, { useState } from 'react';
import './App.css';
import TextEditor from './components/TextEditor';
import MapVisualization from './components/MapVisualization';

interface ParsedSpec {
  geojsonPath: string;
  method: string;
  fillAttribute: string;
  strokeColor: string;
  strokeWidth: number;
}

const App: React.FC = () => {
  const [parsedSpec, setParsedSpec] = useState<ParsedSpec | null>(null);

  // Function to parse the custom syntax from the text editor
  const parseSpecification = (spec: string): ParsedSpec | null => {
    try {
      // Parse geojson path
      const dataMatch = spec.match(/data\(([^)]+)\)/);
      const geojsonPath = dataMatch ? `/${dataMatch[1]}`.trim() : '';

      // Parse method (e.g., fill or other)
      const methodMatch = spec.match(/method\s*=\s*(\w+)/);
      const method = methodMatch ? methodMatch[1] : '';

      // Parse fill attribute (e.g., totalPopulation)
      const fillMatch = spec.match(/color\((\w+)\)/);
      const fillAttribute = fillMatch ? fillMatch[1] : '';

      // Parse stroke color
      const strokeColorMatch = spec.match(/stroke\(color\s*=\s*(\w+)/);
      const strokeColor = strokeColorMatch ? strokeColorMatch[1] : 'black';

      // Parse stroke width
      const strokeWidthMatch = spec.match(/width\s*=\s*(\d+)/);
      const strokeWidth = strokeWidthMatch ? parseInt(strokeWidthMatch[1], 10) : 1;

      // Return the parsed specification
      return {
        geojsonPath,
        method,
        fillAttribute,
        strokeColor,
        strokeWidth,
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
