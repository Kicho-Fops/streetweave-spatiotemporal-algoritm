import { AggregatedEdges, ParsedSpec, PhysicalEdge } from "streetweave";
import * as d3 from 'd3';
import vegaEmbed from 'vega-embed';

export async function drawVegaLiteCharts(processedEdges: AggregatedEdges, layerSpec: ParsedSpec, map: L.Map) {
  const templateSpec = layerSpec.unit.chart;
  const svgChartWidth = 150;
  const svgChartHeight = 150;
  const pane = map.getPanes().overlayPane;

  d3.selectAll('.vega-lite-svg').remove();
  processedEdges.edges.forEach(async (edge: PhysicalEdge) => {
  const aggregatedAttrs = edge.attributes;

  const chartSpec = JSON.parse(JSON.stringify(templateSpec));
  chartSpec.data = {
      values: Object.entries(aggregatedAttrs || {}).map(([key, value]) => ({ category: key, value: value }))
  };

  const result = await vegaEmbed('#vis', chartSpec, { renderer: 'svg', actions: false })

  const vegaSVG = (result.view as any)._el.querySelector('svg');
  if (!vegaSVG) return;
  console.log(chartSpec.data);

  let [p0, p1] = [
      map.latLngToLayerPoint([edge.point0.lat, edge.point0.lon]),
      map.latLngToLayerPoint([edge.point1.lat, edge.point1.lon])
  ];

  const midpoint = {x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2};
  updateChartPosition(map, midpoint, edge.bearing, svgChartWidth, svgChartHeight, pane, vegaSVG)

  })

  // map.on('move zoom', drawVegaLite);
}

function updateChartPosition(map: L.Map, point: any, bearing: number, svgChartWidth: any, svgChartHeight: any, pane: any, vegaSVG: any) {

  const tempID = 't' + (point.x + point.y + '').replace('.', '').replace('-', '') + 'svg';
  const temp = d3.select(map!.getPanes().overlayPane).select('#' + tempID);

  // const turfStart = turf.point([start.lon, start.lat]); // lon lat
  // const turfEnd = turf.point([end.lon, end.lat]); // lon lat
  // const bearing: number = turf.bearing(turfStart, turfEnd);

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

