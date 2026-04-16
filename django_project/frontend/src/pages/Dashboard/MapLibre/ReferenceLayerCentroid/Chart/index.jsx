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
 * __date__ = '29/07/2024'
 * __copyright__ = ('Copyright 2023, Unicef')
 */

/* ==========================================================================
   Geometry Center
   ========================================================================== */

import { addPopupEl } from "../../utils";
import $ from "jquery";
import maplibregl from "maplibre-gl";
import Chart from "chart.js/auto";
import { popupTemplate } from "../../Popup";

let chartsMap = new WeakMap();
let markersMap = new WeakMap();
let chartLastConfigMap = new WeakMap();

/** Resetting **/
export const resetCharts = (map) => {
  if (!map) return;
  const mapId = map.getContainer().id;
  const charts = chartsMap.get(map) || {};
  for (const [code, chart] of Object.entries(charts)) {
    chart.clear();
    $(`#${code}-chart-${mapId}`).remove();
  }
  const markers = markersMap.get(map) || [];
  markers.map((marker) => marker.remove());

  chartsMap.set(map, {});
  markersMap.set(map, []);
};

export const renderChart = (
  map,
  features,
  lastConfig,
  config,
  transparency,
) => {
  if (!config.indicatorShow) {
    resetCharts(map);
    return;
  }
  if (JSON.stringify(config) === JSON.stringify(lastConfig)) {
    return;
  } else {
    resetCharts(map);
  }
  // Store current config for validation in async callbacks
  chartLastConfigMap.set(map, config);

  const mapId = map.getContainer().id;
  const charts = chartsMap.get(map) || {};
  const markers = markersMap.get(map) || [];

  /** Render charts to Map */
  features.map((feature) => {
    const properties = feature.properties;
    const chartStyle = properties.chart_style;
    const code = properties.code;
    const size = chartStyle.size;
    const { labels, data, colors, options } = properties.chartData;

    if (charts[code]) {
      charts[code].clear();
      $(`#${code}-chart-${mapId}`).remove();
    }

    const popup = new maplibregl.Popup({
      closeOnClick: false,
      closeButton: false,
      anchor: "center",
    })
      .setLngLat(feature.geometry.coordinates)
      .setHTML(
        `<div id="${code}-wrapper-${mapId}" class="centroid-chart" style="display: block; box-sizing: border-box; height: ${size}px; width: ${size}px; opacity: ${transparency}"><canvas id="${code}-chart-${mapId}" width="${size}" height="${size}" data-size="${size}"></div>`,
      )
      .addTo(map);
    markers.push(popup);
    markersMap.set(map, markers);

    // Create charts
    setTimeout(function () {
      const currentConfig = chartLastConfigMap.get(map);
      // Don't render if config has changed since we started
      if (JSON.stringify(config) !== JSON.stringify(currentConfig)) {
        return;
      }
      const el = document.getElementById(`${code}-chart-${mapId}`);
      if (!el) {
        return;
      }
      const ctx = el.getContext("2d");
      try {
        const chart = new Chart(ctx, {
          type: chartStyle.chartType
            ? chartStyle.chartType.toLowerCase()
            : "pie",
          data: {
            labels: labels,
            datasets: [
              {
                data: data,
                backgroundColor: colors,
                borderWidth: 1,
                barPercentage: 1.0,
                categoryPercentage: 1.0,
              },
            ],
          },
          options: options,
        });
        charts[code] = chart;
        chartsMap.set(map, charts);

        // Popup for marker
        addPopupEl(
          map,
          el,
          feature.geometry.coordinates,
          properties,
          (properties) => {
            const markerProperties = JSON.parse(JSON.stringify(properties));
            const maxValue = properties.maxValue;
            const cleanProperties = {};
            markerProperties.data.map((data) => {
              cleanProperties[data.name] = `
              <div class="PopupMultiDataTable">
                <div class="PopupMultiDataTableGraph" style="background-color: ${data.color}; width: ${(data.value / maxValue) * 100}%"></div>
                <div class="PopupMultiDataTableValue">${data.value}</div>
              </div>`;
            });
            const name = markerProperties["name"];
            cleanProperties["code"] = markerProperties["code"];
            cleanProperties["label"] = markerProperties["label"];
            cleanProperties["type"] = markerProperties["type"];
            return popupTemplate(null, cleanProperties, {
              name: name,
              color: "#eee",
            });
          },
          {
            anchor: "bottom",
            offset: [0, -1 * (size / 2)],
          },
        );
      } catch (err) { }
    }, 200);
  });
};

/**
 * Render PIN
 * **/
export const renderPin = (
  map,
  features,
  indicatorLayer,
  lastConfig,
  config,
  transparency,
) => {
  if (!config.indicatorShow) {
    resetCharts(map);
    return;
  }
  if (JSON.stringify(config) === JSON.stringify(lastConfig)) {
    return;
  } else {
    resetCharts(map);
  }
  // Store current config for validation in async callbacks
  chartLastConfigMap.set(map, config);

  const mapId = map.getContainer().id;
  const charts = chartsMap.get(map) || {};
  const markers = markersMap.get(map) || [];

  features.map((feature) => {
    const properties = feature.properties;
    const chartStyle = properties.chart_style;
    const code = properties.code;
    const size = chartStyle.size ? chartStyle.size : 20;

    if (charts[code]) {
      charts[code].clear();
      $(`#${code}-chart-${mapId}`).remove();
    }
    const children = [];
    indicatorLayer.indicators.map((indicator) => {
      const data = feature.properties.data?.find(
        (row) => row.indicator === indicator.indicator,
      );
      if (data) {
        children.push(
          `<div class="pin" title="${data.indicator} - ${data.value}" style="background-color: ${data.style?.color}; height: ${size}px; width: ${size}px;"></div>`,
        );
      } else {
        children.push(`<div class="pin empty"></div>`);
      }
    });

    const popup = new maplibregl.Popup({
      closeOnClick: false,
      closeButton: false,
      anchor: "center",
    })
      .setLngLat(feature.geometry.coordinates)
      .setHTML(
        `<div id="${code}-pin-${mapId}" class="pins centroid-chart" style="opacity: ${transparency}">${children.join("")}</div>`,
      )
      .addTo(map);
    markers.push(popup);
    markersMap.set(map, markers);
  });
};
