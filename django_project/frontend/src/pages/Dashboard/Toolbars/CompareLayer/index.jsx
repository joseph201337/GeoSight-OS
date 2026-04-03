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
   CompareLayer
   ========================================================================== */

import React, { memo, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Plugin, PluginChild } from "../../MapLibre/Plugin";
import { Actions } from "../../../../store/dashboard";
import {
  CompareCheckedIcon,
  CompareUncheckedIcon,
} from "../../../../components/Icons";
import { isDashboardToolEnabled } from "../../../../selectors/dashboard";
import { Variables } from "../../../../utils/Variables";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";

import "./style.scss";

/**
 * CompareLayer component.
 */
export function CompareLayer({ disabled = false }) {
  const dispatch = useDispatch();
  const compareMode = useSelector((state) => state.mapMode?.compareMode);
  const compareType = useSelector((state) => state.mapMode?.compareType);
  const enabled = useSelector(
    isDashboardToolEnabled(Variables.DASHBOARD.TOOL.COMPARE_LAYERS),
  );

  /**
   * FIRST INITIATE
   * */
  useEffect(() => {
    if (disabled && compareMode) {
      dispatch(Actions.MapMode.changeCompareMode());
    }
  }, [disabled]);

  if (!enabled) {
    return null;
  }

  return (
    <Plugin>
      <div
        className="CompareLayerComponent Active"
        data-tool={Variables.DASHBOARD.TOOL.COMPARE_LAYERS}
        style={{ display: "flex", alignItems: "center", gap: "8px" }}
      >
        <PluginChild
          title={(compareMode ? "Turn off" : "Turn on") + " compare Layers"}
          disabled={disabled}
          onClick={() => {
            if (!disabled) {
              dispatch(Actions.MapMode.changeCompareMode());
            }
          }}
        >
          {compareMode ? <CompareCheckedIcon /> : <CompareUncheckedIcon />}
        </PluginChild>
        {compareMode ? (
          <FormControl size="small" variant="standard">
            <Select
              value={compareType}
              onChange={(event) => {
                dispatch(Actions.MapMode.setCompareType(event.target.value));
              }}
              style={{ color: "#fff", minWidth: 120 }}
            >
              <MenuItem value="OUTLINE">Outline & Fill</MenuItem>
              <MenuItem value="SWIPE">Swipe</MenuItem>
            </Select>
          </FormControl>
        ) : null}
      </div>
    </Plugin>
  );
}

export default memo(CompareLayer);
