
import os
from Sagebrush.stsim_utils import stsim_manager
from OutputProcessing import texture_utils, raster_utils
import rasterio
from math import ceil
from OutputProcessing.plugins import conversions


TILE_SIZE = 512


def build_reporting_units(name, lib, layer, output_dir):
    """
    Clips each extent for a given reporting unit and builds the
    :param name: Name of the reporting_unit in the STSIM_CONFIG
    :param lib: Name of the library in the STSIM_CONFIG
    :param layer: Path to the layer
    :param output_dir: Path to place the built structure
    """

    veg_path = stsim_manager.veg_paths[lib]
    sc_path = stsim_manager.sc_paths[lib]
    elev_path = stsim_manager.elev_paths[lib]
    reporting_units = parse_reporting_units(layer)
    output_dir = os.path.join(output_dir, lib, name)

    for unit in reporting_units:

        unit_dir = os.path.join(output_dir, unit['id'])
        if not os.path.exists(unit_dir):
            os.makedirs(os.path.join(unit_dir, 'veg'))
            os.makedirs(os.path.join(unit_dir, 'sc'))
            os.makedirs(os.path.join(unit_dir, 'elev'))
            os.makedirs(os.path.join(unit_dir, 'temp'))
        else:
            continue    # only need to process this whole thing once  <('_'<) KIRBY!!!

        # output vegetation rasters, textures
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

                    output_path = os.path.join(unit_dir, 'veg', '-'.join([str(i),str(j),'veg.tif']))
                    with rasterio.open(output_path, 'w', **out_kwargs) as dst:
                        dst.write(src.read(1, window=window).astype('int32'), 1)
                    veg_texture = texture_utils.vegtype_texture(output_path)
                    veg_texture.save(output_path.replace('tif', 'png'))

        # output stateclass rasters, textures
        with rasterio.open(sc_path, 'r') as src:
            overall_window = src.window(*unit['extent'])
            height = overall_window[0][1] - overall_window[0][0]
            width = overall_window[1][1] - overall_window[1][0]

            x_tiles = ceil(width / TILE_SIZE)
            y_tiles = ceil(height / TILE_SIZE)

            sc_colormap = texture_utils.create_colormap(stsim_manager.stateclass_definitions[lib])

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

                    # output vegetation rasters
                    output_path = os.path.join(unit_dir, 'sc', '-'.join([str(i), str(j), 'sc.tif']))

                    if len(stsim_manager.conversion_functions[lib]) > 0:
                        temp_veg_path = output_path.replace('sc', 'veg')
                        temp_sc_path = output_path.replace('sc', 'temp')
                        with rasterio.open(temp_sc_path, 'w', **out_kwargs) as dst:
                            dst.write(src.read(1, window=window).astype('int32'), 1)
                        sc_conversion_func = getattr(conversions, stsim_manager.conversion_functions[lib])
                        sc_conversion_func(temp_veg_path, temp_sc_path, output_path)
                        os.remove(temp_sc_path)
                    else:
                        with rasterio.open(output_path, 'w', **out_kwargs) as dst:
                            dst.write(src.read(1, window=window).astype('int32'), 1)

                    sc_texture = texture_utils.stateclass_texture(output_path, sc_colormap)
                    sc_texture.save(output_path.replace('tif', 'png'))

        # output elevation rasters, textures (and remove rasters afterwards since we don't need them)
        with rasterio.open(elev_path, 'r') as src:
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

                    # output elevation texture
                    output_path = os.path.join(unit_dir, 'elev', '-'.join([str(i), str(j), 'elev.tif']))
                    with rasterio.open(output_path, 'w', **out_kwargs) as dst:
                        dst.write(src.read(1, window=window).astype('int32'), 1)
                    sc_texture = texture_utils.elevation_texture(output_path)
                    sc_texture.save(output_path.replace('tif', 'png'))
                    os.remove(output_path) # output_path still has tif extension
        if os.path.exists(os.path.join(unit_dir, 'temp')):
            os.rmdir(os.path.join(unit_dir, 'temp'))


def parse_reporting_units(path):

    extents = list()

    with open(path, 'r') as f:

        raw = f.read()
        raw = raw.split('\n')
        for row in raw:
            if len(row) == 0:
                continue
            unit, id, extent = row.split('|')
            extent = [float(coord) for coord in extent[1:-1].split(',')]
            extents.append({'id': id, 'extent': extent})
    return extents

