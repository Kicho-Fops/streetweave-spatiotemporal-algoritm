import { AggregatedEdges, ParsedSpec, PhysicalEdge } from "streetweave";
import * as d3 from 'd3';
import vegaEmbed from 'vega-embed';
import L from "leaflet";


// --------- Edges: Draw VegaLite Charts ---------
export async function drawVegaLiteEdges(processedEdges: AggregatedEdges, layerSpec: ParsedSpec, map: L.Map) {
  const templateSpec = layerSpec.unit.chart;
  const svgChartWidth = 150;
  const svgChartHeight = 150;
  const pane = map.getPanes().overlayPane;

  d3.selectAll('.vega-lite-svg').remove();

  processedEdges.edges.forEach(async (edge: PhysicalEdge) => {
    const aggregatedAttrs = edge.attributes;
    const dataValues = Object.entries(aggregatedAttrs || {}).map(([key, value]) => ({ category: key, value }));

    let [p0, p1] = [
      map.latLngToLayerPoint([edge.point0.lat, edge.point0.lon]),
      map.latLngToLayerPoint([edge.point1.lat, edge.point1.lon])
    ];
    const midpoint = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    const angle = edge.bearing + 90;
    const tempID = 't' + (midpoint.x + midpoint.y + '').replace('.', '').replace('-', '') + 'svg';
    const transform = `translate(${midpoint.x - svgChartWidth / 3},${midpoint.y - svgChartHeight / 3})`
      + ` rotate(${angle},${svgChartWidth / 2.5},${svgChartHeight / 2.5})`;

    await createAndPlaceVegaLiteSVG({
      pane,
      chartSpec: templateSpec,
      dataValues,
      id: tempID,
      transform
    });

    map.on('move zoom', async () => {
      [p0, p1] = [
        map.latLngToLayerPoint([edge.point0.lat, edge.point0.lon]),
        map.latLngToLayerPoint([edge.point1.lat, edge.point1.lon])
      ];
      const midpoint = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
      const transform = `translate(${midpoint.x - svgChartWidth / 3},${midpoint.y - svgChartHeight / 3})`
        + ` rotate(${angle},${svgChartWidth / 2.5},${svgChartHeight / 2.5})`;

      await createAndPlaceVegaLiteSVG({
        pane,
        chartSpec: templateSpec,
        dataValues,
        id: tempID,
        transform
      });
    });
  });
}

// --------- Nodes: Draw VegaLite Charts ---------
export async function drawVegaLiteNodes(nodesList: Record<string, any>[], layerSpec: ParsedSpec, map: L.Map) {
  const templateSpec = layerSpec.unit.chart;
  const svgChartWidth = 150;
  const svgChartHeight = 150;
  const pane = map.getPanes().overlayPane;

  nodesList.forEach(async (node) => {
    const dataValues = Object.entries(node.attributes)
      .filter(([key]) => key !== 'lat' && key !== 'lon')
      .map(([category, value]) => ({ category, value }));

    const pt = map.latLngToLayerPoint([node.lat, node.lon]);
    const tempID = 't' + (node.lat + node.lon + '').replace('.', '').replace('-', '') + 'svg';
    const transform = `translate(${pt.x - svgChartWidth / 2},${pt.y - svgChartHeight / 2})`;

    await createAndPlaceVegaLiteSVG({
      pane,
      chartSpec: templateSpec,
      dataValues,
      id: tempID,
      transform
    });

    map.on('move zoom', async () => {
      const pt = map.latLngToLayerPoint([node.lat, node.lon]);
      const transform = `translate(${pt.x - svgChartWidth / 2},${pt.y - svgChartHeight / 2})`;
      await createAndPlaceVegaLiteSVG({
        pane,
        chartSpec: templateSpec,
        dataValues,
        id: tempID,
        transform
      });
    });
  });
}


async function createAndPlaceVegaLiteSVG({
  pane,
  chartSpec,
  dataValues,
  id,
  transform,
  vegaEmbedSelector = '#vis'
}: {
  pane: HTMLElement,
  chartSpec: any,
  dataValues: { category: string, value: any }[],
  id: string,
  transform: string,
  vegaEmbedSelector?: string,
}) {
  const spec = JSON.parse(JSON.stringify(chartSpec));
  spec.data = { values: dataValues };

  const result = await vegaEmbed(vegaEmbedSelector, spec, { renderer: 'svg', actions: false });
  const vegaSVG = (result.view as any)._el.querySelector('svg');
  if (!vegaSVG) return;

  const existing = d3.select(pane).select(`#${id}`);
  if (existing.empty()) {
    d3.select(pane)
      .append('svg')
      .attr('class', 'vega-lite-svg')
      .attr('id', id)
      .attr('width', vegaSVG.getAttribute('width') || 150)
      .attr('height', vegaSVG.getAttribute('height') || 150)
      .attr('transform', transform)
      .node()
      ?.appendChild(vegaSVG.cloneNode(true));
  } else {
    existing.attr('transform', transform);
  }
}
