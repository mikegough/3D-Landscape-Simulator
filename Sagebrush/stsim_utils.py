"""
    Simple utilities for managing stsimpy instances
"""

from stsimpy import STSimConsole
import os
from json import loads
from django.conf import settings


class STSimManager:
    """
        In-memory management of STSimConsole instances.
    """

    def __init__(self, config_path, exe):
        with open(config_path, 'r') as f:
            config = loads(f.read())
        self.config = config
        print('Optimizing ST-Sim libraries for usage...')
        init_path = os.path.join(os.path.dirname(os.path.abspath(__file__)))
        self.library_names = list(config.keys())

        # stsimpy console
        self.consoles = {
            lib_name: STSimConsole(orig_lib_path=config[lib_name]['orig_path'],
                                   lib_path=config[lib_name]['lib_path'],
                                   exe=exe)
            for lib_name in self.library_names
        }

        # Specified pids, sids, and various transition types that we want to expose to the user interface
        self.pids = {lib_name: config[lib_name]['pid'] for lib_name in self.library_names}
        self.sids = {lib_name: config[lib_name]['default_sid'] for lib_name in self.library_names}
        self.probabilistic_transition_types = {lib_name: config[lib_name]['transition_types'] for lib_name in self.library_names}

        # asset paths
        asset_dir = {lib_name: config[lib_name]['asset_directory'] for lib_name in self.library_names}
        self.veg_paths = {lib_name: os.path.join(asset_dir[lib_name], config[lib_name]['veg_path']) for lib_name in self.library_names}
        self.sc_paths = {lib_name: os.path.join(asset_dir[lib_name], config[lib_name]['sc_path']) for lib_name in self.library_names}
        self.elev_paths = {lib_name: os.path.join(asset_dir[lib_name], config[lib_name]['elev_path']) for lib_name in self.library_names}
        self.output_paths = {lib_name: config[lib_name]['output_path'] for lib_name in self.library_names}

        # viz configuration
        self.veg_model_configs = {lib_name: config[lib_name]['veg_model_config'] for lib_name in self.library_names}
        self.has_lookup_fields = {lib_name: config[lib_name]['has_lookup'] for lib_name in self.library_names}

        # lookup specifics
        self.lookup_fields = {lib_name: config[lib_name]['lookup_fields'] for lib_name in self.library_names}
        self.lookup_functions = {lib_name: config[lib_name]['lookup_function'] for lib_name in self.library_names}
        self.lookup_file_path = {lib_name: os.path.join(asset_dir[lib_name], config[lib_name]['lookup_file_name']) for lib_name in self.library_names}
        self.desc_file_path = {lib_name: os.path.join(asset_dir[lib_name], config[lib_name]['desc_file_name']) for lib_name in self.library_names}

        # stateclass conversion functions
        self.conversion_functions = {lib_name: config[lib_name]['conversion_function'] for lib_name in self.library_names}
        self.conversion_extensions = {lib_name: config[lib_name]['conversion_extension'] for lib_name in self.library_names}

        # pre-defined extent information and how to get the heightmap
        self.has_predefined_extent = {lib_name: config[lib_name]['has_predefined_extent'] for lib_name in self.library_names}
        self.heightmap_functions = {lib_name: config[lib_name]['heightmap_function'] for lib_name in self.library_names}

        # TODO - add transition_groups

        self.all_veg_state_classes = {
            lib_name: self.consoles[lib_name].export_veg_state_classes(
                sid=self.sids[lib_name],
                readonly=os.path.exists(os.path.join(init_path, lib_name + '-vegsc.csv')),
                state_class_path=os.path.join(init_path, lib_name + '-vegsc.csv'))
            for lib_name in self.library_names
        }

        self.all_probabilistic_transition_types = {
            lib_name: self.consoles[lib_name].export_probabilistic_transitions_types(
                sid=self.sids[lib_name],
                readonly=os.path.exists(os.path.join(init_path, lib_name + '-tr.csv')),
                transitions_path=os.path.join(init_path, lib_name + '-tr.csv')
            )
            for lib_name in self.library_names
        }

        # TODO - add 'all_probabilistic_transition_groups'

        self.vegtype_definitions = {
            lib_name: self.consoles[lib_name].export_vegtype_definitions(
                pid=self.pids[lib_name],
                readonly=os.path.exists(os.path.join(init_path, lib_name + '-vegdefs.csv')),
                working_path=os.path.join(init_path, lib_name + '-vegdefs.csv'))
            for lib_name in self.library_names
        }

        self.stateclass_definitions = {
            lib_name: self.consoles[lib_name].export_stateclass_definitions(
                pid=self.pids[lib_name],
                readonly=os.path.exists(os.path.join(init_path, lib_name + '-scdefs.csv')),
                working_path=os.path.join(init_path, lib_name + '-scdefs.csv'))
            for lib_name in self.library_names
        }

stsim_manager = STSimManager(settings.STSIM_CONFIG, settings.STSIM_EXE)
