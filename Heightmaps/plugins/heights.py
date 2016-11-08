from netCDF4 import Dataset
import numpy as np
import numpy_indexed as npi
from PIL import Image


def castle_creek_heightmap(path):
    """
    Serve the Castle Creek dem
    """
    with Dataset(path, 'r') as src:

        width = src.variables['x'][:].size
        height = src.variables['y'][:].size
        elev = src.variables['ned30m42116_snap_clip'][:].astype('int16')
        elev_flat = elev.ravel()
        unique_codes = [x for x in range(np.min(elev), np.max(elev)+1)]
        # Pack the elevation into the color channels.
        # Allows for a max of a 24 unsigned integer, and 1 8bit integer for depth below 0

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
            elif value < -255:
                r_map[value] = g_map[value] = b_map[value] = a_map[value] = 0
            else:
                r_map[value] = g_map[value] = b_map[value] = 0
                a_map[value] = 255 + value  # value is negative at this point, so add it

        image_shape = (width, height)  # images are column major
        texture = Image.new('RGBA', image_shape)
        r_array = npi.remap(elev_flat, list(r_map.keys()), list(r_map.values()))
        g_array = npi.remap(elev_flat, list(g_map.keys()), list(g_map.values()))
        b_array = npi.remap(elev_flat, list(b_map.keys()), list(b_map.values()))
        a_array = npi.remap(elev_flat, list(a_map.keys()), list(a_map.values()))
        image_data = [(r_array[i], g_array[i], b_array[i], a_array[i]) for i in range(width * height)]
        texture.putdata(image_data)
        return texture