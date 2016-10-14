import os
import rasterio
import json
from Sagebrush.stsim_utils import stsim_manager
from OutputProcessing import texture_utils, raster_utils
from math import ceil
from OutputProcessing.plugins import conversions, lookups
import sys

TILE_SIZE = 512

# Print iterations progress
def printProgress (iteration, total, prefix = '', suffix = '', decimals = 1, barLength = 100):
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
    formatStr       = "{0:." + str(decimals) + "f}"
    percents        = formatStr.format(100 * (iteration / float(total)))
    filledLength    = int(round(barLength * iteration / float(total)))
    bar             = '█' * filledLength + '-' * (barLength - filledLength)
    sys.stdout.write('\r%s |%s| %s%s %s' % (prefix, bar, percents, '%', suffix)),
    if iteration == total:
        sys.stdout.write('\n')
    sys.stdout.flush()


def build_reporting_units(name, lib, layer, output_dir):
    """
    Clips each extent for a given reporting unit and builds the textures and initial conditions
    :param name: Name of the reporting_unit in the STSIM_CONFIG
    :param lib: Name of the library in the STSIM_CONFIG
    :param layer: Path to the layer
    :param output_dir: Path to place the built structure
    """

    if lib not in stsim_manager.library_names:
        raise KeyError('{lib} is not an available library.'.format(lib=lib))

    veg_path = stsim_manager.veg_paths[lib]
    sc_path = stsim_manager.sc_paths[lib]
    elev_path = stsim_manager.elev_paths[lib]
    reporting_units = parse_reporting_units(layer)
    output_dir = os.path.join(output_dir, lib, name)

    progress = 0
    total_progress = len(reporting_units) * 2
    printProgress(progress, total_progress, prefix='Progress:', suffix='Complete', barLength=50)
    for unit in reporting_units:

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
        raw_unit_zonal_stats = list()
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
                row_stats = list()
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
                    temp_veg_path = output_path.replace('sc', 'veg')

                    if len(stsim_manager.conversion_functions[lib]) > 0:
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

                    # collect zonal stats for this chunk
                    row_stats.append(raster_utils.zonal_stateclass_stats(temp_veg_path, output_path))
                raw_unit_zonal_stats.append(row_stats)

        final_zonal_stats, total = total_stateclass_stats(raw_unit_zonal_stats)
        unit_initial_conditions['veg_sc_pct'] = final_zonal_stats
        unit_initial_conditions['total_cells'] = total
        veg_codes = final_zonal_stats.keys()
        if stsim_manager.has_lookup_fields[lib]:
            lookup_function = getattr(lookups, stsim_manager.lookup_functions[lib])
            veg_names = lookup_function(veg_codes, stsim_manager.lookup_fields[lib][0])
        else:
            veg_names = {name: name for name in veg_codes}
        unit_initial_conditions['veg_names'] = veg_names

        progress += 1
        printProgress(progress, total_progress, prefix='Progress:', suffix='Complete', barLength=50)

        # output elevation rasters, textures (and remove rasters afterwards since we don't need them)
        raw_unit_elevation_stats = list()
        with rasterio.open(elev_path, 'r') as src:
            overall_window = src.window(*unit['extent'])
            height = overall_window[0][1] - overall_window[0][0]
            width = overall_window[1][1] - overall_window[1][0]

            x_tiles = ceil(width / TILE_SIZE)
            y_tiles = ceil(height / TILE_SIZE)

            for i in range(x_tiles):
                left_idx = i * TILE_SIZE + overall_window[1][0]
                right_idx = left_idx + TILE_SIZE if left_idx + TILE_SIZE < overall_window[1][1] else overall_window[1][1]
                row_stats = list()
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
                    row_stats.append(raster_utils.elevation_stats(output_path))

                    # cleanup the elevation since we don't need it anymore
                    os.remove(output_path) # output_path still has tif extension
                raw_unit_elevation_stats.append(row_stats)

        unit_initial_conditions['elev'] = total_elevation_stats(raw_unit_elevation_stats)
        unit_initial_conditions['elev']['x_tiles'] = x_tiles
        unit_initial_conditions['elev']['y_tiles'] = y_tiles

        unit_json_path = os.path.join(unit_dir, 'initial_conditions.json')
        with open(unit_json_path, 'w') as ic:
            json.dump(unit_initial_conditions, ic)

        # cleanup
        if os.path.exists(os.path.join(unit_dir, 'temp')):
            os.rmdir(os.path.join(unit_dir, 'temp'))

        progress += 1
        printProgress(progress, total_progress, prefix='Progress:', suffix='Complete', barLength=50)


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


def total_stateclass_stats(raw_stats):
    """ Determine the overall covers """
    result = dict()
    overall_total = 0
    for row in raw_stats:
        for col in row:
            block_stats, block_total = col
            overall_total += block_total
            for veg in block_stats.keys():
                if str(veg) not in result.keys():
                    result[str(veg)] = dict()
                for sc in block_stats[veg].keys():
                    if str(sc) not in result[str(veg)].keys():
                        result[str(veg)][str(sc)] = 0
                    result[str(veg)][str(sc)] += block_stats[veg][sc] * block_total

    for veg in result.keys():
        for sc in result[veg].keys():
            result[veg][sc] /= overall_total

    return result, overall_total


def total_elevation_stats(raw_stats):
    """ Determine the overall world size """

    width = height = 0
    min_height = 100000
    max_height = 0

    for i in range(len(raw_stats)):
        row = raw_stats[i]
        for j in range(len(row)):
            col = row[j]
            if i == 0:
                # update total width
                width += col['dem_width']

            if j == 0:
                # update total height
                height += col['dem_height']

            min_height = col['dem_min'] if col['dem_min'] < min_height else min_height
            max_height = col['dem_max'] if col['dem_max'] > max_height else max_height

    return {'dem_min': min_height, 'dem_max': max_height, 'dem_width': width, 'dem_height': height}
