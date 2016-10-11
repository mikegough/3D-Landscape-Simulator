
import os
from Sagebrush.stsim_utils import stsim_manager
from OutputProcessing import texture_utils, raster_utils
from pprint import pprint
import rasterio
from math import ceil
from rasterio.warp import transform_bounds
from rasterio.crs import CRS


TILE_SIZE = 512


def build_reporting_units(lib, layer, output_dir):
    """
    Clips each extent for a given reporting unit and builds the
    :param lib: Name of the library in the STSIM_CONFIG
    :param layer: Path to the layer
    :param output_dir: Path to place the built structure
    """

    veg_path = stsim_manager.veg_paths[lib]
    sc_path = stsim_manager.sc_paths[lib]
    reporting_units = parse_reporting_units(layer)

    for unit in reporting_units:
        with rasterio.open(veg_path, 'r') as src:
            overall_window = src.window(*unit['extent'])
            height = overall_window[0][1] - overall_window[0][0]
            width = overall_window[1][1] - overall_window[1][0]

            x_tiles = ceil(width / TILE_SIZE)
            y_tiles = ceil(height / TILE_SIZE)

            for i in range(x_tiles):
                left_idx = i * TILE_SIZE + overall_window[1][0]
                right_idx = left_idx + TILE_SIZE if left_idx + TILE_SIZE < overall_window[1][1] else overall_window[1][1]

                for j in range(y_tiles):

                    top_idx = j * TILE_SIZE + overall_window[0][0]
                    bot_idx = top_idx + TILE_SIZE if top_idx + TILE_SIZE < overall_window[0][1] else overall_window[0][1]

                    window = ((top_idx, bot_idx), (left_idx, right_idx))
                    out_kwargs = src.meta.copy()
                    out_kwargs.update({
                        'height': TILE_SIZE if bot_idx != overall_window[0][1] else bot_idx - top_idx,
                        'width': TILE_SIZE if right_idx != overall_window[1][1] else right_idx - left_idx,
                        'transform': src.window_transform(window),
                        'dtype': 'int32',  # SyncroSim needs a signed int32
                        'nodata': 0
                    })
                    unit_dir = os.path.join(output_dir, unit['id'])
                    if not os.path.exists(unit_dir):
                        os.makedirs(unit_dir)

                    # output vegetation rasters
                    output_path = os.path.join(unit_dir, '_'.join([str(i),str(j)]) + '-veg.tif')
                    with rasterio.open(output_path, 'w', **out_kwargs) as dst:
                        dst.write(src.read(1, window=window).astype('int32'), 1)
                    veg_texture = texture_utils.vegtype_texture(output_path)
                    veg_texture.save(output_path.replace('tif', 'png'))


def parse_reporting_units(path):

    extents = list()

    with open(path, 'r') as f:

        raw = f.read()
        raw = raw.split('\n')
        for row in raw:
            if len(row) == 0:
                continue
            #print(row)
            unit, id, extent = row.split('|')
            extent = [float(coord) for coord in extent[1:-1].split(',')]
            extents.append({'id': id, 'extent': extent})
    return extents

