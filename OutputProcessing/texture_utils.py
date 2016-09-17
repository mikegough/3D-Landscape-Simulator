import os
import rasterio
import numpy as np
import numpy_indexed as npi
from PIL import Image


def elevation_texture(elev_path):
    """ Creates an elevation-encoded image from a given elevation GeoTiff
    :param elev_path: The path to the elevation to encode into the texture.
    """
    with rasterio.open(elev_path, 'r') as src:

        elev_data = src.read(1).astype('int16')
        shape = elev_data.shape
        elev_flat = elev_data.ravel()

        # Pack the elevation into the color channels.
        # Allows for a max of a 24 unsigned integer, and 1 8bit integer for depth below 0
        unique_codes = [x for x in range(np.min(elev_data), np.max(elev_data)+1)]
        r_map = dict()
        g_map = dict()
        b_map = dict()
        a_map = dict()
        for value in list(unique_codes):
            if value >= 0:
                r_map[value] = (value & 0xFF)
                g_map[value] = (value & 0xFF00) >> 8
                b_map[value] = (value & 0xFF0000) >> 16
                a_map[value] = 255
            elif value < 255:
                r_map[value] = g_map[value] = b_map[value] = a_map[value] = 0
            else:
                r_map[value] = g_map[value] = b_map[value] = 0
                a_map[value] = 255 + value  # value is negative at this point, so add it

        image_shape = (shape[1], shape[0])  # images are column major
        texture = Image.new('RGBA', image_shape)
        r_array = npi.remap(elev_flat, list(r_map.keys()), list(r_map.values()))
        g_array = npi.remap(elev_flat, list(g_map.keys()), list(g_map.values()))
        b_array = npi.remap(elev_flat, list(b_map.keys()), list(b_map.values()))
        a_array = npi.remap(elev_flat, list(a_map.keys()), list(a_map.values()))
        image_data = [(r_array[i], g_array[i], b_array[i], a_array[i]) for i in range(shape[0] * shape[1])]
        texture.putdata(image_data)
        return texture


def vegtype_texture(strata_path):
    """ Creates a type-encoded image from a given strata GeoTiff
    :param strata_path: The path to the vegtype to encode into the texture.
    """

    with rasterio.open(strata_path, 'r') as src:

        strata_data = src.read(1).astype('int32')
        shape = strata_data.shape
        strata_flat = strata_data.ravel()

        # Pack the codes into the color channels.
        # Allows for a max of a 24 unsigned integer.
        unique_codes = np.unique(strata_flat)
        r_map = dict()
        g_map = dict()
        b_map = dict()
        for value in list(unique_codes):
            r_map[value] = (value & 0xFF)
            g_map[value] = (value & 0xFF00) >> 8
            b_map[value] = (value & 0xFF0000) >> 16

        image_shape = (shape[1], shape[0])  # images are column major
        texture = Image.new('RGB', image_shape)
        r_array = npi.remap(strata_flat, list(r_map.keys()), list(r_map.values()))
        g_array = npi.remap(strata_flat, list(g_map.keys()), list(g_map.values()))
        b_array = npi.remap(strata_flat, list(b_map.keys()), list(b_map.values()))
        image_data = [(r_array[i], g_array[i], b_array[i]) for i in range(shape[0] * shape[1])]
        texture.putdata(image_data)
        return texture


def stateclass_texture(sc_tif, colormap):
    """ Creates a true-color image from a given strata GeoTiff
    :param strata_path: The path to the vegtype to encode into the texture.
    """
    r_map = dict()
    g_map = dict()
    b_map = dict()

    fill = -9999
    zero = 0
    r_map[fill] = g_map[fill] = b_map[fill] = r_map[zero] = g_map[zero] = b_map[zero] = 0

    for row in colormap:
        idx = int(row['ID'])
        r_map[idx] = int(row['r'])
        g_map[idx] = int(row['g'])
        b_map[idx] = int(row['b'])

    # open the stateclass geotiff and get as a linear array
    with rasterio.open(sc_tif, 'r') as src:
        # cast the values to integers since they are uniquely identifiable
        sc_data = src.read(1).astype('int32')
        shape = sc_data.shape
        sc_flat = sc_data.ravel()
        # copy and remap the numpy arrays to the rgb values we want
        sc_copy = np.copy(sc_flat)
        r_array = npi.remap(sc_copy, list(r_map.keys()), list(r_map.values()))
        g_array = npi.remap(sc_copy, list(g_map.keys()), list(g_map.values()))
        b_array = npi.remap(sc_copy, list(b_map.keys()), list(b_map.values()))

        # get construct the image data based on the mapped values
        image_data = [(r_array[i], g_array[i], b_array[i]) for i in range(shape[0] * shape[1])]

        # build the png image
        image_shape = (shape[1], shape[0])  # images are column major
        texture = Image.new('RGB', image_shape)
        texture.putdata(image_data)
    return texture


def process_stateclass_directory(dir_path, sc_defs):
    """
    Process a directory of stateclass outputs.
    :param dir_path: Absolute path to the output directory for the given scenario.
    :param sc_defs: The stateclass definitions
    :return:
    """

    colormap = list()   # TODO - let colors be determined by the UI or by the user?
    for stateclass in sc_defs.keys():
        color = sc_defs[stateclass]['Color'].split(',')
        r = color[1]
        g = color[2]
        b = color[3]
        idx = sc_defs[stateclass]['ID']
        colormap.append({'ID': idx, 'r': r, 'g': g, 'b': b})

    file_names = os.listdir(dir_path)
    for f_name in file_names:
        name_parts = f_name.split('-')

        # TODO - replace with regex, since that would be easier to parse
        if name_parts[-1][:2] == 'sc' and name_parts[-1].split(".")[-1] == 'tif':
            # parse iteration, timestep
            iteration = int(name_parts[0][2:])
            timestep = int(name_parts[1][2:])
            texture = stateclass_texture(os.path.join(dir_path, f_name), colormap)
            output_path = os.path.join(dir_path, 'stateclass_{iteration}_{timestep}.png'.format(iteration=iteration,
                                                                                                timestep=timestep))
            texture.save(output_path)
