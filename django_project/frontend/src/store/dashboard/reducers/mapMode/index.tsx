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

/** MAP_MODE reducer */

export const MAP_MODE_ACTION_NAME = "MAP_MODE";
export const MAP_MODE_ACTION_TYPE_COMPARE = "MAP_MODE/COMPARE";
export const MAP_MODE_ACTION_TYPE_COMPOSITE = "MAP_MODE/COMPOSITE";
export const MAP_MODE_ACTION_TYPE_COMPARE_TYPE = "MAP_MODE/COMPARE_TYPE";

interface mapModeProps {
  compareMode: boolean;
  compositeMode: boolean;
  compareType: "OUTLINE" | "SWIPE";
}

const initialState: mapModeProps = {
  compareMode: false,
  compositeMode: false,
  compareType: "OUTLINE",
};
export default function mapCompareModeReducer(
  state = initialState,
  action: any,
) {
  if (action.name === MAP_MODE_ACTION_NAME) {
    switch (action.type) {
      case MAP_MODE_ACTION_TYPE_COMPARE: {
        let { value } = action;
        if (value === undefined) value = !state.compareMode;
        if (value === true) {
          return {
            ...state,
            compareMode: value,
            compositeMode: false,
          };
        }
        return {
          ...state,
          compareMode: value,
          compareType: "OUTLINE",
        };
      }
      case MAP_MODE_ACTION_TYPE_COMPARE_TYPE: {
        const { value } = action;
        if (value !== "SWIPE" && value !== "OUTLINE") {
          return state;
        }
        return {
          ...state,
          compareType: value,
          compareMode: true,
        };
      }
      case MAP_MODE_ACTION_TYPE_COMPOSITE: {
        let { value } = action;
        if (value === undefined) value = !state.compositeMode;
        if (value === true) {
          return {
            ...state,
            compositeMode: value,
            compareMode: false,
          };
        }
        return {
          ...state,
          compositeMode: value,
        };
      }
    }
  }
  return state;
}
