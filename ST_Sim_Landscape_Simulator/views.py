import os
import json
import time
from django.views.generic import TemplateView, View
from django.conf import settings
from json import encoder
from django.http import HttpResponse, JsonResponse, HttpResponseNotFound
from PIL import Image
from OutputProcessing import texture_utils, raster_utils
from OutputProcessing.plugins import lookups, conversions
from Heightmaps.plugins import heights
from Sagebrush.stsim_utils import stsim_manager
from uuid import uuid4

# Two decimal places when dumping to JSON
encoder.FLOAT_REPR = lambda o: format(o, '.2f')


class HomepageView(TemplateView):

    template_name = 'index.html'

    def get_context_data(self, **kwargs):
        context = super(HomepageView, self).get_context_data(**kwargs)
        context['available_libraries'] = stsim_manager.library_names
        return context


class RasterSelectionView(View):
    """
    Clips out the raster extent from the overall dataset.
    Clipping is necessary as we want to run the model on the spatial extent we selected out.
    If we didn't need to do this, we would only need simple tile servers...
    """

    def __init__(self):
        self.library = None
        self.stsim = None
        self.left = None
        self.bottom = None
        self.right = None
        self.top = None
        self.output_path = None
        super().__init__()

    def dispatch(self, request, *args, **kwargs):
        self.library = kwargs.get('library')
        if self.library not in stsim_manager.library_names:
            return HttpResponseNotFound()
        self.stsim = stsim_manager.consoles[self.library]
        self.left = float(kwargs.get('left'))
        self.bottom = float(kwargs.get('bottom'))
        self.right = float(kwargs.get('right'))
        self.top = float(kwargs.get('top'))
        self.output_path = stsim_manager.output_paths[self.library]
        return super().dispatch(request, *args, **kwargs)

    def get(self, request, *args, **kwargs):

        raster_uuid = str(uuid4())
        elev_path = os.path.join(self.output_path, raster_uuid + '-elev.tif')
        sc_path = os.path.join(self.output_path, raster_uuid + '-sc.tif')
        veg_path = os.path.join(self.output_path, raster_uuid + '-veg.tif')

        if stsim_manager.has_predefined_extent[self.library]:
            return JsonResponse({'uuid': 'predefined-extent'})

        raster_utils.clip_from_wgs(stsim_manager.elev_paths[self.library],
                                   elev_path,
                                   (self.left, self.bottom, self.right, self.top))
        raster_utils.clip_from_wgs(stsim_manager.sc_paths[self.library],
                                   sc_path,
                                   (self.left, self.bottom, self.right, self.top))
        raster_utils.clip_from_wgs(stsim_manager.veg_paths[self.library],
                                   veg_path,
                                   (self.left, self.bottom, self.right, self.top))

        if stsim_manager.has_lookup_fields[self.library]:
            sc_conversion_func = getattr(conversions, stsim_manager.conversion_functions[self.library])
            sc_conversion_path = os.path.join(self.output_path, raster_uuid + '-' +
                                              stsim_manager.conversion_extensions[self.library] + '.tif')
            sc_conversion_func(veg_path, sc_path, sc_conversion_path)

        return JsonResponse({'uuid': raster_uuid})


class RasterTextureBase(View):

    def __init__(self):
        self.library = None
        self.raster_uuid = None
        self.output_path = None
        super().__init__()

    def dispatch(self, request, *args, **kwargs):
        self.library = kwargs.get('library')
        if self.library not in stsim_manager.library_names:
            return HttpResponseNotFound()
        self.raster_uuid = kwargs.get('uuid')
        self.output_path = stsim_manager.output_paths[self.library]
        return super().dispatch(request, *args, **kwargs)


class RasterTextureView(RasterTextureBase):
    """
    Serves up a selected raster based on the previously selected raster_uuid
    """

    raster_types = ['sc', 'veg', 'elev']

    def __init__(self):
        self.type = None
        super().__init__()

    def dispatch(self, request, *args, **kwargs):
        self.type = kwargs.get('type')
        if self.type not in self.raster_types:
            raise ValueError(self.type + ' is not a valid data type. Types are ' + str(self.raster_types) + '.')
        return super().dispatch(request, *args, **kwargs)

    def get(self, request, *args, **kwargs):

        response = HttpResponse(content_type="image/png")

        ext = self.type if self.type != 'sc' else ('sc' if not stsim_manager.has_lookup_fields[self.library] else stsim_manager.conversion_extensions[self.library])
        if self.raster_uuid == 'predefined-extent':
            path = getattr(stsim_manager, self.type + '_paths')[self.library]
        else:
            path = os.path.join(self.output_path, self.raster_uuid + '-' + ext + '.tif')

        if self.type == 'elev':
            if stsim_manager.has_predefined_extent[self.library]:
                elev_func = getattr(heights, stsim_manager.heightmap_functions[self.library])
                elev_path = stsim_manager.elev_paths[self.library]
                texture = elev_func(elev_path)
            else:
                texture = texture_utils.elevation_texture(path)
        elif self.type == 'sc':
            sc_colormap = texture_utils.create_colormap(stsim_manager.stateclass_definitions[self.library])
            texture = texture_utils.stateclass_texture(path, sc_colormap)
        elif self.type == 'veg':
            texture = texture_utils.vegtype_texture(path)
        else:
            return HttpResponseNotFound()

        texture.save(response, 'PNG')
        return response


class RasterTextureStats(RasterTextureBase):
    """
    Zonal elevation, vegetation and statelcass statistics from a raster.
    """

    def get(self, request, *args, **kwargs):

        if self.raster_uuid == 'predefined-extent' and stsim_manager.has_predefined_extent[self.library]:
            elev_path = stsim_manager.elev_paths[self.library]
            sc_path = stsim_manager.sc_paths[self.library]
            veg_path = stsim_manager.veg_paths[self.library]
        elif self.raster_uuid != 'predefined-extent' and stsim_manager.has_predefined_extent[self.library] \
                or self.raster_uuid == 'predefined-extent' and not stsim_manager.has_predefined_extent[self.library]:
            return HttpResponseNotFound()
        else:   # raster_uuid is a uuid and the library is boundless
            sc_ext = 'sc' if not stsim_manager.has_lookup_fields[self.library] else stsim_manager.conversion_extensions[self.library]
            sc_path = os.path.join(self.output_path, self.raster_uuid + '-' + sc_ext + '.tif')
            elev_path = os.path.join(self.output_path, self.raster_uuid + '-elev.tif')
            veg_path = os.path.join(self.output_path, self.raster_uuid + '-veg.tif')

        # elevation information
        elev_stats = raster_utils.elevation_stats(elev_path)

        # determine vegetation initial coverage by state class
        veg_state_defs = stsim_manager.all_veg_state_classes[self.library]
        vegtype_defs = stsim_manager.vegtype_definitions[self.library]
        stateclass_defs = stsim_manager.stateclass_definitions[self.library]
        veg_sc_pcts, total = raster_utils.zonal_stateclass_stats(veg_path, sc_path)

        zonal_veg_sc_pcts = dict()
        for vegtype in veg_state_defs.keys():
            veg_id = int(vegtype_defs[vegtype]['ID'])
            if veg_id in veg_sc_pcts.keys():
                zonal_veg = dict()
                for sc_type in veg_state_defs[vegtype]:
                    sc_id = int(stateclass_defs[sc_type]['ID'])
                    if sc_id in veg_sc_pcts[veg_id].keys():
                        zonal_veg[sc_type] = veg_sc_pcts[veg_id][sc_id]
                    else:
                        zonal_veg[sc_type] = 0
                zonal_veg_sc_pcts[vegtype] = zonal_veg
        return JsonResponse({'elev': elev_stats,
                             'veg_sc_pct': zonal_veg_sc_pcts,
                             'total_cells': total})


class STSimBaseView(View):

    def __init__(self):
        self.library = None
        self.stsim = None
        self.project_id = None
        self.scenario_id = None
        self.output_path = None
        super(STSimBaseView, self).__init__()

    def dispatch(self, request, *args, **kwargs):
        self.library = kwargs.get('library')
        if self.library not in stsim_manager.library_names:
            return HttpResponseNotFound()
        self.stsim = stsim_manager.consoles[self.library]
        self.project_id = stsim_manager.pids[self.library]
        self.output_path = stsim_manager.output_paths[self.library]
        if 'scenario_id' in kwargs:
            self.scenario_id = kwargs.get('scenario_id')
        else:
            self.scenario_id = stsim_manager.sids[self.library]
        return super().dispatch(request, *args, **kwargs)


class LookupView(STSimBaseView):
    """
    Lookup for libraries that require additional lookup capabilities.
    Useful for determining which 3D asset or ID to associate with a given vegetation type.
    """

    def __init__(self):
        self.lookup_field = None
        super(STSimBaseView, self).__init__()

    def dispatch(self, request, *args, **kwargs):
        self.lookup_field = kwargs.get('lookup_field')
        return super().dispatch(request, *args, **kwargs)

    def get(self, request, *args, **kwargs):
        if stsim_manager.has_lookup_fields[self.library] \
                and self.lookup_field in stsim_manager.lookup_fields[self.library]:
            input_codes = [int(code) for code in request.GET.getlist('input_codes[]')]
            lookup_function = getattr(lookups, stsim_manager.lookup_functions[self.library])
            data = lookup_function(input_codes, self.lookup_field)
        else:
            data = self.library + ' has no lookup field ' + self.lookup_field
        return JsonResponse({'data': data})


class LibraryInfoView(STSimBaseView):

    def get(self, request, *args, **kwargs):

        response = dict()

        # veg state classes
        response['veg_type_state_classes_json'] = stsim_manager.all_veg_state_classes[self.library]

        # predefined spatial extent?
        response['has_predefined_extent'] = stsim_manager.has_predefined_extent[self.library]

        # has lookup functionality?
        response['has_lookup'] = stsim_manager.has_lookup_fields[self.library]
        response['lookup_fields'] = stsim_manager.lookup_fields[self.library]

        # pass the library info the the frontend viz
        sc_defs = stsim_manager.stateclass_definitions[self.library]
        veg_defs = stsim_manager.vegtype_definitions[self.library]
        response['stateclass_definitions'] = {name: int(sc_defs[name]['ID']) for name in sc_defs.keys()}
        response['vegtype_definitions'] = {name: int(veg_defs[name]['ID']) for name in veg_defs.keys()}

        # our probabilistic transition types for this application
        probabilistic_transition_types = stsim_manager.probabilistic_transition_types[self.library]
        probabilistic_transition_dict = {value: 0 for value in probabilistic_transition_types}
        response['probabilistic_transitions_json'] = probabilistic_transition_dict

        # transition groups, used for specifying transition targets in the UI
        response['management_actions_list'] = stsim_manager.probabilistic_transition_groups[self.library]

        # pass the model config to tell the viz which assets to load
        response['veg_model_config'] = stsim_manager.veg_model_configs[self.library]

        return JsonResponse(response)


class RunModelView(STSimBaseView):

    def __init__(self):
        self.raster_uuid = None
        super().__init__()

    def dispatch(self, request, *args, **kwargs):
        self.raster_uuid = kwargs.get('uuid')
        return super(RunModelView, self).dispatch(request, *args, **kwargs)

    def post(self, request, *args, **kwargs):

        timesteps = int(request.POST['timesteps'])
        step = 1        # TODO - provide min/max timesteps in interface (under advanced tab)?
        min_step = 0
        max_step = timesteps
        iterations = int(request.POST['iterations'])
        is_spatial = json.loads(request.POST['spatial'])
        stateclass_relative_distribution = json.loads(request.POST['veg_slider_values_state_class'])
        probabilistic_transitions_modifiers = json.loads(request.POST['probabilistic_transitions_slider_values'])

        # working file path
        init_conditions_file = os.path.join(settings.STSIM_WORKING_DIR,
                                            "initial_conditions",
                                            "user_defined_temp" + str(time.time()) + ".csv")

        # set the run control for the spatial model
        self.stsim.update_run_control(
            sid=self.scenario_id, working_path=init_conditions_file,
            spatial=is_spatial, iterations=iterations, start_timestep=min_step, end_timestep=max_step
        )

        output_settings = {
            'SummaryOutputSC': True,
            'SummaryOutputSCTimesteps': step,
            'SummaryOutputTR': True,
            'SummaryOutputTRTimesteps': step
        }

        if is_spatial:

            output_settings['RasterOutputSC'] = True
            output_settings['RasterOutputSCTimesteps'] = step

            if not stsim_manager.has_predefined_extent[self.library]:

                veg_path = os.path.join(self.output_path, self.raster_uuid + '-veg.tif')
                sc_path = os.path.join(self.output_path, self.raster_uuid + '-sc.tif')

                # check if a conversion to the stateclasses needs to happen before running stsim
                if stsim_manager.has_lookup_fields[self.library]:
                    sc_path = os.path.join(self.output_path, self.raster_uuid + '-' +
                                           stsim_manager.conversion_extensions[self.library] + '.tif')

                # import vegtype, stateclass raster into stsim
                self.stsim.import_spatial_initial_conditions(sid=self.scenario_id, working_path=init_conditions_file,
                                                         strata_path=veg_path, sc_path=sc_path)
        else:
            self.stsim.import_nonspatial_distribution(self.scenario_id,
                                                      stateclass_relative_distribution,
                                                      init_conditions_file)

        # update the output options for the step size
        self.stsim.set_output_options(self.scenario_id, init_conditions_file, **output_settings)

        # probabilistic transition probabilities
        probabilities = self.stsim.export_probabilistic_transitions_map(self.scenario_id, init_conditions_file, orig=True)

        # if the values are modified by the user, adjust them and pass them to ST-Sim working library
        if probabilistic_transitions_modifiers is not None and len(probabilistic_transitions_modifiers.keys()) > 0:
            for veg_type in probabilities.keys():
                for state_class in probabilities[veg_type]:
                    transition_type = state_class['type']
                    if transition_type in probabilistic_transitions_modifiers.keys():
                        value = probabilistic_transitions_modifiers[transition_type]
                        state_class['probability'] += value

        self.stsim.import_probabilistic_transitions(self.scenario_id,
                                                    probabilities,
                                                    init_conditions_file)

        # run stsim model at self.scenario_id and return the result scenario id
        result_scenario_id = self.stsim.run_model(sid=self.scenario_id)

        if is_spatial:
            # process each output raster in the output directory
            stateclass_definitions = stsim_manager.stateclass_definitions[self.library]
            texture_utils.process_stateclass_directory(
                dir_path=os.path.join(self.stsim.lib + '.output', 'Scenario-'+str(result_scenario_id), 'Spatial'),
                sc_defs=stateclass_definitions
            )

        # collect the summary statistics and return to the user
        report_file = os.path.join(settings.STSIM_WORKING_DIR, "model_results",
                                   "stateclass-summary-" + str(result_scenario_id) + ".csv")

        if os.path.exists(report_file):
            os.remove(report_file)

        # Return the completed spatial run id, and use that ID for obtaining the resulting output timesteps' rasters
        results_json = json.dumps(self.stsim.export_stateclass_summary(result_scenario_id, report_file))
        return HttpResponse(json.dumps({'results_json': results_json, 'result_scenario_id': result_scenario_id}))


class RasterOutputsView(STSimBaseView):

    raster_types = ['veg', 'sc']

    def __init__(self):
        self.type = None
        self.timestep = None
        self.iteration = None
        super(RasterOutputsView, self).__init__()

    def dispatch(self, request, *args, **kwargs):
        self.type = kwargs.get('data_type')
        if self.type not in self.raster_types:
            raise ValueError(self.type + ' is not a valid data type. Types are ' + str(self.raster_types) + '.')
        self.timestep = int(kwargs.get('timestep'))
        self.iteration = int(kwargs.get('iteration'))
        return super(STSimBaseView, self).dispatch(request, *args, **kwargs)

    def get(self, request, *args, **kwargs):

        # TODO - construct a path to the actual directory serving the output tifs from STSim
        image_directory = os.path.join(settings.STSIM_WORKING_DIR, 'initial_conditions', 'spatial')
        if self.type == 'veg':
            image_path = os.path.join(image_directory, 'veg.png')          # TODO - replace with the selected area of interest
        elif self.timestep == 0 and self.iteration == 0:
            image_path = os.path.join(image_directory, 'stateclass_0_0.png')   # TODO - ^^
        else:
            image_path = os.path.join(self.stsim.lib + '.output', 'Scenario-'+str(self.scenario_id),
                                      'Spatial', 'stateclass_{iteration}_{timestep}.png'.format(iteration=self.iteration,
                                                                                                timestep=self.timestep))

        response = HttpResponse(content_type="image/png")
        image = Image.open(image_path)
        image.save(response, 'PNG')
        return response
