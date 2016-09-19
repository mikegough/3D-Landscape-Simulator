"""
    Plugins for fieldname lookups for individual libraries.

    Sometimes you just have to use a lookup table. Using a plugin-style
    setup, we can define the name of the function in the overall configuration
    file, supply the fieldname, and then, in the LookupView, pass back the mapped
    values to the application for consumption.
"""

from django.conf import settings
import csv


def landfire_lookup(bps_codes, fieldname):
    """
    Plugin for the Landfire lookup table
    :param bps_codes: A list of Biophysical settings that we want to return
    :param fieldname: The fieldname to lookup
    :return:
    """

    result = dict()

    with open(settings.LANDFIRE_PATHS['lookup'], 'r') as f:

        lookup = csv.DictReader(f)
        for table_row in lookup:
            read_bps_code = table_row['BPS_MODEL']
            try:
                if int(read_bps_code) in bps_codes:
                    value = table_row[fieldname]
                    result[int(read_bps_code)] = value
            except:
                continue    # skip all the non-int parseable entries

        return result
