from celery import shared_task
from .models import STSimModelRun
from Sagebrush.stsim_utils import stsim_manager


@shared_task
def run_stsim(library, model_run_id, scenario_id):

    #print(x+y)
    #r_sid = console.run_model(scenario_id)
    console = stsim_manager.consoles[library]
    print(console)
    r_sid = 1234    # test_values
    model_run = STSimModelRun.objects.get(pk=model_run_id)
    model_run.result_scenario_id = r_sid
    model_run.save()
    #print('Celery task complete')
