import { AggregatedEdges, ParsedSpec, PhysicalEdge } from "streetweave";
import * as d3 from 'd3';
import vegaEmbed from 'vega-embed';
import L from "leaflet";


// --------- Edges: Draw VegaLite Charts ---------
export async function drawVegaLiteEdges(processedEdges: AggregatedEdges, layerSpec: ParsedSpec, map: L.Map) {
  const templateSpec = layerSpec.unit.chart;
  const svgChartWidth = 250;
  const svgChartHeight = 150;
  const pane = map.getPanes().overlayPane;

  // d3.selectAll('.vega-lite-svg').remove();
  let OrientationAngle = 0;
  if(layerSpec.unit.orientation === 'perpendicular'){
      OrientationAngle = 90;
  }
  

  processedEdges.edges.forEach(async (edge: PhysicalEdge) => {
    const aggregatedAttrs = edge.attributes;
    const dataValues = Object.entries(aggregatedAttrs || {}).map(([key, value]) => ({ category: key, value }));
    // console.log("check dataValue", dataValues)

    let Bearing = edge.bearing;
    Bearing = ((Bearing % 360) + 360) % 360;
    if (Bearing < 180) {
      // Swap start & end
      const temp = { lat: edge.point0.lat, lon: edge.point0.lon };
      edge.point0.lat = edge.point1.lat;   
      edge.point0.lon = edge.point1.lon;
      edge.point1.lat = temp.lat;    
      edge.point1.lon = temp.lon;
      Bearing = (Bearing - 180 + 360) % 360;
    }
    edge.bearing = Bearing;

    const angleMod180 = edge.bearing % 180;
    const isHorizontal   = Math.abs(angleMod180 - 90) < 45;

    let xOffset: any;
    let yOffset: any;

    if(layerSpec.unit.orientation === 'parallel'){
      if(isHorizontal){
        xOffset = -100;
        yOffset = 0;
      }else{
        xOffset = -180;
        yOffset = 20;
      }
    }else if(layerSpec.unit.orientation === 'perpendicular'){
      xOffset = -200;
      yOffset = 25;
    }





    let [p0, p1] = [
      map.latLngToLayerPoint([edge.point0.lat, edge.point0.lon]),
      map.latLngToLayerPoint([edge.point1.lat, edge.point1.lon])
    ];
    const midpoint = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    let angle = edge.bearing + 90 + OrientationAngle;
    const tempID = 't' + (midpoint.x + midpoint.y + '').replace('.', '').replace('-', '') + 'svg';


    const transform = `translate(${midpoint.x - (svgChartWidth / 2) + xOffset},${midpoint.y - (svgChartHeight / 2) + yOffset})`
      + ` rotate(${angle},${svgChartWidth / 2},${svgChartHeight / 2})`;

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
      const transform = `translate(${midpoint.x - (svgChartWidth / 2) + xOffset},${midpoint.y - (svgChartHeight / 2) + yOffset})`
        + ` rotate(${angle},${svgChartWidth / 2},${svgChartHeight / 2})`;

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

      // console.log("vega data", dataValues)

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
  // console.log("specData", spec.data)

  //Adding here
  // 1) make a throw-away DIV with a unique ID
  const tmpDiv = document.createElement('div');
  tmpDiv.id = `vg-temp-${id}`;
  tmpDiv.style.position = 'absolute';
  tmpDiv.style.visibility = 'hidden';
  document.body.appendChild(tmpDiv);

  // const result = await vegaEmbed(vegaEmbedSelector, spec, { renderer: 'svg', actions: false });
  const result = await vegaEmbed(`#${tmpDiv.id}`, spec, { renderer: 'svg', actions: false });

  // const dataset = (result.view as any).data('source_0');  
  // console.log(id, dataset);
  const vegaSVG = (result.view as any)._el.querySelector('svg');
  if (!vegaSVG) {
    document.body.removeChild(tmpDiv);
    return
  };

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
