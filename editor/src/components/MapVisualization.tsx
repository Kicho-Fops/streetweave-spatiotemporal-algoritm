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
  // console.log("checking parsedSpec", parsedSpec)

  const [map, setMap] = useState<L.Map | null>(null)
  const [zoom, setZoom] = useState<number>(
      parsedSpec[0]?.zoom?.[0] ?? 17
    );

  const [mimicWidth, setMimicWidth] = useState<number>(0);
  const [addressCoords, setAddressCoords] = useState<{ lat: number; lon: number } | null>(null);

  const alignmentCounters = useRef({
    left: 0,
    right: 0
  })

  //address change

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


  //initialize the leaflet

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

  //clear and redraw all spec

//1st one-->

  // useEffect(() => {
  //   if (!map) return;

  //   // ─── 1) TEAR DOWN OLD LAYERS (on “Apply”) ────────────────────────────────
  //   map.off('zoomend');

  //   currentLayersRef.current.forEach(layer => {
  //     // remove the Leaflet layer itself
  //     if (map.hasLayer(layer)) {
  //       map.removeLayer(layer);
  //     }
  //     // remove its injected <svg> from the DOM
  //     const container = (layer as any)._container as SVGSVGElement | undefined;
  //     if (container && container.parentNode) {
  //       container.parentNode.removeChild(container);
  //     }
  //   });
  //   currentLayersRef.current = [];

  //   // reset your alignment counters
  //   alignmentCounters.current.left  = 0;
  //   alignmentCounters.current.right = 0;

  //   // ─── 2) BUILD & ADD NEW LAYERS ───────────────────────────────────────────
  //   // every renderX returns Promise<L.Layer> and DOES `.addTo(map)`
  //   const layerPromises: Promise<L.Layer>[] = parsedSpec.map(spec =>
  //     spec.unit.type === 'segment'
  //       ? renderSegmentLayer(map, spec, alignmentCounters)
  //       : renderNodeLayer(map, spec, alignmentCounters)
  //   );

  //   Promise.all(layerPromises).then(layers => {
  //     currentLayersRef.current = layers;

  //     // ─── 3) CSS SHOW/HIDE ON ZOOM ─────────────────────────────────────────
  //     const updateVisibility = () => {
  //       const z = Math.floor(map.getZoom());
  //       layers.forEach((layer, i) => {
  //         const [minZ, maxZ] = parsedSpec[i].zoom;   // your [min,max]
  //         const container = (layer as any)._container as HTMLElement;
  //         if (!container) return;
  //         container.style.display = z >= minZ && z <= maxZ ? '' : 'none';
  //       });
  //     };

  //     updateVisibility();
  //     map.on('zoomend', updateVisibility);
  //   });

  //   // ─── 4) FINAL CLEANUP (unmount or next Apply) ─────────────────────────────
  //   return () => {
  //     map.off('zoomend');
  //     currentLayersRef.current.forEach(layer => {
  //       if (map.hasLayer(layer)) map.removeLayer(layer);
  //       const container = (layer as any)._container as SVGSVGElement | undefined;
  //       if (container && container.parentNode) container.parentNode.removeChild(container);
  //     });
  //     currentLayersRef.current = [];
  //   };
  // }, [map, parsedSpec]);


//2nd one-->
//   useEffect(() => {
//   if (!map) return;

//   const renderByZoom = () => {
//     const z = map.getZoom();

//     // clear out old layers, counters, SVGs…
//     alignmentCounters.current.left  = 0;
//     alignmentCounters.current.right = 0;
//     d3.selectAll('.vega-lite-svg').remove();
//     currentLayersRef.current.forEach(l => map.removeLayer(l));
//     currentLayersRef.current = [];

//     parsedSpec.forEach((spec, idx) => {
//       // grab whatever form your zoom is in:
//       const rawZoom = spec.map?.zoom ?? spec.zoom;
//       let minZ: number, maxZ: number;

//       if (Array.isArray(rawZoom) && rawZoom.length === 2) {
//         [minZ, maxZ] = rawZoom;
//       } else if (rawZoom && typeof rawZoom.min === 'number' && typeof rawZoom.max === 'number') {
//         minZ = rawZoom.min;
//         maxZ = rawZoom.max;
//       } else {
//         // no zoom range declared → either always render or always skip:
//         // here we’ll skip
//         return;
//       }

//       const inRange = z >= minZ && z <= maxZ;
//       console.log(` spec[${idx}] range=[${minZ},${maxZ}] →`, inRange ? '🟢' : '🔴');

//       if (!inRange) return;
//       if (spec.unit.type === 'segment') {
//         renderSegmentLayer(map, spec, currentLayersRef, alignmentCounters);
//       } else if (spec.unit.type === 'node') {
//         renderNodeLayer(map, spec, currentLayersRef);
//       }
//     });
//   };

//   map.on('zoomend', renderByZoom);
//   renderByZoom();

//   return () => {
//     map.off('zoomend', renderByZoom);
//     currentLayersRef.current.forEach(l => map.hasLayer(l) && map.removeLayer(l));
//     currentLayersRef.current = [];
//   };
// }, [map, parsedSpec]);



  useEffect(() => {
  if (!map) return;

    alignmentCounters.current.left  = 0;  // FIX
    alignmentCounters.current.right = 0;  // FIX

  if (parsedSpec[0]?.map?.streetWidth !== undefined) {
    setMimicWidth(parsedSpec[0].map.streetWidth);
  }

  d3.selectAll('.vega-lite-svg').remove();
  map.off('move zoom');
  // map.off('move zoom zoomend moveend');
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
          layerSpec.relation.type,
          map
        );
        drawSegments(layerSpec.unit.method, svgGroup, instructions);
      }

    } catch (error) {
      console.error(`Error rendering segment layer for ${layerSpec.data.physical.path}:`, error);
    }
  }

  // const renderSegmentLayer = async (
  //   map: L.Map,
  //   layerSpec: ParsedSpec,
  //   currentLayersRef: React.MutableRefObject<L.Layer[]>,
  //   alignmentCountersRef: React.MutableRefObject<{ left: number; right: number }>
  // ): Promise<L.Layer> => {
  //   const paneName =
  //     layerSpec.unit.alignment === 'center'
  //       ? 'overlayPane'
  //       : `${layerSpec.unit.alignment}-${layerSpec.unit.orientation}`;
  //   createPaneIfNeeded(map, paneName);

  //   // clear old SVG and add a fresh one
  //   d3.select(map.getPanes()[paneName]).selectAll('svg').remove();
  //   const svgLayer = L.svg({ pane: paneName }).addTo(map);
  //   ;(svgLayer as any).layerGroup = layerSpec.unit.alignment;

  //   const container = (svgLayer as any)._container as SVGSVGElement;
  //   const svg = d3.select(container);

  //   // single <g> we’ll draw into—always clear it first
  //   const group = svg
  //     .selectAll('g.leaflet-zoom-hide')
  //     .data([null])
  //     .join('g')
  //     .attr('class', 'leaflet-zoom-hide');
  //   group.selectAll('*').remove();

  //   // bump offsets
  //   if (layerSpec.unit.alignment === 'left') {
  //     alignmentCountersRef.current.left++;
  //   } else {
  //     alignmentCountersRef.current.right++;
  //   }

  //   // load data
  //   const { processedEdges, thematicData } = await loadSegmentData(layerSpec);

  //   if (!layerSpec.unit.chart) {
  //     // D3 path mode
  //     const redraw = () => {
  //       const count = layerSpec.unit.alignment === 'left'
  //         ? alignmentCountersRef.current.left
  //         : alignmentCountersRef.current.right;
  //       const instructions = buildD3Instructions(
  //         processedEdges.edges,
  //         layerSpec.unit,
  //         processedEdges,
  //         thematicData,
  //         getOffsetDistance(map) * count,
  //         map
  //       );
  //       drawSegments(layerSpec.unit.method, group, instructions);
  //     };
  //     redraw();
  //     bindMapEvents(map, redraw);

  //   } else {
  //     // Vega‐Lite mode: clear <g> then call your helper
  //     // (we assume drawVegaLiteEdges now draws into that same <g>)
  //     await drawVegaLiteEdges(processedEdges, layerSpec, map);
  //   }

  //   // remember this layer for zoom/apply cleanup
  //   currentLayersRef.current.push(svgLayer);
  //   return svgLayer;
  // };


  
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
      map.on("moveend", redraw);
      map.on("zoomend", redraw);

      (svgLayer as any).onRemove = () => {
        map.off("moveend", redraw);
        map.off("zoomend", redraw);
      };

      // bindMapEvents(map, redraw);

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