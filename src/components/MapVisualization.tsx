import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as d3 from 'd3';

interface ParsedSpec {
  geojsonPath: string;
  method: string;
  fillAttribute: string;
  strokeColor: string;
  strokeWidth: number;
}

interface MapVisualizationProps {
  parsedSpec: ParsedSpec;
}

const MapVisualization: React.FC<MapVisualizationProps> = ({ parsedSpec }) => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current) {
      // Initialize the Leaflet map
      mapInstanceRef.current = L.map(mapRef.current).setView([41.8781, -87.6298], 10); // Chicago coordinates
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
      }).addTo(mapInstanceRef.current);
    }
  }, []);

  useEffect(() => {
    if (mapInstanceRef.current && parsedSpec.geojsonPath) {
      console.log("Parsed Spec:", parsedSpec);

      // Load the specified GeoJSON data and update the map
      d3.json(parsedSpec.geojsonPath).then(function (geojsonData) {
        console.log("Loaded GeoJSON Data:", geojsonData);

        if (geojsonData && geojsonData.features) {
          // Remove existing layers
          mapInstanceRef.current?.eachLayer((layer) => {
            if (!(layer instanceof L.TileLayer)) {
              mapInstanceRef.current?.removeLayer(layer);
            }
          });

          // Handle different methods dynamically
          switch (parsedSpec.method) {
            case 'fill':
              // Create a color scale based on the specified fill attribute
              const colorScale = d3.scaleSequential(d3.interpolateBlues)
                .domain(d3.extent(geojsonData.features, function (d: any) {
                  return d.properties[parsedSpec.fillAttribute];
                }));

              console.log("Color Scale Domain:", colorScale.domain());

              // Define a style function for each feature (zipcode)
              function style(feature: any) {
                return {
                  fillColor: colorScale(feature.properties[parsedSpec.fillAttribute]),
                  weight: parsedSpec.strokeWidth,
                  color: parsedSpec.strokeColor,
                  fillOpacity: 0.7
                };
              }

              // Add the GeoJSON layer to the map
              L.geoJSON(geojsonData, { style: style }).addTo(mapInstanceRef.current);
              break;

            case 'otherMethod':
              // Handle other methods here
              console.log("Other method not yet implemented");
              break;

            default:
              console.error("Unknown method:", parsedSpec.method);
              break;
          }
        } else {
          console.error("GeoJSON data is missing features or is invalid.");
        }
      }).catch(error => {
        console.error("Failed to load GeoJSON data:", error);
      });
    }
  }, [parsedSpec]);

  return <div ref={mapRef} id="map" style={{ height: '100%', width: '100%' }}></div>;
};

export default MapVisualization;
