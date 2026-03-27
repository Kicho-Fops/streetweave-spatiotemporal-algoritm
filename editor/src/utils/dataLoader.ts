
import { loadAPIData, loadPhysicalData, loadThematicData } from "./geoHelpers";
import { applySpatialAggregation, processEdgesToNodes } from "./aggregation";
import { PhysicalEdge, ParsedSpec, ThematicPoint, AggregatedEdges } from "streetweave";
import { getDynamicStyleValue } from "./styleHelpers";


export async function loadSegmentData(layerSpec: ParsedSpec) {

  let physicalData, thematicData;
  let processedEdges: AggregatedEdges;

  console.log("loading data with spec:", layerSpec);

  if(layerSpec.data.api?.path) {
    physicalData = await loadAPIData(layerSpec.data.api.path);
    const attributeStats: Record<string, { min: number; max: number }> = {};
    
    physicalData.forEach((edge: PhysicalEdge) => {
      if (edge.attributes) {
        Object.entries(edge.attributes).forEach(([key, value]) => {
          if (typeof value === 'number') {
            if (!attributeStats[key]) {
              attributeStats[key] = { min: value, max: value };
            }
            attributeStats[key].min = Math.min(attributeStats[key].min, value);
            attributeStats[key].max = Math.max(attributeStats[key].max, value);
          }
        });
      }
    });

    processedEdges = {
      edges: physicalData,
      attributeStats
    };
  }
  
  else {
    physicalData = await loadPhysicalData(layerSpec.data.physical.path);
    thematicData = await loadThematicData(
      layerSpec.data.thematic.path,
      layerSpec.data.thematic.latColumn,
      layerSpec.data.thematic.lonColumn
    );
    processedEdges = await applySpatialAggregation(physicalData, thematicData.data, layerSpec);
    
  }

  

  // let thematicData: { data: ThematicPoint[]; attributeStats: Record<string, any> } = { data: [], attributeStats: {} };

  // Check if we have a thematic layer define
  const hasThematic = layerSpec.data.thematic && layerSpec.data.thematic.path;

  // Handle density subdivision if defined in the unit
  if (layerSpec.unit.density != undefined) {
    const subdividedEdgesData = subdivideEdges(
      processedEdges, 
      processedEdges.attributeStats, 
      layerSpec.unit.density, 
      layerSpec.unit.method, 
      layerSpec.unit.orientation, 
      layerSpec.unit.chart
    );

    if (hasThematic) {
       // If thematic exists, we need to re-aggregate the smaller subdivided segments
       processedEdges = await applySpatialAggregation(
         subdividedEdgesData.edges, 
         thematicData.data, 
         layerSpec
       );
    } else {
      // If no thematic exists, the subdivision is enough, just pass it through
      processedEdges = subdividedEdgesData;
    }
  }

  return { processedEdges, thematicData };
}

export async function loadNodeData(layerSpec: ParsedSpec) {


  let physicalData, thematicData;

  if (layerSpec.data.physical.path.startsWith('http')) {
    physicalData = await loadPhysicalData(layerSpec.data.physical.path);
  } else {
    physicalData = await loadPhysicalData(layerSpec.data.physical.path);
    thematicData = await loadThematicData(
    layerSpec.data.thematic.path,
    layerSpec.data.thematic.latColumn,
    layerSpec.data.thematic.lonColumn
  );
  }

  
  
  

  const aggregatedEdges: AggregatedEdges = await applySpatialAggregation(physicalData, thematicData.data, layerSpec);
  const nodesList = processEdgesToNodes(aggregatedEdges.edges);

  return { nodesList, thematicData };
}

function subdivideEdges(aggregation: AggregatedEdges, attributeStats: Record<string, any>, layerSpecDensity: string | number | undefined, layerSpecMethod: string | number | undefined, layerSpecOrientation: string | number | undefined, layerChart: string ) {
  const subdivided: PhysicalEdge[] = [];
  // console.log("checking the edges:", aggregation)

  aggregation.edges.forEach((edge: PhysicalEdge) => {
    let density = getDynamicStyleValue(layerSpecDensity, edge.attributes, attributeStats, [0, 100]) as number;

    if(density > 0) {
      let length = 200 / density;
      let numSplits = edge.length / length;

      const start = edge.point0;
      const end = edge.point1;
      const bearing = edge.bearing;
      const attributes = edge.attributes;
      const lat0 = start.lat, lon0 = start.lon;
      const lat1 = end.lat, lon1 = end.lon;
      const dLat = lat1 - lat0, dLon = lon1 - lon0;

      // shrink window
      const shrinkStart = 0.2;        // 20%
      const shrinkSpan  = 0.8 - 0.2;  // 60%

      let startIndex = 0;
      let endIndex = numSplits;
      let point0: any;
      let point1: any;

      for (let i = startIndex; i < endIndex; i++) {
        if((layerSpecMethod === 'line' && layerSpecOrientation === 'perpendicular') || layerSpecMethod === 'rect'){
          const t0 = shrinkStart + (i / numSplits) * shrinkSpan;
          const t1 = shrinkStart + ((i+1)/ numSplits) * shrinkSpan;
          point0 = {
            lat: lat0 + dLat * t0,
            lon: lon0 + dLon * t0
          } as ThematicPoint;
          point1 = {
            lat: lat0 + dLat * t1,
            lon: lon0 + dLon * t1
          }
        }else{
          point0 = { lat: lat0 + dLat * (i / numSplits), lon: lon0 + dLon * (i / numSplits) } as ThematicPoint;
          point1 = { lat: lat0 + dLat * ((i + 1) / numSplits), lon: lon0 + dLon * ((i + 1) / numSplits) } as ThematicPoint;
        }

        subdivided.push({point0, point1, bearing, length, attributes} as PhysicalEdge);
      }
    }
    else{
      //subdivided.push(edge);
      if((layerSpecMethod === 'line' && layerSpecOrientation === 'parallel') || layerChart){
        subdivided.push(edge);
      }
    }
  });

  return {edges: subdivided, attributeStats: aggregation.attributeStats};
}
