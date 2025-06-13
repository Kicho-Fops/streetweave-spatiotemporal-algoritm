import React, { useState, useRef } from 'react';
import TextEditor from './TextEditor';
import MapVisualization from './MapVisualization';
import './App.css';
import { parseSpecification, ParsedSpec } from '@streetweave/parser';

const App: React.FC = () => {
  const [parsedSpec, setParsedSpec] = useState<ParsedSpec[]>([]);
  const applyFlag = useRef(0);

  const applySpec = (spec: string) => {
    const parsedLayers = parseSpecification(spec);
    if (parsedLayers.length > 0) {
      setParsedSpec(parsedLayers);
      applyFlag.current = 1;
    }
  };

  return (
    <div className="grid-container">
      <div className="grid-item editor">
        <TextEditor onApply={applySpec} />
      </div>
      <div className="grid-item visualization">
        {parsedSpec.length > 0 && (
          <MapVisualization parsedSpec={parsedSpec} applyFlag={applyFlag.current} />
        )}
      </div>
    </div>
  );
};

export default App;