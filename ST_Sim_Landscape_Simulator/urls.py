from django.conf.urls import url, include
from ST_Sim_Landscape_Simulator.views import HomepageView, STSimRunnerView, STSimRunModelView, STSimRastersView, STSimDefinitionsView
from django.views.decorators.csrf import csrf_exempt


urlpatterns = [
    # Home
    url(r'^$', HomepageView.as_view(), name='home'),

    # TODO - Add CSRF tokens to the index page and include those with the AJAX posts
    # ST-Sim Model Runners
    url(r'^run_st_sim/(?P<scenario_id>\d+)$', csrf_exempt(STSimRunnerView.as_view()), name='run_st_sim'),
    url(r'^spatial/', include([
        url(r'^run_st_sim/(?P<project_id>\d+)/(?P<scenario_id>\d+)/$', csrf_exempt(STSimRunModelView.as_view()), name='spatial_run_st_sim'),
        url(r'^outputs/(?P<project_id>\d+)/(?P<scenario_id>\d+)/(?P<data_type>[a-z]+)/(?P<timestep>\d+)/$', STSimRastersView.as_view()),
        url(r'^stats/(?P<project_id>\d+)/(?P<scenario_id>\d+)/(?P<data_type>[a-z]+)/$', STSimDefinitionsView.as_view())
    ]))
]
