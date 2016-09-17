from django.conf.urls import url
from ST_Sim_Landscape_Simulator.views import HomepageView, RunModelView, RastersView, DefinitionsView,\
    LibraryInfoView, LookupView
from django.views.decorators.csrf import csrf_exempt

# TODO - Add CSRF tokens to the index page and include those with the AJAX posts

urlpatterns = [
    url(r'^$', HomepageView.as_view(), name='home'),
    url(r'^library/(?P<library>[\w ]+)/$', LibraryInfoView.as_view()),
    url(r'^run_st_sim/(?P<library>[\w ]+)/$', csrf_exempt(RunModelView.as_view())),
    url(r'^outputs/(?P<library>[\w ]+)/(?P<data_type>[a-z]+)/(?P<iteration>\d+)/(?P<timestep>\d+)/$', RastersView.as_view()),
    url(r'^stats/(?P<library>[\w ]+)/(?P<data_type>[a-z]+)/$', DefinitionsView.as_view()),
    url(r'^lookup/(?P<library>[\w ]+)/(?P<lookup_field>[\w ]+)/$', LookupView.as_view()),
]
