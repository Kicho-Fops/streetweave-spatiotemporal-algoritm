import React, { useEffect } from 'react';
import './MapVisualization.css';
import { ParsedSpec } from 'streetweave'

interface MapVisualizationProps {
  parsedSpec: ParsedSpec[];
  applyFlag: React.MutableRefObject<number>;
}

const MapVisualization: React.FC<MapVisualizationProps> = ({ parsedSpec, applyFlag }) => {
  useEffect(() => {
    if (applyFlag.current === 1) {
      // Re-render map with parsedSpec here
      console.log('Rendering map with spec:', parsedSpec);
      applyFlag.current = 0;
    }
  }, [parsedSpec, applyFlag]);

  return (
    <div id="map">
      <p>Map visualization goes here.</p>
    </div>
  );
};

export default MapVisualization;
