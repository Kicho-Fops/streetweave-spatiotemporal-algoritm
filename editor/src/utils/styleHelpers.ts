// src/utils/styleHelpers.ts

import * as d3 from 'd3';
import L from 'leaflet'; // Import L for L.Point
import { ParsedSpec, PhysicalEdge } from 'streetweave';

/**
 * Applies opacity based on the type (fill, stroke, line) and layer specification.
 * @param type The type of opacity to apply ('fill', 'stroke', 'line').
 * @param layerSpec The parsed specification for the layer.
 * @returns The opacity value.
 */
export const applyOpacity = (type: 'fill' | 'stroke' | 'line', layerSpec: ParsedSpec): number => {
  switch (type) {
    case 'line':
      return typeof layerSpec.unit.opacity === 'number' ? layerSpec.unit.opacity : 1;
    case 'fill':
      return typeof layerSpec.unit.opacity === 'number' ? layerSpec.unit.opacity : 0.7;
    case 'stroke':
      return typeof layerSpec.unit.opacity === 'number' ? layerSpec.unit.opacity : 1;
    default:
      return 1;
  }
};

/**
 * Computes a style value (color, width, opacity, height) for a segment/node based on layer spec and data.
 * Handles both fixed values and attribute-mapped values.
 * @param specValue The value from the layer spec (e.g., `layerSpec.lineColor`, `layerSpec.lineStrokeWidth`).
 * @param dataPoint The current data point (segment or node) with aggregated attributes.
 * @param allDataPoints All processed data points (for min/max domain calculation).
 * @param d3ScaleRange The D3 scale range for attribute mapping (e.g., [0, 10] for width, [0, 1] for opacity).
 * @param interpolateFn A D3 interpolation function for color scales (e.g., d3.interpolateBuGn).
 * @param thresholdColors An array of colors for threshold scales.
 * @param thresholdSteps The number of steps for threshold scales (default: 5).
 * @returns The computed style value.
 */
export const getDynamicStyleValue = (
  name: string | number | undefined,
  attributes: Record<string, number | undefined> | undefined,
  domain: Record<string, { min: number; max: number }> | undefined,
  range: any | undefined
  // d3ScaleRange: [number, number] | null = null,
  // interpolateFn: ((t: number) => string) | null = null,
  // thresholdColors: string[] | null = null,
  // thresholdSteps: number = 5
): string | number | undefined => {
  // console.log(specValue, dataPoint, allDataPoints, d3ScaleRange, interpolateFn, thresholdColors, thresholdSteps);

  const hexRe = /^#([0-9A-F]{3}|[0-9A-F]{6})$/i;
  if (typeof name === 'number') {
    return name;
  }
  if (typeof name === 'string' && hexRe.test(name)) {
    return name;
  }
  else if(typeof name === 'string' && attributes && attributes[name] && domain) {
    let scale;
    if(range)
      scale = d3.scaleLinear().domain([domain[name].min, domain[name].max]).range(range);
    else
      scale = d3.scaleLinear().domain([domain[name].min, domain[name].max]);
    return scale(attributes[name]);
  }
  
      // if (aggregatedAttributes && aggregatedAttributes.hasOwnProperty(specValue)) {
        // const attributeValue = aggregatedAttributes[specValue];
        // if (attributeValue === null || typeof attributeValue === 'undefined') return null;
  
        // Collect all valid numbers for the specified attribute from all data points
        // const allAttributeValues = allDataPoints
        //   .map(dp => (Array.isArray(dp) ? dp.attributes?.[specValue] : dp.attributes))
        //   .filter((v): v is number => typeof v === 'number');
  
        // if (allAttributeValues.length === 0) return null;
  
        // const minValue = d3.min(allAttributeValues);
        // const maxValue = d3.max(allAttributeValues);
  
        // if (minValue === undefined || maxValue === undefined) return null;
  
        // if (d3ScaleRange) {
        //   // Linear scale for width/opacity/height
        //   const scale = d3.scaleLinear().domain([minValue, maxValue]).range(d3ScaleRange);
        //   return scale(attributeValue);
        // } else if (interpolateFn) {
        //   // Sequential color scale
        //   const scale = d3.scaleSequential(interpolateFn).domain([minValue, maxValue]);
        //   return scale(attributeValue);
        // } else if (thresholdColors && thresholdColors.length >= thresholdSteps) {
        //   // Threshold color scale
        //   const step = (maxValue - minValue) / thresholdSteps;
        //   const thresholds = Array.from({ length: thresholdSteps - 1 }, (_, i) => minValue + (i + 1) * step);
        //   const scale = d3.scaleThreshold<number, string>().domain(thresholds).range(thresholdColors);
        //   return scale(attributeValue);
        // }
      // }
  // }
  return undefined; // Default if attribute not found or no mapping specified
};

/**
 * Computes dash array for a dashed line based on an attribute value.
 * @param lineType The line type from layer spec.
 * @param lineTypeVal The attribute name for dash array.
 * @param segment The current segment.
 * @param allSegments All processed segments.
 * @returns The dash array string or null.
 */
export const getDashArray = (
  lineType: string | undefined,
  lineTypeVal: string | undefined,
  segment: PhysicalEdge,
  allSegments: PhysicalEdge[]
): string => {
  if (lineType === "dashed" && lineTypeVal) {
    const aggregatedAttributes = segment.attributes;
    if (aggregatedAttributes && aggregatedAttributes.hasOwnProperty(lineTypeVal)) {
      const attributeValue = aggregatedAttributes[lineTypeVal];
      if (attributeValue === null || typeof attributeValue === 'undefined') return "";

      const allAttributeValues = allSegments
        .map(s => s.attributes?.[lineTypeVal])
        .filter((v): v is number => typeof v === 'number');

      if (allAttributeValues.length === 0) return "";

      const minValue = d3.min(allAttributeValues);
      const maxValue = d3.max(allAttributeValues);

      if (minValue === undefined || maxValue === undefined) return "";

      if (attributeValue < minValue + (maxValue - minValue) / 3) {
        return "2, 5";
      } else if (
        attributeValue >= minValue + (maxValue - minValue) / 3 &&
        attributeValue < minValue + (2 * (maxValue - minValue)) / 3
      ) {
        return "10, 10";
      } else {
        return "15, 10";
      }
    }
  }
  return "";
};

/**
 * Computes squiggle amplitude and frequency based on an attribute value.
 * @param lineType The line type.
 * @param lineTypeVal The attribute name for squiggle.
 * @param segment The current segment.
 * @param allSegments All processed segments.
 * @returns An object with amplitude and frequency.
 */
export const getSquiggleParams = (
  lineType: string | undefined,
  lineTypeVal: string | undefined,
  segment: PhysicalEdge,
  allSegments: PhysicalEdge[]
): { amplitude: number; frequency: number } => {
  let squiggleAmplitude = 25;
  let squiggleFrequency = 10;

  if (lineType === 'squiggle' && lineTypeVal) {
    const aggregatedAttributes = segment.attributes;
    if (aggregatedAttributes && aggregatedAttributes.hasOwnProperty(lineTypeVal)) {
      const attributeValue = aggregatedAttributes[lineTypeVal];
      if (attributeValue === null || typeof attributeValue === 'undefined') return { amplitude: squiggleAmplitude, frequency: squiggleFrequency };

      const allAttributeValues = allSegments
        .map(s => s.attributes?.[lineTypeVal])
        .filter((v): v is number => typeof v === 'number');

      if (allAttributeValues.length === 0) return { amplitude: squiggleAmplitude, frequency: squiggleFrequency };

      const minValue = d3.min(allAttributeValues);
      const maxValue = d3.max(allAttributeValues);

      if (minValue === undefined || maxValue === undefined) return { amplitude: squiggleAmplitude, frequency: squiggleFrequency };

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
  return { amplitude: squiggleAmplitude, frequency: squiggleFrequency };
};

/**
 * Generates a simple wavy SVG path between two points.
 * @param start Start point [x, y].
 * @param end End point [x, y].
 * @param amplitude Amplitude of the wave.
 * @param wavelength Wavelength of the wave.
 * @returns The SVG path string.
 */
export function generateSimpleWavyPath(start: L.Point, end: L.Point, amplitude: number, wavelength: number): string {
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

    const offsetX = amplitude * Math.sin((i + 0.5) * Math.PI);
    const controlX = xMid + offsetX * Math.cos(angle + Math.PI / 2);
    const controlY = yMid + offsetX * Math.sin(angle + Math.PI / 2);

    const xNext = start.x + ((i + 1) / numWaves) * dx;
    const yNext = start.y + ((i + 1) / numWaves) * dy;

    path += `Q ${controlX},${controlY} ${xNext},${yNext} `;
  }
  return path;
}

/**
 * Generates an SVG spike path.
 * @param length Length of the spike.
 * @param width Base width of the spike.
 * @returns The SVG path string.
 */
export function spikePath(length: number, width: number): string {
  return `M${-width / 2},0 L0,${-length} L${width / 2},0 Z`;
}

/**
 * Generates an SVG rectangle path.
 * @param length Length of the rectangle.
 * @param width Width of the rectangle.
 * @returns The SVG path string.
 */
export function rectPath(length: number, width: number): string {
  return `M${-width / 2},0 L${-width / 2},${-length} L${width / 2},${-length} L${width / 2},0 Z`;
}

// Colors for the example based on index for perpendicular rectangles
export const PERPENDICULAR_COLORS = [
  ["#feb24c", "#fd8d3c", "#fc4e2a", "#e31a1c", "#b10026"], // Index 0 (NoSidewalk)
  ["#a6bddb", "#74a9cf", "#3690c0", "#0570b0", "#034e7b"]  // Index 1 (Obstacle)
];