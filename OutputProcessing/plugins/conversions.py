import rasterio
import csv
import numpy as np
from Sagebrush.stsim_utils import stsim_manager

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
landfire_descriptions_file = stsim_manager.desc_file_path['Landfire']
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


def landfire_stateclass_index_raster(bps_path, sc_path, output_path):
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
