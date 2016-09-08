import os
import json
import time
from django.views.generic import TemplateView, View
from django.conf import settings
from json import encoder
from django.http import HttpResponse, JsonResponse
from stsimpy import STSimConsole
from PIL import Image
from OutputProcessing import texture_utils

# Two decimal places when dumping to JSON
encoder.FLOAT_REPR = lambda o: format(o, '.2f')

# Declare the stsim console we want to work with
stsim = STSimConsole(lib_path=settings.ST_SIM_WORKING_LIB,
                     orig_lib_path=settings.ST_SIM_ORIG_LIB,
                     exe=settings.ST_SIM_EXE)

default_run_control_path = os.path.join(settings.ST_SIM_WORKING_DIR, 'run_control', 'run_ctrl.csv')

# Defaults for this library. Run once and hold in memory.
default_sid = stsim.list_scenarios()[0]
default_sc_path = os.path.join(settings.ST_SIM_WORKING_DIR, 'state_classes', 'state_classes.csv')
default_transitions_path = os.path.join(settings.ST_SIM_WORKING_DIR,
                                        'probabilistic_transitions', 'original', 'prob_trans.csv')
all_veg_state_classes = stsim.export_veg_state_classes(default_sid,
                                                       state_class_path=default_sc_path)
all_transition_types = stsim.export_probabilistic_transitions_types(default_sid,
                                                                    transitions_path=default_transitions_path)
all_scenario_names = stsim.list_scenario_names(orig=True)


class HomepageView(TemplateView):

    template_name = 'index.html'

    def get_context_data(self, **kwargs):
        context = super(HomepageView, self).get_context_data(**kwargs)

        # veg state classes
        context['veg_type_state_classes_json'] = json.dumps(all_veg_state_classes)

        # our probabilistic transition types for this application
        probabilistic_transition_types = ["Replacement Fire",
                                          "Annual Grass Invasion",
                                          "Insect/Disease",
                                          "Native Grazing",
                                          "Excessive-Herbivory"]

        if not all(value in all_transition_types for value in probabilistic_transition_types):
            raise KeyError("Invalid transition type specified for this library. Supplied values: " +
                           str([value for value in probabilistic_transition_types]))

        probabilistic_transition_dict = {value: 0 for value in probabilistic_transition_types}
        context['probabilistic_transitions_json'] = json.dumps(probabilistic_transition_dict)

        # scenario ids
        spatial_sids = [scenario for scenario in all_scenario_names if 'Spatial' in scenario['name']]
        nonspatial_sids = [scenario for scenario in all_scenario_names if 'Spatial' not in scenario['name']]

        context['scenarios_json'] = json.dumps({
            'spatial': spatial_sids,
            'nonspatial': nonspatial_sids
        })

        return context


class STSimBaseView(View):

    def __init__(self):
        self.project_id = None
        self.scenario_id = None
        super(STSimBaseView, self).__init__()

    def dispatch(self, request, *args, **kwargs):
        self.project_id = kwargs.get('project_id')
        self.scenario_id = kwargs.get('scenario_id')
        return super().dispatch(request, *args, **kwargs)


class STSimRunModelView(STSimBaseView):

    def post(self, request, *args, **kwargs):

        step = int(request.POST['step_size'])
        min_step = int(request.POST['min_step'])
        max_step = int(request.POST['max_step'])
        iterations = int(request.POST['iterations'])
        is_spatial = json.loads(request.POST['spatial'])
        stateclass_relative_distribution = json.loads(request.POST['veg_slider_values_state_class'])
        probabilistic_transitions_modifiers = json.loads(request.POST['probabilistic_transitions_slider_values'])

        # working file path
        init_conditions_file = os.path.join(settings.ST_SIM_WORKING_DIR,
                                            "initial_conditions",
                                            "user_defined_temp" + str(time.time()) + ".csv")

        # set the run control for the spatial model
        stsim.update_run_control(
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
            stsim.import_nonspatial_distribution(sid=self.scenario_id,
                                                 values_dict=stateclass_relative_distribution,
                                                 working_path=init_conditions_file)

        # update the output options for the step size
        stsim.set_output_options(self.scenario_id, init_conditions_file, **output_settings)

        # probabilistic transition probabilities
        probabilities = stsim.export_probabilistic_transitions_map(
            sid=default_sid,
            transitions_path=init_conditions_file,
            orig=True)

        # if the values are modified by the user, adjust them and pass them to ST-Sim working library
        if probabilistic_transitions_modifiers is not None and len(probabilistic_transitions_modifiers.keys()) > 0:
            for veg_type in probabilities.keys():
                for state_class in probabilities[veg_type]:
                    transition_type = state_class['type']
                    if transition_type in probabilistic_transitions_modifiers.keys():
                        value = probabilistic_transitions_modifiers[transition_type]
                        state_class['probability'] += value

        stsim.import_probabilistic_transitions(sid=self.scenario_id,
                                               values_dict=probabilities,
                                               working_path=init_conditions_file)

        # run spatial stsim model at self.scenario_id and return the result scenario id
        result_scenario_id = stsim.run_model(sid=self.scenario_id)

        if is_spatial:
            # process each output raster in the output directory
            stateclass_definitions = stsim.export_stateclass_definitions(
                pid=self.project_id,
                working_path=default_sc_path,
                orig=True
            )
            texture_utils.process_stateclass_directory(
                dir_path=os.path.join(stsim.lib + '.output', 'Scenario-'+str(result_scenario_id), 'Spatial'),
                sc_defs=stateclass_definitions
            )

        # collect the summary statistics and return to the user
        report_file = os.path.join(settings.ST_SIM_WORKING_DIR, "model_results",
                                   "stateclass-summary-" + str(result_scenario_id) + ".csv")

        if os.path.exists(report_file):
            os.remove(report_file)

        # Return the completed spatial run id, and use that ID for obtaining the resulting output timesteps' rasters
        results_json = json.dumps(stsim.export_stateclass_summary(sid=result_scenario_id,
                                                                  report_path=report_file))
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


class STSimDefinitionsView(STSimDataViewBase):

    def get(self, request, *args, **kwargs):

        data = dict()
        if self.data_type == 'veg':

            data = stsim.export_vegtype_definitions(
                pid=self.project_id,
                working_path=default_sc_path,
                orig=True)

        elif self.data_type == 'stateclass':

            data = stsim.export_stateclass_definitions(
                pid=self.project_id,
                working_path=default_sc_path,
                orig=True)

        return JsonResponse({
            'data': {name: data[name]['ID'] for name in data.keys()}
            })


class STSimRastersView(STSimDataViewBase):

    def __init__(self):
        self.timestep = None
        super(STSimRastersView, self).__init__()

    def dispatch(self, request, *args, **kwargs):

        self.timestep = kwargs.get('timestep')
        return super(STSimRastersView, self).dispatch(request, *args, **kwargs)

    def get(self, request, *args, **kwargs):

        # TODO - construct a path to the actual directory serving the output tifs from STSim
        image_directory = os.path.join(settings.ST_SIM_WORKING_DIR, 'initial_conditions', 'spatial')
        if self.data_type == 'veg':
            image_path = os.path.join(image_directory, 'veg.png')          # TODO - replace with the selected area of interest
        elif self.timestep == 0 or self.timestep == '0':
            image_path = os.path.join(image_directory, 'stateclass_0.png')   # TODO - ^^
        else:
            image_path = os.path.join(stsim.lib + '.output', 'Scenario-'+str(self.scenario_id),
                                      'Spatial', 'stateclass_{timestep}.png'.format(timestep=self.timestep))

        response = HttpResponse(content_type="image/png")
        image = Image.open(image_path)
        image.save(response, 'PNG')
        return response
