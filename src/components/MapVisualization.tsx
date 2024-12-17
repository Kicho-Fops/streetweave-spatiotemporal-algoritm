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
  lineStrokeWidth?: string | number;
  xField?: string;
  yField?: string;
  pointColor?: string;
  chart?: any;      // Vega-Lite spec
  orientation?: string;  // Orientation of the chart
  alignment?: string;    // Alignment of the chart
  physicalLayerPath?: string;
  thematicLayerPath?: string;
  spatialRelation?: string;
  operation?: string;
  AggregationType?: string;
  bufferValue?: number;
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
function aggregationContains(geojsonData, thematicData, aggregationType, UnitVal) {
  if(UnitVal == 'area'){
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
  } else if(UnitVal == 'segment'){
    // console.log('check if data is passed to the function:', geojsonData)
    const bboxWidth = 5000;
    const aggregatedEdges = geojsonData.edges.map( edge => {
      const pointA = [edge[0].lon, edge[0].lat];
      const pointB = [edge[1].lon, edge[1].lat];

      // console.log('check point a b', pointA, pointB)

      // Create a bounding box polygon around the edge with the given width
      const line = turf.lineString([pointA, pointB]);
      const bbox = turf.buffer(line, bboxWidth, { units: 'meters' });

      // Collect all environmental points that fall within this bounding box
      const pointsInBoundingBox = thematicData.filter(point => {
          const thematicPoint = turf.point([point.Lon, point.Lat]);
          return turf.booleanPointInPolygon(thematicPoint, bbox);
      });

      // console.log('pointsInBoundingBox check:', pointsInBoundingBox)

      // Perform aggregation for each environmental attribute
      let aggregatedValues = [];
      const attributes = ["temperature", "PM2_5", "CO", "CO2", "humidity", "wind", "traffic", "Ozone", "N2O"];

      attributes.forEach(attr => {
        const values = pointsInBoundingBox.map(point => point[attr]);
        let aggregatedValue = 0;

        if (aggregationType === 'sum') {
          aggregatedValue = values.reduce((sum, val) => sum + val, 0);
        } else if (aggregationType === 'mean') {
          aggregatedValue = values.length ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
        } else if (aggregationType === 'min') {
          aggregatedValue = values.length ? Math.min(...values) : null;
        } else if (aggregationType === 'max') {
          aggregatedValue = values.length ? Math.max(...values) : null;
        }

        aggregatedValues.push({ [attr]: aggregatedValue });
      });

        // Construct the final data array for the edge
        let updatedEdge = [];

        // Add original edge properties as separate elements in the array
        updatedEdge.push(edge[0]); // Point A (lat, lon)
        updatedEdge.push(edge[1]); // Point B (lat, lon)
        updatedEdge.push(edge[2]); // Bearing
        updatedEdge.push(edge[3]); // Length

        // Add aggregated values as separate elements in the array
        aggregatedValues.forEach(value => {
            updatedEdge.push(value);
        });

        return updatedEdge;


    })
    
    return aggregatedEdges;
  }
}




// 2. Euclidian Distance METHOD-->
// Function to calculate the centroid of a multipolygon using Turf.js
const calculateCentroid = (geometry) => {
  const multiPolygon = turf.multiPolygon(geometry.coordinates);
  return turf.centroid(multiPolygon);
};

// Function to calculate the midpoint between two coordinates
function calculateMidpoint(coord1, coord2) {
  return {
      lat: (coord1.lat + coord2.lat) / 2,
      lon: (coord1.lon + coord2.lon) / 2
  };
}

// Function to calculate Euclidean distance between two points using Turf.js
const calculateDistance = (centroid, point) => {
  return turf.distance(centroid, point, { units: 'kilometers' });
};

// Function to calculate distances to all points and return them
const calculateDistances = (centroid, thematicData) => {
  return thematicData.map((point, index) => {
      const pointCoords = turf.point([point.Lon, point.Lat]);
      const distance = calculateDistance(centroid, pointCoords);
      return { index, distance };
  });
};

// Function to find the closest points based on distance
const findClosestPoints = (distances, thematicData, numberOfPoints = 100) => {
  distances.sort((a, b) => a.distance - b.distance);
  return distances.slice(0, numberOfPoints).map(d => thematicData[d.index]);
};


// Function to aggregate data based on type for area
const aggregateData = (points, aggregationType) => {
  const attributes = ["temperature", "PM2_5", "CO", "CO2", "humidity", "wind", "traffic", "Ozone", "N2O"];
  let aggregatedValues = {};

  attributes.forEach(attr => {
      const values = points.map(point => point[attr]);

      if (aggregationType === 'sum') {
          aggregatedValues[attr] = d3.sum(values);
      } else if (aggregationType === 'mean') {
          aggregatedValues[attr] = d3.mean(values);
      } else if (aggregationType === 'min') {
          aggregatedValues[attr] = d3.min(values);
      } else if (aggregationType === 'max') {
          aggregatedValues[attr] = d3.max(values);
      } else {
          aggregatedValues[attr] = 0; // Default case
      }
  });

  return aggregatedValues;
};


// Main function to create the new dataset using the modular functions for area
const createNewDataset = (geojsonData, thematicData, aggregationType) => {
  geojsonData.features.forEach(function (feature) {
      // Calculate centroid of the MultiPolygon
      const centroid = calculateCentroid(feature.geometry);

      // Calculate distances to all points in thematicData
      const distances = calculateDistances(centroid, thematicData);

      // Find the closest points based on distances
      const closestPoints = findClosestPoints(distances, thematicData);

      // Aggregate the data from the closest points
      const aggregatedValues = aggregateData(closestPoints, aggregationType);
      // console.log('check data geojsonData2', aggregatedValues)
      // Add the aggregated values to the feature properties
      feature.properties = {
          ...feature.properties,
          ...aggregatedValues
      };
  });

  return geojsonData; // Return the updated GeoJSON data
};


// Function to aggregate environmental data based on given points and aggregation type for segment line
function aggregateAttributes(points, aggregationType) {
  const attributes = ["temperature", "PM2_5", "CO", "CO2", "humidity", "wind", "traffic", "Ozone", "N2O"];
  let aggregatedValues = [];

  attributes.forEach(attr => {
      const values = points.map(point => point[attr]);
      let aggregatedValue = 0;

      if (aggregationType === 'sum') {
          aggregatedValue = values.reduce((sum, val) => sum + val, 0);
      } else if (aggregationType === 'mean') {
          aggregatedValue = values.length ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
      } else if (aggregationType === 'min') {
          aggregatedValue = values.length ? Math.min(...values) : null;
      } else if (aggregationType === 'max') {
          aggregatedValue = values.length ? Math.max(...values) : null;
      }

      aggregatedValues.push({ [attr]: aggregatedValue });
  });

  return aggregatedValues;
}

// Main function to aggregate data for each edge segment lines
function aggregateEdgeData(edgesData, environmentalData, aggregationType) {
  return edgesData.map(edge => {
      const [pointA, pointB] = [edge[0], edge[1]];

      // Calculate midpoint of the edge
      const midpointCoords = calculateMidpoint(pointA, pointB);
      const centroid = turf.point([midpointCoords.lon, midpointCoords.lat]);

      // Calculate distances from the centroid to all environmental points
      const distances = calculateDistances(centroid, environmentalData);

      // Find the 100 closest environmental points
      const closestPoints = findClosestPoints(distances, environmentalData);

      // Aggregate the environmental attributes based on the selected aggregation type
      const aggregatedValues = aggregateAttributes(closestPoints, aggregationType);

      // Construct the final data for the edge
      let updatedEdge = [];

      // Add original edge properties as separate elements in the array
      updatedEdge.push(edge[0]); // Point A (lat, lon)
      updatedEdge.push(edge[1]); // Point B (lat, lon)
      updatedEdge.push(edge[2]); // Bearing
      updatedEdge.push(edge[3]); // Length

      // Add aggregated values as separate elements in the array
      aggregatedValues.forEach(value => {
          updatedEdge.push(value);
      });

      return updatedEdge;
  });
}

/////3. Buffer METHOD-->
////calculateCentroid function in up
// Function to create a buffer around a centroid
const createBuffer = (centroid, bufferDistance) => {
  return turf.buffer(centroid, bufferDistance, { units: 'kilometers' });
};


function createBufferSegment(midpoint, bufferDistance) {
  const point = turf.point([midpoint.lon, midpoint.lat]);
  return turf.buffer(point, bufferDistance, { units: 'kilometers' });
}

// Function to filter points that fall within the buffer
const filterPointsInBuffer = (buffer, points) => {
  return points.filter(point => {
      const pointCoords = turf.point([point.Lon, point.Lat]);
      return turf.booleanPointInPolygon(pointCoords, buffer);
  });
};


// Function to filter points within buffer
function filterPointsWithinBufferSegment(buffer, environmentalData) {
  return environmentalData.filter(point => {
      const pointFeature = turf.point([point.Lon, point.Lat]);
      return turf.booleanPointInPolygon(pointFeature, buffer);
  });
}


// Function to aggregate values based on the selected aggregation type
const aggregateValues = (points, aggregationType) => {
  const attributes = ["temperature", "PM2_5", "CO", "CO2", "humidity", "wind", "traffic", "Ozone", "N2O"];
  let aggregatedValues = {};

  attributes.forEach(attr => {
      const values = points.map(point => point[attr]);
      // console.log('values are', values)

      if (aggregationType === 'sum') {
          aggregatedValues[attr] = d3.sum(values);
      } else if (aggregationType === 'mean') {
          aggregatedValues[attr] = d3.mean(values);
      } else if (aggregationType === 'min') {
          aggregatedValues[attr] = d3.min(values);
      } else if (aggregationType === 'max') {
          aggregatedValues[attr] = d3.max(values);
      } else {
          aggregatedValues[attr] = 0; // Default case
      }
  });
  // console.log('checking agg val:', aggregatedValues)

  return aggregatedValues;
};


// Main function to create the new dataset with aggregated environmental data
const createAggregatedDataset = (geojsonData, environmentalData, bufferDistance, aggregationType) => {
  geojsonData.features.forEach(feature => {
      // Calculate the centroid of the current MultiPolygon
      const centroid = calculateCentroid(feature.geometry);
      // console.log('checking centroids', centroid)

      // Create a buffer around the centroid
      const buffer = createBuffer(centroid, bufferDistance);
      // console.log('checking centroids', buffer)

      // Filter the environmental points that fall within the buffer
      const pointsInBuffer = filterPointsInBuffer(buffer, environmentalData);
      // console.log('checking pointsInBuffer', pointsInBuffer)

      // Aggregate the values based on the selected aggregation type
      const aggregatedValues = aggregateValues(pointsInBuffer, aggregationType);
      // console.log('checking aggregatedValues', aggregatedValues)

      // Add the aggregated values to the feature properties
      feature.properties = {
          ...feature.properties,
          ...aggregatedValues
      };
  });
  // console.log('check data geojsonData', geojsonData)

  return geojsonData;
};

// aggregateAttributes function is up

// Main function to aggregate data for each edge segment lines
function BufferDataAggregationSegment(edgesData, environmentalData, bufferDistance = 1, aggregationType = 'sum') {
  const aggregatedEdges = edgesData.edges.map(edge => {
      // Extract coordinates of both points of the edge
      const pointA = { lat: edge[0].lat, lon: edge[0].lon };
      const pointB = { lat: edge[1].lat, lon: edge[1].lon };

      // Calculate midpoint
      const midpoint = calculateMidpoint(pointA, pointB);

      // Create buffer around the midpoint
      const buffer = createBufferSegment(midpoint, bufferDistance);

      // Filter points within buffer
      const pointsInBuffer = filterPointsWithinBufferSegment(buffer, environmentalData);

      // Calculate aggregated values
      const aggregatedValues = aggregateAttributes(pointsInBuffer, aggregationType);

      // Construct the updated edge with aggregated values
      let updatedEdge = [];
      updatedEdge.push(edge[0]); // Point A (lat, lon)
      updatedEdge.push(edge[1]); // Point B (lat, lon)
      updatedEdge.push(edge[2]); // Bearing
      updatedEdge.push(edge[3]); // Length

      // Add aggregated values as separate elements in the array
      aggregatedValues.forEach(value => {
          updatedEdge.push(value);
      });

      return updatedEdge;
  });

  // Create final dataset
  // const finalData = {
  //     edges: aggregatedEdges
  // };

  // console.log("Aggregated Edges Data:", finalData);
  return aggregatedEdges;
}






/////////

const MapVisualization: React.FC<{ parsedSpec: ParsedSpec[], applyFlag: number }> = ({ parsedSpec, applyFlag }) => {

  // console.log('applyFlag check', applyFlag)
  // applyFlag = 0;
  // console.log('applyFlag check2', applyFlag)
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  
  // Store references to the current layers (for lines, fill, heatmap)
  const currentLayersRef = useRef<L.Layer[]>([]);
  

  // Initialize the map on the first render
  useEffect(() => {
    if (mapRef.current) {
      let Lat, Lon;
      if(parsedSpec[0].unit == 'area'){
        Lat = 41.8781;
        Lon = -87.6298;
      } else if(parsedSpec[0].unit == 'segment'){
        Lat = 41.80159035804221;
        Lon = -87.64538029790135;
      } else if(parsedSpec[0].unit == 'node'){
        Lat = 41.80159035804221;
        Lon = -87.64538029790135;
      }
     
      let zoomVar;

      if (!mapInstanceRef.current) {
        console.log('zoom is', parsedSpec)
        // Initial map creation
        mapInstanceRef.current = L.map(mapRef.current).setView([Lat, Lon], parsedSpec[0].zoom); // Use zoom of first layer
        L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(mapInstanceRef.current);
      } else {
        // Update zoom level when parsedSpec changes
        mapInstanceRef.current.setView([Lat, Lon], parsedSpec[0].zoom);
      }
    }
  }, [parsedSpec]);

  // Clear previous visualizations and render the new one
  useEffect(() => {
    if (mapInstanceRef.current) {
      // Remove existing layers from the map
      if(applyFlag==1){
        // currentLayersRef.current.forEach(layer => mapInstanceRef.current!.removeLayer(layer));
        applyFlag = 0;
      }
      // currentLayersRef.current.forEach(layer => mapInstanceRef.current!.removeLayer(layer));
      currentLayersRef.current = []; // Reset the layer reference

      parsedSpec.forEach((layerSpec, index) => {
        console.log("Initial Checking", layerSpec)
        d3.selectAll('.vega-lite-svg').remove();
        // Remove 'move' and 'zoom' event listeners
        mapInstanceRef.current.off('move zoom');

        if (layerSpec.unit === 'segment'){
          if (layerSpec.method === 'line') {
            let updatedGeoJsonData;
            d3.json(layerSpec.physicalLayerPath).then(function (data: any) {
              if (data && data.edges) {
                d3.json(layerSpec.thematicLayerPath).then(function (thematicData){
                  if(layerSpec.spatialRelation == 'contains'){
                    updatedGeoJsonData = aggregationContains(data, thematicData, layerSpec.AggregationType, layerSpec.unit);
                  }else if(layerSpec.spatialRelation == 'nearest neighbor'){
                    updatedGeoJsonData = aggregateEdgeData(data.edges, thematicData, layerSpec.AggregationType);
                  }else if(layerSpec.spatialRelation == 'buffer'){
                    updatedGeoJsonData = BufferDataAggregationSegment(data, thematicData, layerSpec.bufferValue, layerSpec.AggregationType);
                  }
                  updatedGeoJsonData = {
                    edges: updatedGeoJsonData
                  };


                  mapInstanceRef.current?.eachLayer((layer) => {
                    if (!(layer instanceof L.TileLayer)) {
                      if(applyFlag==1){
                        mapInstanceRef.current?.removeLayer(layer);
                        applyFlag = 0;
                      }
                      // mapInstanceRef.current?.removeLayer(layer);
                    }
                  });
                  // Create a new SVG layer for lines
                  const svgLayer = L.svg().addTo(mapInstanceRef.current!);
                  const svgGroup = d3.select(mapInstanceRef.current!.getPanes().overlayPane).select("svg").append("g").attr("class", "leaflet-zoom-hide");
    
                  const lineGenerator = d3.line<any>()
                    .x((d: any) => mapInstanceRef.current!.latLngToLayerPoint(new L.LatLng(d.lat, d.lon)).x)
                    .y((d: any) => mapInstanceRef.current!.latLngToLayerPoint(new L.LatLng(d.lat, d.lon)).y);

                  



                  // Function to convert lat/lng to point on the map
                  function projectPoint(lat, lon) {
                    return mapInstanceRef.current!.latLngToLayerPoint(new L.LatLng(lat, lon));
                  }

                  // Function to generate a simple wavy path between two points
                  function generateSimpleWavyPath(start, end, amplitude, wavelength) {
                    // console.log('checking am, wl', amplitude, wavelength)
                      const dx = end.x - start.x;
                      const dy = end.y - start.y;
                      const distance = Math.sqrt(dx * dx + dy * dy);
                      const angle = Math.atan2(dy, dx);
                      const numWaves = Math.ceil(distance / wavelength);
                      
                      let path = `M ${start.x},${start.y} `;

                      for (let i = 0; i < numWaves; i++) {
                          const t = (i + 0.5) / numWaves;
                          
                          const xMid = start.x + t * dx;
                          const yMid = start.y + t * dy;

                          // Add wave effect using sine function
                          const offsetX = amplitude * Math.sin((i + 0.5) * Math.PI);
                          const controlX = xMid + offsetX * Math.cos(angle + Math.PI / 2);
                          const controlY = yMid + offsetX * Math.sin(angle + Math.PI / 2);

                          const xNext = start.x + ((i + 1) / numWaves) * dx;
                          const yNext = start.y + ((i + 1) / numWaves) * dy;

                          path += `Q ${controlX},${controlY} ${xNext},${yNext} `;
                      }

                      return path;
                  }

    
                  updatedGeoJsonData.edges.forEach((edge: any) => {
                    const points = [
                      { lat: edge[0].lat, lon: edge[0].lon },
                      { lat: edge[1].lat, lon: edge[1].lon }
                    ];

    
                    // Set line color based on attribute value or specific color
                    let lineColor = layerSpec.lineColor || "red";
                    const attributeIndex = edge.findIndex((e: any) => e.hasOwnProperty(lineColor));
                    if (attributeIndex !== -1) {
                      const attributeValues = updatedGeoJsonData.edges
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


                    // Set line width based on attribute value or specific width
                    let lineWidth = layerSpec.lineStrokeWidth;
                    if (typeof lineWidth === "string") {
                      // Check if lineWidth is an attribute name in the data
                      const attributeIndex = edge.findIndex((e: any) => e.hasOwnProperty(lineWidth));
                      if (attributeIndex !== -1) {
                        const attributeValues = updatedGeoJsonData.edges
                          .flatMap((e: any) => e.filter((entry: any) => entry.hasOwnProperty(lineWidth)).map((entry: any) => entry[lineWidth]))
                          .filter((v: any) => v !== undefined);
                        const minValue = d3.min(attributeValues);
                        const maxValue = d3.max(attributeValues);
                        const attributeValue = edge[attributeIndex][lineWidth];
                        if (minValue !== undefined && maxValue !== undefined && attributeValue !== undefined) {
                          // Map attribute values between 2 and 15
                          const lineWidthScale = d3.scaleLinear().domain([minValue, maxValue]).range([5, 30]);
                          lineWidth = lineWidthScale(attributeValue)
                        }
                      } else {
                        lineWidth = 5; // Default value if attribute not found
                      }
                    } else if (typeof lineWidth === "number") {
                      // Use user-defined value if provided and it's a number
                      lineWidth = layerSpec.lineStrokeWidth;
                    } else {
                      // Default to 5 if undefined
                      lineWidth = 5;
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
                        const attributeValues = updatedGeoJsonData.edges
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
                          const attributeValues = updatedGeoJsonData.edges
                          .flatMap((e: any) => e.filter((entry: any) => entry.hasOwnProperty(layerSpec.lineTypeVal)).map((entry: any) => entry[layerSpec.lineTypeVal]))
                          .filter((v: any) => v !== undefined);
                          const minValue = d3.min(attributeValues);
                          const maxValue = d3.max(attributeValues);
                          console.log('min and max is', minValue, maxValue)
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



                    // Append line to SVG group based on type
                    if (layerSpec.lineType === 'squiggle') {
                      // Set squiggle amplitude and frequency based on attribute value
                      let squiggleAmplitude = 25;
                      let squiggleFrequency = 10;
                      if (layerSpec.lineType === 'squiggle' && layerSpec.lineTypeVal) {
                          const squiggleIndex = edge.findIndex((e: any) => e.hasOwnProperty(layerSpec.lineTypeVal));
                          if (squiggleIndex !== -1) {
                              const attributeValue = edge[squiggleIndex][layerSpec.lineTypeVal];
                              if (attributeValue !== undefined) {
                                const attributeValues = updatedGeoJsonData.edges
                                .flatMap((e: any) => e.filter((entry: any) => entry.hasOwnProperty(layerSpec.lineTypeVal)).map((entry: any) => entry[layerSpec.lineTypeVal]))
                                .filter((v: any) => v !== undefined);
                                  const minValue = d3.min(attributeValues);
                                  const maxValue = d3.max(attributeValues);
                                  console.log('min and max is', minValue, maxValue)
                                  const range = maxValue - minValue;
                                  const stepSize = range/3;
                                  const boundary1 = minValue + stepSize;
                                  const boundary2 = minValue + 2 * stepSize;
                                  if (attributeValue >= minValue && attributeValue < boundary1) {
                                      squiggleAmplitude = 25;
                                      squiggleFrequency = 60;
                                  } else if (attributeValue >= boundary1 && attributeValue < boundary2) {
                                      squiggleAmplitude = 25;
                                      squiggleFrequency = 20;
                                  } else {
                                      squiggleAmplitude = 25;
                                      squiggleFrequency = 5;
                                  }
                              }
                          }
                      }


                      // Project the lat/lng coordinates to SVG points
                      const point1 = projectPoint(points[0].lat, points[0].lon);
                      const point2 = projectPoint(points[1].lat, points[1].lon);

                      // Create a squiggly line using the new method
                      let squigglyPath = generateSimpleWavyPath(point1, point2, squiggleAmplitude, squiggleFrequency);
                      svgGroup.append("path")
                          .attr("d", squigglyPath)
                          .style("stroke", lineColor)
                          .style("stroke-width", lineWidth)
                          .style("stroke-opacity", lineOpacity)
                          .attr("fill", "none");
                    } else {
                      // Create a normal line
                      svgGroup.append("path")
                          .datum(points)
                          .attr("d", lineGenerator)
                          .style("stroke", lineColor)
                          .style("stroke-width", lineWidth)
                          .style("stroke-opacity", lineOpacity)
                          .style("stroke-dasharray", dashArray || null)
                          .attr("fill", "none");
                    }



    
                    // svgGroup.append("path")
                    //   .datum(points)
                    //   .attr("d", lineGenerator)
                    //   .style("stroke", lineColor)
                    //   .style("stroke-width", lineWidth)
                    //   .style("stroke-opacity", lineOpacity)
                    //   .style("stroke-dasharray", dashArray || null)
                    //   .attr("fill", "none");
    
                    function updateLines() {
                      if (layerSpec.lineType === 'squiggle') {
                        svgGroup.selectAll("path")
                            .each(function (d: any, i: number) {
                                // Retrieve the original data points from the edge object
                                const edge = updatedGeoJsonData.edges[i];
                                if (edge) {
                                    const points = [
                                        { lat: edge[0].lat, lon: edge[0].lon },
                                        { lat: edge[1].lat, lon: edge[1].lon }
                                    ];
                                    const point1 = projectPoint(points[0].lat, points[0].lon);
                                    const point2 = projectPoint(points[1].lat, points[1].lon);
                
                                    // Recalculate squiggle amplitude and frequency for each edge
                                    let squiggleAmplitude = 25;
                                    let squiggleFrequency = 10;
                                    if (layerSpec.lineTypeVal) {
                                        const squiggleIndex = edge.findIndex((e: any) => e.hasOwnProperty(layerSpec.lineTypeVal));
                                        if (squiggleIndex !== -1) {
                                            const attributeValue = edge[squiggleIndex][layerSpec.lineTypeVal];
                                            if (attributeValue !== undefined) {
                                                const attributeValues = updatedGeoJsonData.edges
                                                    .flatMap((e: any) => e.filter((entry: any) => entry.hasOwnProperty(layerSpec.lineTypeVal)).map((entry: any) => entry[layerSpec.lineTypeVal]))
                                                    .filter((v: any) => v !== undefined);
                                                const minValue = d3.min(attributeValues);
                                                const maxValue = d3.max(attributeValues);
                                                const range = maxValue - minValue;
                                                const stepSize = range / 3;
                                                const boundary1 = minValue + stepSize;
                                                const boundary2 = minValue + 2 * stepSize;
                
                                                if (attributeValue >= minValue && attributeValue < boundary1) {
                                                    squiggleAmplitude = 25;
                                                    squiggleFrequency = 60;
                                                } else if (attributeValue >= boundary1 && attributeValue < boundary2) {
                                                    squiggleAmplitude = 25;
                                                    squiggleFrequency = 20;
                                                } else {
                                                    squiggleAmplitude = 25;
                                                    squiggleFrequency = 5;
                                                }
                                            }
                                        }
                                    }
                
                                    const squigglyPath = generateSimpleWavyPath(point1, point2, squiggleAmplitude, squiggleFrequency);
                                    d3.select(this).attr("d", squigglyPath);
                                }
                            });
                    } else {
                          svgGroup.selectAll("path")
                              .attr("d", lineGenerator);
                      }
                  }

                    mapInstanceRef.current!.on("moveend", updateLines);
                  });
    
                  // Add the SVG layer to the reference list for later removal
                  currentLayersRef.current.push(svgLayer);

                })





              } else {
                console.error("Data is missing edges or is invalid.");
              }
            }).catch(error => {
              console.error("Failed to load JSON data:", error);
            });
          }
          else if(layerSpec.chart){
            // console.log(layerSpec)
            d3.json(layerSpec.physicalLayerPath).then((data: any) => {
              if (data && data.edges){
                mapInstanceRef.current?.eachLayer((layer) => {
                  if (!(layer instanceof L.TileLayer)) {
                    // mapInstanceRef.current?.removeLayer(layer);
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
                .then(() => {
                  const svgLayer1 = L.svg().addTo(mapInstanceRef.current!);
                  currentLayersRef.current.push(svgLayer1);
                });
              }
            })
          }
        }
        else if(layerSpec.unit === 'node'){
          let nodesSet = new Set();
          let NodesList = [];
          if(layerSpec.chart){
            // console.log(layerSpec)
            d3.json(layerSpec.physicalLayerPath).then((data: any) => {
              if (data && data.edges){
                mapInstanceRef.current?.eachLayer((layer) => {
                  if (!(layer instanceof L.TileLayer)) {
                    // mapInstanceRef.current?.removeLayer(layer);
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
                
                //Here now for each node position different charts are creating--->
                (async () => {
                  for (let idx = 0; idx < NodesList.length; idx++) {
                    const NodePoint = NodesList[idx];
                    const midpoint = { lat: NodePoint[0], lon: NodePoint[1] };
      
                    // Step 1: Copy the chart specification for each node
                    const chartSpec = JSON.parse(JSON.stringify(layerSpec.chart));
      
                    // Step 2: Generate unique data for each node
                    chartSpec.data = {
                      values: [
                        Math.floor(Math.random() * 31),
                        Math.floor(Math.random() * 31),
                        Math.floor(Math.random() * 31),
                        Math.floor(Math.random() * 31),
                        Math.floor(Math.random() * 31),
                        Math.floor(Math.random() * 31)
                      ],
                    };
      
                    // Step 3: Embed the chart for the current node in the #vis container
                    await vegaEmbed('#vis', chartSpec, { renderer: 'svg', actions: false }).then(result => {
                      const vegaSVG = result.view._el.querySelector('svg');
                      const svgWidth = 100;
                      const svgHeight = 100;
      
                      const updateSvgPosition = () => {
                        const point = mapInstanceRef.current!.latLngToLayerPoint([midpoint.lat, midpoint.lon]);
                        const tempID = 't' + (midpoint.lat + midpoint.lon + '').replace('.', '').replace('-', '') + 'svg';
                        const temp = d3.select(mapInstanceRef.current!.getPanes().overlayPane).select('#' + tempID);
      
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
                    });
                  }
                  const svgLayer = L.svg().addTo(mapInstanceRef.current!);
                  currentLayersRef.current.push(svgLayer);
                })();
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
                  if(layerSpec.spatialRelation == 'contains'){
                    updatedGeoJsonData = aggregationContains(geojsonData, thematicData, layerSpec.AggregationType, layerSpec.unit);
                  }else if(layerSpec.spatialRelation == 'nearest neighbor'){
                    updatedGeoJsonData = createNewDataset(geojsonData, thematicData, layerSpec.AggregationType);
                  }else if(layerSpec.spatialRelation == 'buffer'){
                    updatedGeoJsonData = createAggregatedDataset(geojsonData, thematicData, layerSpec.bufferValue, layerSpec.AggregationType);
                  }
                  
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