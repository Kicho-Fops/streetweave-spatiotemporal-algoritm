import React, { useState } from 'react';
import TextEditor from './components/TextEditor';
import MapVisualization from './components/MapVisualization';
import './App.css';
import { parseSpecification, ParsedSpec } from 'streetweave';

const App: React.FC = () => {
  const [parsedSpec, setParsedSpec] = useState<ParsedSpec[]>([]);

  const applySpec = (spec: string) => {
    const parsedLayers = parseSpecification(spec);
    if (parsedLayers.length > 0) {
      console.log("Specification:", parsedLayers[0]);
      setParsedSpec(parsedLayers);
    }
  };


  return (
    <div className="grid-container">
      <div className="grid-item editor">
        <TextEditor onApply={applySpec} />
      </div>
      <div className="grid-item visualization">
        {parsedSpec.length > 0 && (
          <MapVisualization parsedSpec={parsedSpec} />
        )}
      </div>
    </div>
  );
};

export default App;