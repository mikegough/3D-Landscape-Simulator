import os
import rasterio
import numpy as np
import numpy_indexed as npi
from PIL import Image


def vegtype_texture(strata_path):
    """ Creates a greyscale image from a given strata GeoTiff """

    with rasterio.open(strata_path, 'r') as src:

        strata_data = src.read(1).astype('int32')
        shape = strata_data.shape
        strata_flat = strata_data.ravel()

        keys = np.unique(strata_flat)
        mapping = dict()

        # 0 should map to 0
        # -9999 should map to 0
        # otherwise, map key to value directly
        for key in keys:
            value = key
            if key == -9999:
                value = 0
            mapping[key] = value  # * 30 # debug, to check that things are actually there

        image_shape = (shape[1], shape[0])  # images are column major
        texture = Image.new('L', image_shape)

        image_data = npi.remap(strata_flat, list(mapping.keys()), list(mapping.values()))
        texture.putdata(image_data)
        return texture


def stateclass_colors_as_list(colormap_path):

    colors = list()

    with open(colormap_path, 'r') as f:

        colors_src = f.readlines()[2:]
        for line in colors_src:
            line = line.strip().split(',')
            color = {
                'value': "rgb(" + ",".join([line[1], line[2], line[3]]) + ")",
                'name': line[5]
            }

            colors.append(color)

    return colors


def create_stateclass_texture(sc_tif, colormap):

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

    colormap = list()
    for stateclass in sc_defs.keys():
        color = sc_defs[stateclass]['Color'].split(',')
        r = color[1]
        g = color[2]
        b = color[3]
        idx = sc_defs[stateclass]['ID']
        colormap.append({'ID':idx, 'r': r, 'g': g, 'b': b})

    file_names = os.listdir(dir_path)
    for f_name in file_names:
        name_parts = f_name.split('-')

        # TODO - replace with regex, since that would be easier to parse
        if name_parts[-1][:2] == 'sc' and name_parts[-1].split(".")[-1] == 'tif':
            # parse iteration, timestep
            iteration = int(name_parts[0][2:])
            timestep = int(name_parts[1][2:])
            texture = create_stateclass_texture(os.path.join(dir_path, f_name), colormap)
            output_path = os.path.join(dir_path, 'stateclass_{timestep}.png'.format(timestep=timestep))
            texture.save(output_path)
