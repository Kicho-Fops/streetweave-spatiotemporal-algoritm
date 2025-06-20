
import { loadPhysicalData, loadThematicData } from "./geoHelpers";
import { applySpatialAggregation, processEdgesToNodes } from "./aggregation";
import { PhysicalEdge, ParsedSpec, ThematicPoint, AggregatedEdges } from "streetweave";
import { getDynamicStyleValue } from "./styleHelpers";


export async function loadSegmentData(layerSpec: ParsedSpec) {
  const physicalData = await loadPhysicalData(layerSpec.data.physical.path);
  const thematicData = await loadThematicData(
    layerSpec.data.thematic.path,
    layerSpec.data.thematic.latColumn,
    layerSpec.data.thematic.lonColumn
  );

  let edges = physicalData;
  let processedEdges: AggregatedEdges = await applySpatialAggregation(edges, thematicData.data, layerSpec);

  if (layerSpec.unit.splits !== 1) {
    processedEdges = await applySpatialAggregation(
      subdivideEdges(processedEdges, thematicData.attributeStats, layerSpec.unit.splits).edges,
      thematicData.data,
      layerSpec
    );
  }

  return { processedEdges, thematicData };
}

export async function loadNodeData(layerSpec: ParsedSpec) {
  const physicalData = await loadPhysicalData(layerSpec.data.physical.path);
  const thematicData = await loadThematicData(
    layerSpec.data.thematic.path,
    layerSpec.data.thematic.latColumn,
    layerSpec.data.thematic.lonColumn
  );

  const aggregatedEdges: AggregatedEdges = await applySpatialAggregation(physicalData, thematicData.data, layerSpec);
  const nodesList = processEdgesToNodes(aggregatedEdges.edges);

  return { nodesList, thematicData };
}

function subdivideEdges(aggregation: AggregatedEdges, attributeStats: Record<string, any>, layerSpecSplits: string | number | undefined ) {
  const subdivided: PhysicalEdge[] = [];

  aggregation.edges.forEach((edge: PhysicalEdge) => {

    let splits = getDynamicStyleValue(layerSpecSplits, edge.attributes, attributeStats, [1, 20]) as number;
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

  return {edges: subdivided, attributeStats: aggregation.attributeStats};
}
