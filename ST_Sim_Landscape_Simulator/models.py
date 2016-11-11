from django.db import models

# Create your models here.

class STSimModelRun(models.Model):

    scenario_id = models.IntegerField()
    result_scenario_id = models.IntegerField(default=-1)


