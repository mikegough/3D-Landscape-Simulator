import os
import rasterio
import json
from Sagebrush.stsim_utils import stsim_manager
from OutputProcessing import texture_utils, raster_utils
from math import ceil
from OutputProcessing.plugins import conversions, lookups
import sys

TIFF_SIZE = 512
TEXTURE_SIZE_RATIO = 0.5    # texture size = tiff_size * ratio
TIFF_STRIDE = 2


# Print iterations progress
def print_progress(iteration, total, prefix='', suffix='', decimals=1, bar_length=50):
    """
    Call in a loop to create terminal progress bar
    @params:
        iteration   - Required  : current iteration (Int)
        total       - Required  : total iterations (Int)
        prefix      - Optional  : prefix string (Str)
        suffix      - Optional  : suffix string (Str)
        decimals    - Optional  : positive number of decimals in percent complete (Int)
        barLength   - Optional  : character length of bar (Int)
    """
    format_str = "{0:." + str(decimals) + "f}"
    percents = format_str.format(100 * (iteration / float(total)))
    filled_length = int(round(bar_length * iteration / float(total)))
    bar = '█' * filled_length + '-' * (bar_length - filled_length)
    sys.stdout.write('\r%s |%s| %s%s %s' % (prefix, bar, percents, '%', suffix)),
    if iteration == total:
        sys.stdout.write('\n')
    sys.stdout.flush()


def build_reporting_units(name, lib, layer, output_dir=None, one_shot=False, single_id=None, save_tifs=False):
    """
    Clips each extent for a given reporting unit and builds the textures and initial conditions
    :param name: Name of the reporting_unit in the STSIM_CONFIG
    :param lib: Name of the library in the STSIM_CONFIG
    :param layer: Path to the layer
    :param output_dir: Path to place the built structure
    """

    if not stsim_manager.has_tiles[lib]:
        raise KeyError("{lib} is not configured to have tiles. Exiting...".format(lib=lib))

    if output_dir is None:
        output_dir = stsim_manager.tile_directory[lib]
        if not os.path.exists(output_dir):
            raise FileNotFoundError("{path} does not exist.".format(path=output_dir))

    if lib not in stsim_manager.library_names:
        raise KeyError('{lib} is not an available library.'.format(lib=lib))

    veg_path = stsim_manager.veg_paths[lib]
    sc_path = stsim_manager.sc_paths[lib]
    elev_path = stsim_manager.elev_paths[lib]
    reporting_units = parse_reporting_units(layer)
    output_dir = os.path.join(output_dir, lib, name)

    veg_sc_defs = stsim_manager.all_veg_state_classes[lib]
    veg_defs = stsim_manager.vegtype_definitions[lib]
    sc_defs = stsim_manager.stateclass_definitions[lib]

    sc_colormap = texture_utils.create_colormap(stsim_manager.stateclass_definitions[lib])
    misc_colors = stsim_manager.misc_legend_info[lib]
    if len(misc_colors) > 0:

        misc_conv = getattr(conversions, 'convert_misc_info')
        misc_colors = [{'ID': str(misc_conv(color['ID'])),  # convert the codes to the proper codes in the textures
                        'r': color['r'],
                        'g': color['g'],
                        'b': color['b']} for color in misc_colors]

        sc_colormap += misc_colors

    p = 0
    total_progress = len(reporting_units)
    print_progress(p, total_progress, prefix='Progress:', suffix='Complete')

    for unit in reporting_units:
        p += 1

        if single_id is not None:
            one_shot = True

            if unit['id'] != single_id:
                continue

        unit_dir = os.path.join(output_dir, unit['id'])
        if not os.path.exists(unit_dir):
            os.makedirs(os.path.join(unit_dir, 'veg'))
            os.makedirs(os.path.join(unit_dir, 'sc'))
            os.makedirs(os.path.join(unit_dir, 'elev'))
            os.makedirs(os.path.join(unit_dir, 'temp'))
        else:
            continue    # only need to process this whole thing once  <('_'<) KIRBY!!!

        unit_initial_conditions = dict()
        # output vegetation rasters, textures
        with rasterio.open(veg_path, 'r') as src:
            overall_window = src.window(*unit['extent'])
            height = overall_window[0][1] - overall_window[0][0]
            width = overall_window[1][1] - overall_window[1][0]

            x_tiles = ceil(width / TIFF_SIZE * TEXTURE_SIZE_RATIO)
            y_tiles = ceil(height / TIFF_SIZE * TEXTURE_SIZE_RATIO)

            for i in range(x_tiles):
                left_idx = i * TIFF_SIZE + overall_window[1][0]
                right_idx = left_idx + TIFF_SIZE if left_idx + TIFF_SIZE < overall_window[1][1] else overall_window[1][1]

                for j in range(y_tiles):
                    top_idx = j * TIFF_SIZE + overall_window[0][0]
                    bot_idx = top_idx + TIFF_SIZE if top_idx + TIFF_SIZE < overall_window[0][1] else overall_window[0][1]

                    tile_height = TIFF_SIZE if bot_idx != overall_window[0][1] else bot_idx - top_idx
                    tile_width = TIFF_SIZE if right_idx != overall_window[1][1] else right_idx - left_idx
                    tile_height *= TEXTURE_SIZE_RATIO
                    tile_width *= TEXTURE_SIZE_RATIO

                    window = ((top_idx, bot_idx), (left_idx, right_idx))
                    out_kwargs = src.meta.copy()
                    out_kwargs.update({
                        'height': tile_height,
                        'width': tile_width,
                        'transform': src.window_transform(window),
                        'dtype': 'int32',  # SyncroSim needs a signed int32
                        'nodata': 0
                    })

                    output_path = os.path.join(unit_dir, 'veg', '-'.join([str(i), str(j), 'veg.tif']))
                    with rasterio.open(output_path, 'w', **out_kwargs) as dst:
                        dst.write(src.read(1, window=window)[::TIFF_STRIDE, ::TIFF_STRIDE].astype('int32'), 1)
                    veg_texture = texture_utils.vegtype_texture(output_path)
                    veg_texture.save(output_path.replace('tif', 'png'))

        # output stateclass rasters, textures
        raw_unit_zonal_stats = list()
        with rasterio.open(sc_path, 'r') as src:
            overall_window = src.window(*unit['extent'])
            height = overall_window[0][1] - overall_window[0][0]
            width = overall_window[1][1] - overall_window[1][0]

            x_tiles = ceil(width / TIFF_SIZE * TEXTURE_SIZE_RATIO)
            y_tiles = ceil(height / TIFF_SIZE * TEXTURE_SIZE_RATIO)


            for i in range(x_tiles):
                left_idx = i * TIFF_SIZE + overall_window[1][0]
                right_idx = left_idx + TIFF_SIZE if left_idx + TIFF_SIZE < overall_window[1][1] else overall_window[1][1]
                row_stats = list()
                for j in range(y_tiles):
                    top_idx = j * TIFF_SIZE + overall_window[0][0]
                    bot_idx = top_idx + TIFF_SIZE if top_idx + TIFF_SIZE < overall_window[0][1] else overall_window[0][1]

                    tile_height = TIFF_SIZE if bot_idx != overall_window[0][1] else bot_idx - top_idx
                    tile_width = TIFF_SIZE if right_idx != overall_window[1][1] else right_idx - left_idx
                    tile_height *= TEXTURE_SIZE_RATIO
                    tile_width *= TEXTURE_SIZE_RATIO

                    window = ((top_idx, bot_idx), (left_idx, right_idx))
                    out_kwargs = src.meta.copy()
                    out_kwargs.update({
                        'height': tile_height,
                        'width': tile_width,
                        'transform': src.window_transform(window),
                        'dtype': 'int32',  # SyncroSim needs a signed int32
                        'nodata': 0
                    })

                    # output vegetation rasters
                    output_path = os.path.join(unit_dir, 'sc', '-'.join([str(i), str(j), 'sc.tif']))
                    temp_veg_path = output_path.replace('sc', 'veg')

                    if len(stsim_manager.conversion_functions[lib]) > 0:
                        temp_sc_path = output_path.replace('sc', 'temp')
                        with rasterio.open(temp_sc_path, 'w', **out_kwargs) as dst:
                            dst.write(src.read(1, window=window)[::TIFF_STRIDE,::TIFF_STRIDE].astype('int32'), 1)
                        sc_conversion_func = getattr(conversions, stsim_manager.conversion_functions[lib])
                        sc_conversion_func(temp_veg_path, temp_sc_path, output_path)
                        os.remove(temp_sc_path)
                    else:
                        with rasterio.open(output_path, 'w', **out_kwargs) as dst:
                            dst.write(src.read(1, window=window)[::TIFF_STRIDE,::TIFF_STRIDE].astype('int32'), 1)

                    sc_texture = texture_utils.stateclass_texture(output_path, sc_colormap)
                    sc_texture.save(output_path.replace('tif', 'png'))

                    # collect zonal stats for this chunk
                    row_stats.append(raster_utils.zonal_stateclass_stats(temp_veg_path, output_path, sc_defs))

                    if not save_tifs:
                        # Remove the tifs after the conversion process is done.
                        os.remove(output_path)
                        os.remove(output_path.replace('sc', 'veg'))

                raw_unit_zonal_stats.append(row_stats)

        final_zonal_stats, veg_total, sc_total = total_stateclass_stats(raw_unit_zonal_stats, veg_sc_defs, veg_defs, sc_defs)
        unit_initial_conditions['veg_sc_pct'] = final_zonal_stats
        unit_initial_conditions['total_cells'] = veg_total
        unit_initial_conditions['total_active_cells'] = sc_total
        veg_codes = final_zonal_stats.keys()
        if stsim_manager.has_lookup_fields[lib]:
            lookup_function = getattr(lookups, stsim_manager.lookup_functions[lib])
            veg_names = lookup_function(veg_codes, stsim_manager.lookup_fields[lib][0])
        else:
            veg_names = {name: name for name in veg_codes}
        unit_initial_conditions['veg_names'] = veg_names

        # output elevation rasters, textures (and remove rasters afterwards since we don't need them)
        raw_unit_elevation_stats = list()
        with rasterio.open(elev_path, 'r') as src:
            overall_window = src.window(*unit['extent'])
            height = overall_window[0][1] - overall_window[0][0]
            width = overall_window[1][1] - overall_window[1][0]

            x_tiles = ceil(width / TIFF_SIZE * TEXTURE_SIZE_RATIO)
            y_tiles = ceil(height / TIFF_SIZE * TEXTURE_SIZE_RATIO)

            for i in range(x_tiles):
                left_idx = i * TIFF_SIZE + overall_window[1][0]
                right_idx = left_idx + TIFF_SIZE if left_idx + TIFF_SIZE < overall_window[1][1] else overall_window[1][1]
                row_stats = list()
                for j in range(y_tiles):
                    top_idx = j * TIFF_SIZE + overall_window[0][0]
                    bot_idx = top_idx + TIFF_SIZE if top_idx + TIFF_SIZE < overall_window[0][1] else overall_window[0][1]

                    tile_height = TIFF_SIZE if bot_idx != overall_window[0][1] else bot_idx - top_idx
                    tile_width = TIFF_SIZE if right_idx != overall_window[1][1] else right_idx - left_idx
                    tile_height *= TEXTURE_SIZE_RATIO
                    tile_width *= TEXTURE_SIZE_RATIO

                    window = ((top_idx, bot_idx), (left_idx, right_idx))
                    out_kwargs = src.meta.copy()
                    out_kwargs.update({
                        'height': tile_height,
                        'width': tile_width,
                        'transform': src.window_transform(window),
                        'dtype': 'int32',  # SyncroSim needs a signed int32
                        'nodata': 0
                    })

                    # output elevation texture
                    output_path = os.path.join(unit_dir, 'elev', '-'.join([str(i), str(j), 'elev.tif']))
                    with rasterio.open(output_path, 'w', **out_kwargs) as dst:
                        dst.write(src.read(1, window=window)[::TIFF_STRIDE,::TIFF_STRIDE].astype('int32'), 1)
                    elev_texture = texture_utils.elevation_texture(output_path)
                    elev_texture.save(output_path.replace('tif', 'png'))
                    row_stats.append(raster_utils.elevation_stats(output_path))

                    # cleanup the elevation since we don't need it anymore
                    os.remove(output_path) # output_path still has tif extension
                raw_unit_elevation_stats.append(row_stats)

        unit_initial_conditions['elev'] = total_elevation_stats(raw_unit_elevation_stats)
        unit_initial_conditions['elev']['x_tiles'] = x_tiles
        unit_initial_conditions['elev']['y_tiles'] = y_tiles
        unit_initial_conditions['elev']['tile_size'] = int(TIFF_SIZE * TEXTURE_SIZE_RATIO)

        unit_json_path = os.path.join(unit_dir, 'initial_conditions.json')
        with open(unit_json_path, 'w') as ic:
            json.dump(unit_initial_conditions, ic)

        # cleanup
        if os.path.exists(os.path.join(unit_dir, 'temp')):
            os.rmdir(os.path.join(unit_dir, 'temp'))

        print_progress(p, total_progress, prefix='Progress:', suffix='Complete')
        if one_shot:
            break


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


def total_stateclass_stats(raw_stats, veg_sc_defs, veg_defs, sc_defs):
    """ Determine the overall covers """
    result = dict()
    overall_sc_total = 0
    overall_veg_total = 0
    for row in raw_stats:
        for col in row:
            block_stats, veg_total, sc_total = col
            overall_sc_total += sc_total
            overall_veg_total += veg_total
            for vegtype in veg_sc_defs.keys():
                veg_id = int(veg_defs[vegtype]['ID'])
                if veg_id in block_stats.keys():
                    if vegtype not in result.keys():
                        result[vegtype] = dict()

                    for sc_type in veg_sc_defs[vegtype]:
                        sc_id = int(sc_defs[sc_type]['ID'])
                        if sc_type not in result[vegtype].keys():
                            result[vegtype][sc_type] = 0
                            
                        if sc_id in block_stats[veg_id].keys():
                            result[vegtype][sc_type] += block_stats[veg_id][sc_id] * veg_total
                        else:
                            result[vegtype][sc_type] = 0

    for veg in result.keys():
        for sc in result[veg].keys():
            result[veg][sc] /= overall_veg_total

    return result, overall_veg_total, overall_sc_total


def total_elevation_stats(raw_stats):
    """ Determine the overall world size """
    min_height = 100000
    max_height = 0

    small_tile = raw_stats[-1][-1]
    width = int((TIFF_SIZE * (len(raw_stats) - 1) + small_tile['dem_width']) * TEXTURE_SIZE_RATIO)
    height = int((TIFF_SIZE * (len(raw_stats[0]) - 1) + small_tile['dem_height']) * TEXTURE_SIZE_RATIO)

    for i in range(len(raw_stats)):
        row = raw_stats[i]
        for j in range(len(row)):
            col = row[j]
            min_height = col['dem_min'] if col['dem_min'] < min_height else min_height
            max_height = col['dem_max'] if col['dem_max'] > max_height else max_height

    return {'dem_min': min_height, 'dem_max': max_height, 'dem_width': width, 'dem_height': height}
