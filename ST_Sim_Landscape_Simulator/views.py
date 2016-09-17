import os
import json
import time
from django.views.generic import TemplateView, View
from django.conf import settings
from json import encoder
from django.http import HttpResponse, JsonResponse
from PIL import Image
from OutputProcessing import texture_utils
from OutputProcessing.lookups import plugins as lookup_plugins
from Sagebrush.stsim_utils import stsim_manager

# Two decimal places when dumping to JSON
encoder.FLOAT_REPR = lambda o: format(o, '.2f')


class HomepageView(TemplateView):

    template_name = 'index.html'

    def get_context_data(self, **kwargs):
        context = super(HomepageView, self).get_context_data(**kwargs)
        context['available_libraries'] = json.dumps(list(stsim_manager.library_names))
        return context


class STSimBaseView(View):

    def __init__(self):
        self.library = None
        self.stsim = None
        self.project_id = None
        self.scenario_id = None
        super(STSimBaseView, self).__init__()

    def dispatch(self, request, *args, **kwargs):
        self.library = kwargs.get('library')
        self.stsim = stsim_manager.consoles[self.library]
        self.project_id = stsim_manager.pids[self.library]
        self.scenario_id = stsim_manager.sids[self.library]
        return super().dispatch(request, *args, **kwargs)


class LookupView(STSimBaseView):

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
            lookup_function = getattr(lookup_plugins, stsim_manager.lookup_functions[self.library])
            data = lookup_function(input_codes, self.lookup_field)
        else:
            data = self.library + ' has no lookup field ' + self.lookup_field
        return JsonResponse({'data': data})


class LibraryInfoView(STSimBaseView):

    def get(self, request, *args, **kwargs):

        response = dict()

        # veg state classes
        response['veg_type_state_classes_json'] = stsim_manager.all_veg_state_classes[self.library]

        # our probabilistic transition types for this application
        probabilistic_transition_types = stsim_manager.probabilistic_transition_types[self.library]

        if not all(value in stsim_manager.all_probabilistic_transition_types[self.library]
                   for value in probabilistic_transition_types):
            raise KeyError("Invalid transition type specified for this library. Supplied values: " +
                           str([value for value in probabilistic_transition_types]))

        probabilistic_transition_dict = {value: 0 for value in probabilistic_transition_types}
        response['probabilistic_transitions_json'] = probabilistic_transition_dict
        response['veg_model_config'] = stsim_manager.veg_model_configs[self.library]

        return JsonResponse({self.library: response})


class RunModelView(STSimBaseView):

    def post(self, request, *args, **kwargs):

        step = int(request.POST['step_size'])
        min_step = int(request.POST['min_step'])
        max_step = int(request.POST['max_step'])
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

        # run spatial stsim model at self.scenario_id and return the result scenario id
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


class STSimDataViewBase(STSimBaseView):

    DATA_TYPES = ['veg', 'stateclass']

    def __init__(self):
        self.data_type = None
        super(STSimDataViewBase, self).__init__()

    def dispatch(self, request, *args, **kwargs):
        self.data_type = kwargs.get('data_type')
        if self.data_type not in self.DATA_TYPES:
            raise ValueError(self.data_type + ' is not a valid data type. Types are "veg" or "stateclass".')
        return super(STSimDataViewBase, self).dispatch(request, *args, **kwargs)


class DefinitionsView(STSimDataViewBase):

    def get(self, request, *args, **kwargs):
        request.session['blah'] = 2
        data = dict()
        if self.data_type == 'veg':

            data = stsim_manager.vegtype_definitions[self.library]

        elif self.data_type == 'stateclass':

            data = stsim_manager.stateclass_definitions[self.library]

        return JsonResponse({
            'data': {name: data[name]['ID'] for name in data.keys()}
            })


class RastersView(STSimDataViewBase):

    def __init__(self):
        self.timestep = None
        self.iteration = None
        super(RastersView, self).__init__()

    def dispatch(self, request, *args, **kwargs):

        self.timestep = int(kwargs.get('timestep'))
        self.iteration = int(kwargs.get('iteration'))
        return super(RastersView, self).dispatch(request, *args, **kwargs)

    def get(self, request, *args, **kwargs):

        # TODO - construct a path to the actual directory serving the output tifs from STSim
        image_directory = os.path.join(settings.STSIM_WORKING_DIR, 'initial_conditions', 'spatial')
        if self.data_type == 'veg':
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
