from django.conf.urls import url, include
from ST_Sim_Landscape_Simulator.views import HomepageView, STSimRunModelView, STSimRastersView, STSimDefinitionsView, STSimLibraryInfoView
from django.views.decorators.csrf import csrf_exempt

# TODO - Add CSRF tokens to the index page and include those with the AJAX posts

# TODO - replace project id and scenario id with console name (e.x. 'Castle Creek', 'Landfire', etc.)

urlpatterns = [
    url(r'^$', HomepageView.as_view(), name='home'),
    url(r'^library/(?P<library>[\w ]+)/$', STSimLibraryInfoView.as_view()),
    url(r'^run_st_sim/(?P<library>[\w ]+)/$', csrf_exempt(STSimRunModelView.as_view()),
        name='spatial_run_st_sim'),
    url(r'^outputs/(?P<library>[\w ]+)/(?P<data_type>[a-z]+)/(?P<timestep>\d+)/$',
        STSimRastersView.as_view()),
    url(r'^stats/(?P<library>[\w ]+)/(?P<data_type>[a-z]+)/$', STSimDefinitionsView.as_view()),
]
