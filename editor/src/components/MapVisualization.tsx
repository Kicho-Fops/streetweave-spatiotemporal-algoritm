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
import { getDynamicStyleValue, getDashArray, getSquiggleParams, generateSimpleWavyPath, getBivariateColor } from '../utils/styleHelpers';
import { loadThematicData, loadPhysicalData, offsetPoint } from '../utils/geoHelpers';
import { initializeMap, projectPoint, getOffsetDistance, getAdjustedLineWidth } from '../utils/mapHelpers';


const MapVisualization: React.FC<{ parsedSpec: ParsedSpec[] }> = ({ parsedSpec }) => {

  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const mimicLayerRef = useRef<L.GeoJSON | null>(null);
  const currentLayersRef = useRef<L.Layer[]>([]);

  const [map, setMap] = useState<L.Map | null>(null)
  const [zoom, setZoom] = useState<number>(18)

  const [mimicWidth, setMimicWidth] = useState<number>(0);
  const [addressCoords, setAddressCoords] = useState<{ lat: number; lon: number } | null>(null);

  const alignmentCounters = useRef({
    left: 0,
    right: 0
  })

  useEffect(() => {
    let cancelled = false;
    let mapInstance: L.Map | null = null;

    const startMap = async () => {
      const physData = await loadPhysicalData(parsedSpec[0].data.physical.path);
        
      if (cancelled) return;

      mapInstance = initializeMap(
        mapRef.current!,
        physData[0].point0.lat,
        physData[0].point0.lon,
        zoom,
        "light"
      );

      mapInstance.createPane("mimicStreetPane");
      mapInstance.getPane("mimicStreetPane")!.style.zIndex = "350";

      setMap(mapInstance);
      console.log("Map initialized")
    }

    startMap()

    return () => {
      cancelled = true;
      if (mapInstance) mapInstance.remove();
    };
  }, []);

  useEffect(() => {
    if (map) {

      if (parsedSpec[0] && parsedSpec[0].map?.streetWidth !== undefined) {
        setMimicWidth(parsedSpec[0].map.streetWidth);
      }

      currentLayersRef.current.forEach(layer => {
        if (!(layer.options && layer.options.pane === 'mimicStreetPane')) {
          map!.removeLayer(layer);
        }
      });

      currentLayersRef.current = [];
      
      parsedSpec.forEach(async (layerSpec, index) => {
        d3.selectAll('.vega-lite-svg').remove();

        map.off('move zoom');

        if (layerSpec.unit.type === 'segment'){
          renderSegmentLayer(map, layerSpec, index, currentLayersRef, alignmentCounters);
        }

        else if(layerSpec.unit.type === 'node'){
          renderNodeLayer(map, layerSpec, currentLayersRef);
        }

        // else if (layerSpec.unit === 'area'){
          // renderAreaLayer(map, layerSpec, currentLayersRef);
        // }

      });
    }
  }, [parsedSpec, map]);

  
  // useEffect(() => {
  //   if (!mapInstanceRef.current) return;

  //   const initMimicLayer = async () => {
  //     if (!mapInstanceRef.current!.getPane('mimicStreetPane')) {
  //       mapInstanceRef.current!.createPane('mimicStreetPane');
  //       mapInstanceRef.current!.getPane('mimicStreetPane')!.style.zIndex = '450';
  //     }

  //     if (!mimicLayerRef.current) {
  //       try {
  //         const data = await loadPhysicalData(parsedSpec[0].data.physical.path);

  //         if (data !== undefined) {
  //           const features = data.map(edge => ({
  //             type: 'Feature' as const,
  //             geometry: {
  //               type: 'LineString' as const,
  //               coordinates: [
  //                 [edge.point0.lon, edge.point0.lat],
  //                 [edge.point1.lon, edge.point1.lat]
  //               ]
  //             },
  //             properties: {
  //               Bearing: edge.bearing,
  //               Length: edge.length
  //             }
  //           }));
  
  //           const geojson = { type: 'FeatureCollection' as const, features };
  
  //           mimicLayerRef.current = L.geoJSON(geojson as GeoJsonObject, {
  //             pane: 'mimicStreetPane',
  //             style: {
  //               color: '#d3d3d6',
  //               weight: 0,
  //               opacity: 0.8
  //             }
  //           }).addTo(mapInstanceRef.current!);

  //         }
  //       } catch (error) {
  //         console.error('Failed to load mimic street GeoJSON:', error);
  //       }
  //     }
  //   };

  //   initMimicLayer();
  // }, [parsedSpec]);


  // Update mimic street width based on the slider value and filtering conditions.
  
  // useEffect(() => {
  //   if (mimicLayerRef.current) {
  //     mimicLayerRef.current.eachLayer((layer: any) => {
  //       const defaultWeight = parsedSpec[0].map?.streetWidth;
  //       let shouldUpdate = true;

  //       // if (parsedSpec[0].roadDirection) {
  //       //   const featureBearing = layer.feature.properties.Bearing;
  //       //   const featureDirection = getCardinalDirection(featureBearing);
  //       //   if (featureDirection.toLowerCase() !== parsedSpec[0].roadDirection.toLowerCase()) {
  //       //     shouldUpdate = false;
  //       //   }
  //       // }

  //       if (addressCoords) {
  //         const addressPoint = turf.point([addressCoords.lon, addressCoords.lat]);
  //         const lineFeature = turf.lineString(layer.feature.geometry.coordinates);
  //         const distance = turf.pointToLineDistance(addressPoint, lineFeature, { units: "meters" as turf.Units });
          
  //         if (distance > Number(parsedSpec[0].query?.radius)) {
  //           shouldUpdate = false;
  //         }
  //       }

  //       layer.setStyle({
  //         color: parsedSpec[0].map?.streetColor ? parsedSpec[0].map?.streetColor : '#d3d3d6',
  //         weight: shouldUpdate ? mimicWidth : defaultWeight,
  //         opacity: 0.8
  //       });
  //     });
  //   }
  // }, [mimicWidth, parsedSpec, addressCoords]);


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

      let initialEdges = physicalData;

      if (layerSpec.unit.splits != 1) {
        initialEdges = subdivideEdges(initialEdges, thematicData.attributeStats);
      }

      const processedEdges : AggregatedEdges = await applySpatialAggregation(initialEdges, thematicData.data, layerSpec);
      console.log(processedEdges);

      // Clear existing layers from relevant panes to prevent duplicates on redraw
      const paneName = layerSpec.unit.alignment === "center" 
        ? 'overlayPane' 
        : `${layerSpec.unit.alignment}-${layerSpec.unit.orientation}`;
      
      if (!map.getPane(paneName)) {
        map.createPane(paneName);
        map.getPane(paneName)!.style.zIndex = '400';
      }

      d3.select(map.getPanes()[paneName]).selectAll("svg").remove();

      const svgLayer = L.svg({ pane: paneName }).addTo(map);

      (svgLayer as any).layerGroup = layerSpec.unit.alignment;
      
      const svgGroup = d3.select(map.getPanes()[paneName]).select("svg").append("g").attr("class", "leaflet-zoom-hide");

      if (layerSpec.unit.alignment === "left") {
        alignmentCountersRef.current.left++;
      } else if (layerSpec.unit.alignment === "right") {
        alignmentCountersRef.current.right++;
      }

      const drawVegaLite = () => {
        const templateSpec = layerSpec.unit.chart;
        const svgChartWidth = 150;
        const svgChartHeight = 150;
        const pane = map.getPanes().overlayPane;

        processedEdges.edges.forEach(async (edge: PhysicalEdge) => {
          const aggregatedAttrs = edge.attributes;
          const midpoint = {
            lat: (edge.point0.lat + edge.point1.lat) / 2,
            lon: (edge.point0.lon + edge.point1.lon) / 2
          };

          const chartSpec = JSON.parse(JSON.stringify(templateSpec));
          chartSpec.data = {
            values: Object.entries(aggregatedAttrs || {}).map(([key, value]) => ({ category: key, value: value }))
          };

          const result = await vegaEmbed('#vis', chartSpec, { renderer: 'svg', actions: false })

          const vegaSVG = (result.view as any)._el.querySelector('svg');
          if (!vegaSVG) return;

          updateChartPosition(midpoint, edge.point0, edge.point1, svgChartWidth, svgChartHeight, pane, vegaSVG)

        })


        // map.on('move zoom', updateChartPosition);

      }

      

      const drawSegmentShapes = () => {

        const offsetAngle = layerSpec.unit.alignment === "left" 
          ? -90 
          : layerSpec.unit.alignment === "right"
            ? 90
            : 0

        const distance = getOffsetDistance(map) * (layerSpec.unit.alignment === "left" ? alignmentCountersRef.current.left : alignmentCountersRef.current.right);

        const instructions = processedEdges.edges.map((edge: PhysicalEdge, i: number) => {
          let point0 = edge.point0;
          let point1 = edge.point1;

          if (layerSpec.unit.alignment === "left" || layerSpec.unit.alignment === "right") {
            const offsetStartCoords = offsetPoint(edge.point0.lat, edge.point0.lon, edge.bearing + offsetAngle, distance);
            const offsetEndCoords = offsetPoint(edge.point1.lat, edge.point1.lon, edge.bearing + offsetAngle, distance);
            
            point0 = { lat: offsetStartCoords[0], lon: offsetStartCoords[1] };
            point1 = { lat: offsetEndCoords[0], lon: offsetEndCoords[1] };
          }

          let [p0, p1] = [
            map.latLngToLayerPoint([point0.lat, point0.lon]),
            map.latLngToLayerPoint([point1.lat, point1.lon])
          ];

          let d = null
          let fill = null
          let stroke = null
          let strokeWidth = null
          let strokeOpacity = null
          let strokeDasharray = null
          let strokeLinecap = null
          let opacity = null
          
          let finalObj = null
          
          let dByColor: Record<string,string> = {};
          
          const baseWidth = getDynamicStyleValue(layerSpec.unit.width, edge.attributes, processedEdges.attributeStats, [0, 5]);

          if (layerSpec.unit.method === 'line' && layerSpec.unit.orientation === 'parallel') {
            if (layerSpec.unit.squiggle) {
              const { amplitude: squiggleAmplitude, frequency: squiggleFrequency } = getSquiggleParams(layerSpec.unit.squiggle, edge.attributes, processedEdges.attributeStats);
              d = generateSimpleWavyPath(p0, p1, squiggleAmplitude, squiggleFrequency);
              stroke = getDynamicStyleValue(layerSpec.unit.color, edge.attributes, thematicData.attributeStats, ["black", "red"]) as string;
              strokeWidth = getAdjustedLineWidth(map, baseWidth)
              strokeOpacity = getDynamicStyleValue(layerSpec.unit.opacity, edge.attributes, processedEdges.attributeStats, [0, 1]) as number;

            } else {
              d = `M${p0.x},${p0.y}L${p1.x},${p1.y}`;
              stroke = getDynamicStyleValue(layerSpec.unit.color, edge.attributes, thematicData.attributeStats, ["black", "red"]) as string;
              strokeWidth = getAdjustedLineWidth(map, baseWidth)
              strokeOpacity = getDynamicStyleValue(layerSpec.unit.opacity, edge.attributes, processedEdges.attributeStats, [0, 1]) as number;
              strokeDasharray =  getDashArray(layerSpec.unit.dash, edge.attributes, processedEdges.attributeStats)

            }

          } else if(layerSpec.unit.method === 'line' && layerSpec.unit.orientation === 'perpendicular') {
            const height = getDynamicStyleValue(layerSpec.unit.height, edge.attributes, thematicData.attributeStats, [0, 10]) as number;


            [p0, p1] = [
              map.latLngToLayerPoint([edge.point0.lat, edge.point0.lon]),
              map.latLngToLayerPoint([edge.point1.lat, edge.point1.lon])
            ];

            const midpoint_x = (p0.x + p1.x) / 2;
            const midpoint_y = (p0.y + p1.y) / 2;

            const midpoint_screen = [midpoint_x, midpoint_y];

            const dx_base = p1.x - p0.x;
            const dy_base = p1.y - p0.y;

            const segmentLength = Math.sqrt(dx_base * dx_base + dy_base * dy_base);

            let normal_x = -dy_base / segmentLength;
            let normal_y = dx_base / segmentLength;
            
            if (normal_y > 0) {
              normal_x = -normal_x;
              normal_y = -normal_y;
            }

            const endPoint_x = midpoint_screen[0] + (normal_x * height);
            const endPoint_y = midpoint_screen[1] + (normal_y * height);

            d = `M${midpoint_screen[0]},${midpoint_screen[1]} L${endPoint_x},${endPoint_y}`;
            stroke = getDynamicStyleValue(layerSpec.unit.color, edge.attributes, thematicData.attributeStats, ["black", "red"]) as string;
            strokeWidth = getAdjustedLineWidth(map, baseWidth)
            strokeOpacity = getDynamicStyleValue(layerSpec.unit.opacity, edge.attributes, processedEdges.attributeStats, [0, 1]) as number;


          } else if (layerSpec.unit.method === 'matrix') {
            [p0, p1] = [
              map.latLngToLayerPoint([edge.point0.lat, edge.point0.lon]),
              map.latLngToLayerPoint([edge.point1.lat, edge.point1.lon])
            ];

            const numRows = layerSpec.unit.columns || 1;
            const numColumns = layerSpec.unit.rows || 1;

            const colorVar1Name = layerSpec.unit.width as string;
            const colorVar2Name = layerSpec.unit.height as string;

            const p0_screen = { x: p0.x, y: p0.y };
            const p1_screen = { x: p1.x, y: p1.y};

            const dx_segment = p1_screen.x - p0_screen.x;
            const dy_segment = p1_screen.y - p0_screen.y;

            const segmentLength = Math.sqrt(dx_segment * dx_segment + dy_segment * dy_segment);
            const angleRad = Math.atan2(dy_segment, dx_segment);
            const angleDeg = angleRad * (180 / Math.PI);
            
            const totalMatrixPerpendicularHeight = 25; // getDynamicStyleValue(layerSpec.unit.width, edge.attributes, thematicData.attributeStats, [1, 20]) as number;
            const cellWidthAligned = segmentLength / numColumns; // Each cell's width spans part of the segment length
            const cellHeightAligned = totalMatrixPerpendicularHeight / numRows;

            
            for (let r = 0; r < numRows; r++) {
              for (let c = 0; c < numColumns; c++) {
                // const cellX_relative = c * cellWidthAligned;
                // const matrixCenterYOffset = -totalMatrixPerpendicularHeight / 2; // Center Y on the segment
                // const cellY_relative = matrixCenterYOffset + r * cellHeightAligned;
                
                const value1 = getDynamicStyleValue(colorVar1Name, edge.attributes, thematicData.attributeStats, [0,1]) as number;
                const value2 = getDynamicStyleValue(colorVar2Name, edge.attributes, thematicData.attributeStats, [0,1]) as number;
                const cellColor = getBivariateColor(value1, value2);
                
                const x = c * cellWidthAligned;
                const y = -totalMatrixPerpendicularHeight/2 + r * cellHeightAligned;
                
                const subpath = `M${x},${y}h${cellWidthAligned}v${cellHeightAligned}h${-cellWidthAligned}Z`;
                dByColor[cellColor] = (dByColor[cellColor] || "") + subpath;
                
                // matrixGroup.append("rect")
                //   .attr("x", cellX_relative)
                //   .attr("y", cellY_relative)
                //   .attr("width", cellWidthAligned)
                //   .attr("height", cellHeightAligned)
                //   .attr("fill", cellColor)
                //   .attr("stroke-width", 0);
              }
            }
            
            finalObj = { id: `edge-${i}`, dByColor: dByColor , transform: `translate(${p0_screen.x}, ${p0_screen.y}) rotate(${angleDeg})` }

          } else if (layerSpec.unit.method === 'rect' && layerSpec.unit.orientation === 'perpendicular') {
            const height = getDynamicStyleValue(layerSpec.unit.height, edge.attributes, thematicData.attributeStats, [0, 10]) as number;

            [p0, p1] = [
              map.latLngToLayerPoint([edge.point0.lat, edge.point0.lon]),
              map.latLngToLayerPoint([edge.point1.lat, edge.point1.lon])
            ];

            const dx = p1.x - p0.x;
            const dy = p1.y - p0.y;
            const segmentLength = Math.sqrt(dx * dx + dy * dy);
            const nx = -dy / segmentLength; // Normalized perpendicular x
            const ny = dx / segmentLength;  // Normalized perpendicular y
            const height_offset_x = nx * height;
            const height_offset_y = ny * height;
            const p0_base = { x: p0.x, y: p0.y};
            const p1_base = { x: p1.x, y: p1.y};
            const p0_top = { x: p0.x + height_offset_x, y: p0.y + height_offset_y };
            const p1_top = { x: p1.x + height_offset_x, y: p1.y + height_offset_y };

            d = [
              `M${p0_base.x},${p0_base.y}`,
              `L${p1_base.x},${p1_base.y}`,
              `L${p1_top.x},${p1_top.y}`,
              `L${p0_top.x},${p0_top.y}`,
              "Z"
            ].join(" ");

            fill = getDynamicStyleValue(layerSpec.unit.color, edge.attributes, thematicData.attributeStats, ["black", "red"]) as string;
            opacity = getDynamicStyleValue(layerSpec.unit.opacity, edge.attributes, processedEdges.attributeStats, [0, 1]) as number;

          } else if (layerSpec.unit.method === 'rect' && layerSpec.unit.orientation === 'parallel') {

            [p0, p1] = [
              map.latLngToLayerPoint([edge.point0.lat, edge.point0.lon]),
              map.latLngToLayerPoint([edge.point1.lat, edge.point1.lon])
            ];

            d = `M${p0.x},${p0.y} L${p1.x},${p1.y}`;

            stroke = getDynamicStyleValue(layerSpec.unit.color, edge.attributes, thematicData.attributeStats, ["black", "red"]) as string;
            strokeWidth = getDynamicStyleValue(layerSpec.unit.height, edge.attributes, thematicData.attributeStats, [0, 10]) as number;
            opacity = getDynamicStyleValue(layerSpec.unit.opacity, edge.attributes, processedEdges.attributeStats, [0, 1]) as number;
            strokeLinecap = "butt"
          
          }

          if(layerSpec.unit.method !== 'matrix') {
            finalObj = {
              id: `edge-${i}`,
              d,
              stroke: stroke,
              "fill": fill,
              'stroke-width': strokeWidth,
              'stroke-opacity': strokeOpacity,
              'stroke-dasharray': strokeDasharray,
              "stroke-linecap": strokeLinecap,
              'opacity': opacity
            };
          }

          return finalObj;
        })
        
        if (layerSpec.unit.method === 'matrix') {
          // 1. Select or create one <g> per edge
          const groups = svgGroup.selectAll('g.matrix-edge')
            .data(instructions, d => d.id);

          const groupsEnter = groups.enter()
            .append('g')
              .attr('class', 'matrix-edge')
              .attr('transform', d => d.transform);

          // Remove any old groups
          groups.exit().remove();

          // 2. For each group, draw one <path> per color band
          groupsEnter.merge(groups)
            .attr('transform', d => d.transform)      // update position on zoom/move
            .each(function(d) {
              const g = d3.select(this);
              // turn { color: dStr, … } into [ [color, dStr], … ]
              const bands = Object.entries(d.dByColor);

              const paths = g.selectAll('path')
                .data(bands);

              // enter + update
              paths.enter().append('path')
                  .merge(paths)
                  .attr('d', ([color, dStr]) => dStr)
                  .attr('fill', ([color]) => color)
                  .attr('stroke-width', 0);

              // exit
              paths.exit().remove();
            });
        }
        else {
          const paths = svgGroup.selectAll('path').data(instructions, d => d.id);
          const enter = paths.enter().append('path').attr('fill', 'none');
          
          enter.merge(paths)
            .attr('d', d => d.d)
            .style('fill', d => d.fill)
            .style('fill-opacity', d => d["fill-opacity"])
            .style('stroke', d => d.stroke)
            .style('stroke-width', d => d['stroke-width'])
            .style('stroke-opacity', d => d['stroke-opacity'])
            .style('stroke-dasharray', d => d['stroke-dasharray']);
        }


        // // console.log(processedEdges);
        // processedEdges.edges.forEach((edge: PhysicalEdge) => {

        //   // Apply alignment offsets for parallel lines/rects
        //   let currentStartPoint = edge.point0;
        //   let currentEndPoint = edge.point1;
        //   const currentBearing = edge.bearing;// bearingBetweenPoints(edge.point0.lat, edge[0].lon, edge[1].lat, edge[1].lon);

        //   if (layerSpec.unit.alignment === "left" || layerSpec.unit.alignment === "right") {
        //     const offsetAngle = layerSpec.unit.alignment === "left" ? currentBearing - 90 : currentBearing + 90;
        //     const distance = getOffsetDistance(map) * (layerSpec.unit.alignment === "left" ? alignmentCountersRef.current.left : alignmentCountersRef.current.right);

        //     const offsetStartCoords = offsetPoint(edge.point0.lat, edge.point0.lon, offsetAngle, distance);
        //     const offsetEndCoords = offsetPoint(edge.point1.lat, edge.point1.lon, offsetAngle, distance);
        //     currentStartPoint = { lat: offsetStartCoords[0], lon: offsetStartCoords[1] };
        //     currentEndPoint = { lat: offsetEndCoords[0], lon: offsetEndCoords[1] };
        //   }

        //   const pointsForRendering = [{ lat: currentStartPoint.lat, lon: currentStartPoint.lon }, { lat: currentEndPoint.lat, lon: currentEndPoint.lon }];
        //   // Retrieve dynamic styles using the helper
        //   // const colorRamp = layerIndex === 0
        //     // ? ["#a50f15", "#de2d26", "#fb6a4a", "#fcae91", "#fee5d9"]
        //     // : layerIndex === 1
        //       // ? ["#08519c", "#3182bd", "#6baed6", "#bdd7e7", "#eff3ff"]
        //       // : ["#f2f0f7", "#cbc9e2", "#9e9ac8", "#756bb1", "#54278f"];
        //   // const lineColor = getDynamicStyleValue(layerSpec.unit.color, edge.attributes, thematicData.attributeStats, colorRamp) as string;
        //   const lineColor = getDynamicStyleValue(layerSpec.unit.color, edge.attributes, thematicData.attributeStats, ["black", "red"]) as string;
          
        //   // Use nullish coalescing (??) for numeric values to provide a default if null/undefined
        //   const baseLineWidth = getDynamicStyleValue(layerSpec.unit.width, edge.attributes, processedEdges.attributeStats, [0, 5]) as number;
        //   // console.log("previous line width", baseLineWidth)
        //   const lineWidth = getAdjustedLineWidth(map, baseLineWidth);
        //   // console.log("after line width", lineWidth)

        //   const lineOpacity = getDynamicStyleValue(layerSpec.unit.opacity, edge.attributes, processedEdges.attributeStats, [0, 1]) as number;

        //   if (layerSpec.unit.method === 'line' && layerSpec.unit.orientation === 'parallel') {
        //     const lineGenerator = d3.line<any>()
        //       .x((d: any) => projectPoint(map, d.lat, d.lon)[0])
        //       .y((d: any) => projectPoint(map, d.lat, d.lon)[1]);

        //     if (layerSpec.unit.squiggle) {
        //       const { amplitude: squiggleAmplitude, frequency: squiggleFrequency } = getSquiggleParams(layerSpec.unit.squiggle, edge.attributes, processedEdges.attributeStats);
        //       console.log(squiggleAmplitude, squiggleFrequency);
        //       const point1 = L.point(projectPoint(map, pointsForRendering[0].lat, pointsForRendering[0].lon)[0], projectPoint(map, pointsForRendering[0].lat, pointsForRendering[0].lon)[1]);
        //       const point2 = L.point(projectPoint(map, pointsForRendering[1].lat, pointsForRendering[1].lon)[0], projectPoint(map, pointsForRendering[1].lat, pointsForRendering[1].lon)[1]);
        //       const squigglyPath = generateSimpleWavyPath(point1, point2, squiggleAmplitude, squiggleFrequency);
        //       svgGroup.append("path")
        //         .attr("d", squigglyPath)
        //         .style("stroke", lineColor)
        //         .style("stroke-width", lineWidth)
        //         .style("stroke-opacity", lineOpacity)
        //     } else {
        //       const dashArray = getDashArray(layerSpec.unit.dash, edge.attributes, processedEdges.attributeStats);
        //       svgGroup.append("path")
        //         .datum(pointsForRendering)
        //         .attr("d", lineGenerator)
        //         .style("stroke", lineColor)
        //         .style("stroke-width", lineWidth)
        //         .style("stroke-opacity", lineOpacity)
        //         .style("stroke-dasharray", dashArray)
        //     }
        //   }
        //   else if(layerSpec.unit.method === 'line' && layerSpec.unit.orientation === 'perpendicular') {
        //     const height = getDynamicStyleValue(layerSpec.unit.height, edge.attributes, thematicData.attributeStats, [0, 10]) as number;
        //     const p1 = projectPoint(map, edge.point0.lat, edge.point0.lon);
        //     const p2 = projectPoint(map, edge.point1.lat, edge.point1.lon);
        //     const midpoint_x = (p1[0] + p2[0]) / 2;
        //     const midpoint_y = (p1[1] + p2[1]) / 2;
        //     const midpoint_screen = [midpoint_x, midpoint_y];

        //     const dx_base = p2[0] - p1[0];
        //     const dy_base = p2[1] - p1[1];

        //     const segmentLength = Math.sqrt(dx_base * dx_base + dy_base * dy_base);

        //     let normal_x = -dy_base / segmentLength;
        //     let normal_y = dx_base / segmentLength;
            
        //     if (normal_y > 0) {
        //       normal_x = -normal_x;
        //       normal_y = -normal_y;
        //     }

        //     const endPoint_x = midpoint_screen[0] + (normal_x * height);
        //     const endPoint_y = midpoint_screen[1] + (normal_y * height);

        //     svgGroup.append("line")
        //     .attr("x1", midpoint_screen[0])
        //     .attr("y1", midpoint_screen[1])
        //     .attr("x2", endPoint_x)
        //     .attr("y2", endPoint_y)
        //     .attr("stroke", lineColor)       // Use the dynamic line color
        //     .attr("opacity", lineOpacity)     // Use the dynamic line opacity
        //     .attr("stroke-width", lineWidth);

        //   }
        //   else if (layerSpec.unit.method === 'matrix') {
        //     const numRows = layerSpec.unit.columns || 1;
        //     const numColumns = layerSpec.unit.rows || 1;

        //     const colorVar1Name = layerSpec.unit.width as string;
        //     const colorVar2Name = layerSpec.unit.height as string;

        //     const p1_screen = { x: projectPoint(map, edge.point0.lat, edge.point0.lon)[0], y: projectPoint(map, edge.point0.lat, edge.point0.lon)[1] };
        //     const p2_screen = { x: projectPoint(map, edge.point1.lat, edge.point1.lon)[0], y: projectPoint(map, edge.point1.lat, edge.point1.lon)[1] };
        //     const dx_segment = p2_screen.x - p1_screen.x;
        //     const dy_segment = p2_screen.y - p1_screen.y;

        //     const segmentLength = Math.sqrt(dx_segment * dx_segment + dy_segment * dy_segment);
        //     const angleRad = Math.atan2(dy_segment, dx_segment);
        //     const angleDeg = angleRad * (180 / Math.PI);
            
        //     const totalMatrixPerpendicularHeight = 25; // getDynamicStyleValue(layerSpec.unit.width, edge.attributes, thematicData.attributeStats, [1, 20]) as number;
        //     const cellWidthAligned = segmentLength / numColumns; // Each cell's width spans part of the segment length
        //     const cellHeightAligned = totalMatrixPerpendicularHeight / numRows;

        //     const matrixGroup = svgGroup.append("g")
        //       .attr("transform", `translate(${p1_screen.x}, ${p1_screen.y}) rotate(${angleDeg})`);


        //     for (let r = 0; r < numRows; r++) {
        //       for (let c = 0; c < numColumns; c++) {
        //         const cellX_relative = c * cellWidthAligned;
        //         const matrixCenterYOffset = -totalMatrixPerpendicularHeight / 2; // Center Y on the segment
        //         const cellY_relative = matrixCenterYOffset + r * cellHeightAligned;

        //         const value1 = getDynamicStyleValue(colorVar1Name, edge.attributes, thematicData.attributeStats, [0,1]) as number;
        //         const value2 = getDynamicStyleValue(colorVar2Name, edge.attributes, thematicData.attributeStats, [0,1]) as number;
        //         const cellColor = getBivariateColor(value1, value2);

        //         matrixGroup.append("rect")
        //           .attr("x", cellX_relative)
        //           .attr("y", cellY_relative)
        //           .attr("width", cellWidthAligned)
        //           .attr("height", cellHeightAligned)
        //           .attr("fill", cellColor)
        //           .attr("stroke-width", 0);
        //       }
        //     }
        //   }
        //   else if (layerSpec.unit.method === 'rect' && layerSpec.unit.orientation === 'perpendicular') {
        //     const height = getDynamicStyleValue(layerSpec.unit.height, edge.attributes, thematicData.attributeStats, [0, 10]) as number;
        //     const p1 = projectPoint(map, edge.point0.lat, edge.point0.lon);
        //     const p2 = projectPoint(map, edge.point1.lat, edge.point1.lon);

        //     const dx = p2[0] - p1[0];
        //     const dy = p2[1] - p1[1];
        //     const segmentLength = Math.sqrt(dx * dx + dy * dy);
        //     const nx = -dy / segmentLength; // Normalized perpendicular x
        //     const ny = dx / segmentLength;  // Normalized perpendicular y
        //     const height_offset_x = nx * height;
        //     const height_offset_y = ny * height;
        //     const p1_base = { x: p1[0], y: p1[1]};
        //     const p2_base = { x: p2[0], y: p2[1]};
        //     const p1_top = { x: p1[0] + height_offset_x, y: p1[1] + height_offset_y };
        //     const p2_top = { x: p2[0] + height_offset_x, y: p2[1] + height_offset_y };

        //     const polygonPoints = [
        //       p1_base,
        //       p2_base,
        //       p2_top,
        //       p1_top
        //     ].map(p => `${p.x},${p.y}`).join(" ");

        //     svgGroup.append("polygon")
        //       .attr("points", polygonPoints)
        //       .attr("opacity", lineOpacity)
        //       .attr("fill", lineColor);
        //   }
        //   else if (layerSpec.unit.method === 'rect' && layerSpec.unit.orientation === 'parallel') {
        //     const height = getDynamicStyleValue(layerSpec.unit.height, edge.attributes, thematicData.attributeStats, [0, 10]) as number;
        //     const p1 = projectPoint(map, edge.point0.lat, edge.point0.lon);
        //     const p2 = projectPoint(map, edge.point1.lat, edge.point1.lon);

        //     svgGroup.append("line")
        //       .attr("x1", p1[0])
        //       .attr("y1", p1[1])
        //       .attr("x2", p2[0])
        //       .attr("y2", p2[1])
        //       .attr("opacity", lineOpacity)
        //       .attr("stroke", lineColor)
        //       .attr("stroke-width", height)
        //       .attr("stroke-linecap", "butt");
        //   } 
        //   else if (layerSpec.unit.chart) {
        //     const templateSpec = layerSpec.unit.chart;
        //     const svgChartWidth = 150, svgChartHeight = 150;
        //     const pane = map.getPanes().overlayPane;

        //     const start = edge.point0;
        //     const end = edge.point1;
        //     // const bearing = edge.bearing;
        //     // const length = edge.length;
        //     const aggregatedAttrs = edge.attributes;
        //     const midpoint = {
        //       lat: (start.lat + end.lat) / 2,
        //       lon: (start.lon + end.lon) / 2
        //     };

        //     const chartSpec = JSON.parse(JSON.stringify(templateSpec));
        //     chartSpec.data = {
        //       values: Object.entries(aggregatedAttrs || {}).map(([key, value]) => ({ category: key, value: value }))
        //     };

        //     // console.log("vegadata is", chartSpec.data)

        //     vegaEmbed('#vis', chartSpec, { renderer: 'svg', actions: false })
        //       .then(result => {
        //         const vegaSVG = (result.view as any)._el.querySelector('svg');
        //         if (!vegaSVG) return;

        //         // const id = `chart_edge_${midpoint.lat}_${midpoint.lon}`.replace(/[^\w]/g, '');

        //         const updateChartPosition = () => {
        //           const point = map.latLngToLayerPoint([midpoint.lat, midpoint.lon]);
        //           const tempID = 't' + (midpoint.lat + midpoint.lon + '').replace('.', '').replace('-', '') + 'svg';
        //           const temp = d3.select(mapInstanceRef.current!.getPanes().overlayPane).select('#' + tempID);
        //           // const bearing = bearingBetweenPoints(start.lat, start.lon, end.lat, end.lon);
        //           const turfStart = turf.point([start.lon, start.lat]); // lon lat
        //           const turfEnd = turf.point([end.lon, end.lat]); // lon lat
        //           const bearing: number = turf.bearing(turfStart, turfEnd);

        //           const angle = bearing + 90;

        //           const transform = `translate(${point.x - svgChartWidth / 3},${point.y - svgChartHeight / 3})`
        //                           + ` rotate(${angle},${svgChartWidth / 2.5},${svgChartHeight / 2.5})`;

        //           // const sel = d3.select(pane).select<SVGSVGElement>(`#${id}`);
        //           if (temp.empty()) {
        //             d3.select(pane)
        //               .append('svg')
        //               .attr('class', 'vega-lite-svg')
        //               .attr('id', tempID)
        //               .attr('width', svgChartWidth)
        //               .attr('height', svgChartHeight)
        //               .attr('transform', transform)
        //               .node()
        //               ?.appendChild(vegaSVG.cloneNode(true));
        //           } else {
        //             temp.attr('transform', transform);
        //           }
        //         };

        //         updateChartPosition();
        //         map.on('move zoom', updateChartPosition);
        //       })
        //       .catch(error => console.error("Error embedding Vega-Lite chart:", error));

        //   } 
        // });
      };

      if(layerSpec.unit.chart) {
        drawSegmentShapes();
        map.on('moveend zoomend', drawSegmentShapes);
        currentLayersRef.current.push(svgLayer);

      } else {
        drawVegaLite()
      }


    } catch (error) {
      console.error(`Error rendering segment layer for ${layerSpec.data.physical.path}:`, error);
    }

    function subdivideEdges(edges: PhysicalEdge[], attributeStats) {
      const subdivided: PhysicalEdge[] = [];


      edges.forEach((edge: PhysicalEdge) => {

        let splits = getDynamicStyleValue(layerSpec.unit.splits, edge.attributes, attributeStats, [1, 20]) as number;
        const start = edge.point0;
          const end = edge.point1;
          const bearing = edge.bearing;
          const length = edge.length / splits;
          const attributes = edge.attributes;
          const lat0 = start.lat, lon0 = start.lon;
          const lat1 = end.lat, lon1 = end.lon;
          const dLat = lat1 - lat0, dLon = lon1 - lon0;

          let startIndex = 0;
          let endIndex = splits;
          if (splits >= 20) {
            startIndex = 5;
            endIndex = splits - 5;
          } else if (splits >= 10 && splits < 20) {
            startIndex = 1;
            endIndex = splits - 1;
          }

          for (let i = startIndex; i < endIndex; i++) {
            const point0 = { lat: lat0 + dLat * (i / splits), lon: lon0 + dLon * (i / splits) } as ThematicPoint;
            const point1 = { lat: lat0 + dLat * ((i + 1) / splits), lon: lon0 + dLon * ((i + 1) / splits) } as ThematicPoint;

            subdivided.push({point0, point1, bearing, length, attributes} as PhysicalEdge);
          }
      });

      return subdivided;
    }

    function updateChartPosition(midpoint, start, end, svgChartWidth, svgChartHeight, pane, vegaSVG) {
      const point = map.latLngToLayerPoint([midpoint.lat, midpoint.lon]);
      const tempID = 't' + (midpoint.lat + midpoint.lon + '').replace('.', '').replace('-', '') + 'svg';
      const temp = d3.select(map!.getPanes().overlayPane).select('#' + tempID);

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