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
                                   lib_path=config[lib_name]['working_path'],
                                   exe=exe)
            for lib_name in self.library_names
        }

        # Specified pids, sids, and various transition types that we want to expose to the user interface
        self.pids = {lib_name: config[lib_name]['pid'] for lib_name in self.library_names}
        self.sids = {lib_name: config[lib_name]['default_sid'] for lib_name in self.library_names}
        self.probabilistic_transition_types = {lib_name: config[lib_name]['transition_types'] for lib_name in self.library_names}
        self.veg_model_configs = {lib_name: config[lib_name]['veg_model_config'] for lib_name in self.library_names}
        self.has_lookup_fields = {lib_name: config[lib_name]['has_lookup'] for lib_name in self.library_names}
        self.lookup_fields = {lib_name: config[lib_name]['lookup_fields'] for lib_name in self.library_names}
        self.lookup_functions = {lib_name: config[lib_name]['lookup_function'] for lib_name in self.library_names}
        self.conversion_functions = {lib_name: config[lib_name]['conversion_function'] for lib_name in self.library_names}
        self.conversion_extensions = {lib_name: config[lib_name]['conversion_extension'] for lib_name in self.library_names}
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

        # TODO - devise better loading technique. Rapidly decrease startup if the files are still there
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

        # TODO - remove, since we don't need this anymore
        self.all_scenario_names = {
            lib_name: self.consoles[lib_name].list_scenario_names(orig=True)
            for lib_name in self.library_names
        }

stsim_manager = STSimManager(settings.STSIM_CONFIG, settings.STSIM_EXE)
