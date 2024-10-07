import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as d3 from 'd3';
import 'leaflet.heat'; // Import the heatmap plugin

interface ParsedSpec {
  geojsonPath: string;
  method: string;
  unit: string;
  zoom: number;
  radius?: number;
  blur?: number;
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
}

// Helper function to parse rand[min,max] and return a random value between min and max
const getRandomValueFromRange = (expression: string): number | null => {
  const randMatch = expression.match(/rand\[(\d+),(\d+)\]/);
  if (randMatch) {
    const min = parseFloat(randMatch[1]);
    const max = parseFloat(randMatch[2]);
    return min + Math.random() * (max - min); // Random value between min and max
  }
  return null;
};

// Apply opacity based on the type (fill, stroke, line) and layer specification
const applyOpacity = (type: 'fill' | 'stroke' | 'line', layerSpec: ParsedSpec): number => {
  if (type === 'line' && layerSpec.strokeOpacity === undefined) {
    return Math.random(); // Random value between 0 and 1
  }
  if (type === 'line' && layerSpec.strokeOpacity !== undefined) {
    return layerSpec.strokeOpacity;
  }
  if (type === 'fill' && layerSpec.fillOpacity !== undefined) {
    return layerSpec.fillOpacity;
  } else if (type === 'stroke' && layerSpec.strokeOpacity !== undefined) {
    return layerSpec.strokeOpacity;
  }
  return type === 'fill' ? 0.7 : 1; // Default opacities
};

const MapVisualization: React.FC<{ parsedSpec: ParsedSpec[] }> = ({ parsedSpec }) => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  
  // Store references to the current layers (for lines, fill, heatmap)
  const currentLayersRef = useRef<L.Layer[]>([]);

  // Initialize the map on the first render
  useEffect(() => {
    if (mapRef.current) {
      let Lat = 41.8781;
      let Lon = -87.6298;

      if (!mapInstanceRef.current) {
        // Initial map creation
        mapInstanceRef.current = L.map(mapRef.current).setView([Lat, Lon], parsedSpec[0].zoom); // Use zoom of first layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors',
        }).addTo(mapInstanceRef.current);
      }
    }
  }, [parsedSpec]);

  // Clear previous visualizations and render the new one
  useEffect(() => {
    if (mapInstanceRef.current) {
      // Remove existing layers from the map
      currentLayersRef.current.forEach(layer => mapInstanceRef.current!.removeLayer(layer));
      currentLayersRef.current = []; // Reset the layer reference

      parsedSpec.forEach((layerSpec, index) => {
        if (layerSpec.method === 'line') {
          d3.json(layerSpec.geojsonPath).then(function (data: any) {
            if (data && data.edges) {
              mapInstanceRef.current?.eachLayer((layer) => {
                if (!(layer instanceof L.TileLayer)) {
                  mapInstanceRef.current?.removeLayer(layer);
                }
              });
              // Create a new SVG layer for lines
              const svgLayer = L.svg().addTo(mapInstanceRef.current!);
              const svgGroup = d3.select(mapInstanceRef.current!.getPanes().overlayPane).select("svg").append("g").attr("class", "leaflet-zoom-hide");

              const lineGenerator = d3.line<any>()
                .x((d: any) => mapInstanceRef.current!.latLngToLayerPoint(new L.LatLng(d.lat, d.lon)).x)
                .y((d: any) => mapInstanceRef.current!.latLngToLayerPoint(new L.LatLng(d.lat, d.lon)).y);

              data.edges.forEach((edge: any) => {
                const points = [
                  { lat: edge[0].lat, lon: edge[0].lon },
                  { lat: edge[1].lat, lon: edge[1].lon }
                ];

                let lineColor = layerSpec.lineColor || 'red'; 
                const randomValue = getRandomValueFromRange(layerSpec.lineColor || '');

                if (randomValue !== null) {
                  const colorScale = d3.scaleSequential(d3.interpolateInferno).domain([0, 10]);
                  lineColor = colorScale(randomValue);
                }

                let dashArray = null;
                if (layerSpec.lineType === 'dashed') {
                  const dashRandomValue = getRandomValueFromRange(layerSpec.lineTypeVal || '');
                  dashArray = dashRandomValue !== null && dashRandomValue < 5 ? '5, 5' : '15, 10';
                }

                svgGroup.append("path")
                  .datum(points)
                  .attr("d", lineGenerator)
                  .style("stroke", lineColor)
                  .style("stroke-width", 5)
                  .style("stroke-opacity", applyOpacity('line', layerSpec))
                  .style("stroke-dasharray", dashArray || null)
                  .attr("fill", "none");

                function updateLines() {
                  svgGroup.selectAll("path")
                    .attr("d", lineGenerator);
                }
                mapInstanceRef.current!.on("moveend", updateLines);
              });

              // Add the SVG layer to the reference list for later removal
              currentLayersRef.current.push(svgLayer);
            } else {
              console.error("Data is missing edges or is invalid.");
            }
          }).catch(error => {
            console.error("Failed to load JSON data:", error);
          });
        }

        // Handle the `fill` method
        else if (layerSpec.method === 'fill') {
          d3.json(layerSpec.geojsonPath).then(function (geojsonData) {
            if (geojsonData && geojsonData.features) {
              let colorScale;

              if (layerSpec.domain && layerSpec.range) {
                colorScale = d3.scaleThreshold()
                  .domain(layerSpec.domain)
                  .range(layerSpec.range);
              } else {
                colorScale = d3.scaleSequential(d3.interpolateBlues)
                  .domain(d3.extent(geojsonData.features, function (d: any) {
                    return d.properties[layerSpec.fillAttribute];
                  }));
              }

              function style(feature: any) {
                return {
                  fillColor: colorScale(feature.properties[layerSpec.fillAttribute]),
                  fillOpacity: applyOpacity('fill', layerSpec),
                  weight: layerSpec.strokeWidth,
                  color: layerSpec.strokeColor || 'black',
                  opacity: applyOpacity('stroke', layerSpec),
                };
              }

              const geoJsonLayer = L.geoJSON(geojsonData, { style: style }).addTo(mapInstanceRef.current!);

              // Add the geoJsonLayer to the reference list for later removal
              currentLayersRef.current.push(geoJsonLayer);
            } else {
              console.error("GeoJSON data is missing features or is invalid.");
            }
          }).catch(error => {
            console.error("Failed to load GeoJSON data:", error);
          });
        }

        // Handle the heatmap method
        else if (layerSpec.method === 'heatmap') {
          d3.json(layerSpec.geojsonPath).then((data: any) => {
            if (data && Array.isArray(data)) {
              const heatData = data.map((point: any) => [
                point.lat, point.lon, point.value
              ]);

              const heatmapLayer = (L as any).heatLayer(heatData, {
                radius: layerSpec.radius || 25,
                blur: layerSpec.blur || 15,
                maxZoom: 17,
              }).addTo(mapInstanceRef.current!);

              // Add the heatmapLayer to the reference list for later removal
              currentLayersRef.current.push(heatmapLayer);
            } else {
              console.error('Data is missing or not in the expected format.');
            }
          }).catch(error => {
            console.error('Failed to load heatmap data:', error);
          });
        }
      });
    }
  }, [parsedSpec]);

  return <div ref={mapRef} id="map" style={{ height: '100%', width: '100%' }}></div>;
};

export default MapVisualization;

//That works Last
