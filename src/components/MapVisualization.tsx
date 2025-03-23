import React, { useEffect, useRef, useState  } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as d3 from 'd3';
import 'leaflet.heat'; // Import the heatmap plugin
import vegaEmbed from 'vega-embed';
import * as turf from '@turf/turf';
import '@maplibre/maplibre-gl-leaflet';  // Plugin bridging MapLibre & Leaflet
import maplibregl from 'maplibre-gl';


interface ParsedSpec {
  geojsonPath: string;
  method: string;
  shape: string;
  unit: string;
  unitDivide: number;
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
  height?: string | number; 
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
  roadDirection?: string;
  address?: string;
  roadRadius?: number; 
  radiusUnit?: string;
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
      // const attributes = ["temperature", "PM2_5", "CO", "CO2", "humidity", "wind", "traffic", "Ozone", "N2O"];
      const attributes = ["Crosswalk", "CurbRamp", "NoCurbRamp", "NoSidewalk", "Obstacle", "Signal", "SurfaceProblem", "Other"]
      // const attributes = ["NTAscoree", "Walkabilit", "MarketScor", "LibScore", "SchoolsSco","MetraScore", 
      //                     "PaceScore", "CTAScore", "Amenities", "TreeScore", "TransitAcc", "TotalScore",
      //                     "Total_Crimes", "Total_Arrests", "ASSAULT", "BATTERY", "BURGLARY",
      //                     "Damage", "Trespass", "GAMBLING", "HOMICIDE", "HUMAN TRAFFICKING",
      //                     "KIDNAPPING", "MOTOR VEHICLE THEFT", "NON-CRIMINAL", "OBSCENITY",
      //                     "OFFENSE INVOLVING CHILDREN", "OTHER NARCOTIC VIOLATION", "OTHER OFFENSE",
      //                     "PUBLIC PEACE VIOLATION", "ROBBERY", "SEX OFFENSE", "STALKING", "THEFT",
      //                     "WEAPONS VIOLATION", "Summer", "Winter", "Spring"]

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
      // const attributes = ["temperature", "PM2_5", "CO", "CO2", "humidity", "wind", "traffic", "Ozone", "N2O"];
      const attributes = ["Crosswalk", "CurbRamp", "NoCurbRamp", "NoSidewalk", "Obstacle", "Signal", "SurfaceProblem", "Other"]
      // const attributes = ["NTAscoree", "Walkabilit", "MarketScor", "LibScore", "SchoolsSco","MetraScore", 
      //                     "PaceScore", "CTAScore", "Amenities", "TreeScore", "TransitAcc", "TotalScore",
      //                     "Total_Crimes", "Total_Arrests", "ASSAULT", "BATTERY", "BURGLARY",
      //                     "Damage", "Trespass", "GAMBLING", "HOMICIDE", "HUMAN TRAFFICKING",
      //                     "KIDNAPPING", "MOTOR VEHICLE THEFT", "NON-CRIMINAL", "OBSCENITY",
      //                     "OFFENSE INVOLVING CHILDREN", "OTHER NARCOTIC VIOLATION", "OTHER OFFENSE",
      //                     "PUBLIC PEACE VIOLATION", "ROBBERY", "SEX OFFENSE", "STALKING", "THEFT",
      //                     "WEAPONS VIOLATION", "Summer", "Winter", "Spring"]

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
  // const attributes = ["temperature", "PM2_5", "CO", "CO2", "humidity", "wind", "traffic", "Ozone", "N2O"];
  const attributes = ["Crosswalk", "CurbRamp", "NoCurbRamp", "NoSidewalk", "Obstacle", "Signal", "SurfaceProblem", "Other"]
  // const attributes = ["NTAscoree", "Walkabilit", "MarketScor", "LibScore", "SchoolsSco","MetraScore", 
  //                         "PaceScore", "CTAScore", "Amenities", "TreeScore", "TransitAcc", "TotalScore",
  //                         "Total_Crimes", "Total_Arrests", "ASSAULT", "BATTERY", "BURGLARY",
  //                         "Damage", "Trespass", "GAMBLING", "HOMICIDE", "HUMAN TRAFFICKING",
  //                         "KIDNAPPING", "MOTOR VEHICLE THEFT", "NON-CRIMINAL", "OBSCENITY",
  //                         "OFFENSE INVOLVING CHILDREN", "OTHER NARCOTIC VIOLATION", "OTHER OFFENSE",
  //                         "PUBLIC PEACE VIOLATION", "ROBBERY", "SEX OFFENSE", "STALKING", "THEFT",
  //                         "WEAPONS VIOLATION", "Summer", "Winter", "Spring"]
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
  // const attributes = ["temperature", "PM2_5", "CO", "CO2", "humidity", "wind", "traffic", "Ozone", "N2O"];
  const attributes = ["Crosswalk", "CurbRamp", "NoCurbRamp", "NoSidewalk", "Obstacle", "Signal", "SurfaceProblem", "Other"]
  // const attributes = ["NTAscoree", "Walkabilit", "MarketScor", "LibScore", "SchoolsSco","MetraScore", 
  //                         "PaceScore", "CTAScore", "Amenities", "TreeScore", "TransitAcc", "TotalScore",
  //                         "Total_Crimes", "Total_Arrests", "ASSAULT", "BATTERY", "BURGLARY",
  //                         "Damage", "Trespass", "GAMBLING", "HOMICIDE", "HUMAN TRAFFICKING",
  //                         "KIDNAPPING", "MOTOR VEHICLE THEFT", "NON-CRIMINAL", "OBSCENITY",
  //                         "OFFENSE INVOLVING CHILDREN", "OTHER NARCOTIC VIOLATION", "OTHER OFFENSE",
  //                         "PUBLIC PEACE VIOLATION", "ROBBERY", "SEX OFFENSE", "STALKING", "THEFT",
  //                         "WEAPONS VIOLATION", "Summer", "Winter", "Spring"]
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
  // console.log("environmentalData checkkk", updatedGeoJsonData)
  return environmentalData.filter(point => {
      const pointFeature = turf.point([point.Lon, point.Lat]);
      return turf.booleanPointInPolygon(pointFeature, buffer);
  });
}


// Function to aggregate values based on the selected aggregation type
const aggregateValues = (points, aggregationType) => {
  // const attributes = ["temperature", "PM2_5", "CO", "CO2", "humidity", "wind", "traffic", "Ozone", "N2O"];
  const attributes = ["Crosswalk", "CurbRamp", "NoCurbRamp", "NoSidewalk", "Obstacle", "Signal", "SurfaceProblem", "Other"]
  // const attributes = ["NTAscoree", "Walkabilit", "MarketScor", "LibScore", "SchoolsSco","MetraScore", 
  //                         "PaceScore", "CTAScore", "Amenities", "TreeScore", "TransitAcc", "TotalScore",
  //                         "Total_Crimes", "Total_Arrests", "ASSAULT", "BATTERY", "BURGLARY",
  //                         "Damage", "Trespass", "GAMBLING", "HOMICIDE", "HUMAN TRAFFICKING",
  //                         "KIDNAPPING", "MOTOR VEHICLE THEFT", "NON-CRIMINAL", "OBSCENITY",
  //                         "OFFENSE INVOLVING CHILDREN", "OTHER NARCOTIC VIOLATION", "OTHER OFFENSE",
  //                         "PUBLIC PEACE VIOLATION", "ROBBERY", "SEX OFFENSE", "STALKING", "THEFT",
  //                         "WEAPONS VIOLATION", "Summer", "Winter", "Spring"]
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

// Helper: Convert a bearing (in degrees) to one of 8 cardinal directions.
function getCardinalDirection(bearing: number): string {
  const directions = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
  const index = Math.floor((bearing + 22.5) / 45) % 8;
  return directions[index];
}

// let alignmentCounters = {
//   center: 0,
//   left: 0,
//   right: 0
// };



const MapVisualization: React.FC<{ parsedSpec: ParsedSpec[], applyFlag: number }> = ({ parsedSpec, applyFlag }) => {

  // console.log('applyFlag check', applyFlag)
  // applyFlag = 0;
  // console.log('applyFlag check2', applyFlag)
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const mimicLayerRef = useRef<L.Layer | null>(null);
  
  // Store references to the current layers (for lines, fill, heatmap)
  const currentLayersRef = useRef<L.Layer[]>([]);
  // New state to control mimic street width
  const [mimicWidth, setMimicWidth] = useState<number>(0);
  // New state for the geocoded address coordinates.
  const [addressCoords, setAddressCoords] = useState<{ lat: number; lon: number } | null>(null);

   // Geocode the address if provided (using Nominatim)
   useEffect(() => {
    const address = parsedSpec[0].address;
    if (address) {
      fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`)
        .then(response => response.json())
        .then(data => {
          if (data && data.length > 0) {
            setAddressCoords({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) });
          }
        })
        .catch(error => console.error("Error geocoding address:", error));
    } else {
      setAddressCoords(null);
    }
  }, [parsedSpec[0].address]);


  // useEffect(() => {
  //   if (!mapRef.current) return;

  //   if (!mapInstanceRef.current) {
  //     // Create the Leaflet map only once
  //     mapInstanceRef.current = L.map(mapRef.current, {
  //       center: [41.8781, -87.6298], // Example: Chicago
  //       zoom: 14
  //     });

  //     L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png', {
  //       maxZoom: 19,
  //       attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  //     }).addTo(mapInstanceRef.current);

  //     // Allow multiple popups (so we can open multiple mini-maps)
  //     mapInstanceRef.current.options.closePopupOnClick = false;

  //     // Right-click => open a mini-map popup
  //     mapInstanceRef.current.on('contextmenu', (e) => {
  //       e.originalEvent.preventDefault(); // hide browser's default context menu
  //       openMiniMapPopup(e.latlng);
  //     });
  //   }
  // }, []);
  

  // Initialize the map on the first render
  useEffect(() => {
    if (mapRef.current) {
      let Lat, Lon;
      if(parsedSpec[0].unit == 'area'){
        Lat = 41.8781;
        Lon = -87.6298;
        // Lat = 47.61902970588908;
        // Lon = -122.29361573322541;
      } else if(parsedSpec[0].unit == 'segment'){
        Lat = 41.80159035804221;
        Lon = -87.64538029790135;
        // Lat = 47.61902970588908;
        // Lon = -122.29361573322541;
      } else if(parsedSpec[0].unit == 'node'){
        Lat = 41.80159035804221;
        Lon = -87.64538029790135;
        // Lat = 47.61902970588908;
        // Lon = -122.29361573322541;
      }
     
      let zoomVar;

      if (!mapInstanceRef.current) {
        // console.log('zoom is', parsedSpec)
        // Initial map creation
        mapInstanceRef.current = L.map(mapRef.current).setView([Lat, Lon], parsedSpec[0].zoom); // Use zoom of first layer
        
        
        L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
        }).addTo(mapInstanceRef.current);
      } else {
        // Update zoom level when parsedSpec changes
        mapInstanceRef.current.setView([Lat, Lon], parsedSpec[0].zoom);
      }

    }
  }, [parsedSpec]);
  



    // ================== 2) RIGHT-CLICK => OPEN MINI-MAP POPUP ==================
    


    // NEW: Add the mimic street layer in its own pane.
    useEffect(() => {
      if (mapInstanceRef.current) {
        // Create the mimic street pane if it doesn't exist
        if (!mapInstanceRef.current.getPane('mimicStreetPane')) {
          mapInstanceRef.current.createPane('mimicStreetPane');
          mapInstanceRef.current.getPane('mimicStreetPane')!.style.zIndex = '350';
        }
        // Only add the mimic layer if it hasn't been added yet.
        if (!mimicLayerRef.current) {
          d3.json(`/filtered_data.json`)
            .then((data: any) => {
              // Transform your data into a GeoJSON FeatureCollection
              const features = data.edges.map(edge => ({
                type: "Feature",
                geometry: {
                  type: "LineString",
                  coordinates: [
                    [edge[0].lon, edge[0].lat],
                    [edge[1].lon, edge[1].lat]
                  ]
                },
                properties: {
                  Bearing: edge[2].Bearing,
                  Length: edge[3].Length
                }
              }));
              const geojson = {
                type: "FeatureCollection",
                features: features
              };
    
              mimicLayerRef.current = L.geoJSON(geojson, {
                pane: 'mimicStreetPane',
                style: {
                  color: '#d3d3d6',
                  weight: 0,
                  opacity: 0.8
                }
              }).addTo(mapInstanceRef.current);
            })
            .catch(error => {
              console.error("Failed to load mimic street GeoJSON:", error);
            });
        }
      }
    }, []);

      // Update mimic street width based on the slider value and filtering conditions.
      useEffect(() => {
        if (mimicLayerRef.current) {
          mimicLayerRef.current.eachLayer((layer: any) => {
            const defaultWeight = 50;
            let shouldUpdate = true;
            // If a roadDirection is provided, check the feature's cardinal direction.
            if (parsedSpec[0].roadDirection) {
              const featureBearing = layer.feature.properties.Bearing;
              const featureDirection = getCardinalDirection(featureBearing);
              if (featureDirection.toLowerCase() !== parsedSpec[0].roadDirection.toLowerCase()) {
                shouldUpdate = false;
              }
            }
            // If an address is provided (via geocoded addressCoords), check if the feature is within a 5km radius.
            if (addressCoords) {
              const addressPoint = turf.point([addressCoords.lon, addressCoords.lat]);
              const lineFeature = turf.lineString(layer.feature.geometry.coordinates);
              const distance = turf.pointToLineDistance(addressPoint, lineFeature, { units: parsedSpec[0].radiusUnit });
              if (distance > parsedSpec[0].roadRadius) {
                shouldUpdate = false;
              }
            }
            // If neither condition is provided, or if all provided conditions are met, update the width.
            layer.setStyle({
              color: '#d3d3d6',
              weight: shouldUpdate ? mimicWidth : defaultWeight,
              opacity: 0.8
            });
          });
        }
      }, [mimicWidth, parsedSpec, addressCoords]);

  let alignmentCounters = {
    center: 0,
    left: 0,
    right: 0
  };

  // Clear previous visualizations and render the new one
  useEffect(() => {
    if (mapInstanceRef.current) {
      // Remove existing layers from the map
      // if(applyFlag==1){
      //   currentLayersRef.current.forEach(layer => mapInstanceRef.current!.removeLayer(layer));
      //   applyFlag = 0;
      // }
      // // currentLayersRef.current.forEach(layer => mapInstanceRef.current!.removeLayer(layer));
      // currentLayersRef.current = []; // Reset the layer reference

      currentLayersRef.current.forEach(layer => {
        // Check if the layer's pane is NOT the mimic street pane before removing
        if (!(layer.options && layer.options.pane === 'mimicStreetPane')) {
          mapInstanceRef.current!.removeLayer(layer);
        }
      });
      currentLayersRef.current = [];
      

      parsedSpec.forEach((layerSpec, index) => {
        console.log("Initial Checking", layerSpec)
        d3.selectAll('.vega-lite-svg').remove();
        // Remove 'move' and 'zoom' event listeners
        mapInstanceRef.current.off('move zoom');

        if (layerSpec.unit === 'segment'){
          if (layerSpec.method === 'line') {

            // Helper function to offset a point by a given bearing and distance (in meters)
            function offsetPoint(lat, lon, bearing, distance) {
              const R = 6378137; // Earth's radius in meters
              const toRad = Math.PI / 180;
              const toDeg = 180 / Math.PI;
              const lat1 = lat * toRad;
              const lon1 = lon * toRad;
              const brng = bearing * toRad;
              const dR = distance / R;
              
              const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dR) + Math.cos(lat1) * Math.sin(dR) * Math.cos(brng));
              const lon2 = lon1 + Math.atan2(
                Math.sin(brng) * Math.sin(dR) * Math.cos(lat1),
                Math.cos(dR) - Math.sin(lat1) * Math.sin(lat2)
              );
              
              return [lat2 * toDeg, lon2 * toDeg];
            }
            // Helper function to calculate bearing between two points (in degrees)
            function bearingBetweenPoints(lat1, lon1, lat2, lon2) {
              const toRad = Math.PI / 180;
              const toDeg = 180 / Math.PI;
              const φ1 = lat1 * toRad;
              const φ2 = lat2 * toRad;
              const Δλ = (lon2 - lon1) * toRad;
              
              const y = Math.sin(Δλ) * Math.cos(φ2);
              const x = Math.cos(φ1) * Math.sin(φ2) -
                        Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
              let brng = Math.atan2(y, x) * toDeg;
              return (brng + 360) % 360;
            }

            // Normalize the segment by swapping start and end if needed (assumes a Bearing property in extras)
            function normalizeSegment(segment) {
              const start = segment[0];
              const end = segment[1];
              let bearing = segment[2].Bearing;
              bearing = ((bearing % 360) + 360) % 360;
              if (bearing >= 180) {
                // Swap start & end
                const temp = { lat: start.lat, lon: start.lon };
                start.lat = end.lat;   start.lon = end.lon;
                end.lat = temp.lat;    end.lon = temp.lon;
                bearing -= 180;
              }
              segment[2].Bearing = bearing;
            }

            function getOffsetDistance() {
              const zoom = mapInstanceRef.current.getZoom();
              if (zoom >= 18) return 15;
              if (zoom <= 17) return 25;
              // Smooth linear interpolation between 5 (zoom 18) and 20 (zoom 16)
              return 5 + ((18 - zoom) / (18 - 17)) * (25 - 15);
            }

            

            function getLineWidth(baseWidth) {
              // baseWidth is your “default” stroke at low zoom
              const zoom = mapInstanceRef.current.getZoom();
              // console.log("zoom and basewidth", zoom, baseWidth)
              
              if (zoom <= 16) {
                // Zoom 1–5: just use base width
                return baseWidth; 
              } else if (zoom > 16 && zoom <= 17) {
                // Zoom 6–8: a little wider
                return baseWidth * 1.5; 
              } else if (zoom > 17 && zoom <= 18) {
                // Zoom 9–12: more wide
                return baseWidth * 3;
              } else {
                // Zoom above 12: even wider
                return baseWidth * 3.5;
              }
            }


            let updatedGeoJsonData;
            d3.json(layerSpec.physicalLayerPath).then(function (data: any) {
              if (data && data.edges) {
                  var subdividedEdges = [];
                  // Offset the original start and end points by 5 meters
                  let multiplier = 0;
                  if(layerSpec.alignment === "left"){
                    multiplier = alignmentCounters.left + 1
                    alignmentCounters.left++
                  }else if(layerSpec.alignment === "right"){
                    multiplier = alignmentCounters.right + 1
                    alignmentCounters.right++
                  }
                  
                  console.log("multiplier:", multiplier);

                  // Loop through each edge in the original array
                  data.edges.forEach(function(edge) {

                    edge[2].Bearing = bearingBetweenPoints(edge[0].lat, edge[0].lon,
                        edge[1].lat, edge[1].lon);
                      normalizeSegment(edge);
                     // Extract the original start and end points and any extra attributes
                      const originalStart = edge[0];
                      const originalEnd = edge[1];
                      const extras = edge.slice(2);

                      // Determine the points to use for subdivision based on alignment
                      let startPoint, endPoint;
                      if (layerSpec.alignment === "center") {
                        // Use the original centerline
                        startPoint = originalStart;
                        endPoint = originalEnd;
                      } else if (layerSpec.alignment === "left" || layerSpec.alignment === "right") {
                        // Calculate the bearing of the original street segment
                        const bearing = bearingBetweenPoints(originalStart.lat, originalStart.lon, originalEnd.lat, originalEnd.lon);
                        // For left, subtract 90°; for right, add 90°
                        const offsetAngle = layerSpec.alignment === "left" ? bearing - 90 : bearing + 90;

                        

                        const baseDistance = getOffsetDistance();
                        const distance = baseDistance * multiplier;
                        

                        const offsetStartCoords = offsetPoint(originalStart.lat, originalStart.lon, offsetAngle, distance);
                        const offsetEndCoords = offsetPoint(originalEnd.lat, originalEnd.lon, offsetAngle, distance);
                        startPoint = { lat: offsetStartCoords[0], lon: offsetStartCoords[1] };
                        endPoint = { lat: offsetEndCoords[0], lon: offsetEndCoords[1] };
                      }

                    // Destructure the coordinates
                    const lat0 = startPoint.lat, lon0 = startPoint.lon;
                    const lat1 = endPoint.lat, lon1 = endPoint.lon;

                    // Calculate the total difference between the start and end points
                    var dLat = lat1 - lat0;
                    var dLon = lon1 - lon0;

                    // Subdivide this edge into `unitDivide` segments
                    for (var i = 0; i < layerSpec.unitDivide; i++) {
                      // Calculate the start coordinate of the new segment
                      var segStartLat = lat0 + dLat * (i / layerSpec.unitDivide);
                      var segStartLon = lon0 + dLon * (i / layerSpec.unitDivide);
                      // console.log("calculation lat lon", segStartLat, segStartLon)

                      // Calculate the end coordinate of the new segment
                      var segEndLat = lat0 + dLat * ((i + 1) / layerSpec.unitDivide);
                      var segEndLon = lon0 + dLon * ((i + 1) / layerSpec.unitDivide);

                      // Build new coordinate objects
                      var newStart = { lat: segStartLat, lon: segStartLon };
                      var newEnd = { lat: segEndLat, lon: segEndLon };


                      // Create the new edge. The new edge will contain:
                      //  - The new start coordinate
                      //  - The new end coordinate
                      //  - The same extra values from the original edge
                      var newEdge = [
                        newStart,newEnd
                      ].concat(extras);

                      subdividedEdges.push(newEdge);
                    }
                  });
                  updatedGeoJsonData = {
                    edges: subdividedEdges
                  };
                d3.json(layerSpec.thematicLayerPath).then(function (thematicData){
                  if(layerSpec.spatialRelation == 'contains'){
                    updatedGeoJsonData = aggregationContains(updatedGeoJsonData, thematicData, layerSpec.AggregationType, layerSpec.unit);
                    console.log("data is:", updatedGeoJsonData)
                  }else if(layerSpec.spatialRelation == 'nearest neighbor'){
                    updatedGeoJsonData = aggregateEdgeData(updatedGeoJsonData.edges, thematicData, layerSpec.AggregationType);
                  }else if(layerSpec.spatialRelation == 'buffer'){
                    updatedGeoJsonData = BufferDataAggregationSegment(updatedGeoJsonData, thematicData, layerSpec.bufferValue, layerSpec.AggregationType);
                  }

                  // if (layerSpec.unitDivide == 1){
                  //   updatedGeoJsonData = {
                  //     edges: updatedGeoJsonData
                  //   };
                  // }else{
                  //   var subdividedEdges = [];

                  //   // Loop through each edge in the original array
                  //   updatedGeoJsonData.forEach(function(edge) {
                  //     // Get the start and end coordinates
                  //     var start = edge[0]; // [lat, lon]
                  //     var end = edge[1];   // [lat, lon]
                  //     // Get the extra values (indices 2 to 12)
                  //     var extras = edge.slice(2);

                  //     // Destructure the coordinates
                  //     var lat0 = start["lat"],
                  //         lon0 = start["lon"],
                  //         lat1 = end["lat"],
                  //         lon1 = end["lon"];

                  //     // Calculate the total difference between the start and end points
                  //     var dLat = lat1 - lat0;
                  //     var dLon = lon1 - lon0;

                  //     // Subdivide this edge into `unitDivide` segments
                  //     for (var i = 0; i < layerSpec.unitDivide; i++) {
                  //       // Calculate the start coordinate of the new segment
                  //       var segStartLat = lat0 + dLat * (i / layerSpec.unitDivide);
                  //       var segStartLon = lon0 + dLon * (i / layerSpec.unitDivide);
                  //       // console.log("calculation lat lon", segStartLat, segStartLon)

                  //       // Calculate the end coordinate of the new segment
                  //       var segEndLat = lat0 + dLat * ((i + 1) / layerSpec.unitDivide);
                  //       var segEndLon = lon0 + dLon * ((i + 1) / layerSpec.unitDivide);

                  //       // Build new coordinate objects
                  //       var newStart = { lat: segStartLat, lon: segStartLon };
                  //       var newEnd = { lat: segEndLat, lon: segEndLon };


                  //       // Create the new edge. The new edge will contain:
                  //       //  - The new start coordinate
                  //       //  - The new end coordinate
                  //       //  - The same extra values from the original edge
                  //       var newEdge = [
                  //         newStart,newEnd
                  //       ].concat(extras);

                  //       subdividedEdges.push(newEdge);
                  //     }
                  //   });

                  //     console.log("data2 is:", subdividedEdges)




                  //   updatedGeoJsonData = {
                  //     edges: subdividedEdges
                  //   };

                  // }
                  
                  updatedGeoJsonData = {
                        edges: updatedGeoJsonData
                      };

                  // console.log("updatedGeoJsonData checkkk", updatedGeoJsonData)


                  //     const currentLayerGroup = layerSpec.alignment; // "center", "left", or "right"
                  //     mapInstanceRef.current?.eachLayer((layer) => {
                  //   if (!(layer instanceof L.TileLayer) && layer.layerGroup === currentLayerGroup) {
                      
                  //     // Check if the layer's pane is NOT the mimic street pane before removing
                  //     if (!(layer.options && layer.options.pane === 'mimicStreetPane')) {
                  //       mapInstanceRef.current!.removeLayer(layer);
                  //     }
                  //   }
                  // });

                  // [CHANGED] For center layers, we remove any previous center layers.
                  // For left/right, we want to keep them all.
                  if (layerSpec.alignment === "center") {
                    mapInstanceRef.current?.eachLayer((layer) => {
                      if (!(layer instanceof L.TileLayer) && layer.layerGroup === "center") {
                        // Check if the layer's pane is NOT the mimic street pane before removing
                        if (!(layer.options && layer.options.pane === 'mimicStreetPane')) {
                          mapInstanceRef.current!.removeLayer(layer);
                        }
                      }
                    });
                  }


                  // Create a new SVG layer for lines
                  const svgLayer = L.svg().addTo(mapInstanceRef.current!);
                  svgLayer.layerGroup = layerSpec.alignment; // "center", "left", or "right"
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

                  // ...............
                  // Parallel offset helpers:
                  function bearingBetweenPoints(lat1: number, lon1: number, lat2: number, lon2: number) {
                    const toRad = Math.PI / 180;
                    const phi1 = lat1 * toRad;
                    const phi2 = lat2 * toRad;
                    const dLon = (lon2 - lon1) * toRad;

                    const y = Math.sin(dLon) * Math.cos(phi2);
                    const x = Math.cos(phi1)*Math.sin(phi2) - Math.sin(phi1)*Math.cos(phi2)*Math.cos(dLon);
                    let brng = Math.atan2(y, x) * (180 / Math.PI);
                    return (brng + 360) % 360;
                  }

                  function offsetPoint(lat: number, lon: number, bearing: number, distance: number) {
                    const R = 6378137;
                    const toRad = Math.PI / 180;
                    const lat1 = lat * toRad;
                    const lon1 = lon * toRad;
                    const brng = bearing * toRad;
                    const dR   = distance / R;

                    const lat2 = Math.asin(
                      Math.sin(lat1) * Math.cos(dR) +
                      Math.cos(lat1) * Math.sin(dR) * Math.cos(brng)
                    );
                    const lon2 = lon1 + Math.atan2(
                      Math.sin(brng) * Math.sin(dR) * Math.cos(lat1),
                      Math.cos(dR) - Math.sin(lat1) * Math.sin(lat2)
                    );
                    return [ lat2 / toRad, lon2 / toRad ];
                  }

                  function drawPolygon(corners: [number, number][], color: string) {
                    const pointsStr = corners.map(pt => pt.join(",")).join(" ");
                    svgGroup.append("polygon")
                      .attr("points", pointsStr)
                      .style("fill", color)
                      .style("fill-opacity", 0.4);
                  }
                  // ...............

    
                  updatedGeoJsonData.edges.forEach((edge: any) => {

                    // edge[2].Bearing = bearingBetweenPoints(edge[0].lat, edge[0].lon,
                    //   edge[1].lat, edge[1].lon);
                    // normalizeSegment(edge);
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
                        // const colorScale = d3.scaleSequential(d3.interpolateInferno).domain([minValue, maxValue]);
                        const colorScale = d3.scaleSequential(d3.interpolateBuGn).domain([minValue, maxValue]);
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
                          const lineWidthScale = d3.scaleLinear().domain([minValue, maxValue]).range([0, 20]);
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

                    // console.log("lineWidth before:", lineWidth)

                    lineWidth = getLineWidth(lineWidth)
                    // console.log("lineWidth after:", lineWidth)

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
                          // console.log('min and max is', minValue, maxValue)
                          if (attributeValue < minValue + (maxValue - minValue) / 3) {
                            dashArray = "2, 5";
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
                      // We update geometry AND style each time the map moves/zooms:
                      svgGroup.selectAll("path").each((d: any, idx: number, nodes) => {
                        // “idx” is the path index => get the matching edge
                        const thisEdge = updatedGeoJsonData.edges[idx];
                        if (!thisEdge) return;
          
                        // Recompute style exactly like above:
                        // --- lineColor ---
                        let lineColor = layerSpec.lineColor || "red";
                        const colorAttrIndex = thisEdge.findIndex((e: any) => e.hasOwnProperty(lineColor));
                        if (colorAttrIndex !== -1) {
                          const attributeValues = updatedGeoJsonData.edges
                            .flatMap((e: any) => e.filter((entry: any) => entry.hasOwnProperty(lineColor))
                                                  .map((entry: any) => entry[lineColor]))
                            .filter((v: any) => v !== undefined);
                          const minValue = d3.min(attributeValues);
                          const maxValue = d3.max(attributeValues);
                          const attributeValue = thisEdge[colorAttrIndex][lineColor];
                          if (minValue !== undefined && maxValue !== undefined && attributeValue !== undefined) {
                            const colorScale = d3.scaleSequential(d3.interpolateBuGn).domain([minValue, maxValue]);
                            lineColor = colorScale(attributeValue);
                          }
                        }
          
                        // --- lineWidth ---
                        let lineWidth = layerSpec.lineStrokeWidth;
                        if (typeof lineWidth === "string") {
                          const wIndex = thisEdge.findIndex((e: any) => e.hasOwnProperty(lineWidth));
                          if (wIndex !== -1) {
                            const attributeValues = updatedGeoJsonData.edges
                              .flatMap((e: any) => e.filter((entry: any) => entry.hasOwnProperty(lineWidth))
                                                    .map((entry: any) => entry[lineWidth]))
                              .filter((v: any) => v !== undefined);
                            const minValue = d3.min(attributeValues);
                            const maxValue = d3.max(attributeValues);
                            const attributeValue = thisEdge[wIndex][lineWidth];
                            if (minValue !== undefined && maxValue !== undefined && attributeValue !== undefined) {
                              const lineWidthScale = d3.scaleLinear().domain([minValue, maxValue]).range([0, 20]);
                              lineWidth = lineWidthScale(attributeValue);
                            } else {
                              lineWidth = 5;
                            }
                          } else {
                            lineWidth = 5;
                          }
                        } else if (typeof lineWidth === "number") {
                          lineWidth = layerSpec.lineStrokeWidth;
                        } else {
                          lineWidth = 5;
                        }
                        lineWidth = getLineWidth(lineWidth);
          
                        // --- lineOpacity ---
                        let lineOpacity = layerSpec.strokeOpacity || 1;
                        if (typeof lineOpacity === "number" && lineOpacity >= 0 && lineOpacity <= 1) {
                          // use directly
                        } else if (typeof lineOpacity === "string") {
                          const opacityIndex = thisEdge.findIndex((e: any) => e.hasOwnProperty(lineOpacity));
                          if (opacityIndex !== -1) {
                            const attributeValues = updatedGeoJsonData.edges
                              .flatMap((e: any) => e.filter((entry: any) => entry.hasOwnProperty(lineOpacity))
                                                    .map((entry: any) => entry[lineOpacity]))
                              .filter((v: any) => v !== undefined);
                            const minValue = d3.min(attributeValues);
                            const maxValue = d3.max(attributeValues);
                            const attributeValue = thisEdge[opacityIndex][lineOpacity];
                            if (minValue !== undefined && maxValue !== undefined && attributeValue !== undefined) {
                              const opacityScale = d3.scaleLinear().domain([minValue, maxValue]).range([0, 1]);
                              lineOpacity = opacityScale(attributeValue);
                            }
                          }
                        }
          
                        // --- dashArray ---
                        let dashArray = null;
                        if (layerSpec.lineType === "dashed" && layerSpec.lineTypeVal) {
                          const dashIndex = thisEdge.findIndex((e: any) => e.hasOwnProperty(layerSpec.lineTypeVal));
                          if (dashIndex !== -1) {
                            const attributeValue = thisEdge[dashIndex][layerSpec.lineTypeVal];
                            if (attributeValue !== undefined) {
                              const attributeValues = updatedGeoJsonData.edges
                                .flatMap((e: any) => e.filter((entry: any) => entry.hasOwnProperty(layerSpec.lineTypeVal))
                                                      .map((entry: any) => entry[layerSpec.lineTypeVal]))
                                .filter((v: any) => v !== undefined);
                              const minValue = d3.min(attributeValues);
                              const maxValue = d3.max(attributeValues);
                              if (attributeValue < minValue + (maxValue - minValue) / 3) {
                                dashArray = "2, 5";
                              } else if (
                                attributeValue >= minValue + (maxValue - minValue) / 3 &&
                                attributeValue < minValue + 2 * ((maxValue - minValue) / 3)
                              ) {
                                dashArray = "10, 10";
                              } else {
                                dashArray = "15, 10";
                              }
                            }
                          }
                        }
          
                        // Now re‐compute geometry:
                        if (layerSpec.lineType === 'squiggle') {
                          const points = [
                            { lat: thisEdge[0].lat, lon: thisEdge[0].lon },
                            { lat: thisEdge[1].lat, lon: thisEdge[1].lon }
                          ];
          
                          // Recompute squiggle amplitude/freq
                          let squiggleAmplitude = 25;
                          let squiggleFrequency = 10;
                          if (layerSpec.lineTypeVal) {
                            const sqIndex = thisEdge.findIndex((e: any) => e.hasOwnProperty(layerSpec.lineTypeVal));
                            if (sqIndex !== -1) {
                              const attributeValue = thisEdge[sqIndex][layerSpec.lineTypeVal];
                              if (attributeValue !== undefined) {
                                const attributeValues = updatedGeoJsonData.edges
                                  .flatMap((e: any) => e.filter((entry: any) => entry.hasOwnProperty(layerSpec.lineTypeVal))
                                                        .map((entry: any) => entry[layerSpec.lineTypeVal]))
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
          
                          const point1 = projectPoint(points[0].lat, points[0].lon);
                          const point2 = projectPoint(points[1].lat, points[1].lon);
                          const squigglyPath = generateSimpleWavyPath(point1, point2, squiggleAmplitude, squiggleFrequency);
          
                          d3.select(nodes[idx])
                            .attr("d", squigglyPath)
                            .style("stroke", lineColor)
                            .style("stroke-width", lineWidth)
                            .style("stroke-opacity", lineOpacity)
                            .style("stroke-dasharray", dashArray || null);
          
                        } else {
                          // Normal line
                          const points = [
                            { lat: thisEdge[0].lat, lon: thisEdge[0].lon },
                            { lat: thisEdge[1].lat, lon: thisEdge[1].lon }
                          ];
                          d3.select(nodes[idx])
                            .datum(points)
                            .attr("d", lineGenerator)
                            .style("stroke", lineColor)
                            .style("stroke-width", lineWidth)
                            .style("stroke-opacity", lineOpacity)
                            .style("stroke-dasharray", dashArray || null);
                        }
                      });
                    }

                    mapInstanceRef.current!.on("moveend", updateLines);
                  });
    
                  // [CHANGED] Now that this layer is drawn, update the counter for this alignment
                  // alignmentCounters[layerSpec.alignment]++;
                  console.log("alignmentCounters:", alignmentCounters)

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



          else if(layerSpec.method === 'grid'){
            let updatedGeoJsonData;
            d3.json(layerSpec.physicalLayerPath).then(function(data) {
              if (!data || !data.edges) {
                console.error("Data is missing edges or is invalid.");
                return;
              }

              // 1) Subdivide each edge along its length (already done in your code).
              //    We'll keep your logic but remove left/right skipping, etc.
              let subdividedEdges = [];
              data.edges.forEach(function(edge) {
                let start = edge[0]; // {lat, lon}
                let end   = edge[1]; // {lat, lon}
                let extras = edge.slice(2);

                let lat0 = start.lat, lon0 = start.lon;
                let lat1 = end.lat,   lon1 = end.lon;

                let dLat = lat1 - lat0;
                let dLon = lon1 - lon0;

                for (let i = 0; i < layerSpec.unitDivide; i++) {
                  // If you want to skip endpoints, etc., do it here:
                  // if (i < 2 || i >= layerSpec.unitDivide - 2) continue;

                  let segStartLat = lat0 + dLat * (i / layerSpec.unitDivide);
                  let segStartLon = lon0 + dLon * (i / layerSpec.unitDivide);
                  let segEndLat   = lat0 + dLat * ((i + 1) / layerSpec.unitDivide);
                  let segEndLon   = lon0 + dLon * ((i + 1) / layerSpec.unitDivide);

                  let newStart = { lat: segStartLat, lon: segStartLon };
                  let newEnd   = { lat: segEndLat,   lon: segEndLon   };

                  let newEdge = [ newStart, newEnd ].concat(extras);
                  subdividedEdges.push(newEdge);
                }
              });
              subdividedEdges = { edges: subdividedEdges };

              // 2) Load thematic data and do your aggregator if needed.
              d3.json(layerSpec.thematicLayerPath).then(function(thematicData) {
                // Example aggregator step (adapt to your real aggregator):
                // updatedGeoJsonData = aggregateEdgeData(subdividedEdges.edges, thematicData, ...);
                // For demo, just keep the subdivided edges:
                updatedGeoJsonData = { edges: subdividedEdges.edges };

                // 3) Create an SVG layer
                if (!mapInstanceRef.current.getPane("streetGridPane")) {
                  mapInstanceRef.current.createPane("streetGridPane");
                  mapInstanceRef.current.getPane("streetGridPane").style.zIndex = 400;
                }
                const svgLayer = L.svg({
                  pane: "streetGridPane",
                  className: "gMap-streetGrid"
                }).addTo(mapInstanceRef.current);

                // 4) Create an SVG <g> for drawing
                const svgGroup = d3.select(mapInstanceRef.current.getPanes()["streetGridPane"])
                                  .select("svg")
                                  .append("g")
                                  .attr("class", "leaflet-zoom-hide");
                // We'll store all NxN cells here:
                const gridGroup = svgGroup.append("g").attr("class", "street-grid-group");

                // --- Helper functions ---
                function offsetPoint(lat, lon, bearingDeg, distanceMeters) {
                  const R = 6378137; // Earth radius in meters
                  const toRad = Math.PI / 180;
                  let lat1 = lat * toRad;
                  let lon1 = lon * toRad;
                  let brng = bearingDeg * toRad;
                  let dR = distanceMeters / R;

                  let lat2 = Math.asin(Math.sin(lat1) * Math.cos(dR) +
                                      Math.cos(lat1) * Math.sin(dR) * Math.cos(brng));
                  let lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(dR) * Math.cos(lat1),
                                              Math.cos(dR) - Math.sin(lat1) * Math.sin(lat2));
                  return [ lat2 / toRad, lon2 / toRad ];
                }

                function bearingBetweenPoints(lat1, lon1, lat2, lon2) {
                  const toRad = Math.PI / 180;
                  let phi1 = lat1 * toRad, phi2 = lat2 * toRad;
                  let dLon = (lon2 - lon1) * toRad;
                  let y = Math.sin(dLon) * Math.cos(phi2);
                  let x = Math.cos(phi1) * Math.sin(phi2) -
                          Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
                  let brng = Math.atan2(y, x) * (180 / Math.PI);
                  return (brng + 360) % 360;
                }

                function projectPoint(lat, lon) {
                  let point = mapInstanceRef.current.latLngToLayerPoint([lat, lon]);
                  return [ point.x, point.y ];
                }

                // This is your existing getColor function, adapted to take a numeric value.
                // You can shape it however you like:
                function getColor(val) {
                  // Example: define domain from min->max of your aggregator
                  // (In real usage, store minVal/maxVal from the data, or pass them in.)
                  const minVal = 0, maxVal = 100; // placeholder
                  let colorScale = d3.scaleSequential(d3.interpolateBuGn)
                                    .domain([minVal, maxVal]);
                  return colorScale(val);
                }

                // For a simple NxN approach, let crossDivide = layerSpec.unitDivide (so total NxN):
                let crossDivide = layerSpec.unitDivide;

                // Suppose each street has a fixed total width (in meters). 
                // You could also read from an attribute in `segment` if you have a “streetWidth” property.
                let streetWidth = 20;

                // 5) Draw NxN cells for each subdivided segment
                function drawGridCells() {
                  gridGroup.selectAll("*").remove(); // Clear old cells

                  updatedGeoJsonData.edges.forEach(function(segment) {
                    let start = segment[0];
                    let end   = segment[1];

                    // Bearing along the street
                    let bearing = bearingBetweenPoints(start.lat, start.lon, end.lat, end.lon);

                    // We'll offset perpendicular to the street’s centerline:
                    let outward = (bearing + 90) % 360;

                    // The length of the segment in meters (optional if you want length-based aggregator)
                    // Could compute distance using haversine or offsetPoint logic. Not strictly needed here.

                    // 6) For each sub-segment, we have exactly 1 row in the NxN grid.
                    //    We now slice across the width into crossDivide columns:
                    for (let j = 0; j < crossDivide; j++) {
                      // fraction of street width for this column
                      let w1 = (j / crossDivide)     * streetWidth;
                      let w2 = ((j + 1) / crossDivide) * streetWidth;

                      // Corner #1: offset the start point by w1
                      let [sLat1, sLon1] = offsetPoint(start.lat, start.lon, outward, w1);
                      // Corner #2: offset the start point by w2
                      let [sLat2, sLon2] = offsetPoint(start.lat, start.lon, outward, w2);

                      // Corner #3: offset the end point by w1
                      let [eLat1, eLon1] = offsetPoint(end.lat, end.lon, outward, w1);
                      // Corner #4: offset the end point by w2
                      let [eLat2, eLon2] = offsetPoint(end.lat, end.lon, outward, w2);

                      // Convert to screen coords
                      let s1XY = projectPoint(sLat1, sLon1);
                      let s2XY = projectPoint(sLat2, sLon2);
                      let e1XY = projectPoint(eLat1, eLon1);
                      let e2XY = projectPoint(eLat2, eLon2);

                      // 7) Compute aggregator value for this cell.
                      //    In real usage, you might do:
                      //      let aggregatorVal = myCellAggregator(segment, iIndex, jIndex);
                      //    or just read from segment extras. For demo, use a random:
                      let aggregatorVal = Math.random() * 100; // 0..100

                      // 8) Get color from aggregator
                      let cellColor = getColor(aggregatorVal);

                      // 9) Draw the cell polygon
                      gridGroup.append("polygon")
                        .attr("points", [
                          s1XY, e1XY, e2XY, s2XY // going around corners
                        ].map(pt => pt.join(",")).join(" "))
                        .style("fill", cellColor)
                        .style("fill-opacity", 0.7)
                        .style("stroke", "#222")
                        .style("stroke-width", 0.5);
                    }
                  });
                }

                // Draw once initially
                drawGridCells();

                // 10) Redraw on map zoom/pan
                mapInstanceRef.current.on("moveend", drawGridCells);

              }).catch(error => {
                console.error("Failed to load thematic JSON data:", error);
              });

            }).catch(error => {
              console.error("Failed to load physical JSON data:", error);
            });
          }


















          else if (layerSpec.method === 'rect') {
            if(layerSpec.orientation === 'parallel'){
              let updatedGeoJsonData;
              d3.json(layerSpec.physicalLayerPath).then(function (data) {
                if (data && data.edges) {
                  var subdividedEdges = [];
                  // Loop through each edge in the original array
                  data.edges.forEach(function (edge) {
                    // Get the start and end coordinates
                    var start = edge[0]; // { lat, lon }
                    var end = edge[1];   // { lat, lon }
                    // Get the extra values (indices 2 to 12)
                    var extras = edge.slice(2);
        
                    // Destructure the coordinates
                    var lat0 = start["lat"],
                        lon0 = start["lon"],
                        lat1 = end["lat"],
                        lon1 = end["lon"];
        
                    // Calculate the total difference between the start and end points
                    var dLat = lat1 - lat0;
                    var dLon = lon1 - lon0;
        
                    // Subdivide this edge into `unitDivide` segments
                    for (var i = 0; i < layerSpec.unitDivide; i++) {

                      // Skip the first two (i < 2) and last two (i >= layerSpec.unitDivide - 2)
                      if (i < 2 || i >= layerSpec.unitDivide - 2) {
                        continue; // Do not push these subdivided segments
                      }
                      // Calculate the start coordinate of the new segment
                      var segStartLat = lat0 + dLat * (i / layerSpec.unitDivide);
                      var segStartLon = lon0 + dLon * (i / layerSpec.unitDivide);
        
                      // Calculate the end coordinate of the new segment
                      var segEndLat = lat0 + dLat * ((i + 1) / layerSpec.unitDivide);
                      var segEndLon = lon0 + dLon * ((i + 1) / layerSpec.unitDivide);
        
                      // Build new coordinate objects
                      var newStart = { lat: segStartLat, lon: segStartLon };
                      var newEnd = { lat: segEndLat, lon: segEndLon };
        
                      // Create the new edge. The new edge will contain:
                      //  - The new start coordinate
                      //  - The new end coordinate
                      //  - The same extra values from the original edge
                      var newEdge = [ newStart, newEnd ].concat(extras);
                      subdividedEdges.push(newEdge);
                    }
                    
                  });
                  subdividedEdges = {
                    edges: subdividedEdges
                  };
                  

                  d3.json(layerSpec.thematicLayerPath).then(function (thematicData) {
                    // Apply spatial aggregation
                    if (layerSpec.spatialRelation === 'contains') {
                      updatedGeoJsonData = aggregationContains(subdividedEdges, thematicData, layerSpec.AggregationType, layerSpec.unit);
                      console.log("data is:", updatedGeoJsonData);
                    } else if (layerSpec.spatialRelation === 'nearest neighbor') {
                      updatedGeoJsonData = aggregateEdgeData(subdividedEdges.edges, thematicData, layerSpec.AggregationType);
                    } else if (layerSpec.spatialRelation === 'buffer') {
                      updatedGeoJsonData = BufferDataAggregationSegment(subdividedEdges, thematicData, layerSpec.bufferValue, layerSpec.AggregationType);
                    }
            

                    updatedGeoJsonData = {
                      edges: updatedGeoJsonData
                    };
                    // updatedGeoJsonData = [updatedGeoJsonData.edges[0]]

                    console.log("data check for rect2", updatedGeoJsonData)
                    const paneName = layerSpec.alignment + "-" + layerSpec.orientation;

            
            
                    // Create separate panes for left and right if not already created.
                    // if (!mapInstanceRef.current.getPane("leftPane")) {
                    //   mapInstanceRef.current.createPane("leftPane");
                    //   mapInstanceRef.current.getPane("leftPane").style.zIndex = 400;
                    // }
                    // if (!mapInstanceRef.current.getPane("rightPane")) {
                    //   mapInstanceRef.current.createPane("rightPane");
                    //   mapInstanceRef.current.getPane("rightPane").style.zIndex = 410;
                    // }
                    if (!mapInstanceRef.current.getPane(paneName)) {
                      mapInstanceRef.current.createPane(paneName);
                      mapInstanceRef.current.getPane(paneName).style.zIndex = 400; 
                      // Or 410, etc., as needed
                    }
                    // Determine the pane name based on alignment.
                    // const paneName = layerSpec.alignment === "left" ? "leftPane" : "rightPane";
                    // const paneName = layerSpec.alignment + "-" + layerSpec.orientation;

                    // Remove only layers in the current pane (unless they belong to mimicStreetPane)
                    mapInstanceRef.current?.eachLayer((layer) => {
                      if (!(layer instanceof L.TileLayer)) {
                        if (!(layer.options && layer.options.pane === 'mimicStreetPane') &&
                        layer.options?.pane === paneName) {
                          mapInstanceRef.current.removeLayer(layer);
                        }
                      }
                    });

                    // Create an SVG layer in the proper pane with a unique class.
                    const svgLayer = L.svg({
                      pane: paneName,
                      className: "gMap-" + layerSpec.alignment
                    }).addTo(mapInstanceRef.current);

                    // Create an SVG group inside that pane.
                    const svgGroup = d3.select(mapInstanceRef.current.getPanes()[paneName])
                                      .select("svg")
                                      .append("g")
                                      .attr("class", "leaflet-zoom-hide");

                    // We'll use this group as the container for drawing (it’s independent for each alignment).
                    const group = svgGroup;
                    
                    // Create separate groups for left and right
                    const leftGroup = svgGroup.append("g").attr("class", "rect-left");
                    const rightGroup = svgGroup.append("g").attr("class", "rect-right");
            
                    // --- Helper Functions ---
                    // Offset a point by a certain distance (in meters) at a given bearing (in degrees)
                    function offsetPoint(lat, lon, bearing, distance) {
                      const R = 6378137; // Earth radius in meters
                      const toRad = Math.PI / 180;
                      const lat1 = lat * toRad;
                      const lon1 = lon * toRad;
                      const brng = bearing * toRad;
                      const dR = distance / R;
                      const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dR) +
                                            Math.cos(lat1) * Math.sin(dR) * Math.cos(brng));
                      const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(dR) * Math.cos(lat1),
                                                    Math.cos(dR) - Math.sin(lat1) * Math.sin(lat2));
                      return [ lat2 / toRad, lon2 / toRad ];
                    }
            
                    // Convert geographic coordinates to SVG layer points
                    function projectPoint(lat, lon) {
                      const point = mapInstanceRef.current!.latLngToLayerPoint(new L.LatLng(lat, lon));
                      return [ point.x, point.y ];
                    }
            
                    // Calculate bearing between two points
                    function bearingBetweenPoints(lat1, lon1, lat2, lon2) {
                      const toRad = Math.PI / 180;
                      const phi1 = lat1 * toRad;
                      const phi2 = lat2 * toRad;
                      const dLon = (lon2 - lon1) * toRad;
                      const y = Math.sin(dLon) * Math.cos(phi2);
                      const x = Math.cos(phi1) * Math.sin(phi2) -
                                Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
                      let brng = Math.atan2(y, x) * (180 / Math.PI);
                      return (brng + 360) % 360;
                    }
            
                    // Normalize the segment by swapping start and end if needed (assumes a Bearing property in extras)
                    function normalizeSegment(segment) {
                      const start = segment[0];
                      const end = segment[1];
                      let bearing = segment[2].Bearing;
                      bearing = ((bearing % 360) + 360) % 360;
                      if (bearing >= 180) {
                        // Swap start & end
                        const temp = { lat: start.lat, lon: start.lon };
                        start.lat = end.lat;   start.lon = end.lon;
                        end.lat = temp.lat;    end.lon = temp.lon;
                        bearing -= 180;
                      }
                      segment[2].Bearing = bearing;
                    }
            
                    // Draw a polygon using an array of [x, y] coordinates
                    function drawPolygon(g, corners, color) {
                      const pointsStr = corners.map(pt => pt.join(",")).join(" ");
                      g.append("polygon")
                      .attr("points", pointsStr)
                      .style("fill", color)
                      .style("fill-opacity", 0.4);
                    }
                    // --- End Helper Functions ---
            
                    // For each edge, assign random left/right widths (or you could use attribute values)
                    updatedGeoJsonData.edges.forEach(function(segment) {
                      segment[2].Bearing = bearingBetweenPoints(segment[0].lat, segment[0].lon,
                        segment[1].lat, segment[1].lon);
                      normalizeSegment(segment);
                      segment._leftWidth = Math.random() * 20 + 10;  // width between 10 and 30 meters
                      segment._rightWidth = Math.random() * 20 + 10;
                    });

                    function getWidth(segment, updatedGeoJsonData){
                      let lineWidth   = layerSpec.lineStrokeWidth;
                      // (B) lineWidth
                      if (typeof lineWidth === "string") {
                        const attrIndexWidth = segment.findIndex((e) => e.hasOwnProperty(lineWidth));
                        if (attrIndexWidth !== -1) {
                          const attributeValues = updatedGeoJsonData.edges
                            .flatMap((edg) => edg.filter((entry) => entry.hasOwnProperty(lineWidth))
                                                .map((entry) => entry[lineWidth]))
                            .filter((v) => v !== undefined);
                          const minValue = d3.min(attributeValues);
                          const maxValue = d3.max(attributeValues);
                          // console.log("min and max width val check:", minValue, maxValue)
                          const attributeValue = segment[attrIndexWidth][lineWidth];
                          if (minValue !== undefined && maxValue !== undefined && attributeValue !== undefined) {
                            const lineWidthScale = d3.scaleLinear().domain([minValue, maxValue]).range([0, 10]);
                            lineWidth = lineWidthScale(attributeValue);
                          }
                        } else {
                          lineWidth = 5;
                        }
                      } else if (typeof lineWidth === "number") {
                        lineWidth = layerSpec.lineStrokeWidth;
                      } else {
                        lineWidth = 5;
                      }
                      return lineWidth
                    }
                    function getColor(segment, updatedGeoData){
                      // (A) lineColor
                      let lineColor   = layerSpec.lineColor   || "red";
                      const attrIndexColor = segment.findIndex((e) => e.hasOwnProperty(lineColor));
                      if (attrIndexColor !== -1) {
                        const attributeValues = updatedGeoJsonData.edges
                          .flatMap((edg) => edg.filter((entry) => entry.hasOwnProperty(lineColor))
                                              .map((entry) => entry[lineColor]))
                          .filter((v) => v !== undefined);
                        const minValue = d3.min(attributeValues);
                        const maxValue = d3.max(attributeValues);
                        // console.log("min and max col val check:", minValue, maxValue)
                        const attributeValue = segment[attrIndexColor][lineColor];
                        if (minValue !== undefined && maxValue !== undefined && attributeValue !== undefined) {
                          const colorScale = d3.scaleSequential(d3.interpolateBuGn).domain([minValue, maxValue]);
                          lineColor = colorScale(attributeValue);
                        }
                      }
                      return lineColor
                    }

                    function getOpacity(segment, updatedGeoData){
                      let lineOpacity = layerSpec.strokeOpacity || 1;
                      // (C) lineOpacity
                      if (typeof lineOpacity === "number" && lineOpacity >= 0 && lineOpacity <= 1) {
                        lineOpacity = lineOpacity;
                      } else if (typeof lineOpacity === "string") {
                        const opacityIndex = segment.findIndex((e) => e.hasOwnProperty(lineOpacity));
                        if (opacityIndex !== -1) {
                          const attributeValues = updatedGeoJsonData.edges
                            .flatMap((edg) => edg.filter((entry) => entry.hasOwnProperty(lineOpacity))
                                                .map((entry) => entry[lineOpacity]))
                            .filter((v) => v !== undefined);
                          const minValue = d3.min(attributeValues);
                          const maxValue = d3.max(attributeValues);
                          const attributeValue = segment[opacityIndex][lineOpacity];
                          if (minValue !== undefined && maxValue !== undefined && attributeValue !== undefined) {
                            const opacityScale = d3.scaleLinear().domain([minValue, maxValue]).range([0, 1]);
                            lineOpacity = opacityScale(attributeValue);
                          }
                        }
                      }
                      return lineOpacity
                    }
                    
            
                    // Draw rectangles (4-corner polygons) for each edge
                    updatedGeoJsonData.edges.forEach(function(segment) {

                      
                      const lineWidth = getWidth(segment, updatedGeoJsonData)
                      const lineColor = getColor(segment, updatedGeoJsonData)
                      const lineOpacity = getOpacity(segment, updatedGeoJsonData)







                      const start = segment[0];
                      const end = segment[1];
                      // Compute the bearing between start and end
                      const bearing = bearingBetweenPoints(start.lat, start.lon, end.lat, end.lon);

                      if(layerSpec.alignment === "left"){
                        const leftBearing = (bearing + 90) % 360;
                        // Determine left/right insets
                        const inset = 5; // fixed inset distance in meters
            
                        // Inside edge offsets for LEFT side
                        const [sLeftLat, sLeftLon] = offsetPoint(start.lat, start.lon, leftBearing, inset);
                        const [eLeftLat, eLeftLon] = offsetPoint(end.lat, end.lon, leftBearing, inset);
            
                        // Compute bearing of the inside edge lines
                        const bLeftLine = bearingBetweenPoints(sLeftLat, sLeftLon, eLeftLat, eLeftLon);
            
                        // Outward offsets: for left side use (bLeftLine + 270) % 360, for right side use (bRightLine + 90) % 360
                        const outwardLeft = (bLeftLine + 90) % 360;
                        const wLeft = segment._leftWidth;
            
                        // Outer corners for LEFT side
                        const [sLeft2Lat, sLeft2Lon] = offsetPoint(sLeftLat, sLeftLon, outwardLeft, wLeft);
                        const [eLeft2Lat, eLeft2Lon] = offsetPoint(eLeftLat, eLeftLon, outwardLeft, wLeft);
                        
            
                        // Convert geographic coordinates to screen (SVG) coordinates
                        const sLeftXY  = projectPoint(sLeftLat, sLeftLon);
                        const eLeftXY  = projectPoint(eLeftLat, eLeftLon);
                        const sLeft2XY = projectPoint(sLeft2Lat, sLeft2Lon);
                        const eLeft2XY = projectPoint(eLeft2Lat, eLeft2Lon);
            
            
                      // Draw left-side polygon (blue) and right-side polygon (green)
                      // drawPolygon(svgGroup, [ sLeftXY, eLeftXY, eLeft2XY, sLeft2XY ], "blue");
                      // drawPolygon(svgGroup, [ sRightXY, eRightXY, eRight2XY, sRight2XY ], "green");
                      leftGroup.append("polygon")
                              .attr("points", [ sLeftXY, eLeftXY, eLeft2XY, sLeft2XY ]
                                                .map(pt => pt.join(",")).join(" "))
                              .style("fill", lineColor)
                              .style("fill-opacity", lineOpacity)
                              .style("stroke-width", lineWidth);

                      }
                      if(layerSpec.alignment === "right"){
                        // Determine left/right insets
                        const rightBearing = (bearing + 270) % 360;
                        const inset = 5; // fixed inset distance in meters
            
                        // Inside edge offsets for RIGHT side
                        const [sRightLat, sRightLon] = offsetPoint(start.lat, start.lon, rightBearing, inset);
                        const [eRightLat, eRightLon] = offsetPoint(end.lat, end.lon, rightBearing, inset);
            
                        // Compute bearing of the inside edge lines
                        const bRightLine = bearingBetweenPoints(sRightLat, sRightLon, eRightLat, eRightLon);
            
                        // Outward offsets: for left side use (bLeftLine + 270) % 360, for right side use (bRightLine + 90) % 360 
                        const outwardRight = (bRightLine + 270) % 360;
                        const wRight = segment._rightWidth;
            
                        // Outer corners for RIGHT side
                        const [sRight2Lat, sRight2Lon] = offsetPoint(sRightLat, sRightLon, outwardRight, wRight);
                        const [eRight2Lat, eRight2Lon] = offsetPoint(eRightLat, eRightLon, outwardRight, wRight);
            
                        // Convert geographic coordinates to screen (SVG) coordinates
                        const sRightXY  = projectPoint(sRightLat, sRightLon);
                        const eRightXY  = projectPoint(eRightLat, eRightLon);
                        const sRight2XY = projectPoint(sRight2Lat, sRight2Lon);
                        const eRight2XY = projectPoint(eRight2Lat, eRight2Lon);
            
                      // Draw left-side polygon (blue) and right-side polygon (green)
                      // drawPolygon(svgGroup, [ sLeftXY, eLeftXY, eLeft2XY, sLeft2XY ], "blue");
                      // drawPolygon(svgGroup, [ sRightXY, eRightXY, eRight2XY, sRight2XY ], "green");

                      // Draw right-side polygon with the same styling
                      rightGroup.append("polygon")
                              .attr("points", [ sRightXY, eRightXY, eRight2XY, sRight2XY ]
                                                .map(pt => pt.join(",")).join(" "))
                              .style("fill", lineColor)
                              .style("fill-opacity", lineOpacity)
                              .style("stroke-width", lineWidth);

                      }
            
                      
                    });
            
                    // Update rectangles on map movements (pan/zoom)
                    function updateRectangles() {
                      if(layerSpec.alignment === "left"){leftGroup.selectAll("*").remove();}
                      if(layerSpec.alignment === "right"){rightGroup.selectAll("*").remove();}

                      // svgGroup.selectAll("*").remove();
                      updatedGeoJsonData.edges.forEach(function(segment) {
                        normalizeSegment(segment);
                        const start = segment[0];
                        const end = segment[1];
                        const bearing = bearingBetweenPoints(start.lat, start.lon, end.lat, end.lon);
                        const lineWidth = getWidth(segment, updatedGeoJsonData)
                        const lineColor = getColor(segment, updatedGeoJsonData)
                        const lineOpacity = getOpacity(segment, updatedGeoJsonData)

                        if(layerSpec.alignment === "left"){
                          const leftBearing = (bearing + 90) % 360;
                          const inset = 5;
                          const [sLeftLat, sLeftLon] = offsetPoint(start.lat, start.lon, leftBearing, inset);
                          const [eLeftLat, eLeftLon] = offsetPoint(end.lat, end.lon, leftBearing, inset);
                          const bLeftLine = bearingBetweenPoints(sLeftLat, sLeftLon, eLeftLat, eLeftLon);
                          const outwardLeft = (bLeftLine + 90) % 360;
                          const wLeft = segment._leftWidth;
                          const [sLeft2Lat, sLeft2Lon] = offsetPoint(sLeftLat, sLeftLon, outwardLeft, wLeft);
                        const [eLeft2Lat, eLeft2Lon] = offsetPoint(eLeftLat, eLeftLon, outwardLeft, wLeft);
                        const sLeftXY  = projectPoint(sLeftLat, sLeftLon);
                        const eLeftXY  = projectPoint(eLeftLat, eLeftLon);
                        const sLeft2XY = projectPoint(sLeft2Lat, sLeft2Lon);
                        const eLeft2XY = projectPoint(eLeft2Lat, eLeft2Lon);

                        leftGroup.append("polygon")
                              .attr("points", [ sLeftXY, eLeftXY, eLeft2XY, sLeft2XY ]
                                                .map(pt => pt.join(",")).join(" "))
                              .style("fill", lineColor)
                              .style("fill-opacity", lineOpacity)
                              .style("stroke-width", lineWidth);
                        }
                        if(layerSpec.alignment === "right"){
                          // rightGroup.selectAll("*").remove();
                          const rightBearing = (bearing + 270) % 360;
                          const inset = 5;
                          const [sRightLat, sRightLon] = offsetPoint(start.lat, start.lon, rightBearing, inset);
                          const [eRightLat, eRightLon] = offsetPoint(end.lat, end.lon, rightBearing, inset);
                          
                          const bRightLine = bearingBetweenPoints(sRightLat, sRightLon, eRightLat, eRightLon);
                          
                          const outwardRight = (bRightLine + 270) % 360;
                          
                          const wRight = segment._rightWidth;
                          
                          const [sRight2Lat, sRight2Lon] = offsetPoint(sRightLat, sRightLon, outwardRight, wRight);
                          const [eRight2Lat, eRight2Lon] = offsetPoint(eRightLat, eRightLon, outwardRight, wRight);
                          
                          const sRightXY  = projectPoint(sRightLat, sRightLon);
                          const eRightXY  = projectPoint(eRightLat, eRightLon);
                          const sRight2XY = projectPoint(sRight2Lat, sRight2Lon);
                          const eRight2XY = projectPoint(eRight2Lat, eRight2Lon);
                          

                        // Draw right-side polygon with the same styling
                        rightGroup.append("polygon")
                                .attr("points", [ sRightXY, eRightXY, eRight2XY, sRight2XY ]
                                                  .map(pt => pt.join(",")).join(" "))
                                .style("fill", lineColor)
                                .style("fill-opacity", lineOpacity)
                                .style("stroke-width", lineWidth);

                        }
                      });
                    }
            
                    mapInstanceRef.current!.on("moveend", updateRectangles);
                    currentLayersRef.current.push(svgLayer);
            
                  }).catch(error => {
                    console.error("Failed to load thematic JSON data:", error);
                  });
                } else {
                  console.error("Data is missing edges or is invalid.");
                }
              }).catch(error => {
                console.error("Failed to load physical JSON data:", error);
              });
            }
            else if(layerSpec.orientation === 'perpendicular'){
              let updatedGeoJsonData;
              d3.json(layerSpec.physicalLayerPath).then(function (data) {
                if (data && data.edges) {
                  // 1) Subdivide edges if needed
                  var subdividedEdges = [];
                  data.edges.forEach(function (edge) {
                    var start = edge[0];
                    var end   = edge[1];
                    var extras = edge.slice(2);

                    var lat0 = start.lat, lon0 = start.lon,
                        lat1 = end.lat,   lon1 = end.lon;
                    var dLat = lat1 - lat0, dLon = lon1 - lon0;

                    for (var i = 0; i < layerSpec.unitDivide; i++) {
                      // Skip the first two (i < 2) and last two (i >= layerSpec.unitDivide - 2)
                      let Gap;

                      if(layerSpec.unitDivide<8){
                        Gap = 2
                      }else if(layerSpec.unitDivide>8 && layerSpec.unitDivide<15){
                        Gap = 4
                      }else{
                        Gap = 6
                      }
                      if (i < 2 || i >= layerSpec.unitDivide - 2 ) {
                        continue; // Do not push these subdivided segments
                      }
                      var segStartLat = lat0 + dLat * (i / layerSpec.unitDivide);
                      var segStartLon = lon0 + dLon * (i / layerSpec.unitDivide);
                      var segEndLat   = lat0 + dLat * ((i + 1) / layerSpec.unitDivide);
                      var segEndLon   = lon0 + dLon * ((i + 1) / layerSpec.unitDivide);

                      var newStart = { lat: segStartLat, lon: segStartLon };
                      var newEnd   = { lat: segEndLat,   lon: segEndLon };
                      var newEdge  = [ newStart, newEnd ].concat(extras);
                      subdividedEdges.push(newEdge);
                    }
                  });
                  subdividedEdges = { edges: subdividedEdges };

                  // 2) Aggregate with thematic data
                  d3.json(layerSpec.thematicLayerPath).then(function (thematicData) {
                    // Apply spatial aggregation
                    if (layerSpec.spatialRelation === 'contains') {
                      updatedGeoJsonData = aggregationContains(subdividedEdges, thematicData, layerSpec.AggregationType, layerSpec.unit);
                      console.log("data is:", updatedGeoJsonData);
                    } else if (layerSpec.spatialRelation === 'nearest neighbor') {
                      updatedGeoJsonData = aggregateEdgeData(subdividedEdges.edges, thematicData, layerSpec.AggregationType);
                    } else if (layerSpec.spatialRelation === 'buffer') {
                      updatedGeoJsonData = BufferDataAggregationSegment(subdividedEdges, thematicData, layerSpec.bufferValue, layerSpec.AggregationType);
                    }
                    updatedGeoJsonData = { edges: updatedGeoJsonData };
                    console.log("data check for rect2", updatedGeoJsonData);

                    // 3) Prepare style parameters
                   

                    // 4) Create separate panes for left and right (if not existing)
                    const paneName = layerSpec.alignment + "-" + layerSpec.orientation;

            
            
                    // Create separate panes for left and right if not already created.
                    // if (!mapInstanceRef.current.getPane("leftPane")) {
                    //   mapInstanceRef.current.createPane("leftPane");
                    //   mapInstanceRef.current.getPane("leftPane").style.zIndex = 400;
                    // }
                    // if (!mapInstanceRef.current.getPane("rightPane")) {
                    //   mapInstanceRef.current.createPane("rightPane");
                    //   mapInstanceRef.current.getPane("rightPane").style.zIndex = 410;
                    // }
                    if (!mapInstanceRef.current.getPane(paneName)) {
                      mapInstanceRef.current.createPane(paneName);
                      mapInstanceRef.current.getPane(paneName).style.zIndex = 400; 
                      // Or 410, etc., as needed
                    }
                    // Determine the pane name based on alignment.
                    // const paneName = layerSpec.alignment === "left" ? "leftPane" : "rightPane";
                    // const paneName = layerSpec.alignment + "-" + layerSpec.orientation;

                    // Remove only layers in the current pane (unless they belong to mimicStreetPane)
                    mapInstanceRef.current?.eachLayer((layer) => {
                      if (!(layer instanceof L.TileLayer)) {
                        if (!(layer.options && layer.options.pane === 'mimicStreetPane') &&
                        layer.options?.pane === paneName) {
                          mapInstanceRef.current.removeLayer(layer);
                        }
                      }
                    });

                    // Create an SVG layer in the chosen pane
                    const svgLayer = L.svg({
                      pane: paneName,
                      className: "gMap-" + layerSpec.alignment
                    }).addTo(mapInstanceRef.current);

                    // Create an SVG group inside that pane
                    const svgGroup = d3.select(mapInstanceRef.current.getPanes()[paneName])
                                      .select("svg")
                                      .append("g")
                                      .attr("class", "leaflet-zoom-hide");

                    // We'll separate lines for left & right
                    const leftGroup  = svgGroup.append("g").attr("class", "hedge-left");
                    const rightGroup = svgGroup.append("g").attr("class", "hedge-right");

                    // --- Helper Functions ---
                    function offsetPoint(lat, lon, bearing, distance) {
                      const R = 6378137;
                      const toRad = Math.PI / 180;
                      const lat1 = lat * toRad, lon1 = lon * toRad, brng = bearing * toRad;
                      const dR = distance / R;
                      const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dR) +
                                            Math.cos(lat1) * Math.sin(dR) * Math.cos(brng));
                      const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(dR) * Math.cos(lat1),
                                                    Math.cos(dR) - Math.sin(lat1) * Math.sin(lat2));
                      return [ lat2 / toRad, lon2 / toRad ];
                    }
                    function projectPoint(lat, lon) {
                      const point = mapInstanceRef.current.latLngToLayerPoint(new L.LatLng(lat, lon));
                      return [ point.x, point.y ];
                    }
                    function bearingBetweenPoints(lat1, lon1, lat2, lon2) {
                      const toRad = Math.PI / 180;
                      const phi1 = lat1 * toRad, phi2 = lat2 * toRad;
                      const dLon = (lon2 - lon1) * toRad;
                      const y = Math.sin(dLon) * Math.cos(phi2);
                      const x = Math.cos(phi1)*Math.sin(phi2) -
                                Math.sin(phi1)*Math.cos(phi2)*Math.cos(dLon);
                      let brng = Math.atan2(y, x) * (180 / Math.PI);
                      return (brng + 360) % 360;
                    }
                    function normalizeSegment(segment) {
                      const start = segment[0], end = segment[1];
                      let bearing = segment[2].Bearing;
                      bearing = ((bearing % 360) + 360) % 360;
                      if (bearing >= 180) {
                        const temp = { lat: start.lat, lon: start.lon };
                        start.lat = end.lat;   start.lon = end.lon;
                        end.lat   = temp.lat;  end.lon   = temp.lon;
                        bearing  -= 180;
                      }
                      segment[2].Bearing = bearing;
                    }

                    function getLineWidth(baseWidth) {
                      // baseWidth is your “default” stroke at low zoom
                      const zoom = mapInstanceRef.current.getZoom();
                      // console.log("zoom and basewidth", zoom, baseWidth)
                      
                      if (zoom <= 16) {
                        // Zoom 1–5: just use base width
                        return baseWidth; 
                      } else if (zoom > 16 && zoom <= 17) {
                        // Zoom 6–8: a little wider
                        return baseWidth * 1.5; 
                      } else if (zoom > 17 && zoom <= 18) {
                        // Zoom 9–12: more wide
                        return baseWidth * 2;
                      } else {
                        // Zoom above 12: even wider
                        return baseWidth * 3;
                      }
                    }

                    // Function to get "height" for each line from layerSpec.height
                    function getLineHeight(segment, updatedGeoJsonData) {
                      let height = layerSpec.height;
                      if (typeof height === "string") {
                        // Interpret as an attribute name
                        const attributeIndex = segment.findIndex((e) => e.hasOwnProperty(height));
                        if (attributeIndex !== -1) {
                          const attributeValues = updatedGeoJsonData.edges
                            .flatMap((edg) =>
                              edg.filter((entry) => entry.hasOwnProperty(height)).map((entry) => entry[height])
                            )
                            .filter((v) => v !== undefined);
                          const minValue = d3.min(attributeValues);
                          const maxValue = d3.max(attributeValues);
                          // console.log("min and max height val check:", minValue, maxValue)
                          const attributeValue = segment[attributeIndex][height];
                          if (minValue !== undefined && maxValue !== undefined && attributeValue !== undefined) {
                            // Map attribute values to [5..30], for example
                            const heightScale = d3.scaleLinear().domain([minValue, maxValue]).range([0, 5]);
                            height = heightScale(attributeValue);
                          } else {
                            height = 5; // default if not found or invalid
                          }
                        } else {
                          height = 5; // default if attribute not found
                        }
                      } else if (typeof height === "number") {
                        // Use the numeric value directly
                        height = layerSpec.height;
                      } else {
                        height = 5; // default
                      }
                      height = getLineWidth(height)
                      return height;
                    }

                    function getWidth(segment, updatedGeoJsonData){
                      let lineWidth   = layerSpec.lineStrokeWidth;
                      // (B) lineWidth
                      if (typeof lineWidth === "string") {
                        const attrIndexWidth = segment.findIndex((e) => e.hasOwnProperty(lineWidth));
                        if (attrIndexWidth !== -1) {
                          const attributeValues = updatedGeoJsonData.edges
                            .flatMap((edg) => edg.filter((entry) => entry.hasOwnProperty(lineWidth))
                                                .map((entry) => entry[lineWidth]))
                            .filter((v) => v !== undefined);
                          const minValue = d3.min(attributeValues);
                          const maxValue = d3.max(attributeValues);
                          // console.log("min and max width val check:", minValue, maxValue)
                          const attributeValue = segment[attrIndexWidth][lineWidth];
                          if (minValue !== undefined && maxValue !== undefined && attributeValue !== undefined) {
                            const lineWidthScale = d3.scaleLinear().domain([minValue, maxValue]).range([0, 5]);
                            lineWidth = lineWidthScale(attributeValue);
                          }
                        } else {
                          lineWidth = 5;
                        }
                      } else if (typeof lineWidth === "number") {
                        lineWidth = layerSpec.lineStrokeWidth;
                      } else {
                        lineWidth = 5;
                      }
                      lineWidth = getLineWidth(lineWidth)
                      return lineWidth
                    }
                    function getColor(segment, updatedGeoData){
                      // (A) lineColor
                      let lineColor   = layerSpec.lineColor   || "red";
                      const attrIndexColor = segment.findIndex((e) => e.hasOwnProperty(lineColor));
                      if (attrIndexColor !== -1) {
                        const attributeValues = updatedGeoJsonData.edges
                          .flatMap((edg) => edg.filter((entry) => entry.hasOwnProperty(lineColor))
                                              .map((entry) => entry[lineColor]))
                          .filter((v) => v !== undefined);
                        const minValue = d3.min(attributeValues);
                        const maxValue = d3.max(attributeValues);
                        // console.log("min and max col val check:", minValue, maxValue)
                        const attributeValue = segment[attrIndexColor][lineColor];
                        if (minValue !== undefined && maxValue !== undefined && attributeValue !== undefined) {
                          const colorScale = d3.scaleSequential(d3.interpolateBuGn).domain([minValue, maxValue]);
                          lineColor = colorScale(attributeValue);
                        }
                      }
                      return lineColor
                    }

                    function getOpacity(segment, updatedGeoData){
                      let lineOpacity = layerSpec.strokeOpacity || 1;
                      // (C) lineOpacity
                      if (typeof lineOpacity === "number" && lineOpacity >= 0 && lineOpacity <= 1) {
                        lineOpacity = lineOpacity;
                      } else if (typeof lineOpacity === "string") {
                        const opacityIndex = segment.findIndex((e) => e.hasOwnProperty(lineOpacity));
                        if (opacityIndex !== -1) {
                          const attributeValues = updatedGeoJsonData.edges
                            .flatMap((edg) => edg.filter((entry) => entry.hasOwnProperty(lineOpacity))
                                                .map((entry) => entry[lineOpacity]))
                            .filter((v) => v !== undefined);
                          const minValue = d3.min(attributeValues);
                          const maxValue = d3.max(attributeValues);
                          const attributeValue = segment[opacityIndex][lineOpacity];
                          if (minValue !== undefined && maxValue !== undefined && attributeValue !== undefined) {
                            const opacityScale = d3.scaleLinear().domain([minValue, maxValue]).range([0, 1]);
                            lineOpacity = opacityScale(attributeValue);
                          }
                        }
                      }
                      return lineOpacity
                    }

                    // 5) For each edge, set up data & draw lines
                    updatedGeoJsonData.edges.forEach(function(segment) {
                      segment[2].Bearing = bearingBetweenPoints(segment[0].lat, segment[0].lon,
                        segment[1].lat, segment[1].lon);
                      // 5A) Normalize bearing & compute lineColor/lineWidth/lineOpacity (as in your snippet)
                      normalizeSegment(segment);

                      // --- Dynamic styling for color/width/opacity (already shown above) ---
                    
                      
                    

                      // 5B) Get the line "height" from layerSpec.height attribute
                      const hedgehogHeight = getLineHeight(segment, updatedGeoJsonData); // 5..30 or numeric
                      const lineWidth = getWidth(segment, updatedGeoJsonData)
                      const lineColor = getColor(segment, updatedGeoJsonData)
                      const lineOpacity = getOpacity(segment, updatedGeoJsonData)

                      // 5C) Compute midpoint & offset
                      const start = segment[0], end = segment[1];
                      const bearing = bearingBetweenPoints(start.lat, start.lon, end.lat, end.lon);
                      const midLat = (start.lat + end.lat) / 2;
                      const midLon = (start.lon + end.lon) / 2;

                      // 5D) Left or right alignment => offset & draw
                      if (layerSpec.alignment === "left") {
                        // offset bearing = (bearing + 270)
                        const offsetBearing = (bearing + 270) % 360;
                        // offset midpoint by 5m
                        const [mLeftLat, mLeftLon] = offsetPoint(midLat, midLon, offsetBearing, 5);

                        // outward line => same offsetBearing, length = hedgehogHeight
                        const [mLeft2Lat, mLeft2Lon] = offsetPoint(mLeftLat, mLeftLon, offsetBearing, hedgehogHeight);

                        // convert to screen coords
                        const p1 = projectPoint(mLeftLat,  mLeftLon);
                        const p2 = projectPoint(mLeft2Lat, mLeft2Lon);

                        // console.log("checkinh LineWidth for each", lineWidth)

                        // draw line
                        leftGroup.append("line")
                          .attr("x1", p1[0]).attr("y1", p1[1])
                          .attr("x2", p2[0]).attr("y2", p2[1])
                          .style("stroke", lineColor)
                          .style("stroke-opacity", lineOpacity)
                          .style("stroke-width", lineWidth)
                          .style("stroke-linecap", "round");

                      } else if (layerSpec.alignment === "right") {
                        // offset bearing = (bearing + 90)
                        const offsetBearing = (bearing + 90) % 360;
                        // offset midpoint by 5m
                        const [mRightLat, mRightLon] = offsetPoint(midLat, midLon, offsetBearing, 5);

                        // outward line => same offsetBearing, length = hedgehogHeight
                        const [mRight2Lat, mRight2Lon] = offsetPoint(mRightLat, mRightLon, offsetBearing, hedgehogHeight);

                        const p1 = projectPoint(mRightLat,  mRightLon);
                        const p2 = projectPoint(mRight2Lat, mRight2Lon);

                        rightGroup.append("line")
                          .attr("x1", p1[0]).attr("y1", p1[1])
                          .attr("x2", p2[0]).attr("y2", p2[1])
                          .style("stroke", lineColor)
                          .style("stroke-opacity", lineOpacity)
                          .style("stroke-width", lineWidth)
                          .style("stroke-linecap", "round");
                      }
                    });

                    // 6) Update on map movements
                    function updateRectangles() {
                      // Clear lines from the relevant group
                      if (layerSpec.alignment === "left") {
                        leftGroup.selectAll("*").remove();
                      }
                      if (layerSpec.alignment === "right") {
                        rightGroup.selectAll("*").remove();
                      }

                      // Redraw lines
                      updatedGeoJsonData.edges.forEach(function(segment) {
                        normalizeSegment(segment);
                        const hedgehogHeight = getLineHeight(segment, updatedGeoJsonData);
                        const lineWidth = getWidth(segment, updatedGeoJsonData)
                        const lineColor = getColor(segment, updatedGeoJsonData)
                        const lineOpacity = getOpacity(segment, updatedGeoJsonData)

                        const start = segment[0], end = segment[1];
                        const bearing = bearingBetweenPoints(start.lat, start.lon, end.lat, end.lon);
                        const midLat = (start.lat + end.lat) / 2;
                        const midLon = (start.lon + end.lon) / 2;

                        if (layerSpec.alignment === "left") {
                          const offsetBearing = (bearing + 270) % 360;
                          const [mLeftLat, mLeftLon] = offsetPoint(midLat, midLon, offsetBearing, 5);
                          const [mLeft2Lat, mLeft2Lon] = offsetPoint(mLeftLat, mLeftLon, offsetBearing, hedgehogHeight);

                          const p1 = projectPoint(mLeftLat,  mLeftLon);
                          const p2 = projectPoint(mLeft2Lat, mLeft2Lon);

                          leftGroup.append("line")
                            .attr("x1", p1[0]).attr("y1", p1[1])
                            .attr("x2", p2[0]).attr("y2", p2[1])
                            .style("stroke", lineColor)
                            .style("stroke-opacity", lineOpacity)
                            .style("stroke-width", lineWidth)
                            .style("stroke-linecap", "round");

                        } else if (layerSpec.alignment === "right") {
                          const offsetBearing = (bearing + 90) % 360;
                          const [mRightLat, mRightLon] = offsetPoint(midLat, midLon, offsetBearing, 5);
                          const [mRight2Lat, mRight2Lon] = offsetPoint(mRightLat, mRightLon, offsetBearing, hedgehogHeight);

                          const p1 = projectPoint(mRightLat,  mRightLon);
                          const p2 = projectPoint(mRight2Lat, mRight2Lon);

                          rightGroup.append("line")
                            .attr("x1", p1[0]).attr("y1", p1[1])
                            .attr("x2", p2[0]).attr("y2", p2[1])
                            .style("stroke", lineColor)
                            .style("stroke-opacity", lineOpacity)
                            .style("stroke-width", lineWidth)
                            .style("stroke-linecap", "round");
                        }
                      });
                    }

                    mapInstanceRef.current.on("moveend", updateRectangles);
                    currentLayersRef.current.push(svgLayer);

                  }).catch(error => {
                    console.error("Failed to load thematic JSON data:", error);
                  });
                } else {
                  console.error("Data is missing edges or is invalid.");
                }
              }).catch(error => {
                console.error("Failed to load physical JSON data:", error);
              });
              

            }
          }



          else if(layerSpec.chart){
            // console.log(layerSpec)
            d3.json(layerSpec.physicalLayerPath).then((data: any) => {
              if (data && data.edges){
                mapInstanceRef.current?.eachLayer((layer) => {
                  if (!(layer instanceof L.TileLayer)) {
                    // Check if the layer's pane is NOT the mimic street pane before removing
                    if (!(layer.options && layer.options.pane === 'mimicStreetPane')) {
                      mapInstanceRef.current!.removeLayer(layer);
                    }
                  }
                });


                if (layerSpec.unitDivide == 1){
                  data = data;
                }else{
                  var subdividedEdges = [];

                  // Loop through each edge in the original array
                  data.edges.forEach(function(edge) {
                    // Get the start and end coordinates
                    var start = edge[0]; // [lat, lon]
                    var end = edge[1];   // [lat, lon]
                    // Get the extra values (indices 2 to 12)
                    var extras = edge.slice(2);

                    // Destructure the coordinates
                    var lat0 = start["lat"],
                        lon0 = start["lon"],
                        lat1 = end["lat"],
                        lon1 = end["lon"];

                    // Calculate the total difference between the start and end points
                    var dLat = lat1 - lat0;
                    var dLon = lon1 - lon0;

                    // Subdivide this edge into `unitDivide` segments
                    for (var i = 0; i < layerSpec.unitDivide; i++) {
                      // Calculate the start coordinate of the new segment
                      var segStartLat = lat0 + dLat * (i / layerSpec.unitDivide);
                      var segStartLon = lon0 + dLon * (i / layerSpec.unitDivide);
                      // console.log("calculation lat lon", segStartLat, segStartLon)

                      // Calculate the end coordinate of the new segment
                      var segEndLat = lat0 + dLat * ((i + 1) / layerSpec.unitDivide);
                      var segEndLon = lon0 + dLon * ((i + 1) / layerSpec.unitDivide);

                      // Build new coordinate objects
                      var newStart = { lat: segStartLat, lon: segStartLon };
                      var newEnd = { lat: segEndLat, lon: segEndLon };


                      // Create the new edge. The new edge will contain:
                      //  - The new start coordinate
                      //  - The new end coordinate
                      //  - The same extra values from the original edge
                      var newEdge = [
                        newStart,newEnd
                      ].concat(extras);

                      subdividedEdges.push(newEdge);
                    }
                  });

                    console.log("data2 is:", subdividedEdges)




                    data = {
                    edges: subdividedEdges
                  };

                }

  
                vegaEmbed('#vis', layerSpec.chart, {renderer: 'svg', actions: false}).then(result => {
                  const vegaSVG = result.view._el.querySelector('svg');
                  const svgWidth = 150;
                  const svgHeight = 70;
  
                  // console.log(vegaSVG)
                  data.edges.forEach(edge => {
                    let start = edge[0];
                    let end = edge[1];
                    let bearing = edge[2].Bearing;
                    let angle = edge[2].Bearing + 90;
                    let midpoint;
                    if(layerSpec.alignment === 'center'){
                      midpoint = { lat: (start.lat + end.lat) / 2, lon: (start.lon + end.lon) / 2 };
                    } else if(layerSpec.alignment === 'top'){
                      midpoint = { lat: (start.lat + end.lat) / 2, lon: (start.lon + end.lon) / 2 };
                      midpoint = { lat: (start.lat + midpoint.lat) / 2, lon: (start.lon + midpoint.lon) / 2 };
                    }else if(layerSpec.alignment === 'bottom'){
                      midpoint = { lat: (start.lat + end.lat) / 2, lon: (start.lon + end.lon) / 2 };
                      midpoint = { lat: (midpoint.lat + end.lat) / 2, lon: (midpoint.lon + end.lon) / 2 };
                    }
                    
                    if(layerSpec.orientation=='perpendicular'){
                      angle = angle + 90;
                    }

                    let leftPoint;
                    let rightPoint

                    // Convert degrees to radians
                    function toRad(deg) {
                      return deg * Math.PI / 180;
                    }

                    // Convert radians to degrees
                    function toDeg(rad) {
                      return rad * 180 / Math.PI;
                    }

                    function destinationPoint(lat, lon, bearing, distance) {
                      const R = 6371000; // Earth radius in meters
                      const brng = toRad(bearing);
                      const lat1 = toRad(lat);
                      const lon1 = toRad(lon);
                      const dR = distance / R; // angular distance in radians
                
                      const lat2 = Math.asin(
                        Math.sin(lat1) * Math.cos(dR) +
                        Math.cos(lat1) * Math.sin(dR) * Math.cos(brng)
                      );
                      const lon2 = lon1 + Math.atan2(
                        Math.sin(brng) * Math.sin(dR) * Math.cos(lat1),
                        Math.cos(dR) - Math.sin(lat1) * Math.sin(lat2)
                      );
                
                      return { lat: toDeg(lat2), lon: toDeg(lon2) };
                    }

                    if(layerSpec.alignment=="left"){
                      if (bearing > 180) {
                        bearing = (bearing + 180) % 360;
                        // Swap start/end
                        const temp = start;
                        start = end;
                        end = temp;
                      }
                      const leftBearing = (bearing + 90) % 360;
                      leftPoint = destinationPoint(midpoint.lat, midpoint.lon, leftBearing, 50);
                    }
                    else if(layerSpec.alignment=="right"){
                      if (bearing > 180) {
                        bearing = (bearing + 180) % 360;
                        // Swap start/end
                        const temp = start;
                        start = end;
                        end = temp;
                      }
                      const rightBearing = (bearing - 90 + 360) % 360;
                      rightPoint = destinationPoint(midpoint.lat, midpoint.lon, rightBearing, 30);
                    }


                    let point;

  
                    const updateSvgPosition = () => {
                      if(layerSpec.alignment=="center"){
                        point = mapInstanceRef.current!.latLngToLayerPoint([midpoint.lat, midpoint.lon]);
                      }else if(layerSpec.alignment=="left"){
                        point = mapInstanceRef.current!.latLngToLayerPoint([leftPoint.lat, leftPoint.lon]);
                      }else if(layerSpec.alignment=="right"){
                        point = mapInstanceRef.current!.latLngToLayerPoint([rightPoint.lat, rightPoint.lon]);
                      }else if(layerSpec.alignment=="top"){
                        point = mapInstanceRef.current!.latLngToLayerPoint([midpoint.lat, midpoint.lon]);
                      }else if(layerSpec.alignment=="bottom"){
                        point = mapInstanceRef.current!.latLngToLayerPoint([midpoint.lat, midpoint.lon]);
                      }
                      // const point = mapInstanceRef.current!.latLngToLayerPoint([midpoint.lat, midpoint.lon]);
                      // const tempID = `t${midpoint.lat}${midpoint.lon}`.replace('.', '').replace('-', '') + 'svg';
                      const alignmentSuffix = layerSpec.alignment; // "left", "right", or "center"
                      const tempID = 't' + alignmentSuffix + '_' 
                                  + (midpoint.lat + midpoint.lon + '').replace('.', '').replace('-', '') 
                                  + 'svg';
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

          else if (layerSpec.shape === 'spike') {
            let updatedGeoJsonData;
          
            d3.json(layerSpec.physicalLayerPath).then(function (data: any) {
              if (data && data.edges) {
                var subdividedEdges = [];

                  // Loop through each edge in the original array
                  data.edges.forEach(function(edge) {
                    // Get the start and end coordinates
                    var start = edge[0]; // [lat, lon]
                    var end = edge[1];   // [lat, lon]
                    // Get the extra values (indices 2 to 12)
                    var extras = edge.slice(2);

                    // Destructure the coordinates
                    var lat0 = start["lat"],
                        lon0 = start["lon"],
                        lat1 = end["lat"],
                        lon1 = end["lon"];

                    // Calculate the total difference between the start and end points
                    var dLat = lat1 - lat0;
                    var dLon = lon1 - lon0;

                    // Subdivide this edge into `unitDivide` segments
                    for (var i = 0; i < layerSpec.unitDivide; i++) {
                      // Calculate the start coordinate of the new segment
                      var segStartLat = lat0 + dLat * (i / layerSpec.unitDivide);
                      var segStartLon = lon0 + dLon * (i / layerSpec.unitDivide);
                      // console.log("calculation lat lon", segStartLat, segStartLon)

                      // Calculate the end coordinate of the new segment
                      var segEndLat = lat0 + dLat * ((i + 1) / layerSpec.unitDivide);
                      var segEndLon = lon0 + dLon * ((i + 1) / layerSpec.unitDivide);

                      // Build new coordinate objects
                      var newStart = { lat: segStartLat, lon: segStartLon };
                      var newEnd = { lat: segEndLat, lon: segEndLon };


                      // Create the new edge. The new edge will contain:
                      //  - The new start coordinate
                      //  - The new end coordinate
                      //  - The same extra values from the original edge
                      var newEdge = [
                        newStart,newEnd
                      ].concat(extras);

                      subdividedEdges.push(newEdge);
                    }
                  });
                  updatedGeoJsonData = {
                    edges: subdividedEdges
                  };
                d3.json(layerSpec.thematicLayerPath).then(function (thematicData: any) {
                  // 1) Spatial Aggregation (unchanged)
                  if (layerSpec.spatialRelation === 'contains') {
                    updatedGeoJsonData = aggregationContains(updatedGeoJsonData, thematicData, layerSpec.AggregationType, layerSpec.unit);
                  } else if (layerSpec.spatialRelation === 'nearest neighbor') {
                    updatedGeoJsonData = aggregateEdgeData(updatedGeoJsonData.edges, thematicData, layerSpec.AggregationType);
                  } else if (layerSpec.spatialRelation === 'buffer') {
                    updatedGeoJsonData = BufferDataAggregationSegment(updatedGeoJsonData, thematicData, layerSpec.bufferValue, layerSpec.AggregationType);
                  }

                  updatedGeoJsonData = {
                    edges: updatedGeoJsonData
                  };
          
                  // 3) Remove old layers
                  mapInstanceRef.current?.eachLayer((layer) => {
                    if (!(layer instanceof L.TileLayer)) {
                      if (!(layer.options && layer.options.pane === 'mimicStreetPane')) {
                        mapInstanceRef.current!.removeLayer(layer);
                      }
                    }
                  });
          
                  // 4) Create Leaflet SVG layer
                  const svgLayer = L.svg().addTo(mapInstanceRef.current!);
                  const svgGroup = d3
                    .select(mapInstanceRef.current!.getPanes().overlayPane)
                    .select("svg")
                    .append("g")
                    .attr("class", "leaflet-zoom-hide");
          
                  const edgesArray = updatedGeoJsonData.edges;
          
                  // 5) Helper: get midpoint + project to map coords
                  function getMidpoint(segment: any) {
                    const lat1 = segment[0].lat, lon1 = segment[0].lon;
                    const lat2 = segment[1].lat, lon2 = segment[1].lon;
                    return { lat: (lat1 + lat2) / 2, lon: (lon1 + lon2) / 2 };
                  }
                  function projectPoint(lat: number, lon: number) {
                    return mapInstanceRef.current!.latLngToLayerPoint(new L.LatLng(lat, lon));
                  }
          
                  // 6) Spike path generator
                  function spikePath(length: number, width: number) {
                    return `M${-width / 2},0 L0,${-length} L${width / 2},0 Z`;
                  }
          
                  // 7) Main draw function
                  function updateSpikes() {
                    // Bind data
                    const selection = svgGroup.selectAll("path.mySpike").data(edgesArray);
          
                    selection
                      .join("path")
                      .attr("class", "mySpike")
                      // For each edge, compute color, width, opacity from your EXACT code snippet:
                      .each(function (edge: any) {
                        // ---------------------------
                        // 7a) EXACT color snippet
                        // ---------------------------
                        let lineColor = layerSpec.lineColor || "red";
                        const attributeIndex = edge.findIndex((e: any) => e.hasOwnProperty(lineColor));
                        if (attributeIndex !== -1) {
                          const attributeValues = updatedGeoJsonData.edges
                            .flatMap((e: any) =>
                              e.filter((entry: any) => entry.hasOwnProperty(lineColor)).map((entry: any) => entry[lineColor])
                            )
                            .filter((v: any) => v !== undefined);
                          const minValue = d3.min(attributeValues);
                          const maxValue = d3.max(attributeValues);
                          const attributeValue = edge[attributeIndex][lineColor];
                          if (minValue !== undefined && maxValue !== undefined && attributeValue !== undefined) {
                            // const colorScale = d3.scaleSequential(d3.interpolateInferno).domain([minValue, maxValue]);
                            const colorScale = d3.scaleSequential(d3.interpolateBuGn).domain([minValue, maxValue]);
                            lineColor = colorScale(attributeValue);
                          }
                        }
                        // Store the final color on the edge so we can read it in .attr
                        edge.__spikeColor = lineColor;
          
                        // ---------------------------
                        // 7b) EXACT width snippet
                        // ---------------------------
                        let lineWidth = layerSpec.lineStrokeWidth;
                        if (typeof lineWidth === "string") {
                          // Check if lineWidth is an attribute name in the data
                          const attributeIndex = edge.findIndex((e: any) => e.hasOwnProperty(lineWidth));
                          if (attributeIndex !== -1) {
                            const attributeValues = updatedGeoJsonData.edges
                              .flatMap((e: any) =>
                                e.filter((entry: any) => entry.hasOwnProperty(lineWidth)).map((entry: any) => entry[lineWidth])
                              )
                              .filter((v: any) => v !== undefined);
                            const minValue = d3.min(attributeValues);
                            const maxValue = d3.max(attributeValues);
                            const attributeValue = edge[attributeIndex][lineWidth];
                            if (minValue !== undefined && maxValue !== undefined && attributeValue !== undefined) {
                              // Map attribute values between 5 and 30 (example)
                              const lineWidthScale = d3.scaleLinear().domain([minValue, maxValue]).range([5, 30]);
                              lineWidth = lineWidthScale(attributeValue);
                            }
                          } else {
                            lineWidth = 5; // Default if attribute not found
                          }
                        } else if (typeof lineWidth === "number") {
                          // Use user-defined numeric value
                          lineWidth = layerSpec.lineStrokeWidth;
                        } else {
                          lineWidth = 5; // default
                        }
                        // Store final width on the edge
                        edge.__spikeWidth = lineWidth;


                        ////height
                        let height = layerSpec.height;
                        if (typeof height === "string") {
                          // Check if lineWidth is an attribute name in the data
                          const attributeIndex = edge.findIndex((e: any) => e.hasOwnProperty(height));
                          if (attributeIndex !== -1) {
                            const attributeValues = updatedGeoJsonData.edges
                              .flatMap((e: any) =>
                                e.filter((entry: any) => entry.hasOwnProperty(height)).map((entry: any) => entry[height])
                              )
                              .filter((v: any) => v !== undefined);
                            const minValue = d3.min(attributeValues);
                            const maxValue = d3.max(attributeValues);
                            const attributeValue = edge[attributeIndex][height];
                            if (minValue !== undefined && maxValue !== undefined && attributeValue !== undefined) {
                              // Map attribute values between 5 and 30 (example)
                              const heightScale = d3.scaleLinear().domain([minValue, maxValue]).range([5, 30]);
                              lineWidth = heightScale(attributeValue);
                            }
                          } else {
                            height = 5; // Default if attribute not found
                          }
                        } else if (typeof height === "number") {
                          // Use user-defined numeric value
                          height = layerSpec.height;
                        } else {
                          height = 5; // default
                        }
                        // Store final width on the edge
                        edge.__spikeheight = height;
          
                        // ---------------------------
                        // 7c) EXACT opacity snippet
                        // ---------------------------
                        let lineOpacity = layerSpec.strokeOpacity || 1;
                        if (typeof lineOpacity === "number" && lineOpacity >= 0 && lineOpacity <= 1) {
                          lineOpacity = lineOpacity;
                        } else if (typeof lineOpacity === "string") {
                          const opacityIndex = edge.findIndex((e: any) => e.hasOwnProperty(lineOpacity));
                          if (opacityIndex !== -1) {
                            const attributeValues = updatedGeoJsonData.edges
                              .flatMap((e: any) =>
                                e.filter((entry: any) => entry.hasOwnProperty(lineOpacity)).map((entry: any) => entry[lineOpacity])
                              )
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
                        // Store final opacity
                        edge.__spikeOpacity = lineOpacity;
                      })
                      // Now set shape position & path
                      .attr("transform", (edge: any) => {
                        const mid = getMidpoint(edge);
                        const pt = projectPoint(mid.lat, mid.lon);
                        return `translate(${pt.x}, ${pt.y})`;
                      })
                      .attr("d", (edge: any) => {
                        // Spike height from edge[3].Length (if present)
                        const lengthVal = edge[3]?.Length || 0; 
                        // Use the “width” we computed above
                        const baseWidth = edge.__spikeWidth || 5;
                        return spikePath(lengthVal, baseWidth);
                      })
                      // Fill with lineColor, set fill-opacity
                      .attr("fill", (edge: any) => edge.__spikeColor)
                      .attr("fill-opacity", (edge: any) => edge.__spikeOpacity)
                      .attr("stroke", "#333")
                      .attr("stroke-width", 0.5)
                      .selectAll("title") // remove old titles before appending new
                      .remove();
          
                    // Append new title
                    selection.append("title").text((edge: any) => {
                      const lenVal = edge[3]?.Length?.toFixed(2) ?? "N/A";
                      return `Length: ${edge.__spikeheight}
                              Color: ${edge.__spikeColor}
                              Width: ${edge.__spikeWidth}
                              Opacity: ${edge.__spikeOpacity}`;
                    });
                  }
          
                  // 8) Draw once
                  updateSpikes();
                  // 9) Redraw on zoom/pan
                  mapInstanceRef.current!.on("zoomend moveend", updateSpikes);
          
                  // Keep track of the new layer
                  currentLayersRef.current.push(svgLayer);
                });
              } else {
                console.error("Data is missing edges or is invalid.");
              }
            }).catch(error => {
              console.error("Failed to load JSON data:", error);
            });
          }
          // // -------------------------------------------
          // // NEW BRANCH FOR RECT SHAPE
          // // -------------------------------------------
          else if (layerSpec.shape === 'rect') {
            let updatedGeoJsonData;
          
            // 1) Load physical-layer JSON
            d3.json(layerSpec.physicalLayerPath).then(function (data: any) {
              if (data && data.edges) {
                var subdividedEdges = [];

                  // Loop through each edge in the original array
                  data.edges.forEach(function(edge) {
                    // Get the start and end coordinates
                    var start = edge[0]; // [lat, lon]
                    var end = edge[1];   // [lat, lon]
                    // Get the extra values (indices 2 to 12)
                    var extras = edge.slice(2);

                    // Destructure the coordinates
                    var lat0 = start["lat"],
                        lon0 = start["lon"],
                        lat1 = end["lat"],
                        lon1 = end["lon"];

                    // Calculate the total difference between the start and end points
                    var dLat = lat1 - lat0;
                    var dLon = lon1 - lon0;

                    // Subdivide this edge into `unitDivide` segments
                    for (var i = 0; i < layerSpec.unitDivide; i++) {
                      // Calculate the start coordinate of the new segment
                      var segStartLat = lat0 + dLat * (i / layerSpec.unitDivide);
                      var segStartLon = lon0 + dLon * (i / layerSpec.unitDivide);
                      // console.log("calculation lat lon", segStartLat, segStartLon)

                      // Calculate the end coordinate of the new segment
                      var segEndLat = lat0 + dLat * ((i + 1) / layerSpec.unitDivide);
                      var segEndLon = lon0 + dLon * ((i + 1) / layerSpec.unitDivide);

                      // Build new coordinate objects
                      var newStart = { lat: segStartLat, lon: segStartLon };
                      var newEnd = { lat: segEndLat, lon: segEndLon };


                      // Create the new edge. The new edge will contain:
                      //  - The new start coordinate
                      //  - The new end coordinate
                      //  - The same extra values from the original edge
                      var newEdge = [
                        newStart,newEnd
                      ].concat(extras);

                      subdividedEdges.push(newEdge);
                    }
                  });
                  updatedGeoJsonData = {
                    edges: subdividedEdges
                  };
                // 2) Load thematic data (if needed)
                d3.json(layerSpec.thematicLayerPath).then(function (thematicData: any) {
                  // 3) Perform spatial aggregation
                  if (layerSpec.spatialRelation === 'contains') {
                    updatedGeoJsonData = aggregationContains(updatedGeoJsonData, thematicData, layerSpec.AggregationType, layerSpec.unit);
                  } else if (layerSpec.spatialRelation === 'nearest neighbor') {
                    updatedGeoJsonData = aggregateEdgeData(updatedGeoJsonData.edges, thematicData, layerSpec.AggregationType);
                  } else if (layerSpec.spatialRelation === 'buffer') {
                    updatedGeoJsonData = BufferDataAggregationSegment(updatedGeoJsonData, thematicData, layerSpec.bufferValue, layerSpec.AggregationType);
                  }

                    updatedGeoJsonData = { edges: updatedGeoJsonData };
                  
          
                  // 5) Remove old layers except tile or mimicStreetPane
                  mapInstanceRef.current?.eachLayer((layer) => {
                    if (!(layer instanceof L.TileLayer)) {
                      if (!(layer.options && layer.options.pane === 'mimicStreetPane')) {
                        mapInstanceRef.current!.removeLayer(layer);
                      }
                    }
                  });
          
                  // 6) Create Leaflet SVG layer
                  const svgLayer = L.svg().addTo(mapInstanceRef.current!);
                  const svgGroup = d3
                    .select(mapInstanceRef.current!.getPanes().overlayPane)
                    .select("svg")
                    .append("g")
                    .attr("class", "leaflet-zoom-hide");
          
                  const edgesArray = updatedGeoJsonData.edges;
          
                  // 7) Helper functions
                  function getMidpoint(segment: any) {
                    const lat1 = segment[0].lat, lon1 = segment[0].lon;
                    const lat2 = segment[1].lat, lon2 = segment[1].lon;
                    return { lat: (lat1 + lat2) / 2, lon: (lon1 + lon2) / 2 };
                  }
                  function projectPoint(lat: number, lon: number) {
                    return mapInstanceRef.current!.latLngToLayerPoint(new L.LatLng(lat, lon));
                  }
          
                  // 8) Rectangular path generator
                  function rectPath(length: number, width: number) {
                    return `M${-width / 2},0 
                            L${-width / 2},${-length}
                            L${width / 2},${-length}
                            L${width / 2},0 Z`;
                  }
          
                  // 9) Main draw function
                  function updateRects() {
                    const selection = svgGroup.selectAll("path.myRect").data(edgesArray);
          
                    selection
                      .join("path")
                      .attr("class", "myRect")
                      // 9a) For each edge, use EXACT color/width/opacity code:
                      .each(function (edge: any) {
                        // -------------------------------------
                        // 9a-i) Set color (lineColor) snippet
                        // -------------------------------------
                        let lineColor = layerSpec.lineColor || "red";
                        const attributeIndex = edge.findIndex((e: any) => e.hasOwnProperty(lineColor));
                        if (attributeIndex !== -1) {
                          const attributeValues = updatedGeoJsonData.edges
                            .flatMap((e: any) =>
                              e.filter((entry: any) => entry.hasOwnProperty(lineColor)).map((entry: any) => entry[lineColor])
                            )
                            .filter((v: any) => v !== undefined);
                          const minValue = d3.min(attributeValues);
                          const maxValue = d3.max(attributeValues);
                          const attributeValue = edge[attributeIndex][lineColor];
                          if (minValue !== undefined && maxValue !== undefined && attributeValue !== undefined) {
                            const colorScale = d3.scaleSequential(d3.interpolateBuGn).domain([minValue, maxValue]);
                            lineColor = colorScale(attributeValue);
                          }
                        }
                        edge.__rectColor = lineColor;
          
                        // -------------------------------------
                        // 9a-ii) Set width (lineWidth) snippet
                        // -------------------------------------
                        let lineWidth = layerSpec.lineStrokeWidth;
                        if (typeof lineWidth === "string") {
                          const attributeIndex = edge.findIndex((e: any) => e.hasOwnProperty(lineWidth));
                          if (attributeIndex !== -1) {
                            const attributeValues = updatedGeoJsonData.edges
                              .flatMap((e: any) =>
                                e.filter((entry: any) => entry.hasOwnProperty(lineWidth)).map((entry: any) => entry[lineWidth])
                              )
                              .filter((v: any) => v !== undefined);
                            const minValue = d3.min(attributeValues);
                            const maxValue = d3.max(attributeValues);
                            const attributeValue = edge[attributeIndex][lineWidth];
                            if (minValue !== undefined && maxValue !== undefined && attributeValue !== undefined) {
                              const lineWidthScale = d3.scaleLinear().domain([minValue, maxValue]).range([5, 30]);
                              lineWidth = lineWidthScale(attributeValue);
                            }
                          } else {
                            lineWidth = 5; 
                          }
                        } else if (typeof lineWidth === "number") {
                          lineWidth = layerSpec.lineStrokeWidth;
                        } else {
                          lineWidth = 5;
                        }
                        edge.__rectWidth = lineWidth;


                        ////height
                        let height = layerSpec.height;
                        if (typeof height === "string") {
                          // Check if lineWidth is an attribute name in the data
                          const attributeIndex = edge.findIndex((e: any) => e.hasOwnProperty(height));
                          if (attributeIndex !== -1) {
                            const attributeValues = updatedGeoJsonData.edges
                              .flatMap((e: any) =>
                                e.filter((entry: any) => entry.hasOwnProperty(height)).map((entry: any) => entry[height])
                              )
                              .filter((v: any) => v !== undefined);
                            const minValue = d3.min(attributeValues);
                            const maxValue = d3.max(attributeValues);
                            const attributeValue = edge[attributeIndex][height];
                            if (minValue !== undefined && maxValue !== undefined && attributeValue !== undefined) {
                              // Map attribute values between 5 and 30 (example)
                              const heightScale = d3.scaleLinear().domain([minValue, maxValue]).range([5, 30]);
                              lineWidth = heightScale(attributeValue);
                            }
                          } else {
                            height = 5; // Default if attribute not found
                          }
                        } else if (typeof height === "number") {
                          // Use user-defined numeric value
                          height = layerSpec.height;
                        } else {
                          height = 5; // default
                        }
                        // Store final width on the edge
                        edge.__spikeheight = height;

          
                        // -------------------------------------
                        // 9a-iii) Set opacity (lineOpacity) snippet
                        // -------------------------------------
                        let lineOpacity = layerSpec.strokeOpacity || 1;
                        if (typeof lineOpacity === "number" && lineOpacity >= 0 && lineOpacity <= 1) {
                          lineOpacity = lineOpacity;
                        } else if (typeof lineOpacity === "string") {
                          const opacityIndex = edge.findIndex((e: any) => e.hasOwnProperty(lineOpacity));
                          if (opacityIndex !== -1) {
                            const attributeValues = updatedGeoJsonData.edges
                              .flatMap((e: any) =>
                                e.filter((entry: any) => entry.hasOwnProperty(lineOpacity)).map((entry: any) => entry[lineOpacity])
                              )
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
                        edge.__rectOpacity = lineOpacity;
                      })
                      // 9b) Position each rect at midpoint
                      .attr("transform", (edge: any) => {
                        const mid = getMidpoint(edge);
                        const pt = projectPoint(mid.lat, mid.lon);
                        return `translate(${pt.x}, ${pt.y})`;
                      })
                      // 9c) Height from edge[3].Length, width from edge.__rectWidth
                      .attr("d", (edge: any) => {
                        const lengthVal = edge[3]?.Length || 0; 
                        const baseWidth = edge.__rectWidth || 5;
                        return rectPath(lengthVal, baseWidth);
                      })
                      // 9d) Fill color & opacity
                      .attr("fill", (edge: any) => edge.__rectColor)
                      .attr("fill-opacity", (edge: any) => edge.__rectOpacity)
                      .attr("stroke", "#333")
                      .attr("stroke-width", 0.5)
                      .selectAll("title")
                      .remove();
          
                    // Add <title> for tooltip
                    selection.append("title").text((edge: any) => {
                      // const lenVal = edge[3]?.Length?.toFixed(2) ?? "N/A";
                      return `Length: ${edge.__spikeheight}
                              Color: ${edge.__rectColor}
                              Width: ${edge.__rectWidth}
                              Opacity: ${edge.__rectOpacity}`;
                    });
                  }
          
                  // 10) Draw once
                  updateRects();
                  // 11) Redraw on zoom/pan
                  mapInstanceRef.current!.on("zoomend moveend", updateRects);
          
                  // Keep track of this new layer
                  currentLayersRef.current.push(svgLayer);
                });
              } else {
                console.error("Data is missing edges or is invalid.");
              }
            }).catch(error => {
              console.error("Failed to load JSON data:", error);
            });
          }

        }
        else if(layerSpec.unit === 'node'){

          let updatedGeoJsonData
          


          let nodesSet = new Set();
          let NodesList = [];
          if (layerSpec.chart) {
            d3.json(layerSpec.physicalLayerPath).then((data: any) => {
              if (data && data.edges) {
                // 1) Remove old layers except the mimicStreetPane
                mapInstanceRef.current?.eachLayer((layer: any) => {
                  if (!(layer instanceof L.TileLayer)) {
                    // Check if the layer's pane is NOT the mimic street pane before removing
                    if (!(layer.options && layer.options.pane === 'mimicStreetPane')) {
                      mapInstanceRef.current!.removeLayer(layer);
                    }
                  }
                });

                d3.json(layerSpec.thematicLayerPath).then(function (thematicData){
                  if(layerSpec.spatialRelation == 'contains'){
                    updatedGeoJsonData = aggregationContains(data, thematicData, layerSpec.AggregationType, layerSpec.unit);
                    // console.log("data is:", updatedGeoJsonData)
                  }else if(layerSpec.spatialRelation == 'nearest neighbor'){
                    updatedGeoJsonData = aggregateEdgeData(data.edges, thematicData, layerSpec.AggregationType);
                  }else if(layerSpec.spatialRelation == 'buffer'){
                    updatedGeoJsonData = BufferDataAggregationSegment(data, thematicData, layerSpec.bufferValue, layerSpec.AggregationType);
                    // console.log("checking updatedGeoData inside", updatedGeoJsonData)
                  }
                // })

                updatedGeoJsonData = {
                  edges: updatedGeoJsonData
                };
                // console.log("checking updatedGeoData outside", updatedGeoJsonData)
          
                // 2) Accumulate node data in a dictionary keyed by lat,lon
                const NodesMap: Record<string, any> = {};
          
                // Helper function to add data for a node
                function addNodeData(lat: number, lon: number, edgeData: Record<string, any>) {
                  const key = `${lat},${lon}`;
          
                  if (!NodesMap[key]) {
                    NodesMap[key] = {
                      lat,
                      lon,
                      sums: {},  // sums of numeric attributes
                      count: 0
                    };
                  }
          
                  // For each attribute in edgeData, if it's numeric, accumulate it
                  for (const [attrKey, attrValue] of Object.entries(edgeData)) {
                    if (typeof attrValue === 'number') {
                      if (!NodesMap[key].sums[attrKey]) {
                        NodesMap[key].sums[attrKey] = 0;
                      }
                      NodesMap[key].sums[attrKey] += attrValue;
                    }
                  }
          
                  NodesMap[key].count += 1;
                }
          
                // 3) Go through each edge, gather the node data
                const edges = updatedGeoJsonData.edges;
                console.log("edges:", edges)
                // console.log("checking the data for edge", updatedGeoJsonData)
                edges.forEach((edge: any) => {
                  // edge[0] = first node { lat, lon }
                  // edge[1] = second node { lat, lon }
                  const firstNode = edge[0];
                  const secondNode = edge[1];
          
                  // The rest of the edge array items are objects with numeric attributes
                  // e.g. { bearing: 88.8 }, { length: 101.731 }, { speed: 40 }, etc.
                  // Merge them into a single object
                  const mergedAttributes = Object.assign({}, ...edge.slice(2));
                  // Example mergedAttributes => { bearing: 88.8, length: 101.731, speed: 40, ... }
          
                  addNodeData(firstNode.lat, firstNode.lon, mergedAttributes);
                  addNodeData(secondNode.lat, secondNode.lon, mergedAttributes);
                });
          
                // 4) Convert the NodesMap to a final array (averaging the numeric sums)
                const NodesList = Object.values(NodesMap).map((node: any) => {
                  const averagedAttrs: Record<string, number> = {};
          
                  for (const [attrKey, sumValue] of Object.entries(node.sums)) {
                    averagedAttrs[attrKey] = (sumValue as number) / node.count;
                  }
          
                  return {
                    lat: node.lat,
                    lon: node.lon,
                    ...averagedAttrs  // e.g. bearing, length, speed, etc.
                  };
                });
          
                // console.log('Unique NodesList with averaged attributes:', NodesList);
          
                // 5) For each unique node, embed a Vega-Lite chart
                (async () => {
                  for (let idx = 0; idx < NodesList.length; idx++) {
                    const nodeData = NodesList[idx];
                    // console.log("Node data is:", nodeData)
                    const midpoint = { lat: nodeData.lat, lon: nodeData.lon };
          
                    // 5a) Copy the chart specification
                    const chartSpec = JSON.parse(JSON.stringify(layerSpec.chart));
          
          
                    // 5c) Assign to chartSpec.data
                    chartSpec.data = {
                      values: [
                        {"category": "Total Crimes", "value": nodeData.Total_Crimes},
                        {"category": "Summer", "value": nodeData.Summer},
                        {"category": "Winter", "value": nodeData.Winter},
                        {"category": "Spring", "value": nodeData.Spring},
                        // nodeData.Total_Crimes,
                        // nodeData.Summer,
                        // nodeData.Winter,
                        // nodeData.Spring
                        // nodeData.MetraScore,
                        // nodeData.CTAScore,
                        // nodeData.PaceScore
                        
                      ],
                    };
                    // console.log("chart data check:", chartSpec.data)
          
                    // 5d) Render the chart in a hidden container (#vis), then move the SVG
                    await vegaEmbed('#vis', chartSpec, { renderer: 'svg', actions: false }).then((result) => {
                      const vegaSVG = result.view._el.querySelector('svg');
                      const svgWidth = 120;
                      const svgHeight = 120;
          
                      // Function to position the chart on the map
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
          
                  // 6) Add an SVG layer to the map so overlays work
                  const svgLayer = L.svg().addTo(mapInstanceRef.current!);
                  currentLayersRef.current.push(svgLayer);
                })(); // end async IIFE
              })
              }
            });
          }
          if (layerSpec.shape === 'spike' || layerSpec.shape === 'rect') {
            // 1) Load the physical-layer JSON (which has "edges")
            d3.json(layerSpec.physicalLayerPath).then((data: any) => {
              if (data && data.edges) {
                // 2) Remove old layers (except tile or mimicStreetPane)
                mapInstanceRef.current?.eachLayer((layer: any) => {
                  if (!(layer instanceof L.TileLayer)) {
                    if (!(layer.options && layer.options.pane === 'mimicStreetPane')) {
                      mapInstanceRef.current!.removeLayer(layer);
                    }
                  }
                });
          
                // 3) Load the thematic data (if needed), then aggregate
                d3.json(layerSpec.thematicLayerPath).then((thematicData: any) => {
                  let updatedGeoJsonData: any;
                  if (layerSpec.spatialRelation === 'contains') {
                    updatedGeoJsonData = aggregationContains(data, thematicData, layerSpec.AggregationType, layerSpec.unit);
                  } else if (layerSpec.spatialRelation === 'nearest neighbor') {
                    updatedGeoJsonData = aggregateEdgeData(data.edges, thematicData, layerSpec.AggregationType);
                  } else if (layerSpec.spatialRelation === 'buffer') {
                    updatedGeoJsonData = BufferDataAggregationSegment(data, thematicData, layerSpec.bufferValue, layerSpec.AggregationType);
                  }
          
                  // No unitDivide here
                  updatedGeoJsonData = { edges: updatedGeoJsonData };
          
                  // 4) Build a dictionary of nodes keyed by lat,lon
                  const NodesMap: Record<string, any> = {};
          
                  function addNodeData(lat: number, lon: number, edgeData: Record<string, any>) {
                    const key = `${lat},${lon}`;
                    if (!NodesMap[key]) {
                      NodesMap[key] = {
                        lat,
                        lon,
                        sums: {},
                        count: 0
                      };
                    }
                    // Accumulate numeric attributes
                    for (const [attrKey, attrValue] of Object.entries(edgeData)) {
                      if (typeof attrValue === 'number') {
                        if (!NodesMap[key].sums[attrKey]) {
                          NodesMap[key].sums[attrKey] = 0;
                        }
                        NodesMap[key].sums[attrKey] += attrValue;
                      }
                    }
                    NodesMap[key].count += 1;
                  }
          
                  // 5) For each edge, gather node data
                  const edges = updatedGeoJsonData.edges;
                  edges.forEach((edge: any) => {
                    const firstNode = edge[0]; 
                    const secondNode = edge[1]; 
                    // Merge any additional attributes (e.g. {Bearing, Length, Speed, ...})
                    const mergedAttributes = Object.assign({}, ...edge.slice(2));
                    addNodeData(firstNode.lat, firstNode.lon, mergedAttributes);
                    addNodeData(secondNode.lat, secondNode.lon, mergedAttributes);
                  });
          
                  // 6) Convert NodesMap -> array, computing average for each numeric field
                  const NodesList = Object.values(NodesMap).map((node: any) => {
                    const averagedAttrs: Record<string, number> = {};
                    for (const [attrKey, sumValue] of Object.entries(node.sums)) {
                      averagedAttrs[attrKey] = (sumValue as number) / node.count;
                    }
                    return {
                      lat: node.lat,
                      lon: node.lon,
                      ...averagedAttrs
                    };
                  });

                  console.log("NodesList with aggregated attributes:", NodesList);
          
                  // 7) Create a Leaflet SVG overlay
                  const svgLayer = L.svg().addTo(mapInstanceRef.current!);
                  const svgGroup = d3
                    .select(mapInstanceRef.current!.getPanes().overlayPane)
                    .select("svg")
                    .append("g")
                    .attr("class", "leaflet-zoom-hide");
          
                  // Helpers
                  function projectPoint(lat: number, lon: number) {
                    return mapInstanceRef.current!.latLngToLayerPoint([lat, lon]);
                  }
                  function spikePath(length: number, width: number) {
                    return `M${-width / 2},0 L0,${-length} L${width / 2},0 Z`;
                  }
                  function rectPath(length: number, width: number) {
                    return `M${-width / 2},0
                            L${-width / 2},${-length}
                            L${width / 2},${-length}
                            L${width / 2},0 Z`;
                  }
          
                  // 8) Main draw function
                  function updateShapes() {
                    const selection = svgGroup.selectAll("path.nodeShape").data(NodesList);
          
                    selection
                      .join("path")
                      .attr("class", "nodeShape")
                      .each(function (node: any) {
                        // console.log("node is:", node)
                        // -----------------------------------------------------
                        // EXACT color snippet from your line code
                        // -----------------------------------------------------
                        let lineColor = layerSpec.lineColor || 'red';
                        if (typeof lineColor === 'string' && node.hasOwnProperty(lineColor)) {
                          // Gather all values for this attribute across NodesList
                          const attributeValues = NodesList
                            .map((n: any) => n[lineColor])
                            .filter((v: any) => typeof v === 'number');
                          const minValue = d3.min(attributeValues);
                          const maxValue = d3.max(attributeValues);
                          const attributeValue = node[lineColor];
                          if (
                            minValue !== undefined &&
                            maxValue !== undefined &&
                            attributeValue !== undefined
                          ) {
                            const colorScale = d3
                              .scaleSequential(d3.interpolateBuGn)
                              .domain([minValue, maxValue]);
                            lineColor = colorScale(attributeValue);
                          }
                        }
                        node.__shapeColor = lineColor;
                        // console.log("node.__shapeColor: ", node.__shapeColor)
          
                        // -----------------------------------------------------
                        // EXACT width snippet (becomes shape's base width)
                        // -----------------------------------------------------
                        let lineWidth = layerSpec.lineStrokeWidth;
                        if (typeof lineWidth === 'string' && node.hasOwnProperty(lineWidth)) {
                          const attributeValues = NodesList
                            .map((n: any) => n[lineWidth])
                            .filter((v: any) => typeof v === 'number');
                          const minValue = d3.min(attributeValues);
                          const maxValue = d3.max(attributeValues);
                          const attributeValue = node[lineWidth];
                          if (
                            minValue !== undefined &&
                            maxValue !== undefined &&
                            attributeValue !== undefined
                          ) {
                            const lineWidthScale = d3
                              .scaleLinear()
                              .domain([minValue, maxValue])
                              .range([5, 30]);
                            lineWidth = lineWidthScale(attributeValue);
                          } else {
                            lineWidth = 5;
                          }
                        } else if (typeof lineWidth === 'number') {
                          // direct numeric
                          lineWidth = layerSpec.lineStrokeWidth;
                        } else {
                          lineWidth = 5;
                        }
                        node.__shapeWidth = lineWidth;
          
                        // -----------------------------------------------------
                        // Height snippet (for node.__shapeheight)
                        // -----------------------------------------------------
                        let height = layerSpec.height;
                        if (typeof height === 'string' && node.hasOwnProperty(height)) {
                          const attributeValues = NodesList
                            .map((n: any) => n[height])
                            .filter((v: any) => typeof v === 'number');
                            // console.log("node.height: ", attributeValues)
                          const minValue = d3.min(attributeValues);
                          const maxValue = d3.max(attributeValues);
                          const attributeValue = node[height];
                          if (
                            minValue !== undefined &&
                            maxValue !== undefined &&
                            attributeValue !== undefined
                          ) {
                            const heightScale = d3
                              .scaleLinear()
                              .domain([minValue, maxValue])
                              .range([5, 30]);
                            height = heightScale(attributeValue);
                            console.log("Final node.height: ", minValue, maxValue)
                          } else {
                            height = 5;
                          }
                        } else if (typeof height === 'number') {
                          height = layerSpec.height;
                        } else {
                          height = 5;
                        }
                        node.__height = height;
                        // console.log("Final node.height: ", minValue, maxValue)

                        // console.log("height check is", node.__height)
                        // console.log("color check is", node.__shapeColor)
          
                        // -----------------------------------------------------
                        // EXACT opacity snippet
                        // -----------------------------------------------------
                        let lineOpacity = layerSpec.strokeOpacity || 1;
                        if (typeof lineOpacity === 'string' && node.hasOwnProperty(lineOpacity)) {
                          const attributeValues = NodesList
                            .map((n: any) => n[lineOpacity])
                            .filter((v: any) => typeof v === 'number');
                          const minValue = d3.min(attributeValues);
                          const maxValue = d3.max(attributeValues);
                          const attributeValue = node[lineOpacity];
                          if (
                            minValue !== undefined &&
                            maxValue !== undefined &&
                            attributeValue !== undefined
                          ) {
                            const opacityScale = d3
                              .scaleLinear()
                              .domain([minValue, maxValue])
                              .range([0, 1]);
                            lineOpacity = opacityScale(attributeValue);
                          } else {
                            lineOpacity = 1;
                          }
                        } else if (typeof lineOpacity === 'number') {
                          lineOpacity = layerSpec.strokeOpacity;
                        }
                        node.__shapeOpacity = lineOpacity;
                      })
                      // Position each shape at node lat/lon
                      .attr("transform", (node: any) => {
                        const pt = projectPoint(node.lat, node.lon);
                        return `translate(${pt.x},${pt.y})`;
                      })
                      // Use the shape = 'spike' or 'rect' to pick path
                      .attr("d", (node: any) => {
                        const heightVal = node.__height || 5; // from the snippet above
                        // console.log("node.__height val is", node.__height)
                        const baseWidth = node.__shapeWidth || 5;
                        if (layerSpec.shape === 'rect') {
                          return rectPath(heightVal, baseWidth);
                        } else {
                          // shape = 'spike'
                          return spikePath(heightVal, baseWidth);
                        }
                      })
                      .attr("fill", (node: any) => node.__shapeColor)
                      .attr("fill-opacity", (node: any) => node.__shapeOpacity)
                      .attr("stroke", "#333")
                      .attr("stroke-width", 0.5)
                      .selectAll("title")
                      .remove();
          
                    // Add <title> tooltip
                    selection
                      .append("title")
                      .text((node: any) => {
                        return `Height: ${node.__height}
                                Color: ${node.__shapeColor}
                                Width: ${node.__shapeWidth}
                                Opacity: ${node.__shapeOpacity}`;
                      });
                  }
          
                  // 9) Draw once
                  updateShapes();
                  // 10) Re-draw on zoom/pan
                  mapInstanceRef.current!.on("zoomend moveend", updateShapes);
          
                  // 11) Store the new layer reference
                  currentLayersRef.current.push(svgLayer);
                });
              } else {
                console.error("Data is missing edges or invalid.");
              }
            }).catch(error => {
              console.error("Failed to load JSON data:", error);
            });
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
      <div
        style={{
          position: 'absolute',
          right: '20px',
          top: '50%',
          zIndex: 500,
          background: 'rgba(255,255,255,0.8)',
          padding: '10px',
          borderRadius: '5px'
        }}
      >
        <label htmlFor="widthSlider">Street Width: {mimicWidth}</label>
        <br />
        <input
          id="widthSlider"
          type="range"
          min="0"
          max="100"
          value={mimicWidth}
          onChange={(e) => setMimicWidth(Number(e.target.value))}
        />
      </div>
    </div>
  );
  
};

export default MapVisualization;
//That works Last