import React, { useEffect, useRef, useState  } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as d3 from 'd3';
import 'leaflet.heat';
import vegaEmbed from 'vega-embed';
import * as turf from '@turf/turf';
// import '@maplibre/maplibre-gl-leaflet';  // Plugin bridging MapLibre & Leaflet

import type { GeoJsonObject } from 'geojson';

// Import types
import { ParsedSpec, GeoJSONData, ProcessedEdge } from 'streetweave'

// Import utility functions
import { applySpatialAggregation, processEdgesToNodes } from '../utils/aggregation';
import { applyOpacity, getDynamicStyleValue, getDashArray, getSquiggleParams, generateSimpleWavyPath, spikePath, rectPath, PERPENDICULAR_COLORS } from '../utils/styleHelpers';
import { getCardinalDirection, bearingBetweenPoints, normalizeSegment, offsetPoint, calculateMidpoint } from '../utils/geoHelpers';
import { initializeMap, projectPoint, getOffsetDistance, getAdjustedLineWidth } from '../utils/mapHelpers';


const MapVisualization: React.FC<{ parsedSpec: ParsedSpec[] }> = ({ parsedSpec }) => {

  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const mimicLayerRef = useRef<L.GeoJSON | null>(null);
  const currentLayersRef = useRef<L.Layer[]>([]);

  const [mimicWidth, setMimicWidth] = useState<number>(0);
  const [addressCoords, setAddressCoords] = useState<{ lat: number; lon: number } | null>(null);

  const alignmentCounters = useRef({
    left: 0,
    right: 0
  })

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

  useEffect(() => {
    if (parsedSpec[0] && parsedSpec[0].streetWidth !== undefined) {
      setMimicWidth(parsedSpec[0].streetWidth);
    }
  }, [parsedSpec]);

  useEffect(() => {
    // if (!mapInstanceRef.current) return

    if (mapRef.current) {
      const initialZoom = parsedSpec[0]?.zoom || 12;
      let initialLat: number = 41.8781
      let initialLon: number = -87.6298

      if(parsedSpec[0].unit == 'area'){
        initialLat = 41.8781;
        initialLon = -87.6298;

      } else if(parsedSpec[0].unit == 'segment'){

        initialLat = 41.802515601319314;
        initialLon = -87.64537972052756;

      } else if(parsedSpec[0].unit == 'node'){
        initialLat = 41.80159035804221;
        initialLon = -87.64538029790135;
      }

      if (!mapInstanceRef.current) {
        // Initial map creation
        mapInstanceRef.current = initializeMap(
          mapRef.current,
          initialLat,
          initialLon,
          initialZoom,
          parsedSpec[0]?.background || "light"
        );

        // mapInstanceRef.current.createPane('mimicStreetPane');
        // mapInstanceRef.current.getPane('mimicStreetPane')!.style.zIndex = '350'
      
      } else {
        // Update zoom level if parsedSpec changes
        // mapInstanceRef.current.setView([Lat, Lon], parsedSpec[0].zoom);

        // Smoothly animate through each spec’s zoom in sequence
        parsedSpec.slice(1).reduce<Promise<void>>(
          (prev, spec) =>
            prev.then(() => {
              // compute Lat/Lon for this spec
              let tLat: number, tLon: number;
              if (spec.unit === 'area') {
                tLat = 41.8781; tLon = -87.6298;
              } else if (spec.unit === 'segment') {
                tLat = 41.802515601319314; tLon = -87.64537972052756;
              } else {
                tLat = 41.80159035804221; tLon = -87.64538029790135;
              }

              return new Promise<void>(resolve => {
                mapInstanceRef.current!
                  .flyTo([tLat, tLon], spec.zoom, { duration: 1 })
                  .once('moveend', () => resolve());
              });
            }),
          // start the chain by first flying from the current view to the first element
          new Promise<void>(resolve => {
            mapInstanceRef.current!
              .flyTo([initialLat, initialLon], parsedSpec[0].zoom, { duration: 1 })
              .once('moveend', () => resolve());
          })
        );
      }

    }
  }, [parsedSpec]);
  
    // ================== 2) RIGHT-CLICK => OPEN MINI-MAP POPUP ==================
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const initMimicLayer = async () => {
      mapInstanceRef.current!.getPane('mimicStreetPane');
      mapInstanceRef.current!.createPane('mimicStreetPane');

      if (!mimicLayerRef.current) {
        try {
          const data: { edges: any[] } | undefined = await d3.json('/data/filtered_data.json');

          if (data !== undefined) {
            const features = data.edges.map(edge => ({
              type: 'Feature' as const,
              geometry: {
                type: 'LineString' as const,
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
  
            const geojson = { type: 'FeatureCollection' as const, features };
  
            mimicLayerRef.current = L.geoJSON(geojson as GeoJsonObject, {
              pane: 'mimicStreetPane',
              style: {
                color: '#d3d3d6',
                weight: 0,
                opacity: 0.8
              }
            }).addTo(mapInstanceRef.current!);

          }
        } catch (error) {
          console.error('Failed to load mimic street GeoJSON:', error);
        }
      }
    };

    initMimicLayer();
  }, []);


  // Update mimic street width based on the slider value and filtering conditions.
  useEffect(() => {
    if (mimicLayerRef.current) {
      mimicLayerRef.current.eachLayer((layer: any) => {
        const defaultWeight = parsedSpec[0].streetWidth;
        let shouldUpdate = true;

        if (parsedSpec[0].roadDirection) {
          const featureBearing = layer.feature.properties.Bearing;
          const featureDirection = getCardinalDirection(featureBearing);
          if (featureDirection.toLowerCase() !== parsedSpec[0].roadDirection.toLowerCase()) {
            shouldUpdate = false;
          }
        }

        if (addressCoords) {
          const addressPoint = turf.point([addressCoords.lon, addressCoords.lat]);
          const lineFeature = turf.lineString(layer.feature.geometry.coordinates);
          const distance = turf.pointToLineDistance(addressPoint, lineFeature, { units: parsedSpec[0].radiusUnit as turf.Units });
          
          if (distance > Number(parsedSpec[0].roadRadius)) {
            shouldUpdate = false;
          }
        }

        layer.setStyle({
          color: parsedSpec[0].streetColor ? parsedSpec[0].streetColor : '#d3d3d6',
          weight: shouldUpdate ? mimicWidth : defaultWeight,
          opacity: 0.8
        });
      });
    }
  }, [mimicWidth, parsedSpec, addressCoords]);



  // Clear previous visualizations and render the new one
  useEffect(() => {
    if (mapInstanceRef.current) {

      currentLayersRef.current.forEach(layer => {
        if (!(layer.options && layer.options.pane === 'mimicStreetPane')) {
          mapInstanceRef.current!.removeLayer(layer);
        }
      });

      currentLayersRef.current = [];
      
      parsedSpec.forEach(async (layerSpec, index) => {
        d3.selectAll('.vega-lite-svg').remove();

        if (mapInstanceRef.current !== null) {
          mapInstanceRef.current.off('move zoom');
  
          if (layerSpec.unit === 'segment'){
            renderSegmentLayer(mapInstanceRef.current, layerSpec, index, currentLayersRef, alignmentCounters);
          }
  
          else if(layerSpec.unit === 'node'){
            renderNodeLayer(mapInstanceRef.current, layerSpec, currentLayersRef);
          }
  
          else if (layerSpec.unit === 'area'){
            renderAreaLayer(mapInstanceRef.current, layerSpec, currentLayersRef);
          }
        }

      });
    }
  }, [parsedSpec]);

  /**
   * Renders a segment-based layer (line, matrix, rect, chart, spike).
   * @param map The Leaflet map instance.
   * @param layerSpec The parsed layer specification.
   * @param layerIndex The index of the current layer in parsedSpec (for color scheme selection).
   * @param currentLayersRef Ref to store active Leaflet layers for cleanup.
   * @param alignmentCountersRef Ref for alignment offsets for parallel lines/rects.
   */
  const renderSegmentLayer = async (
    map: L.Map,
    layerSpec: ParsedSpec,
    layerIndex: number,
    currentLayersRef: React.MutableRefObject<L.Layer[]>,
    alignmentCountersRef: React.MutableRefObject<{ left: number; right: number }>
  ) => {
    try {
      const physicalData: any = await d3.json(`/data/${layerSpec.physicalLayerPath}`);
      if (!physicalData?.edges) {
        console.error("Physical data is missing edges or is invalid for segment layer.");
        return;
      }

      const thematicData: any = layerSpec.thematicLayerPath
        ? await d3.json(`/data/${layerSpec.thematicLayerPath}`)
        : [];

      let initialEdges = physicalData.edges;

      // Step 1: Subdivide edges if unitDivide is specified
      if (layerSpec.unitDivide && layerSpec.unitDivide > 1) {
        const subdivided: any[] = [];
        initialEdges.forEach((edge: any) => {
          const [start, end, ...extras] = edge;
          const lat0 = start.lat, lon0 = start.lon;
          const lat1 = end.lat, lon1 = end.lon;
          const dLat = lat1 - lat0, dLon = lon1 - lon0;

          let startIndex = 0;
          let endIndex = layerSpec.unitDivide;
          if (layerSpec.unitDivide >= 20) {
            startIndex = 5;
            endIndex = layerSpec.unitDivide - 5;
          } else if (layerSpec.unitDivide >= 10 && layerSpec.unitDivide < 20) {
            startIndex = 1;
            endIndex = layerSpec.unitDivide - 1;
          }

          for (let i = startIndex; i < endIndex; i++) {
            const segStart = { lat: lat0 + dLat * (i / layerSpec.unitDivide), lon: lon0 + dLon * (i / layerSpec.unitDivide) };
            const segEnd = { lat: lat0 + dLat * ((i + 1) / layerSpec.unitDivide), lon: lon0 + dLon * ((i + 1) / layerSpec.unitDivide) };
            subdivided.push([segStart, segEnd, ...extras]);
          }
        });
        initialEdges = subdivided;
      }

      // Step 2: Apply spatial aggregation
      let processedEdges: ProcessedEdge[] = await applySpatialAggregation(initialEdges, thematicData, layerSpec) as ProcessedEdge[];

      // Ensure all edges have the correct structure with an aggregated attributes object at index 4
      processedEdges = processedEdges.map(edge => {
        // If the 5th element isn't an object, make it an empty object
        if (!edge[4] || typeof edge[4] !== 'object') {
            const newEdge: ProcessedEdge = [edge[0], edge[1], edge[2], edge[3], {}];
            return newEdge;
        }
        return edge;
      });

      // Clear existing layers from relevant panes to prevent duplicates on redraw
      const paneName = layerSpec.alignment === "center" ? 'overlayPane' : `${layerSpec.alignment}-${layerSpec.orientation}`;
      if (!map.getPane(paneName)) {
        map.createPane(paneName);
        map.getPane(paneName)!.style.zIndex = '400';
      }
      d3.select(map.getPanes()[paneName]).selectAll("svg").remove();

      // Create Leaflet SVG layer and D3 group
      const svgLayer = L.svg({ pane: paneName }).addTo(map);
      (svgLayer as any).layerGroup = layerSpec.alignment; // Custom property for identification
      const svgGroup = d3.select(map.getPanes()[paneName]).select("svg").append("g").attr("class", "leaflet-zoom-hide");

      // Increment alignment counters for parallel/perpendicular rendering
      if (layerSpec.alignment === "left") {
        alignmentCountersRef.current.left++;
      } else if (layerSpec.alignment === "right") {
        alignmentCountersRef.current.right++;
      }

      const drawSegmentShapes = () => {
        svgGroup.selectAll("*").remove();

        processedEdges.forEach((edge: ProcessedEdge) => {
          // Ensure bearing and normalize segment
          if (edge[2] && typeof edge[2] === 'object' && 'Bearing' in edge[2] && typeof edge[2].Bearing === 'number') {
            normalizeSegment(edge);
          } else {
            edge[2] = { Bearing: bearingBetweenPoints(edge[0].lat, edge[0].lon, edge[1].lat, edge[1].lon) };
            normalizeSegment(edge);
          }

          // Apply alignment offsets for parallel lines/rects
          let currentStartPoint = edge[0];
          let currentEndPoint = edge[1];
          const currentBearing = bearingBetweenPoints(edge[0].lat, edge[0].lon, edge[1].lat, edge[1].lon);

          if (layerSpec.alignment === "left" || layerSpec.alignment === "right") {
            const offsetAngle = layerSpec.alignment === "left" ? currentBearing - 90 : currentBearing + 90;
            const distance = getOffsetDistance(map) * (layerSpec.alignment === "left" ? alignmentCountersRef.current.left : alignmentCountersRef.current.right);

            const offsetStartCoords = offsetPoint(edge[0].lat, edge[0].lon, offsetAngle, distance);
            const offsetEndCoords = offsetPoint(edge[1].lat, edge[1].lon, offsetAngle, distance);
            currentStartPoint = { lat: offsetStartCoords[0], lon: offsetStartCoords[1] };
            currentEndPoint = { lat: offsetEndCoords[0], lon: offsetEndCoords[1] };
          }

          const pointsForRendering = [{ lat: currentStartPoint.lat, lon: currentStartPoint.lon }, { lat: currentEndPoint.lat, lon: currentEndPoint.lon }];
          // Retrieve dynamic styles using the helper
          const lineColor = getDynamicStyleValue(
            layerSpec.lineColor,
            edge,
            processedEdges,
            null,
            d3.interpolateBuGn,
            PERPENDICULAR_COLORS[layerIndex] || ["#feb24c", "#fd8d3c", "#fc4e2a", "#e31a1c", "#b10026"]
          ) as string// || 'red';
          // console.log("[MapViz 377] layerSpec.lineColor: ", layerSpec.lineColor)
          // console.log("[MapViz 377] typeof layerSpec.lineColor: ", typeof layerSpec.lineColor)
          // console.log("[MapViz 378] lineColor: ", lineColor)
          
          // Use nullish coalescing (??) for numeric values to provide a default if null/undefined
          const baseLineWidth = getDynamicStyleValue(layerSpec.lineStrokeWidth, edge, processedEdges, [0, 10]) as number ?? 5;
          const lineWidth = getAdjustedLineWidth(map, baseLineWidth);

          const lineOpacity = getDynamicStyleValue(layerSpec.strokeOpacity, edge, processedEdges, [0, 1]) as number ?? 1;

          const dashArray = getDashArray(layerSpec.lineType, layerSpec.lineTypeVal, edge, processedEdges);
          const { amplitude: squiggleAmplitude, frequency: squiggleFrequency } = getSquiggleParams(layerSpec.lineType, layerSpec.lineTypeVal, edge, processedEdges);

          if (layerSpec.method === 'line') {
            const lineGenerator = d3.line<any>()
              .x((d: any) => projectPoint(map, d.lat, d.lon)[0])
              .y((d: any) => projectPoint(map, d.lat, d.lon)[1]);

            if (layerSpec.lineType === 'squiggle') {
              const point1 = L.point(projectPoint(map, pointsForRendering[0].lat, pointsForRendering[0].lon)[0], projectPoint(map, pointsForRendering[0].lat, pointsForRendering[0].lon)[1]);
              const point2 = L.point(projectPoint(map, pointsForRendering[1].lat, pointsForRendering[1].lon)[0], projectPoint(map, pointsForRendering[1].lat, pointsForRendering[1].lon)[1]);
              const squigglyPath = generateSimpleWavyPath(point1, point2, squiggleAmplitude, squiggleFrequency);
              svgGroup.append("path")
                .attr("d", squigglyPath)
                .style("stroke", lineColor)
                .style("stroke-width", lineWidth)
                .style("stroke-opacity", lineOpacity)
                .attr("fill", "none");
            } else {
              svgGroup.append("path")
                .datum(pointsForRendering)
                .attr("d", lineGenerator)
                .style("stroke", lineColor)
                .style("stroke-width", lineWidth)
                .style("stroke-opacity", lineOpacity)
                .style("stroke-dasharray", dashArray)
                .attr("fill", "none");
            }
          } else if (layerSpec.method === 'matrix') {
            const methodColumn = layerSpec.methodColumn || 1;
            const methodRow = layerSpec.methodRow || 1;
            const currentOffsetDistance = getOffsetDistance(map);

            for (let row = 0; row < methodRow; row++) {
              const offsetAngle = currentBearing - 90;
              const offsetMultiplier = row - Math.floor(methodRow / 2);

              const startRowOffsetCoords = offsetPoint(edge[0].lat, edge[0].lon, offsetAngle, currentOffsetDistance * offsetMultiplier);
              const endRowOffsetCoords = offsetPoint(edge[1].lat, edge[1].lon, offsetAngle, currentOffsetDistance * offsetMultiplier);

              const dLat = endRowOffsetCoords[0] - startRowOffsetCoords[0];
              const dLon = endRowOffsetCoords[1] - startRowOffsetCoords[1];

              for (let col = 0; col < methodColumn; col++) {
                const segStartLat = startRowOffsetCoords[0] + (dLat * col) / methodColumn;
                const segStartLon = startRowOffsetCoords[1] + (dLon * col) / methodColumn;
                const segEndLat = startRowOffsetCoords[0] + (dLat * (col + 1)) / methodColumn;
                const segEndLon = startRowOffsetCoords[1] + (dLon * (col + 1)) / methodColumn;

                const linePoints = [
                  { lat: segStartLat, lon: segStartLon },
                  { lat: segEndLat, lon: segEndLon }
                ];
                const lineGenerator = d3.line<any>()
                  .x((d: any) => projectPoint(map, d.lat, d.lon)[0])
                  .y((d: any) => projectPoint(map, d.lat, d.lon)[1]);

                svgGroup.append("path")
                  .datum(linePoints)
                  .attr("d", lineGenerator)
                  .style("stroke", lineColor)
                  .style("stroke-width", lineWidth)
                  .style("stroke-opacity", lineOpacity)
                  .attr("fill", "none");
              }
            }
          } else if (layerSpec.method === 'rect') {
            const baseHeight = getDynamicStyleValue(layerSpec.height, edge, processedEdges, [0, 7]) as number ?? 5;
            const rectWidth = getAdjustedLineWidth(map, baseHeight);
            const inset = 5;

            if (layerSpec.orientation === 'parallel') {
              let offsetBearing = 0;
              let currentMultiplier = 0;

              if (layerSpec.alignment === "left") {
                offsetBearing = (currentBearing + 270) % 360;
                currentMultiplier = alignmentCountersRef.current.left;
              } else if (layerSpec.alignment === "right") {
                offsetBearing = (currentBearing + 90) % 360;
                currentMultiplier = alignmentCountersRef.current.right;
              }

              const [sOffsetLat, sOffsetLon] = offsetPoint(currentStartPoint.lat, currentStartPoint.lon, offsetBearing, inset + (currentMultiplier * rectWidth));
              const [eOffsetLat, eOffsetLon] = offsetPoint(currentEndPoint.lat, currentEndPoint.lon, offsetBearing, inset + (currentMultiplier * rectWidth));

              const lineBearing = bearingBetweenPoints(sOffsetLat, sOffsetLon, eOffsetLat, eOffsetLon);
              const outwardBearing = layerSpec.alignment === "left" ? (lineBearing + 270) % 360 : (lineBearing + 90) % 360;

              const [s2Lat, s2Lon] = offsetPoint(sOffsetLat, sOffsetLon, outwardBearing, rectWidth);
              const [e2Lat, e2Lon] = offsetPoint(eOffsetLat, eOffsetLon, outwardBearing, rectWidth);

              const corners = [
                projectPoint(map, sOffsetLat, sOffsetLon),
                projectPoint(map, eOffsetLat, eOffsetLon),
                projectPoint(map, e2Lat, e2Lon),
                projectPoint(map, s2Lat, s2Lon)
              ];

              svgGroup.append("polygon")
                .attr("points", corners.map(pt => pt.join(",")).join(" "))
                .style("fill", lineColor)
                .style("fill-opacity", lineOpacity)
                .style("stroke", 'none');
            } else if (layerSpec.orientation === 'perpendicular') {
              const midLat = (currentStartPoint.lat + currentEndPoint.lat) / 2;
              const midLon = (currentStartPoint.lon + currentEndPoint.lon) / 2;

              let offsetBearing = 0;
              if (layerSpec.alignment === "left") {
                offsetBearing = (currentBearing + 270) % 360;
              } else if (layerSpec.alignment === "right") {
                offsetBearing = (currentBearing + 90) % 360;
              }

              const [mOffsetLat, mOffsetLon] = offsetPoint(midLat, midLon, offsetBearing, 5);
              const [m2Lat, m2Lon] = offsetPoint(mOffsetLat, mOffsetLon, offsetBearing, rectWidth);

              const p1 = projectPoint(map, mOffsetLat, mOffsetLon);
              const p2 = projectPoint(map, m2Lat, m2Lon);

              svgGroup.append("line")
                .attr("x1", p1[0]).attr("y1", p1[1])
                .attr("x2", p2[0]).attr("y2", p2[1])
                .style("stroke", lineColor)
                .style("stroke-opacity", lineOpacity)
                .style("stroke-width", lineWidth)
                .style("stroke-linecap", "round");
            }
          } else if (layerSpec.chart) {
            const templateSpec = layerSpec.chart;
            const svgChartWidth = 150, svgChartHeight = 150;
            const pane = map.getPanes().overlayPane;

            const [start, end, , , aggregatedAttrs] = edge;
            const midpoint = {
              lat: (start.lat + end.lat) / 2,
              lon: (start.lon + end.lon) / 2
            };

            const chartSpec = JSON.parse(JSON.stringify(templateSpec));
            chartSpec.data = {
              values: Object.entries(aggregatedAttrs || {}).map(([key, value]) => ({ category: key, value: value }))
            };

            vegaEmbed('#vis', chartSpec, { renderer: 'svg', actions: false })
              .then(result => {
                const vegaSVG = (result.view as any)._el.querySelector('svg');
                if (!vegaSVG) return;

                const id = `chart_edge_${midpoint.lat}_${midpoint.lon}`.replace(/[^\w]/g, '');

                const updateChartPosition = () => {
                  const point = map.latLngToLayerPoint([midpoint.lat, midpoint.lon]);
                  const bearing = bearingBetweenPoints(start.lat, start.lon, end.lat, end.lon);
                  const angle = bearing + 90;

                  const transform = `translate(${point.x - svgChartWidth / 2},${point.y - svgChartHeight / 2})`
                                  + ` rotate(${angle},${svgChartWidth / 2},${svgChartHeight / 2})`;

                  const sel = d3.select(pane).select<SVGSVGElement>(`#${id}`);
                  if (sel.empty()) {
                    d3.select(pane)
                      .append('svg')
                      .attr('class', 'vega-lite-svg')
                      .attr('id', id)
                      .attr('width', svgChartWidth)
                      .attr('height', svgChartHeight)
                      .attr('transform', transform)
                      .node()
                      ?.appendChild(vegaSVG.cloneNode(true));
                  } else {
                    sel.attr('transform', transform);
                  }
                };

                updateChartPosition();
                map.on('move zoom', updateChartPosition);
              })
              .catch(error => console.error("Error embedding Vega-Lite chart:", error));

          } else if (layerSpec.shape === 'spike' || layerSpec.shape === 'rect') {
            const mid = calculateMidpoint(pointsForRendering[0], pointsForRendering[1]);
            const pt = L.point(projectPoint(map, mid.lat, mid.lon)[0], projectPoint(map, mid.lat, mid.lon)[1]);

            const shapeColor = getDynamicStyleValue(layerSpec.lineColor, edge, processedEdges, null, d3.interpolateBuGn) as string || 'red';
            const shapeWidth = getDynamicStyleValue(layerSpec.lineStrokeWidth, edge, processedEdges, [5, 30]) as number ?? 5;
            const shapeHeight = getDynamicStyleValue(layerSpec.height, edge, processedEdges, [5, 30]) as number ?? 5;
            const shapeOpacity = getDynamicStyleValue(layerSpec.strokeOpacity, edge, processedEdges, [0, 1]) as number ?? 1;

            const pathGenerator = layerSpec.shape === 'rect' ? rectPath : spikePath;
            const dAttr = pathGenerator(shapeHeight, shapeWidth);

            svgGroup.append("path")
              .datum(edge)
              .attr("class", `my${layerSpec.shape === 'rect' ? 'Rect' : 'Spike'}`)
              .attr("transform", `translate(${pt.x},${pt.y})`)
              .attr("d", dAttr)
              .attr("fill", shapeColor)
              .attr("fill-opacity", shapeOpacity)
              .attr("stroke", "#333")
              .attr("stroke-width", 0.5)
              .append("title")
              .text(`Height: ${shapeHeight.toFixed(2)}\nWidth: ${shapeWidth.toFixed(2)}\nColor: ${shapeColor}\nOpacity: ${shapeOpacity.toFixed(2)}`);
          }
        });
      };

      drawSegmentShapes();
      map.on('moveend zoomend', drawSegmentShapes);
      currentLayersRef.current.push(svgLayer);

    } catch (error) {
      console.error(`Error rendering segment layer for ${layerSpec.physicalLayerPath}:`, error);
    }
  };

    /**
   * Renders a node-based layer (chart, spike, rect, or simple points).
   * @param map The Leaflet map instance.
   * @param layerSpec The parsed layer specification.
   * @param currentLayersRef Ref to store active Leaflet layers for cleanup.
   */
  const renderNodeLayer = async (
    map: L.Map,
    layerSpec: ParsedSpec,
    currentLayersRef: React.MutableRefObject<L.Layer[]>
  ) => {
    try {
      const physicalData: any = await d3.json(`/data/${layerSpec.physicalLayerPath}`);
      if (!physicalData?.edges) {
        console.error("Physical data is missing edges or is invalid for node layer.");
        return;
      }

      const thematicData: any = layerSpec.thematicLayerPath
        ? await d3.json(`/data/${layerSpec.thematicLayerPath}`)
        : [];

      // Aggregates thematic data onto the edges first
      const aggregatedEdges: ProcessedEdge[] = await applySpatialAggregation(physicalData.edges, thematicData, layerSpec) as ProcessedEdge[];

      // Processes the aggregated edges to get unique nodes with their aggregated attributes
      const nodesList = processEdgesToNodes(aggregatedEdges);

      const svgLayer = L.svg().addTo(map);
      const svgGroup = d3.select(map.getPanes().overlayPane).select("svg").append("g").attr("class", "leaflet-zoom-hide");

      const updateNodeShapes = () => {
        svgGroup.selectAll("*").remove();

        nodesList.forEach(node => {
          // Use nullish coalescing (??) for numeric values to provide a default if null/undefined
          const shapeColor = getDynamicStyleValue(layerSpec.lineColor, node, nodesList, null, d3.interpolateBuGn) as string || 'red';
          const shapeWidth = getDynamicStyleValue(layerSpec.lineStrokeWidth, node, nodesList, [5, 30]) as number ?? 5;
          const shapeHeight = getDynamicStyleValue(layerSpec.height, node, nodesList, [5, 30]) as number ?? 5;
          const shapeOpacity = getDynamicStyleValue(layerSpec.strokeOpacity, node, nodesList, [0, 1]) as number ?? 1;

          const pt = L.point(projectPoint(map, node.lat, node.lon)[0], projectPoint(map, node.lat, node.lon)[1]);

          if (layerSpec.chart) {
            const templateSpec = layerSpec.chart;
            const svgChartWidth = 150, svgChartHeight = 150;
            const pane = map.getPanes().overlayPane;

            const chartSpec = JSON.parse(JSON.stringify(templateSpec));
            // Filter out lat/lon from data for the chart
            chartSpec.data = {
              values: Object.entries(node).filter(([key]) => key !== 'lat' && key !== 'lon').map(([key, value]) => ({ category: key, value: value }))
            };

            vegaEmbed('#vis', chartSpec, { renderer: 'svg', actions: false })
              .then(result => {
                const vegaSVG = (result.view as any)._el.querySelector('svg');
                if (!vegaSVG) return;

                const id = `chart_node_${node.lat}_${node.lon}`.replace(/[^\w.]/g, '');

                const updateChartPosition = () => {
                  const point = map.latLngToLayerPoint([node.lat, node.lon]);
                  const transform = `translate(${point.x - svgChartWidth / 2},${point.y - svgChartHeight / 2})`;

                  const sel = d3.select(pane).select<SVGSVGElement>(`#${id}`);
                  if (sel.empty()) {
                    d3.select(pane)
                      .append('svg')
                      .attr('class', 'vega-lite-svg')
                      .attr('id', id)
                      .attr('width', svgChartWidth)
                      .attr('height', svgChartHeight)
                      .attr('transform', transform)
                      .node()
                      ?.appendChild(vegaSVG.cloneNode(true));
                  } else {
                    sel.attr('transform', transform);
                  }
                };

                updateChartPosition();
                map.on('move zoom', updateChartPosition);
              })
              .catch(error => console.error("Error embedding Vega-Lite chart for node:", error));
          } else if (layerSpec.shape === 'spike' || layerSpec.shape === 'rect') {
            const pathGenerator = layerSpec.shape === 'rect' ? rectPath : spikePath;
            const dAttr = pathGenerator(shapeHeight, shapeWidth);

            svgGroup.append("path")
              .datum(node)
              .attr("class", "nodeShape")
              .attr("transform", `translate(${pt.x},${pt.y})`)
              .attr("d", dAttr)
              .attr("fill", shapeColor)
              .attr("fill-opacity", shapeOpacity)
              .attr("stroke", "#333")
              .attr("stroke-width", 0.5)
              .append("title")
              .text(`Height: ${shapeHeight.toFixed(2)}\nWidth: ${shapeWidth.toFixed(2)}\nColor: ${shapeColor}\nOpacity: ${shapeOpacity.toFixed(2)}`);
          } else {
            svgGroup.append("circle")
              .datum(node)
              .attr('class', 'nodeShape')
              .attr('cx', pt.x)
              .attr('cy', pt.y)
              .attr('r', shapeWidth / 2)
              .attr('fill', shapeColor)
              .attr('fill-opacity', shapeOpacity)
              .attr('stroke', '#333')
              .attr('stroke-width', 0.5)
              .append("title")
              .text(`Node Data: ${JSON.stringify(node, null, 2)}`);
          }
        });
      };

      updateNodeShapes();
      map.on("zoomend moveend", updateNodeShapes);
      currentLayersRef.current.push(svgLayer);

    } catch (error) {
      console.error(`Error rendering node layer for ${layerSpec.physicalLayerPath}:`, error);
    }
  };

    /**
   * Renders an area-based layer (fill, heatmap, point).
   * @param map The Leaflet map instance.
   * @param layerSpec The parsed layer specification.
   * @param currentLayersRef Ref to store active Leaflet layers for cleanup.
   */
  const renderAreaLayer = async (
    map: L.Map,
    layerSpec: ParsedSpec,
    currentLayersRef: React.MutableRefObject<L.Layer[]>
  ) => {
    try {
      if (layerSpec.method === 'fill') {
        const geojsonData: any = await d3.json(`/data/${layerSpec.physicalLayerPath}`);
        if (!geojsonData?.features) {
          console.error("GeoJSON data is missing features or is invalid for area fill layer.");
          return;
        }

        const thematicData: any = layerSpec.thematicLayerPath
          ? await d3.json(`/data/${layerSpec.thematicLayerPath}`)
          : [];

        // Apply spatial aggregation if specified
        const aggregatedGeoJSON: GeoJSONData = await applySpatialAggregation(geojsonData, thematicData, layerSpec) as GeoJSONData;

        let colorScale: d3.ScaleThreshold<number, string> | d3.ScaleSequential<string, never>;

        if (layerSpec.domain && layerSpec.range) {
          colorScale = d3.scaleThreshold<number, string>()
            .domain(layerSpec.domain)
            .range(layerSpec.range);
        } else {
          // Fallback to sequential scale if no domain/range is specified for fillAttribute
          const values = aggregatedGeoJSON.features.map(f => f.properties?.[layerSpec.fillAttribute!])
                                                  .filter((v): v is number => typeof v === 'number');
          const minVal = d3.min(values) || 0;
          const maxVal = d3.max(values) || 1;
          colorScale = d3.scaleSequential(d3.interpolateBlues).domain([minVal, maxVal]);
        }

        const styleFeature = (feature: any) => {
          return {
            // Use nullish coalescing (??) to provide a default value (null in this case)
            // if feature.properties is undefined or the attribute itself is null/undefined.
            // This ensures a value compatible with `colorScale` is always passed.
            fillColor: colorScale(feature.properties?.[layerSpec.fillAttribute!] ?? null),
            fillOpacity: applyOpacity('fill', layerSpec),
            weight: layerSpec.strokeWidth || 1,
            color: layerSpec.strokeColor || 'black',
            opacity: applyOpacity('stroke', layerSpec),
          };
        };

        const geoJsonLayer = L.geoJSON(aggregatedGeoJSON, { style: styleFeature }).addTo(map);
        currentLayersRef.current.push(geoJsonLayer);

      } else if (layerSpec.method === 'heatmap') {
        const heatDataRaw: any = await d3.json(`/data/${layerSpec.thematicLayerPath}`);
        if (!Array.isArray(heatDataRaw)) {
          console.error('Heatmap data is missing or not in the expected format (array of points).');
          return;
        }
        // Ensure data is in [lat, lon, value] format for heatmap.js
        const heatData = heatDataRaw.map(point => [point.Lat, point.Lon, point[layerSpec.valueField || 'value'] || 1]);

        const heatmapLayer = (L as any).heatLayer(heatData, {
          radius: layerSpec.radius || 25,
          blur: layerSpec.blur || 15,
          maxZoom: 17,
          // Use D3 color scheme if specified
          gradient: layerSpec.colorScheme ? (d3 as any)[layerSpec.colorScheme] : undefined,
        }).addTo(map);
        currentLayersRef.current.push(heatmapLayer);

      } else if (layerSpec.method === 'point') {
        const pointData: any = await d3.json(`/data/${layerSpec.thematicLayerPath}`);
        if (!Array.isArray(pointData)) {
          console.error('Point data is missing or not in the expected format (array of points).');
          return;
        }

        pointData.forEach((d: any) => {
          const lat = d[layerSpec.xField!];
          const lon = d[layerSpec.yField!];

          if (lat && lon) {
            const marker = L.circleMarker([lat, lon], {
              color: layerSpec.pointColor || 'red',
              radius: layerSpec.pointRadius || 5,
              fillOpacity: applyOpacity('fill', layerSpec),
              weight: layerSpec.strokeWidth || 1,
              opacity: applyOpacity('stroke', layerSpec)
            }).addTo(map);
            currentLayersRef.current.push(marker);
          }
        });
      }
    } catch (error) {
      console.error(`Error rendering area layer:`, error);
    }
  };

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
          top: '5%',
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