import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as d3 from 'd3';
import 'leaflet.heat'; // Import the heatmap plugin
import vegaEmbed from 'vega-embed';
import * as turf from '@turf/turf';

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
  xField?: string;
  yField?: string;
  pointColor?: string;
  chart?: any;      // Vega-Lite spec
  orientation?: string;  // Orientation of the chart
  alignment?: string;    // Alignment of the chart
  physicalLayerPath?: string;
  thematicLayerPath?: string;
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


/////// Here the Aggregation Function Implementation-->>>

// 1. CONTAINS FILL METHOD-->
function aggregationContains(geojsonData, thematicData, aggregationType, parsedSpec) {
  geojsonData.features.forEach(function (feature) {
    const polygon = feature.geometry;

    // Find all points that fall within the current MultiPolygon
    const pointsInPolygon = thematicData.filter(function (point) {
      const [lon, lat] = [point.Lon, point.Lat];
      const pointCoordinates = [lon, lat];
      return d3.polygonContains(polygon.coordinates[0][0], pointCoordinates);
    });

    // Initialize aggregation results for each attribute
    const attributes = ["temperature", "PM2_5", "CO", "CO2", "humidity", "wind", "traffic", "Ozone", "N2O"];
    let aggregatedValues = {};

    attributes.forEach((attr) => {
      const values = pointsInPolygon.map((point) => point[attr]);

      if (aggregationType === 'sum') {
        aggregatedValues[attr] = d3.sum(values);
      } else if (aggregationType === 'mean') {
        aggregatedValues[attr] = d3.mean(values);
      } else if (aggregationType === 'min') {
        aggregatedValues[attr] = d3.min(values);
      } else if (aggregationType === 'max') {
        aggregatedValues[attr] = d3.max(values);
      }
    });

    // Add the aggregated values to the feature properties
    feature.properties = {
      ...feature.properties,
      ...aggregatedValues
    };
  });
  // console.log("function data check: ", geojsonData)

  return geojsonData;
}
/////////

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
        console.log("Initial Checking", layerSpec)
        d3.selectAll('.vega-lite-svg').remove();
        // Remove 'move' and 'zoom' event listeners
        mapInstanceRef.current.off('move zoom');

        if (layerSpec.unit === 'segment'){
          if (layerSpec.method === 'line') {
            d3.json(layerSpec.physicalLayerPath).then(function (data: any) {
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
  
                  // Set line color based on attribute value or specific color
                  let lineColor = layerSpec.lineColor || "red";
                  const attributeIndex = edge.findIndex((e: any) => e.hasOwnProperty(lineColor));
                  if (attributeIndex !== -1) {
                    const attributeValues = data.edges
                      .flatMap((e: any) => e.filter((entry: any) => entry.hasOwnProperty(lineColor)).map((entry: any) => entry[lineColor]))
                      .filter((v: any) => v !== undefined);
                    const minValue = d3.min(attributeValues);
                    const maxValue = d3.max(attributeValues);
                    const attributeValue = edge[attributeIndex][lineColor];
                    if (minValue !== undefined && maxValue !== undefined && attributeValue !== undefined) {
                      const colorScale = d3.scaleSequential(d3.interpolateInferno).domain([minValue, maxValue]);
                      lineColor = colorScale(attributeValue);
                    }
                  }

                  ///line random color-->
                  // const randomValue = getRandomValueFromRange(layerSpec.lineColor || '');
                  // if (randomValue !== null) {
                  //   const colorScale = d3.scaleSequential(d3.interpolateInferno).domain([0, 10]);
                  //   lineColor = colorScale(randomValue);
                  // }


                  // Set opacity based on attribute value or specific value
                  let lineOpacity = layerSpec.strokeOpacity || 1;
                  // console.log('lineOpacity check:', lineOpacity)
                  if (typeof lineOpacity === "number" && lineOpacity >= 0 && lineOpacity <= 1) {
                    // Directly use the specified opacity value if it's between 0 and 1
                    lineOpacity = lineOpacity;
                  } else if (typeof lineOpacity === "string") {
                    // Treat lineOpacity as an attribute name and map its values from 0 to 1
                    const opacityIndex = edge.findIndex((e: any) => e.hasOwnProperty(lineOpacity));
                    if (opacityIndex !== -1) {
                      const attributeValues = data.edges
                        .flatMap((e: any) => e.filter((entry: any) => entry.hasOwnProperty(lineOpacity)).map((entry: any) => entry[lineOpacity]))
                        .filter((v: any) => v !== undefined);
                      const minValue = d3.min(attributeValues);
                      const maxValue = d3.max(attributeValues);
                      const attributeValue = edge[opacityIndex][lineOpacity];
                      if (minValue !== undefined && maxValue !== undefined && attributeValue !== undefined) {
                        const opacityScale = d3.scaleLinear().domain([minValue, maxValue]).range([0, 1]);
                        lineOpacity = opacityScale(attributeValue);
                      }
                    }
                  }
                  
  
                  // let dashArray = null;
                  // if (layerSpec.lineType === 'dashed') {
                  //   const dashRandomValue = getRandomValueFromRange(layerSpec.lineTypeVal || '');
                  //   dashArray = dashRandomValue !== null && dashRandomValue < 5 ? '5, 5' : '15, 10';
                  // }

                  // Set dashed line style based on attribute value
                  let dashArray = null;
                  if (layerSpec.lineType === "dashed" && layerSpec.lineTypeVal) {
                    const dashIndex = edge.findIndex((e: any) => e.hasOwnProperty(layerSpec.lineTypeVal));
                    if (dashIndex !== -1) {
                      const attributeValue = edge[dashIndex][layerSpec.lineTypeVal];
                      if (attributeValue !== undefined) {
                        const minValue = layerSpec.dashMin;
                        const maxValue = layerSpec.dashMax;
                        if (attributeValue < minValue + (maxValue - minValue) / 3) {
                          dashArray = "5, 5";
                        } else if (
                          attributeValue >= minValue + (maxValue - minValue) / 3 &&
                          attributeValue < minValue + (2 * (maxValue - minValue)) / 3
                        ) {
                          dashArray = "10, 10";
                        } else {
                          dashArray = "15, 10";
                        }
                      }
                    }
                  }
  
                  svgGroup.append("path")
                    .datum(points)
                    .attr("d", lineGenerator)
                    .style("stroke", lineColor)
                    .style("stroke-width", 5)
                    .style("stroke-opacity", lineOpacity)
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
          else if(layerSpec.chart){
            // console.log(layerSpec)
            d3.json(layerSpec.geojsonPath).then((data: any) => {
              if (data && data.edges){
                mapInstanceRef.current?.eachLayer((layer) => {
                  if (!(layer instanceof L.TileLayer)) {
                    mapInstanceRef.current?.removeLayer(layer);
                  }
                });
  
                vegaEmbed('#vis', layerSpec.chart, {renderer: 'svg', actions: false}).then(result => {
                  const vegaSVG = result.view._el.querySelector('svg');
                  const svgWidth = 150;
                  const svgHeight = 70;
  
                  // console.log(vegaSVG)
                  data.edges.forEach(edge => {
                    const start = edge[0];
                    const end = edge[1];
                    let angle = edge[2].Bearing + 90;
                    const midpoint = { lat: (start.lat + end.lat) / 2, lon: (start.lon + end.lon) / 2 };
                    if(layerSpec.orientation=='perpendicular'){
                      angle = angle + 90;
                    }
  
                    const updateSvgPosition = () => {
                      const point = mapInstanceRef.current!.latLngToLayerPoint([midpoint.lat, midpoint.lon]);
                      // const tempID = `t${midpoint.lat}${midpoint.lon}`.replace('.', '').replace('-', '') + 'svg';
                      const tempID = 't' + (midpoint.lat + midpoint.lon + '').replace('.', '').replace('-', '') + 'svg';
                      // const temp = d3.select(mapInstanceRef.current!.getPanes().overlayPane).select(`#${tempID}`);
                      const temp = d3.select(mapInstanceRef.current!.getPanes().overlayPane).select('#' + tempID);
                      // console.log(temp)
  
                      if (temp.empty()) {
                        d3.select(mapInstanceRef.current!.getPanes().overlayPane)
                          .append('svg')
                          .attr('class', 'vega-lite-svg')
                          .attr('id', tempID)
                          .attr('width', svgWidth)
                          .attr('height', svgHeight)
                          .attr('transform', `translate(${point.x - svgWidth / 2}, ${point.y - svgHeight / 2}) rotate(${angle}, -5, -5)`)
                          .node()
                          .appendChild(vegaSVG.cloneNode(true));
                      } else {
                        temp.attr('transform', `translate(${point.x - svgWidth / 2}, ${point.y - svgHeight / 2}) rotate(${angle}, -5, -5)`);
                      }
                    };
  
                    updateSvgPosition();
                    mapInstanceRef.current!.on('move zoom', updateSvgPosition);
                  })
                })
              }
            })
          }
        }
        else if(layerSpec.unit === 'node'){
          let nodesSet = new Set();
          let NodesList = [];
          if(layerSpec.chart){
            // console.log(layerSpec)
            d3.json(layerSpec.geojsonPath).then((data: any) => {
              if (data && data.edges){
                mapInstanceRef.current?.eachLayer((layer) => {
                  if (!(layer instanceof L.TileLayer)) {
                    mapInstanceRef.current?.removeLayer(layer);
                  }
                });

                // console.log('data check: ', data)
                const edges = data.edges;

                edges.forEach(edge => {
                  // The first two elements in each edge contain the lat, lon information
                  const firstNode = edge[0];
                  const secondNode = edge[1];

                  // Create a unique string representation for each lat, lon pair
                  const firstNodeKey = `${firstNode.lat},${firstNode.lon}`;
                  const secondNodeKey = `${secondNode.lat},${secondNode.lon}`;

                  // Check if the node is unique and add it to the NodesList
                  if (!nodesSet.has(firstNodeKey)) {
                      nodesSet.add(firstNodeKey);
                      NodesList.push([firstNode.lat, firstNode.lon]);
                  }

                  if (!nodesSet.has(secondNodeKey)) {
                      nodesSet.add(secondNodeKey);
                      NodesList.push([secondNode.lat, secondNode.lon]);
                  }
                });

                // NodesList.forEach(NodePoint => {
                //   console.log("each point:", NodePoint[0], NodePoint[1])
                // })
  
                vegaEmbed('#vis', layerSpec.chart, {renderer: 'svg', actions: false}).then(result => {
                  const vegaSVG = result.view._el.querySelector('svg');
                  const svgWidth = 100;
                  const svgHeight = 100;
  
                  // console.log(vegaSVG)
                  NodesList.forEach(NodePoint => {
                    const midpoint = { lat: NodePoint[0], lon: NodePoint[1] };
                    // if(layerSpec.orientation=='perpendicular'){
                    //   angle = angle + 90;
                    // }
  
                    const updateSvgPosition = () => {
                      const point = mapInstanceRef.current!.latLngToLayerPoint([midpoint.lat, midpoint.lon]);
                      // const tempID = `t${midpoint.lat}${midpoint.lon}`.replace('.', '').replace('-', '') + 'svg';
                      const tempID = 't' + (midpoint.lat + midpoint.lon + '').replace('.', '').replace('-', '') + 'svg';
                      // const temp = d3.select(mapInstanceRef.current!.getPanes().overlayPane).select(`#${tempID}`);
                      const temp = d3.select(mapInstanceRef.current!.getPanes().overlayPane).select('#' + tempID);
                      // console.log(temp)
  
                      if (temp.empty()) {
                        d3.select(mapInstanceRef.current!.getPanes().overlayPane)
                          .append('svg')
                          .attr('class', 'vega-lite-svg')
                          .attr('id', tempID)
                          .attr('width', svgWidth)
                          .attr('height', svgHeight)
                          .attr('transform', `translate(${point.x - svgWidth / 2}, ${point.y - svgHeight / 2})`)
                          .node()
                          .appendChild(vegaSVG.cloneNode(true));
                      } else {
                        temp.attr('transform', `translate(${point.x - svgWidth / 2}, ${point.y - svgHeight / 2})`);
                      }
                    };
  
                    updateSvgPosition();
                    mapInstanceRef.current!.on('move zoom', updateSvgPosition);
                  })
                })
              }
            })
          }
        }
        else if (layerSpec.unit === 'area'){
          // Handle the `fill` method
          if (layerSpec.method === 'fill') {
            let updatedGeoJsonData;
            d3.json(layerSpec.physicalLayerPath).then(function (geojsonData) {
              if (geojsonData && geojsonData.features) {
                d3.json(layerSpec.thematicLayerPath).then(function (thematicData){
                  updatedGeoJsonData = aggregationContains(geojsonData, thematicData, layerSpec.AggregationType, parsedSpec);
                  // console.log('updated Data Check: ', updatedGeoJsonData)
                  let colorScale;

                  if (layerSpec.domain && layerSpec.range) {
                    colorScale = d3.scaleThreshold()
                      .domain(layerSpec.domain)
                      .range(layerSpec.range);
                  } else {
                    colorScale = d3.scaleSequential(d3.interpolateBlues)
                      .domain(d3.extent(updatedGeoJsonData.features, function (d: any) {
                        return d.properties[layerSpec.fillAttribute];
                      }));
                  }

                  function style(feature: any) {
                    // console.log('checking if style get the right properties:', feature.properties)
                    return {
                      fillColor: colorScale(feature.properties[layerSpec.fillAttribute]),
                      fillOpacity: applyOpacity('fill', layerSpec),
                      weight: layerSpec.strokeWidth,
                      color: layerSpec.strokeColor || 'black',
                      opacity: applyOpacity('stroke', layerSpec),
                    };
                  }

                  const geoJsonLayer = L.geoJSON(updatedGeoJsonData, { style: style }).addTo(mapInstanceRef.current!);

                  // Add the geoJsonLayer to the reference list for later removal
                  currentLayersRef.current.push(geoJsonLayer);
                })
              } else {
                console.error("GeoJSON data is missing features or is invalid.");
              }
            }).catch(error => {
              console.error("Failed to load GeoJSON data:", error);
            });
          }

          // Handle the heatmap method
          else if (layerSpec.method === 'heatmap') {
            d3.json(layerSpec.thematicLayerPath).then((data: any) => {
              if (data && Array.isArray(data)) {
                const heatData = data.map((point: any) => [
                  point.Lat, point.Lon, point.temperature
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

          // Handle the `point` method
          else if (layerSpec.method === 'point') {
            d3.json(layerSpec.thematicLayerPath).then(function (data: any) {
              if (data && Array.isArray(data)) {
                // Parse the x and y fields (Lat and Lon)
                const xField = layerSpec.xField;
                const yField = layerSpec.yField;
                const pointColor = layerSpec.pointColor || 'red'; // Default to red if color is not specified

                data.forEach((d: any) => {
                  const lat = d[xField!]; // Assuming the xField is the latitude field
                  const lon = d[yField!]; // Assuming the yField is the longitude field

                  if (lat && lon) {
                    const marker = L.circleMarker([lat, lon], {
                      color: pointColor,
                      radius: 5, // Fixed radius for points
                    }).addTo(mapInstanceRef.current!);

                    // Add the point marker to the reference list for later removal
                    currentLayersRef.current.push(marker);
                  }
                });
              } else {
                console.error('Data is missing or not in the expected format.');
              }
            }).catch(error => {
              console.error("Failed to load point data:", error);
            });
          }
        }
      });
    }
  }, [parsedSpec]);

  // return <div ref={mapRef} id="map" style={{ height: '100%', width: '100%' }}></div>

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Map container */}
      <div ref={mapRef} id="map" style={{ height: '100%', width: '100%' }}></div>
      
      {/* Hidden Vega-Lite chart container */}
      <div id="vis" style={{ visibility: 'hidden', position: 'absolute', top: 0, left: 0, zIndex: -1 }}></div>
    </div>
  );
  
};

export default MapVisualization;
//That works Last