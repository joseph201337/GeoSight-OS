/**
 * GeoSight is UNICEF's geospatial web-based business intelligence platform.
 *
 * Contact : geosight-no-reply@unicef.org
 *
 * .. note:: This program is free software; you can redistribute it and/or modify
 *     it under the terms of the GNU Affero General Public License as published by
 *     the Free Software Foundation; either version 3 of the License, or
 *     (at your option) any later version.
 *
 * __author__ = 'irwan@kartoza.com'
 * __date__ = '13/06/2023'
 * __copyright__ = ('Copyright 2023, Unicef')
 */

/* ==========================================================================
   MAP CONTAINER
   ========================================================================== */

import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import maplibregl from "maplibre-gl";
// import Compare from "@maplibre/maplibre-gl-compare";
// import "@maplibre/maplibre-gl-compare/dist/maplibre-gl-compare.css";
import { MapboxOverlay } from "@deck.gl/mapbox/typed";
import ReferenceLayerCentroid from "./ReferenceLayerCentroid";
import ReferenceLayers from "./Layers/ReferenceLayer";
import ContextLayers from "./Layers/ContextLayers";
import { Plugin, PluginChild } from "./Plugin";
import { removeLayer, removeSource } from "./utils";
import {
  ThreeDimensionOffIcon,
  ThreeDimensionOnIcon,
} from "../../../components/Icons";

// Toolbars
import {
  Bookmark,
  CompareLayer,
  DataDownloader,
  EmbedControl,
  GlobalDateSelector,
  HomeButton,
  LabelToggler,
  PopupToolbars,
  SearchGeometryInput,
  TiltControl,
  ToggleSidePanel,
} from "../Toolbars";
import { EmbedConfig } from "../../../utils/embed";
import { Actions } from "../../../store/dashboard";
import DatasetGeometryData from "./Controllers/DatasetGeometryData";
import IndicatorLayersReferenceControl
  from "./IndicatorLayersReferenceControl";
import { Variables } from "../../../utils/Variables";
import { addLayerWithOrder } from "./Render";
import { TransparencyControl } from "./Transparency";
import { isDashboardToolEnabled } from "../../../selectors/dashboard";
import MobileBottomNav from "../../../components/MobileBottomNav";
import { SearchGeometryMobile } from "../Toolbars/SearchGeometryInput";
import { customDrawStyles } from "../../../utils/MaplibreDrawingTools/Styles";
import ReferenceLayerLevelSelection
  from "../Toolbars/ReferenceLayerLevelSelection";
import ZoomToFilteredGeometries
  from "../../../components/ZoomToFilteredGeometries";

import "maplibre-gl/dist/maplibre-gl.css";
import "./style.scss";

// Initialize cog
import { cogProtocol } from "@geomatico/maplibre-cog-protocol";
import MapboxDraw from "@mapbox/mapbox-gl-draw";

maplibregl.addProtocol("cog", cogProtocol);

const BASEMAP_ID = `basemap`;
let previousLayerIds = [];

/**
 * MapLibre component.
 */
export default function MapLibre({ leftPanelProps, rightPanelProps }) {
  const dispatch = useDispatch();
  const [map, setMap] = useState(null);
  const [mapAfter, setMapAfter] = useState(null);
  const [compareControl, setCompareControl] = useState(null);
  const [deckgl, setDeckGl] = useState(null);
  const extent = useSelector((state) => state.dashboard.data.extent);
  const minZoomConfig = useSelector((state) => state.dashboard.data.minZoom);
  const maxZoomConfig = useSelector((state) => state.dashboard.data.maxZoom);
  const { compareMode, compareType } = useSelector((state) => state.mapMode);
  const { basemapLayer, is3dMode, position, force } = useSelector(
    (state) => state.map,
  );
  const transparencyRef = useRef(null);

  const view3DEnable = useSelector(
    isDashboardToolEnabled(Variables.DASHBOARD.TOOL.VIEW_3D),
  );
  const embedToolEnable = useSelector(
    isDashboardToolEnabled(Variables.DASHBOARD.TOOL.EMBED_TOOL),
  );

  const drawingRef = useRef(null);
  const syncFromMapRef = useRef(null);
  const syncFromAfterRef = useRef(null);
  const syncingRef = useRef(false);
  const redrawMeasurement = () => drawingRef.current.redrawMeasurement();
  const isMeasurementToolActive = () =>
    drawingRef.current.isMeasurementToolActive();
  const redrawZonalAnalysis = () => drawingRef.current.redrawZonalAnalysis();
  const isZonalAnalysisActive = () =>
    drawingRef.current.isZonalAnalysisActive();

  /***
   * Make attribution call Attributions component instead
   */
  class AttributionControl extends maplibregl.AttributionControl {
    _updateCompact() {
      if (this._map?.style) {
        const attributions = [];
        for (const [key, layer] of Object.entries(this._map.style._layers)) {
          const source = this._map.style.sourceCaches[layer.source];
          if (this._map.style.sourceCaches[layer.source]) {
            if (source._source.attribution) {
              attributions.push(source._source.attribution);
            }
          }
        }
        dispatch(
          Actions.GlobalState.update({
            attributions: Array.from(new Set(attributions)),
          }),
        );
      }
    }
  }

  /**
   * FIRST INITIATE
   * */
  useEffect(() => {
    if (!map) {
      const newMap = new maplibregl.Map({
        container: "map",
        style: {
          version: 8,
          sources: {},
          layers: [],
          glyphs: staticUrl + "fonts/{fontstack}/{range}.pbf",
        },
        center: [0, 0],
        zoom: minZoomConfig > 1 ? minZoomConfig : 1,
        minZoom: minZoomConfig,
        maxZoom: maxZoomConfig,
        attributionControl: false,
      }).addControl(
        new AttributionControl({
          compact: true,
        }),
      );
      newMap.once("load", () => {
        console.log("Map initialized");
        setMap(newMap);
        setTimeout(
          () =>
            document
              .querySelector(".maplibregl-ctrl-compass")
              .addEventListener("click", () => {
                newMap.easeTo({ pitch: 0, bearing: 0 });
              }),
          500,
        );
      });
      newMap.addControl(
        new MapboxDraw({
          displayControlsDefault: false,
          styles: customDrawStyles,
          controls: {
            polygon: true,
            line_string: true,
            trash: true,
          },
        }),
        "bottom-right",
      );
      newMap.addControl(new maplibregl.NavigationControl(), "bottom-left");
      newMap.on("styledata", () => {
        const currentIds = newMap.getStyle().layers.map((layer) => layer.id);
        if (JSON.stringify(currentIds) === JSON.stringify(previousLayerIds)) {
          return;
        }
        previousLayerIds = currentIds;
        const contextLayers = newMap
          .getStyle()
          .layers.filter((layer) => layer.id.includes("context-layer-"));
        const contextLayersExists = contextLayers.length > 0;
        const popupElements = document.querySelectorAll(
          "#map .maplibregl-popup-anchor-center",
        );
        if (contextLayersExists) {
          popupElements.forEach((popup) => {
            popup.style.zIndex = "-9"; // Lower than your intended layer
          });
        } else {
          popupElements.forEach((popup) => {
            popup.style.zIndex = "0"; // Lower than your intended layer
          });
        }
        transparencyRef.current.update();
      });

      let mapControl = document.querySelector(
        ".maplibregl-ctrl-bottom-left .maplibregl-ctrl-group",
      );
      let parent = document.getElementById("maplibregl-ctrl-bottom-left");
      parent.appendChild(mapControl);

      let tilt = document.getElementsByClassName("TiltControl")[0];
      parent = document.getElementById("tilt-control");
      parent.appendChild(tilt);

      const deckgl = new MapboxOverlay({
        interleaved: true,
        layers: [],
      });
      newMap.addControl(deckgl);
      setDeckGl(deckgl);

      const originalAddLayer = newMap.addLayer.bind(newMap);
      newMap.addLayer = (layer, beforeId) => {
        originalAddLayer(layer, beforeId);
        if (isZonalAnalysisActive()) redrawZonalAnalysis();
        if (isMeasurementToolActive()) redrawMeasurement();
      };

      // Event when resized
      window.addEventListener("resize", (_) => {
        setTimeout(function () {
          newMap.resize();
        }, 1);
      });
    }
  }, []);

  useEffect(() => {
    if (!map) {
      return;
    }

    const isSwipe = compareMode && compareType === "SWIPE";

    const cleanupSwipe = () => {
      if (syncFromMapRef.current) {
        map.off("move", syncFromMapRef.current);
        syncFromMapRef.current = null;
      }
      if (syncFromAfterRef.current && mapAfter) {
        mapAfter.off("move", syncFromAfterRef.current);
        syncFromAfterRef.current = null;
      }
      if (compareControl && compareControl.remove) {
        compareControl.remove();
        setCompareControl(null);
      }
      if (mapAfter) {
        mapAfter.remove();
        setMapAfter(null);
      }
      // Clean up manual swipe elements
      const handle = document.querySelector(".swipe-handle");
      if (handle) handle.remove();
      const mapContainer = document.getElementById("map");
      const afterContainer = document.getElementById("map-after");
      if (mapContainer) mapContainer.style.clipPath = "";
      if (afterContainer) afterContainer.style.clipPath = "";
    };

    if (!isSwipe) {
      cleanupSwipe();
      return;
    }

    if (isSwipe && !mapAfter) {
      const afterContainer = document.getElementById("map-after");
      if (!afterContainer) {
        return;
      }

      const after = new maplibregl.Map({
        container: "map-after",
        style: {
          version: 8,
          sources: {},
          layers: [],
          glyphs: "/static/fonts/{fontstack}/{range}.pbf",
        },
        center: [0, 0],
        zoom: minZoomConfig > 1 ? minZoomConfig : 1,
        minZoom: minZoomConfig,
        maxZoom: maxZoomConfig,
        attributionControl: false,
      });

      syncFromMapRef.current = () => {
        if (syncingRef.current) return;
        syncingRef.current = true;
        if (map && after) {
          // Only sync if not currently being dragged by user
          setTimeout(() => {
            after.jumpTo({
              center: map.getCenter(),
              zoom: map.getZoom(),
              pitch: map.getPitch(),
              bearing: map.getBearing(),
              animate: false,
            });
            syncingRef.current = false;
          }, 10);
        } else {
          syncingRef.current = false;
        }
      };

      syncFromAfterRef.current = () => {
        if (syncingRef.current) return;
        syncingRef.current = true;
        if (map && after) {
          // Only sync if not currently being dragged by user
          setTimeout(() => {
            map.jumpTo({
              center: after.getCenter(),
              zoom: after.getZoom(),
              pitch: after.getPitch(),
              bearing: after.getBearing(),
              animate: false,
            });
            syncingRef.current = false;
          }, 10);
        } else {
          syncingRef.current = false;
        }
      };

      after.once("load", () => {
        console.log("Setting up Swipe mode manually");
        after.addControl(new maplibregl.NavigationControl(), "bottom-left");

        // Instead of using the Compare plugin, implement manual swipe
        const setupSwipeComparison = () => {
          const mapContainer = document.getElementById("map");
          const afterContainer = document.getElementById("map-after");

          if (!mapContainer || !afterContainer) return;

          // Create swipe handle
          const handle = document.createElement("div");
          handle.className = "swipe-handle";
          handle.style.cssText = `
            position: absolute;
            top: 0;
            left: 50%;
            width: 4px;
            height: 100%;
            background: white;
            border-left: 2px solid black;
            border-right: 2px solid black;
            cursor: ew-resize;
            z-index: 1000;
            transform: translateX(-50%);
          `;

          // Position containers
          mapContainer.style.position = "absolute";
          mapContainer.style.top = "0";
          mapContainer.style.left = "0";
          mapContainer.style.width = "100%";
          mapContainer.style.height = "100%";
          mapContainer.style.clipPath = "inset(0 50% 0 0)";

          afterContainer.style.position = "absolute";
          afterContainer.style.top = "0";
          afterContainer.style.left = "0";
          afterContainer.style.width = "100%";
          afterContainer.style.height = "100%";
          afterContainer.style.clipPath = "inset(0 0 0 50%)";

          // Add handle to map container
          mapContainer.appendChild(handle);

          // Make handle draggable
          let isDragging = false;
          let startX = 0;
          let currentX = 50; // percentage

          handle.addEventListener("mousedown", (e) => {
            isDragging = true;
            startX = e.clientX;
            document.body.style.cursor = "ew-resize";
            e.preventDefault();
          });

          document.addEventListener("mousemove", (e) => {
            if (!isDragging) return;

            const rect = mapContainer.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            currentX = Math.max(0, Math.min(100, x));

            handle.style.left = `${currentX}%`;
            mapContainer.style.clipPath = `inset(0 ${100 - currentX}% 0 0)`;
            afterContainer.style.clipPath = `inset(0 0 0 ${currentX}%)`;
          });

          document.addEventListener("mouseup", () => {
            if (isDragging) {
              isDragging = false;
              document.body.style.cursor = "";
            }
          });
        };

        setupSwipeComparison();
        setMapAfter(after);
        setCompareControl({
          remove: () => {
            const handle = document.querySelector(".swipe-handle");
            if (handle) handle.remove();
            const mapContainer = document.getElementById("map");
            const afterContainer = document.getElementById("map-after");
            if (mapContainer) mapContainer.style.clipPath = "";
            if (afterContainer) afterContainer.style.clipPath = "";
          }
        });

        // Re-enable sync
        map.on("move", syncFromMapRef.current);
        after.on("move", syncFromAfterRef.current);
      });





      return () => {
        cleanupSwipe();
      };
    }

    return () => {
      cleanupSwipe();
    };
  }, [map, compareMode, compareType, mapAfter, compareControl, minZoomConfig, maxZoomConfig]);

  /**
   * EXTENT CHANGED
   * */
  useEffect(() => {
    if (map && extent && !(position && Object.keys(position).length)) {
      setTimeout(function () {
        map.fitBounds(
          [
            [extent[0], extent[1]],
            [extent[2], extent[3]],
          ],
          {
            pitch: 0,
            bearing: 0,
          },
        );
      }, 100);
    }
  }, [map, extent]);

  /**
   * EXTENT CHANGED
   * */
  useEffect(() => {
    if (map && position && Object.keys(position).length) {
      setTimeout(function () {
        map.easeTo({
          pitch: position.pitch,
          bearing: position.bearing,
          zoom: position.zoom,
          center: position.center,
        });
      }, 100);
    }
  }, [map, position]);

  /***
   * Render layer to maplibre
   * @param {String} id of layer
   * @param {Object} source Layer config options.
   * @param {Object} layer Layer config options.
   */
  const renderLayer = (id, source, layer, targetMap = map) => {
    if (!targetMap) return;
    removeLayer(targetMap, id);
    removeSource(targetMap, id);
    targetMap.addSource(id, source);
    addLayerWithOrder(
      targetMap,
      {
        ...layer,
        id: id,
        source: id,
      },
      Variables.LAYER_CATEGORY.BASEMAP,
    );
  };

  /** BASEMAP CHANGED */
  useEffect(() => {
    if (map && basemapLayer) {
      renderLayer(BASEMAP_ID, basemapLayer, { type: "raster" }, map);
    }
    if (mapAfter && basemapLayer) {
      renderLayer(BASEMAP_ID, basemapLayer, { type: "raster" }, mapAfter);
    }
  }, [map, mapAfter, basemapLayer]);

  return (
    <section
      className={"DashboardMap" + (!EmbedConfig().map ? " HideMap" : "")}
    >
      {/* TOOLBARS */}
      <div className="Toolbar">
        <ZoomToFilteredGeometries map={map} />
        <TiltControl map={map} is3DView={is3dMode} force={force} />
        <div className="Toolbar-Left">
          {leftPanelProps ? (
            <ToggleSidePanel
              className={leftPanelProps.className}
              initState={leftPanelProps.initState}
              active={leftPanelProps.active}
              onLeft={() => {
                leftPanelProps.onLeft();
              }}
              onRight={() => {
                leftPanelProps.onRight();
              }}
            />
          ) : null}
          <ReferenceLayerLevelSelection />
          <GlobalDateSelector />
        </div>

        <div className="Toolbar-Middle">
          <div className="Separator" />
          <HomeButton map={map} />
          <LabelToggler />
          <CompareLayer disabled={is3dMode} />
          {/* 3D View */}
          <Plugin hidden={!view3DEnable}>
            <div
              className="ExtrudedIcon Active"
              data-tool={Variables.DASHBOARD.TOOL.VIEW_3D}
            >
              <PluginChild
                title={"3D layer"}
                disabled={!map}
                active={is3dMode}
                onClick={() => {
                  if (is3dMode) {
                    map.easeTo({ pitch: 0 });
                  }
                  dispatch(Actions.Map.change3DMode(!is3dMode));
                }}
              >
                {is3dMode ? (
                  <ThreeDimensionOnIcon />
                ) : (
                  <ThreeDimensionOffIcon />
                )}
              </PluginChild>
            </div>
          </Plugin>
          <PopupToolbars map={map} ref={drawingRef} />
          <div className="Separator" />
        </div>

        {/* Embed */}
        <div className="Toolbar-Right">
          <SearchGeometryInput map={map} />
          <Plugin className="EmbedControl" hidden={!embedToolEnable}>
            <div
              className="Active"
              data-tool={Variables.DASHBOARD.TOOL.EMBED_TOOL}
            >
              <PluginChild title={"Get embed code"}>
                <EmbedControl map={map} />
              </PluginChild>
            </div>
          </Plugin>
          <DataDownloader />
          <Plugin className="BookmarkControl">
            <Bookmark map={map} />
          </Plugin>
          {rightPanelProps ? (
            <ToggleSidePanel
              className={rightPanelProps.className}
              initState={rightPanelProps.initState}
              active={rightPanelProps.active}
              onLeft={() => {
                rightPanelProps.onLeft();
              }}
              onRight={() => {
                rightPanelProps.onRight();
              }}
            />
          ) : null}
        </div>
      </div>

      <SearchGeometryMobile />

      <div id="map"></div>
      {compareMode && compareType === "SWIPE" ? (
        <div id="map-after"></div>
      ) : null}

      <ReferenceLayers map={map} mapAfter={mapAfter} deckgl={deckgl} is3DView={is3dMode} />
      <ContextLayers map={map} mapAfter={mapAfter} />
      {map ? (
        <>
          <IndicatorLayersReferenceControl />
          <DatasetGeometryData />
          <ReferenceLayerCentroid map={map} />
          <TransparencyControl map={map} ref={transparencyRef} />
        </>
      ) : null}

      {/* Navbar footer */}
      <MobileBottomNav />
    </section>
  );
}
