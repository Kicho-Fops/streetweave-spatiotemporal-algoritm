
import { AggregatedEdges, PhysicalEdge, ThematicPoint, UnitType } from "streetweave";

import { generateSimpleWavyPath, getBivariateColor, getDashArray, getDynamicStyleValue, getSquiggleParams } from "./styleHelpers";
import { offsetPoint } from "./geoHelpers";
import { getAdjustedLineWidth } from "./mapHelpers";
import * as d3 from 'd3';


export function buildD3Instructions(
  edges:PhysicalEdge[], 
  unit: UnitType, 
  processedEdges:AggregatedEdges, 
  thematicData: { data?: ThematicPoint[]; attributeStats: any; }, 
  distance: number, 
  map: L.Map) {

  const offsetAngle = unit.alignment === "left" 
    ? -90 
    : unit.alignment === "right"
      ? 90
      : 0

  const instructions = edges.map((edge: PhysicalEdge, i: number) => {

    let point0 = edge.point0;
    let point1 = edge.point1;

    if (unit.alignment === "left" || unit.alignment === "right") {
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
    
    const baseWidth = getDynamicStyleValue(unit.width, edge.attributes, processedEdges.attributeStats, [0, 5]) as number;

    if (unit.method === 'line' && unit.orientation === 'parallel') {
    if (unit.squiggle) {
        const { amplitude: squiggleAmplitude, frequency: squiggleFrequency } = getSquiggleParams(unit.squiggle, edge.attributes, processedEdges.attributeStats);
        d = generateSimpleWavyPath(p0, p1, squiggleAmplitude, squiggleFrequency);
        stroke = getDynamicStyleValue(unit.color, edge.attributes, thematicData.attributeStats, ["black", "red"]) as string;
        strokeWidth = getAdjustedLineWidth(map, baseWidth)
        strokeOpacity = getDynamicStyleValue(unit.opacity, edge.attributes, processedEdges.attributeStats, [0, 1]) as number;

    } else {
        d = `M${p0.x},${p0.y}L${p1.x},${p1.y}`;
        stroke = getDynamicStyleValue(unit.color, edge.attributes, thematicData.attributeStats, ["black", "red"]) as string;
        strokeWidth = getAdjustedLineWidth(map, baseWidth)
        strokeOpacity = getDynamicStyleValue(unit.opacity, edge.attributes, processedEdges.attributeStats, [0, 1]) as number;
        strokeDasharray =  getDashArray(unit.dash, edge.attributes, processedEdges.attributeStats)

    }

    } else if(unit.method === 'line' && unit.orientation === 'perpendicular') {
    const height = getDynamicStyleValue(unit.height, edge.attributes, thematicData.attributeStats, [0, 10]) as number;


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
    stroke = getDynamicStyleValue(unit.color, edge.attributes, thematicData.attributeStats, ["black", "red"]) as string;
    strokeWidth = getAdjustedLineWidth(map, baseWidth)
    strokeOpacity = getDynamicStyleValue(unit.opacity, edge.attributes, processedEdges.attributeStats, [0, 1]) as number;


    } else if (unit.method === 'matrix') {
    [p0, p1] = [
        map.latLngToLayerPoint([edge.point0.lat, edge.point0.lon]),
        map.latLngToLayerPoint([edge.point1.lat, edge.point1.lon])
    ];

    const numRows = unit.columns || 1;
    const numColumns = unit.rows || 1;

    const colorVar1Name = unit.width as string;
    const colorVar2Name = unit.height as string;

    const p0_screen = { x: p0.x, y: p0.y };
    const p1_screen = { x: p1.x, y: p1.y};

    const dx_segment = p1_screen.x - p0_screen.x;
    const dy_segment = p1_screen.y - p0_screen.y;

    const segmentLength = Math.sqrt(dx_segment * dx_segment + dy_segment * dy_segment);
    const angleRad = Math.atan2(dy_segment, dx_segment);
    const angleDeg = angleRad * (180 / Math.PI);
    
    const totalMatrixPerpendicularHeight = 25; // getDynamicStyleValue(unit.width, edge.attributes, thematicData.attributeStats, [1, 20]) as number;
    const cellWidthAligned = segmentLength / numColumns; // Each cell's width spans part of the segment length
    const cellHeightAligned = totalMatrixPerpendicularHeight / numRows;

    
    for (let r = 0; r < numRows; r++) {
        for (let c = 0; c < numColumns; c++) {
        
        const value1 = getDynamicStyleValue(colorVar1Name, edge.attributes, thematicData.attributeStats, [0,1]) as number;
        const value2 = getDynamicStyleValue(colorVar2Name, edge.attributes, thematicData.attributeStats, [0,1]) as number;
        const cellColor = getBivariateColor(value1, value2);
        
        const x = c * cellWidthAligned;
        const y = -totalMatrixPerpendicularHeight/2 + r * cellHeightAligned;
        
        const subpath = `M${x},${y}h${cellWidthAligned}v${cellHeightAligned}h${-cellWidthAligned}Z`;
        dByColor[cellColor] = (dByColor[cellColor] || "") + subpath;
        }
    }
    
    finalObj = { id: `edge-${i}`, dByColor: dByColor , transform: `translate(${p0_screen.x}, ${p0_screen.y}) rotate(${angleDeg})` }

    } else if (unit.method === 'rect' && unit.orientation === 'perpendicular') {
    const height = getDynamicStyleValue(unit.height, edge.attributes, thematicData.attributeStats, [0, 10]) as number;

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

    fill = getDynamicStyleValue(unit.color, edge.attributes, thematicData.attributeStats, ["black", "red"]) as string;
    opacity = getDynamicStyleValue(unit.opacity, edge.attributes, processedEdges.attributeStats, [0, 1]) as number;

    } else if (unit.method === 'rect' && unit.orientation === 'parallel') {

    [p0, p1] = [
        map.latLngToLayerPoint([edge.point0.lat, edge.point0.lon]),
        map.latLngToLayerPoint([edge.point1.lat, edge.point1.lon])
    ];

    d = `M${p0.x},${p0.y} L${p1.x},${p1.y}`;

    stroke = getDynamicStyleValue(unit.color, edge.attributes, thematicData.attributeStats, ["black", "red"]) as string;
    strokeWidth = getDynamicStyleValue(unit.height, edge.attributes, thematicData.attributeStats, [0, 10]) as number;
    opacity = getDynamicStyleValue(unit.opacity, edge.attributes, processedEdges.attributeStats, [0, 1]) as number;
    strokeLinecap = "butt"
    
    }

    if(unit.method !== 'matrix') {
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

  return instructions
  
}

export function drawSegments(
  method: "line" | "rect" | "matrix" | undefined, 
  svgGroup: d3.Selection<d3.BaseType | SVGGElement, null, d3.BaseType, unknown>, 
  instructions: (
    { id: string; d: string | null; stroke: string | null; 
      fill: string | null; 'stroke-width': number | null; 
      'stroke-opacity': number | null; 'stroke-dasharray': string | null; 
      "stroke-linecap": string | null; opacity: number | null; dByColor?: undefined; transform?: undefined; 
    } | 
      { id: string; dByColor: Record<string, string>; transform: string; d?: undefined; stroke?: undefined; 
        fill?: undefined; 'stroke-width'?: undefined; 'stroke-opacity'?: undefined; 'stroke-dasharray'?: undefined; 
        "stroke-linecap"?: undefined; opacity?: undefined; } | null)[]) {

  if (method === 'matrix') {

    const groups = svgGroup.selectAll('g.matrix-edge')
      .data(instructions, (d: any) => d.id);

    const groupsEnter = groups.enter()
      .append('g')
        .attr('class', 'matrix-edge')
        .attr('transform', (d: any) => d.transform);

    groups.exit().remove();


    groupsEnter.merge(groups as any)
      .attr('transform', (d: any) => d.transform)
      .each(function(d) {
        if(d) {
          const g = d3.select(this);

          const bands = Object.entries(d.dByColor as any);

          const paths = g.selectAll('path')
            .data(bands);

          paths.enter().append('path')
              .merge(paths as any)
              .attr('d', ([, dStr]) => dStr as any)
              .attr('fill', ([color]) => color)
              .attr('stroke-width', 0);

          paths.exit().remove();
        }
      });
  }
  else {
    const paths = svgGroup.selectAll('path').data(instructions, (d: any) => d.id);
    const enter = paths.enter().append('path').attr('fill', 'none');
    
    enter.merge(paths as any)
      .attr('d', (d: any) => d.d)
      .style('fill', (d: any) => d.fill)
      .style('fill-opacity', (d: any) => d["fill-opacity"] as any)
      .style('stroke', (d: any) => d.stroke)
      .style('stroke-width', (d: any) => d['stroke-width'])
      .style('stroke-opacity', (d: any) => d['stroke-opacity'])
      .style('stroke-dasharray', (d: any) => d['stroke-dasharray']);
  }
        
}