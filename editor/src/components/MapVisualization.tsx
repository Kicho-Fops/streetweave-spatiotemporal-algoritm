import React, { useEffect, useRef, useState  } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import * as d3 from 'd3';
import 'leaflet.heat';
import * as turf from '@turf/turf';
// import '@maplibre/maplibre-gl-leaflet';  // Plugin bridging MapLibre & Leaflet

// Import types
import { ParsedSpec } from 'streetweave'

// Import utility functions
import { loadPhysicalData } from '../utils/geoHelpers';
import { createPaneIfNeeded, initializeMap, getOffsetDistance, bindMapEvents } from '../utils/mapHelpers';
import { loadNodeData, loadSegmentData } from '../utils/dataLoader';
import { buildD3Instructions, drawD3Nodes, drawSegments } from '../utils/d3Helpers';
import { drawVegaLiteEdges, drawVegaLiteNodes } from '../utils/vegaliteHelpers';


const MapVisualization: React.FC<{ parsedSpec: ParsedSpec[] }> = ({ parsedSpec }) => {

  const mapRef = useRef<HTMLDivElement | null>(null);
  const mimicLayerRef = useRef<L.GeoJSON | null>(null);
  const currentLayersRef = useRef<L.Layer[]>([]);

  const [map, setMap] = useState<L.Map | null>(null)
  const [zoom] = useState<number>(13)

  const [mimicWidth, setMimicWidth] = useState<number>(0);
  const [addressCoords, setAddressCoords] = useState<{ lat: number; lon: number } | null>(null);

  const alignmentCounters = useRef({
    left: 0,
    right: 0
  })

  useEffect(() => {
    const address = parsedSpec[0]?.query?.address;
    let cancelled = false;

    (async () => {
      if (address) {
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`
          );
          const data = await response.json();
          if (!cancelled && data && data.length > 0) {
            setAddressCoords({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) });
          }
        } catch (error) {
          if (!cancelled) console.error("Error geocoding address:", error);
        }
      } else {
        setAddressCoords(null);
      }
    })();
    
    return () => { cancelled = true; };
  }, [parsedSpec[0]?.query?.address]);

  useEffect(() => {
    let cancelled = false;
    let mapInstance: L.Map | null = null;

    (async () => {
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
    })();

    return () => {
      cancelled = true;
      if (mapInstance) mapInstance.remove();
    };
  }, []);

  useEffect(() => {
    if (!map) return;

    (async () => {

      if (mimicLayerRef.current) {
        map.removeLayer(mimicLayerRef.current);
        mimicLayerRef.current = null;
      }

      if (!map.getPane('mimicStreetPane')) {
        map.createPane('mimicStreetPane');
        map.getPane('mimicStreetPane')!.style.zIndex = '450';
      }

      try {
        const data = await loadPhysicalData(parsedSpec[0].data.physical.path);
        if (data) {
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

          mimicLayerRef.current = L.geoJSON(geojson, {
            pane: 'mimicStreetPane',
            style: {
              color: parsedSpec[0]?.map?.streetColor || '#d3d3d6',
              weight: 0,
              opacity: 0.8
            }
          }).addTo(map);
        }
      } catch (error) {
        console.error('Failed to load mimic street GeoJSON:', error);
      }
    })();

    return () => {
      if (mimicLayerRef.current && map) {
        map.removeLayer(mimicLayerRef.current);
        mimicLayerRef.current = null;
      }
    };
  }, [map, parsedSpec]);

  useEffect(() => {
  if (!map) return;

    alignmentCounters.current.left  = 0;  // FIX
    alignmentCounters.current.right = 0;  // FIX

  if (parsedSpec[0]?.map?.streetWidth !== undefined) {
    setMimicWidth(parsedSpec[0].map.streetWidth);
  }

  d3.selectAll('.vega-lite-svg').remove();
  map.off('move zoom');
  setMimicWidth(0)

  currentLayersRef.current.forEach(layer => {
    if (!(layer.options && layer.options.pane === 'mimicStreetPane')) {
      map.removeLayer(layer);
    }
  });

  currentLayersRef.current = [];

  for (let index = 0; index < parsedSpec.length; index++) {
    const layerSpec = parsedSpec[index];
    
    if (layerSpec.unit.type === 'segment') {
      renderSegmentLayer(map, layerSpec, currentLayersRef, alignmentCounters);

    } else if (layerSpec.unit.type === 'node') {
      renderNodeLayer(map, layerSpec, currentLayersRef);
    }
    // else if (layerSpec.unit.type === 'area') {
    //   renderAreaLayer(map, layerSpec, currentLayersRef);
    // }
  }


  return () => {
    d3.selectAll('.vega-lite-svg').remove();
    map.off('move zoom');

    currentLayersRef.current.forEach(layer => {
      if (map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    });
    currentLayersRef.current = [];
  };
}, [map, parsedSpec]);

  
  useEffect(() => {
    if (!mimicLayerRef.current) return;

    mimicLayerRef.current.eachLayer((layer: any) => {
      const defaultWeight = parsedSpec[0]?.map?.streetWidth;
      let shouldUpdate = true;

      if (addressCoords) {
        const addressPoint = turf.point([addressCoords.lon, addressCoords.lat]);
        const lineFeature = turf.lineString(layer.feature.geometry.coordinates);
        const distance = turf.pointToLineDistance(addressPoint, lineFeature, { units: "meters" as turf.Units });
        if (distance > Number(parsedSpec[0]?.query?.radius)) {
          shouldUpdate = false;
        }
      }

      layer.setStyle({
        color: parsedSpec[0]?.map?.streetColor || '#d3d3d6',
        weight: shouldUpdate ? mimicWidth : defaultWeight,
        opacity: 0.8
      });
    });
  }, [mimicWidth, parsedSpec, addressCoords]);


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
    currentLayersRef: React.MutableRefObject<L.Layer[]>,
    alignmentCountersRef: React.MutableRefObject<{ left: number; right: number }>
  ) => {
    try {
      const paneName =
        layerSpec.unit.alignment === 'center'
          ? 'overlayPane'
          : `${layerSpec.unit.alignment}-${layerSpec.unit.orientation}`;
  
      createPaneIfNeeded(map, paneName);
  
      d3.select(map.getPanes()[paneName]).selectAll('svg').remove();
      const svgLayer = L.svg({ pane: paneName }).addTo(map);
      (svgLayer as any).layerGroup = layerSpec.unit.alignment;

      const svg = d3.select(map.getPanes()[paneName]).select('svg');
      const svgGroup = svg
        .selectAll('g.leaflet-zoom-hide')
        .data([null])
        .join('g')
        .attr('class', 'leaflet-zoom-hide');
  
      if (layerSpec.unit.alignment === 'left') alignmentCountersRef.current.left++;
      console.log("alignmentCountersRef.current.left", alignmentCountersRef.current.left)
      if (layerSpec.unit.alignment === 'right') alignmentCountersRef.current.right++;
      console.log("alignmentCountersRef.current.right", alignmentCountersRef.current.right)
  
      const { processedEdges, thematicData } = await loadSegmentData(layerSpec);

      if (!layerSpec.unit.chart) {
        redraw()
        bindMapEvents(map, redraw);
        currentLayersRef.current.push(svgLayer);  

      } else {
        await drawVegaLiteEdges(processedEdges, layerSpec, map);
      }

      function redraw() {
        const dynamicDistance = getOffsetDistance(map) * (layerSpec.unit.alignment === "left" ? alignmentCountersRef.current.left : alignmentCountersRef.current.right);
        const instructions = buildD3Instructions(
          processedEdges.edges,
          layerSpec.unit,
          processedEdges,
          thematicData,
          dynamicDistance,
          map
        );
        drawSegments(layerSpec.unit.method, svgGroup, instructions);
      }

    } catch (error) {
      console.error(`Error rendering segment layer for ${layerSpec.data.physical.path}:`, error);
    }
  }

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

      const { nodesList, thematicData } = await loadNodeData(layerSpec);

      const svgLayer = L.svg().addTo(map);
      const svgGroup = d3.select(map.getPanes().overlayPane).select("svg")
        .append("g").attr("class", "leaflet-zoom-hide");

      async function redraw() {
        svgGroup.selectAll("*").remove();
        
        if (layerSpec.unit.chart) {
          await drawVegaLiteNodes(nodesList, layerSpec, map)

        } else {
          drawD3Nodes(nodesList, svgGroup, layerSpec.unit, thematicData.attributeStats, map)
        }
      };

      await redraw();
      bindMapEvents(map, redraw);

      // const handler = () => redraw();
      // map.on("zoomend moveend", handler);

      // // Optional: expose cleanup
      // (svgLayer as any).onRemove = function() {
      //   map.off("zoomend moveend", handler);
      // };

      currentLayersRef.current.push(svgLayer);
      return svgLayer;

    
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