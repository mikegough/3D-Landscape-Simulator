# raster_utils

import rasterio
from rasterio.warp import transform_bounds
from rasterio.crs import CRS
import numpy as np


def clip_from_wgs(input_path, output_path, bounds):
    """
        Clips a raster based on WGS coordinates.
        Heavily borrowed from: https://github.com/mapbox/rasterio/blob/master/rasterio/rio/clip.py
        :param input_path The path to the raster to clip out of
        :param output_path The path to place the clipped raster
        :param bounds (left, bottom, right, top) bounds in WGS 84 projection
    """

    wgs_crs = CRS({'init': 'epsg:4326'})  # WGS 84 Projection

    with rasterio.open(input_path, 'r') as src:

        window = src.window(*transform_bounds(wgs_crs, src.crs, *bounds))
        height = window[0][1] - window[0][0]
        width = window[1][1] - window[1][0]
        t = 2048    # Threshold, for if the user selects an area greater than 2048 pixels in size
                    # If so, select the center of the area at size of 2048 by 2048
        if width > t:
            if width % 2 != 0:
                width -= 1
            trim = int((width - t) / 2)
            width = t
            window = (window[0], (window[1][0] + trim, window[1][0] + t + trim))

        if height > t:
            if height % 2 != 0:
                height -= 1
            trim = int((height - t) / 2)
            height = t
            window = ((window[0][0] + trim, window[0][0] + t + trim), window[1])

        out_kwargs = src.meta.copy()
        out_kwargs.update({
            'height': height,
            'width': width,
            'transform': src.window_transform(window),
            'dtype': 'int32',   # SyncroSim needs a signed int32
            'nodata': 0
            })

        with rasterio.open(output_path, 'w', **out_kwargs) as dst:
            dst.write(src.read(1, window=window).astype('int32'), 1)


def elevation_stats(raster_path):

    stats = dict()

    with rasterio.open(raster_path, 'r') as src:
        elev_data = src.read(1)
        stats['dem_max'] = int(np.max(elev_data))
        stats['dem_min'] = int(np.min(elev_data))
        stats['dem_width'] = int(elev_data.shape[1])
        stats['dem_height'] = int(elev_data.shape[0])

    return stats


def vegetation_stats(raster_path):
    stats = dict()
    with rasterio.open(raster_path, 'r') as src:
        strata_data = src.read(1).astype('int32')
        total = strata_data.size
        unique_codes = list(np.unique(strata_data))
        for code in unique_codes:
            stats[code] = (int((strata_data == code).sum()) / total) * 100   # numpy sum function, convert to percentage
    return stats, total


def zonal_stateclass_stats(veg_path, sc_path):
    veg_stats, total = vegetation_stats(veg_path)
    zonal_stateclass_results = dict()
    with rasterio.open(sc_path, 'r') as sc_src:
        sc_data = sc_src.read(1)
        unique_sc = list(np.unique(sc_data))
        with rasterio.open(veg_path, 'r') as veg_src:

            veg_data = veg_src.read(1)
            for veg_code in veg_stats.keys():
                for sc_code in unique_sc:
                    sc_cover_by_veg = np.where(sc_data[np.where(veg_data == veg_code)] == sc_code)[0].size
                    if str(veg_code) not in zonal_stateclass_results:
                        zonal_stateclass_results[str(veg_code)] = dict()
                    zonal_stateclass_results[str(veg_code)][str(sc_code)] = (sc_cover_by_veg / total) * 100

    return zonal_stateclass_results, total
