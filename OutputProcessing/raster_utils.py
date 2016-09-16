# raster_utils

import rasterio
from rasterio.warp import transform_bounds
from rasterio.crs import CRS
import csv
import numpy as np
from django.conf import settings


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

# cover types for LANDFIRE
cover_string = ['Early Development ', 'Mid Development ', 'Late Development ']
cover_types = list()

for i in range(1, 4):
    cover_types.append(cover_string[0] + str(i))
    cover_types.append(cover_string[1] + str(i))
    cover_types.append(cover_string[2] + str(i))

cover_map = {cover_type: ''.join(cover_type.split()[0] + cover_type.split()[2]) for cover_type in cover_types}
struct_map = {'All Structures': 'ALL', 'Closed': 'CLS', 'Open': 'OPN'}


def convert_code(cover, struct):
    if 'Not' in cover or len(cover) == 0:
        return ''

    return ':'.join([cover_map[cover], struct_map[struct]])

sc_map = list()
for cover in cover_map:
    for struct in struct_map:
        sc_map.append(convert_code(cover, struct))


# collect the description data from LANDFIRE map
landfire_descriptions_file = settings.LANDFIRE_PATHS['descriptions']
with open(landfire_descriptions_file,'r') as f:
    reader = csv.DictReader(f)
    data = [row for row in reader]

# construct mapping for bps_codes to sc_codes
sc_code_map = dict()
for row in data:
    bps_code = int(row['BpS_Code'])  # important to keep as string
    a = convert_code(row['ClassACover'], row['ClassAStruct'])
    b = convert_code(row['ClassBCover'], row['ClassBStruct'])
    c = convert_code(row['ClassCCover'], row['ClassCStruct'])
    d = convert_code(row['ClassDCover'], row['ClassDStruct'])
    e = convert_code(row['ClassECover'], row['ClassEStruct'])
    sc_code_map[bps_code] = {1: a, 2: b, 3: c, 4: d, 5: e}

# veg types and state classes are sorted by name
# We match that mapping by creating an index for the stateclasses here
sclass_index = dict()
idx = 1
for code in sorted(sc_map):  # sorts by name
    sclass_index[code] = idx
    idx += 1


def generate_stateclass_index_raster(bps_path, sc_path, output_path):
    """
        Convert LANDFIRE BpS and Succession-Class data into index stateclass data useable in SyncroSim.
        :param bps_path Path to Biophysical settings file
        :param sc_path Path to Succession Class settings file
        :param output_path Path to create the indexed succession class settings file
    """

    # bps codes look like 910080 for zone 9, model 10080
    # sc codes look like 1 - 5 plus other stuff which we can use for modeling water, urban, agriculture
    # resulting codes will match from 1 to 27, which we will use in syncrosim project definitions
    with rasterio.open(bps_path, 'r') as bps_src:
        windows = [window for index, window in bps_src.block_windows(1)]
        with rasterio.open(sc_path, 'r') as sc_src:
            with rasterio.open(output_path, 'w', **sc_src.profile) as dst:
                for window in windows:
                    bps_data = bps_src.read(1, window=window)
                    bps_ravel = bps_data.ravel()
                    sc_data = sc_src.read(1, window=window)
                    shape = sc_data.shape
                    sc_ravel = sc_data.ravel()
                    mapped_data = np.zeros(shape[0] * shape[1], dtype=sc_data.dtype)
                    for pixel in range(mapped_data.size):
                        bps_code = bps_ravel[pixel]
                        sc_code = sc_ravel[pixel]
                        if sc_code in [1, 2, 3, 4, 5] and bps_code != 0:
                            state_class_type = sc_code_map[bps_code][sc_code]
                            state_class_value = sclass_index[state_class_type]
                            mapped_data[pixel] = state_class_value
                    output_data = np.reshape(mapped_data, shape)
                    dst.write(output_data, indexes=1, window=window)
