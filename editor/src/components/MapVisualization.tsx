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
import { ParsedSpec, PhysicalEdge, ThematicPoint, AggregatedEdges } from 'streetweave'

// Import utility functions
import { applySpatialAggregation, processEdgesToNodes } from '../utils/aggregation';
import { getDynamicStyleValue, getDashArray, getSquiggleParams, generateSimpleWavyPath } from '../utils/styleHelpers';
import { loadThematicData, loadPhysicalData, offsetPoint } from '../utils/geoHelpers';
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
    const address = parsedSpec[0].query?.address;
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
  }, [parsedSpec[0].query?.address]);

  useEffect(() => {
    if (parsedSpec[0] && parsedSpec[0].map?.streetWidth !== undefined) {
      setMimicWidth(parsedSpec[0].map.streetWidth);
    }
  }, [parsedSpec]);

  useEffect(() => {
    if (parsedSpec[0] && parsedSpec[0].map?.streetWidth !== undefined) {
      setMimicWidth(parsedSpec[0].map.streetWidth);
    }
  }, [parsedSpec]);

  useEffect(() => {
    if (parsedSpec[0] && parsedSpec[0].map?.streetWidth !== undefined) {
      setMimicWidth(parsedSpec[0].map.streetWidth);
    }
  }, [parsedSpec]);

  useEffect(() => {
    // if (!mapInstanceRef.current) return

    if (mapRef.current) {
      const initialZoom = 18;
      let initialLat: number = 41.8781
      let initialLon: number = -87.6298

      if(parsedSpec[0].unit.type == 'segment'){

        initialLat = 41.802515601319314;
        initialLon = -87.64537972052756;

      } else if(parsedSpec[0].unit.type == 'node'){
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
          "light"
        );

        mapInstanceRef.current.createPane('mimicStreetPane');
        mapInstanceRef.current.getPane('mimicStreetPane')!.style.zIndex = '350'
      
      } else {
        // Update zoom level if parsedSpec changes
        // mapInstanceRef.current.setView([Lat, Lon], parsedSpec[0].zoom);

        // Smoothly animate through each spec’s zoom in sequence
        parsedSpec.slice(1).reduce<Promise<void>>(
          (prev, spec) =>
            prev.then(() => {
              // compute Lat/Lon for this spec
              let tLat: number, tLon: number;
              if (spec.unit.type === 'segment') {
                tLat = 41.802515601319314; tLon = -87.64537972052756;
              } else {
                tLat = 41.80159035804221; tLon = -87.64538029790135;
              }

              return new Promise<void>(resolve => {
                mapInstanceRef.current!
                  .flyTo([tLat, tLon], 18, { duration: 1 })
                  .once('moveend', () => resolve());
              });
            }),
          // start the chain by first flying from the current view to the first element
          new Promise<void>(resolve => {
            mapInstanceRef.current!
              .flyTo([initialLat, initialLon], 18, { duration: 1 })
              .once('moveend', () => resolve());
          })
        );
      }

    }
  }, [parsedSpec]);


  
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const initMimicLayer = async () => {
      if (!mapInstanceRef.current!.getPane('mimicStreetPane')) {
        mapInstanceRef.current!.createPane('mimicStreetPane');
        mapInstanceRef.current!.getPane('mimicStreetPane')!.style.zIndex = '450';
      }

      if (!mimicLayerRef.current) {
        try {
          const data = await loadPhysicalData(parsedSpec[0].data.physical.path);

          if (data !== undefined) {
            const features = data.map(edge => ({
              type: 'Feature' as const,
              geometry: {
                type: 'LineString' as const,
                coordinates: [
                  [edge.point0.lon, edge.point0.lat],
                  [edge.point1.lon, edge.point1.lat]
                ]
              },
              properties: {
                Bearing: edge.bearing,
                Length: edge.length
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
  }, [parsedSpec]);


  // Update mimic street width based on the slider value and filtering conditions.
  useEffect(() => {
    if (mimicLayerRef.current) {
      mimicLayerRef.current.eachLayer((layer: any) => {
        const defaultWeight = parsedSpec[0].map?.streetWidth;
        let shouldUpdate = true;

        // if (parsedSpec[0].roadDirection) {
        //   const featureBearing = layer.feature.properties.Bearing;
        //   const featureDirection = getCardinalDirection(featureBearing);
        //   if (featureDirection.toLowerCase() !== parsedSpec[0].roadDirection.toLowerCase()) {
        //     shouldUpdate = false;
        //   }
        // }

        if (addressCoords) {
          const addressPoint = turf.point([addressCoords.lon, addressCoords.lat]);
          const lineFeature = turf.lineString(layer.feature.geometry.coordinates);
          const distance = turf.pointToLineDistance(addressPoint, lineFeature, { units: "meters" as turf.Units });
          
          if (distance > Number(parsedSpec[0].query?.radius)) {
            shouldUpdate = false;
          }
        }

        layer.setStyle({
          color: parsedSpec[0].map?.streetColor ? parsedSpec[0].map?.streetColor : '#d3d3d6',
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
  
          if (layerSpec.unit.type === 'segment'){
            // renderSegmentLayer(mapInstanceRef.current, layerSpec, index, currentLayersRef, alignmentCounters);
            renderSegmentLayer(mapInstanceRef.current, layerSpec, index, currentLayersRef, alignmentCounters);
          }
  
          else if(layerSpec.unit.type === 'node'){
            renderNodeLayer(mapInstanceRef.current, layerSpec, currentLayersRef);
          }
  
          // else if (layerSpec.unit === 'area'){
            // renderAreaLayer(mapInstanceRef.current, layerSpec, currentLayersRef);
          // }
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

      const physicalData = await loadPhysicalData(layerSpec.data.physical.path);
      const thematicData = await loadThematicData(layerSpec.data.thematic.path, layerSpec.data.thematic.latColumn, layerSpec.data.thematic.lonColumn);

      // console.log(thematicData);

      let initialEdges = physicalData;

      // Step 1: Subdivide edges if unitDivide is specified
      if (layerSpec.unit.splits && layerSpec.unit.splits > 1) {
        const subdivided: PhysicalEdge[] = [];
        initialEdges.forEach((edge: PhysicalEdge) => {
          // const [start, end, ...extras] = edge;
          const start = edge.point0;
          const end = edge.point1;
          const bearing = edge.bearing;
          const length = edge.length;
          const attributes = edge.attributes;
          const lat0 = start.lat, lon0 = start.lon;
          const lat1 = end.lat, lon1 = end.lon;
          const dLat = lat1 - lat0, dLon = lon1 - lon0;

          let startIndex = 0;
          let endIndex = layerSpec.unit.splits;
          if (layerSpec.unit.splits >= 20) {
            startIndex = 5;
            endIndex = layerSpec.unit.splits - 5;
          } else if (layerSpec.unit.splits >= 10 && layerSpec.unit.splits < 20) {
            startIndex = 1;
            endIndex = layerSpec.unit.splits - 1;
          }

          for (let i = startIndex; i < endIndex; i++) {
            const point0 = { lat: lat0 + dLat * (i / layerSpec.unit.splits), lon: lon0 + dLon * (i / layerSpec.unit.splits) } as ThematicPoint;
            const point1 = { lat: lat0 + dLat * ((i + 1) / layerSpec.unit.splits), lon: lon0 + dLon * ((i + 1) / layerSpec.unit.splits) } as ThematicPoint;

            subdivided.push({point0, point1, bearing, length, attributes} as PhysicalEdge);
          }
        });
        initialEdges = subdivided;
      }

      // Apply spatial aggregation
      let processedEdges: AggregatedEdges = await applySpatialAggregation(initialEdges, thematicData.data, layerSpec);

      // Clear existing layers from relevant panes to prevent duplicates on redraw
      const paneName = layerSpec.unit.alignment === "center" ? 'overlayPane' : `${layerSpec.unit.alignment}-${layerSpec.unit.orientation}`;
      if (!map.getPane(paneName)) {
        map.createPane(paneName);
        map.getPane(paneName)!.style.zIndex = '400';
      }
      d3.select(map.getPanes()[paneName]).selectAll("svg").remove();

      // Create Leaflet SVG layer and D3 group
      const svgLayer = L.svg({ pane: paneName }).addTo(map);
      (svgLayer as any).layerGroup = layerSpec.unit.alignment; // Custom property for identification
      const svgGroup = d3.select(map.getPanes()[paneName]).select("svg").append("g").attr("class", "leaflet-zoom-hide");

      // Increment alignment counters for parallel/perpendicular rendering
      if (layerSpec.unit.alignment === "left") {
        alignmentCountersRef.current.left++;
      } else if (layerSpec.unit.alignment === "right") {
        alignmentCountersRef.current.right++;
      }

      const drawSegmentShapes = () => {
        // console.log("checking if zooming position change working")
        svgGroup.selectAll("*").remove();

        processedEdges.edges.forEach((edge: PhysicalEdge) => {
          // Ensure bearing and normalize segment
          // if (edge[2] && typeof edge[2] === 'object' && 'Bearing' in edge[2] && typeof edge[2].Bearing === 'number') {
            // normalizeSegment(edge);
          // } else {
          //   edge[2] = { Bearing: bearingBetweenPoints(edge[0].lat, edge[0].lon, edge[1].lat, edge[1].lon) };
          //   normalizeSegment(edge);
          // }

          // Apply alignment offsets for parallel lines/rects
          let currentStartPoint = edge.point0;
          let currentEndPoint = edge.point1;
          const currentBearing = edge.bearing;// bearingBetweenPoints(edge.point0.lat, edge[0].lon, edge[1].lat, edge[1].lon);

          if (layerSpec.unit.alignment === "left" || layerSpec.unit.alignment === "right") {
            const offsetAngle = layerSpec.unit.alignment === "left" ? currentBearing - 90 : currentBearing + 90;
            const distance = getOffsetDistance(map) * (layerSpec.unit.alignment === "left" ? alignmentCountersRef.current.left : alignmentCountersRef.current.right);

            const offsetStartCoords = offsetPoint(edge.point0.lat, edge.point0.lon, offsetAngle, distance);
            const offsetEndCoords = offsetPoint(edge.point1.lat, edge.point1.lon, offsetAngle, distance);
            currentStartPoint = { lat: offsetStartCoords[0], lon: offsetStartCoords[1] };
            currentEndPoint = { lat: offsetEndCoords[0], lon: offsetEndCoords[1] };
          }

          const pointsForRendering = [{ lat: currentStartPoint.lat, lon: currentStartPoint.lon }, { lat: currentEndPoint.lat, lon: currentEndPoint.lon }];
          // Retrieve dynamic styles using the helper
          const colorRamp = layerIndex === 0
            ? ["#a50f15", "#de2d26", "#fb6a4a", "#fcae91", "#fee5d9"]
            : layerIndex === 1
              ? ["#08519c", "#3182bd", "#6baed6", "#bdd7e7", "#eff3ff"]
              : ["#f2f0f7", "#cbc9e2", "#9e9ac8", "#756bb1", "#54278f"];
          const lineColor = getDynamicStyleValue(layerSpec.unit.color, edge.attributes, thematicData.attributeStats, colorRamp) as string;
          // const lineColor = getDynamicStyleValue(layerSpec.unit.color, edge.attributes, thematicData.attributeStats, ["#feb24c", "#fd8d3c", "#fc4e2a", "#e31a1c", "#b10026"]) as string;
          
          // Use nullish coalescing (??) for numeric values to provide a default if null/undefined
          const baseLineWidth = getDynamicStyleValue(layerSpec.unit.width, edge.attributes, processedEdges.attributeStats, [0, 5]) as number;
          // console.log("previous line width", baseLineWidth)
          const lineWidth = getAdjustedLineWidth(map, baseLineWidth);
          // console.log("after line width", lineWidth)

          const lineOpacity = getDynamicStyleValue(layerSpec.unit.opacity, edge.attributes, processedEdges.attributeStats, [0, 1]) as number;

          const dashArray = getDashArray(layerSpec.unit.dash, edge.attributes, processedEdges.attributeStats);
          const { amplitude: squiggleAmplitude, frequency: squiggleFrequency } = getSquiggleParams(layerSpec.unit.squiggle, edge.attributes, processedEdges.attributeStats);

          if (layerSpec.unit.method === 'line' && !layerSpec.unit.chart) {
            const lineGenerator = d3.line<any>()
              .x((d: any) => projectPoint(map, d.lat, d.lon)[0])
              .y((d: any) => projectPoint(map, d.lat, d.lon)[1]);

            if (layerSpec.unit.squiggle) {
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
          } else if (layerSpec.unit.method === 'matrix') {
            const methodColumn = layerSpec.unit.columns || 1;
            const methodRow = layerSpec.unit.rows || 1;
            const currentOffsetDistance = getOffsetDistance(map);

            for (let row = 0; row < methodRow; row++) {
              const offsetAngle = currentBearing - 90;
              const offsetMultiplier = row - Math.floor(methodRow / 2);

              const startRowOffsetCoords = offsetPoint(edge.point0.lat, edge.point0.lon, offsetAngle, currentOffsetDistance * offsetMultiplier);
              const endRowOffsetCoords = offsetPoint(edge.point1.lat, edge.point1.lon, offsetAngle, currentOffsetDistance * offsetMultiplier);

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
          } else if (layerSpec.unit.method === 'rect') {

            const baseHeight = getDynamicStyleValue(layerSpec.unit.height, edge.attributes, thematicData.attributeStats, [0, 10]) as number;
            const rectWidth = getAdjustedLineWidth(map, baseHeight);
            const inset = 5;

            if (layerSpec.unit.orientation === 'parallel') {
              let offsetBearing = 0;
              let currentMultiplier = 0;

              if (layerSpec.unit.alignment === "left") {
                offsetBearing = (currentBearing + 270) % 360;
                currentMultiplier = alignmentCountersRef.current.left;
                console.log("what is currentMultiplier", currentMultiplier)
              } else if (layerSpec.unit.alignment === "right") {
                offsetBearing = (currentBearing + 90) % 360;
                currentMultiplier = alignmentCountersRef.current.right;
              }

              const [sOffsetLat, sOffsetLon] = offsetPoint(currentStartPoint.lat, currentStartPoint.lon, offsetBearing, inset + (currentMultiplier * rectWidth));
              const [eOffsetLat, eOffsetLon] = offsetPoint(currentEndPoint.lat, currentEndPoint.lon, offsetBearing, inset + (currentMultiplier * rectWidth));

              const turfStart = turf.point([sOffsetLon, sOffsetLat]); // lon lat
              const turfEnd = turf.point([eOffsetLon, eOffsetLat]); // lon lat
              const lineBearing: number = turf.bearing(turfStart, turfEnd);

              // const lineBearing = bearingBetweenPoints(sOffsetLat, sOffsetLon, eOffsetLat, eOffsetLon);
              const outwardBearing = layerSpec.unit.alignment === "left" ? (lineBearing + 270) % 360 : (lineBearing + 90) % 360;

              const [s2Lat, s2Lon] = offsetPoint(sOffsetLat, sOffsetLon, outwardBearing, rectWidth*6);
              const [e2Lat, e2Lon] = offsetPoint(eOffsetLat, eOffsetLon, outwardBearing, rectWidth*6);

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
            } else if (layerSpec.unit.orientation === 'perpendicular') {
              const midLat = (currentStartPoint.lat + currentEndPoint.lat) / 2;
              const midLon = (currentStartPoint.lon + currentEndPoint.lon) / 2;

              let offsetBearing = 0;
              if (layerSpec.unit.alignment === "left") {
                offsetBearing = (currentBearing + 270) % 360;
              } else if (layerSpec.unit.alignment === "right") {
                offsetBearing = (currentBearing + 90) % 360;
              }

              const [mOffsetLat, mOffsetLon] = offsetPoint(midLat, midLon, offsetBearing, 0);
              const [m2Lat, m2Lon] = offsetPoint(mOffsetLat, mOffsetLon, offsetBearing, rectWidth*12);

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
          } else if (layerSpec.unit.chart) {
            const templateSpec = layerSpec.unit.chart;
            const svgChartWidth = 150, svgChartHeight = 150;
            const pane = map.getPanes().overlayPane;

            const start = edge.point0;
            const end = edge.point1;
            // const bearing = edge.bearing;
            // const length = edge.length;
            const aggregatedAttrs = edge.attributes;
            const midpoint = {
              lat: (start.lat + end.lat) / 2,
              lon: (start.lon + end.lon) / 2
            };

            const chartSpec = JSON.parse(JSON.stringify(templateSpec));
            chartSpec.data = {
              values: Object.entries(aggregatedAttrs || {}).map(([key, value]) => ({ category: key, value: value }))
            };

            // console.log("vegadata is", chartSpec.data)

            vegaEmbed('#vis', chartSpec, { renderer: 'svg', actions: false })
              .then(result => {
                const vegaSVG = (result.view as any)._el.querySelector('svg');
                if (!vegaSVG) return;

                // const id = `chart_edge_${midpoint.lat}_${midpoint.lon}`.replace(/[^\w]/g, '');

                const updateChartPosition = () => {
                  const point = map.latLngToLayerPoint([midpoint.lat, midpoint.lon]);
                  const tempID = 't' + (midpoint.lat + midpoint.lon + '').replace('.', '').replace('-', '') + 'svg';
                  const temp = d3.select(mapInstanceRef.current!.getPanes().overlayPane).select('#' + tempID);
                  // const bearing = bearingBetweenPoints(start.lat, start.lon, end.lat, end.lon);
                  const turfStart = turf.point([start.lon, start.lat]); // lon lat
                  const turfEnd = turf.point([end.lon, end.lat]); // lon lat
                  const bearing: number = turf.bearing(turfStart, turfEnd);

                  const angle = bearing + 90;

                  const transform = `translate(${point.x - svgChartWidth / 3},${point.y - svgChartHeight / 3})`
                                  + ` rotate(${angle},${svgChartWidth / 2.5},${svgChartHeight / 2.5})`;

                  // const sel = d3.select(pane).select<SVGSVGElement>(`#${id}`);
                  if (temp.empty()) {
                    d3.select(pane)
                      .append('svg')
                      .attr('class', 'vega-lite-svg')
                      .attr('id', tempID)
                      .attr('width', svgChartWidth)
                      .attr('height', svgChartHeight)
                      .attr('transform', transform)
                      .node()
                      ?.appendChild(vegaSVG.cloneNode(true));
                  } else {
                    temp.attr('transform', transform);
                  }
                };

                updateChartPosition();
                map.on('move zoom', updateChartPosition);
              })
              .catch(error => console.error("Error embedding Vega-Lite chart:", error));

          } 
        });
      };

      drawSegmentShapes();
      map.on('moveend zoomend', drawSegmentShapes);
      currentLayersRef.current.push(svgLayer);

    } catch (error) {
      console.error(`Error rendering segment layer for ${layerSpec.data.physical.path}:`, error);
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
      const physicalData = await loadPhysicalData(layerSpec.data.physical.path);
      const thematicData = await loadThematicData(layerSpec.data.thematic.path, layerSpec.data.thematic.latColumn, layerSpec.data.thematic.lonColumn);

      // Aggregates thematic data onto the edges first
      const aggregatedEdges: AggregatedEdges = await applySpatialAggregation(physicalData, thematicData.data, layerSpec);

      // Processes the aggregated edges to get unique nodes with their aggregated attributes
      const nodesList = processEdgesToNodes(aggregatedEdges.edges);

      const svgLayer = L.svg().addTo(map);
      const svgGroup = d3.select(map.getPanes().overlayPane).select("svg").append("g").attr("class", "leaflet-zoom-hide");

      const updateNodeShapes = () => {
        svgGroup.selectAll("*").remove();

        nodesList.forEach(node => {
          // Use nullish coalescing (??) for numeric values to provide a default if null/undefined
          const shapeColor = getDynamicStyleValue(layerSpec.unit.color, node.attributes, thematicData.attributeStats, d3.schemeBuGn[9]) as string;
          const shapeWidth = getDynamicStyleValue(layerSpec.unit.width, node.attributes, thematicData.attributeStats, [5, 30]) as number;
          // const shapeHeight = getDynamicStyleValue(layerSpec.lineHeight, node, nodesList, [5, 30]) as number ?? 5;
          const shapeOpacity = getDynamicStyleValue(layerSpec.unit.opacity, node.attributes, thematicData.attributeStats, [0, 1]) as number;

          const pt = L.point(projectPoint(map, node.lat, node.lon)[0], projectPoint(map, node.lat, node.lon)[1]);

          if (layerSpec.unit.chart) {
            const templateSpec = layerSpec.unit.chart;
            const svgChartWidth = 150, svgChartHeight = 150;
            const pane = map.getPanes().overlayPane;

            const chartSpec = JSON.parse(JSON.stringify(templateSpec));
            // Filter out lat/lon from data for the chart
            // chartSpec.data = {
            //   values: Object.entries(node).filter(([key]) => key !== 'lat' && key !== 'lon').map(([key, value]) => ({ category: key, value: value }))
            // };
            chartSpec.data = {
              values: Object.entries(node.attributes).filter(([key]) => key !== 'lat' && key !== 'lon').map(([category, value]) => ({category, value}))
            };

            // console.log("vegadata is", node)

            vegaEmbed('#vis', chartSpec, { renderer: 'svg', actions: false })
              .then(result => {
                const vegaSVG = (result.view as any)._el.querySelector('svg');
                if (!vegaSVG) return;

                // const id = `chart_node_${node.lat}_${node.lon}`.replace(/[^\w.]/g, '');

                const updateChartPosition = () => {
                  const point = map.latLngToLayerPoint([node.lat, node.lon]);
                  const tempID = 't' + (node.lat + node.lon + '').replace('.', '').replace('-', '') + 'svg';
                  const transform = `translate(${point.x - svgChartWidth / 2},${point.y - svgChartHeight / 2})`;
                  const temp = d3.select(mapInstanceRef.current!.getPanes().overlayPane).select('#' + tempID);

                  // const sel = d3.select(pane).select<SVGSVGElement>(`#${id}`);
                  if (temp.empty()) {
                    d3.select(pane)
                      .append('svg')
                      .attr('class', 'vega-lite-svg')
                      .attr('id', tempID)
                      .attr('width', svgChartWidth)
                      .attr('height', svgChartHeight)
                      .attr('transform', transform)
                      .node()
                      ?.appendChild(vegaSVG.cloneNode(true));
                  } else {
                    temp.attr('transform', transform);
                  }
                };

                updateChartPosition();
                map.on('move zoom', updateChartPosition);
              })
              .catch(error => console.error("Error embedding Vega-Lite chart for node:", error));
          } 
          else {
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
      console.error(`Error rendering node layer for ${layerSpec.data.physical.path}:`, error);
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