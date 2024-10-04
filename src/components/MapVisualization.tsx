import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as d3 from 'd3';

interface ParsedSpec {
  geojsonPath: string;
  method: string;
  unit: string;
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

const MapVisualization: React.FC<{ parsedSpec: ParsedSpec }> = ({ parsedSpec }) => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (mapRef.current) {
      let Lat, Lon;
        let initialZoom;
        if(parsedSpec.unit=="segment"){
          initialZoom = 19;
          Lat = 41.80159035804221, Lon = -87.64538029790135;
        } else if(parsedSpec.unit=="area"){
          initialZoom = 10;
          Lat = 41.8781, Lon = -87.6298;
        } else{
          initialZoom = 19;
          Lat = 41.80159035804221, Lon = -87.64538029790135;
        }
      if (!mapInstanceRef.current) {
        // Initial map creation with default or initial zoom level
        mapInstanceRef.current = L.map(mapRef.current).setView([Lat, Lon], initialZoom); // Chicago coordinates
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors'
        }).addTo(mapInstanceRef.current);
      } else {
        // Update zoom level dynamically when the unit changes
        const newZoom = parsedSpec.unit === 'segment' ? 19 : 10;
        mapInstanceRef.current.setView([Lat, Lon], newZoom);
      }
    }
  }, [parsedSpec.unit]); // Depend on the unit so zoom level updates when unit changes

  const applyOpacity = (type: 'fill' | 'stroke' | 'line'): number => {
    if (type === 'line' && parsedSpec.strokeOpacity === undefined) {
      return Math.random(); // Random value between 0 and 1
    }
    if (type === 'line' && parsedSpec.strokeOpacity !== undefined) {
      return parsedSpec.strokeOpacity;
    }
    if (type === 'fill' && parsedSpec.fillOpacity !== undefined) {
      return parsedSpec.fillOpacity;
    } else if (type === 'stroke' && parsedSpec.strokeOpacity !== undefined) {
      return parsedSpec.strokeOpacity;
    }
    return type === 'fill' ? 0.7 : 1; // Default opacities
  };

  useEffect(() => {
    if (mapInstanceRef.current && parsedSpec.geojsonPath) {
      console.log("Parsed Spec:", parsedSpec);

      // Handle the `line` method
      if (parsedSpec.method === 'line') {
        d3.json(parsedSpec.geojsonPath).then(function (data: any) {
          if (data && data.edges) {
            mapInstanceRef.current?.eachLayer((layer) => {
              if (!(layer instanceof L.TileLayer)) {
                mapInstanceRef.current?.removeLayer(layer);
              }
            });

            L.svg().addTo(mapInstanceRef.current);
            const svgLayer = d3.select(mapInstanceRef.current.getPanes().overlayPane).select("svg");
            const g = svgLayer.append("g").attr("class", "leaflet-zoom-hide");

            const lineGenerator = d3.line<any>()
              .x((d: any) => mapInstanceRef.current?.latLngToLayerPoint(new L.LatLng(d.lat, d.lon)).x)
              .y((d: any) => mapInstanceRef.current?.latLngToLayerPoint(new L.LatLng(d.lat, d.lon)).y);

            data.edges.forEach((edge: any) => {
              let start_lat = edge[0]["lat"];
              let start_lon = edge[0]["lon"];
              let end_lat = edge[1]["lat"];
              let end_lon = edge[1]["lon"];

              const points = [
                { "lat": start_lat, "lon": start_lon },
                { "lat": end_lat, "lon": end_lon }
              ];

              let lineColor: string | null = null;
              const randomValue = getRandomValueFromRange(parsedSpec.lineColor || '');

              if (randomValue !== null) {
                const colorScale = d3.scaleSequential(d3.interpolateInferno).domain([0, 10]);
                lineColor = colorScale(randomValue);
              } else {
                lineColor = parsedSpec.lineColor || 'red';
              }

              let dashArray: string | null = null;
              if (parsedSpec.lineType === 'dashed') {
                const dashRandomValue = getRandomValueFromRange(parsedSpec.lineTypeVal || '');
                dashArray = dashRandomValue !== null && dashRandomValue < 5 ? '5, 5' : '15, 10';
              }

              g.append("path")
                .datum(points)
                .attr("d", lineGenerator)
                .style("stroke", lineColor)
                .style("stroke-width", 5)
                .style("stroke-opacity", applyOpacity('line'))
                .style("stroke-dasharray", dashArray || null)
                .attr("fill", "none");
            });

            function updateLines() {
              g.selectAll("path")
                .attr("d", lineGenerator);
            }

            mapInstanceRef.current.on("moveend", updateLines);
          } else {
            console.error("Data is missing edges or is invalid.");
          }
        }).catch(error => {
          console.error("Failed to load JSON data:", error);
        });
      }

      // Handle the original `fill` method
      else if (parsedSpec.method === 'fill') {
        d3.json(parsedSpec.geojsonPath).then(function (geojsonData) {
          if (geojsonData && geojsonData.features) {
            mapInstanceRef.current?.eachLayer((layer) => {
              if (!(layer instanceof L.TileLayer)) {
                mapInstanceRef.current?.removeLayer(layer);
              }
            });

            let colorScale;

            if (parsedSpec.domain && parsedSpec.range) {
              colorScale = d3.scaleThreshold()
                .domain(parsedSpec.domain)
                .range(parsedSpec.range);
            } else {
              colorScale = d3.scaleSequential(d3.interpolateBlues)
                .domain(d3.extent(geojsonData.features, function (d: any) {
                  return d.properties[parsedSpec.fillAttribute];
                }));
            }

            function style(feature: any) {
              return {
                fillColor: colorScale(feature.properties[parsedSpec.fillAttribute]),
                fillOpacity: applyOpacity('fill'),
                weight: parsedSpec.strokeWidth,
                color: parsedSpec.strokeColor || 'black',
                opacity: applyOpacity('stroke'),
              };
            }

            L.geoJSON(geojsonData, { style: style }).addTo(mapInstanceRef.current);
          } else {
            console.error("GeoJSON data is missing features or is invalid.");
          }
        }).catch(error => {
          console.error("Failed to load GeoJSON data:", error);
        });
      }
    }
  }, [parsedSpec]);

  return <div ref={mapRef} id="map" style={{ height: '100%', width: '100%' }}></div>;
};

export default MapVisualization;


//LAST THAT WORK!!