from django.conf.urls import url, include
from ST_Sim_Landscape_Simulator.views import HomepageView, RunModelView, RastersView, \
    LibraryInfoView, LookupView, RasterSelectionView, RasterTextureView, RasterTextureStats
from django.views.decorators.csrf import csrf_exempt

bounds_regex = r'(?P<left>\-\d+\.\d+)/(?P<bottom>\d+\.\d+)/(?P<right>\-\d+\.\d+)/(?P<top>\d+\.\d+)'
# TODO - Add CSRF tokens to the index page and include those with the AJAX posts

urlpatterns = [
    url(r'^$', HomepageView.as_view(), name='home'),
    url(r'^(?P<library>[\w ]+)/', include([
        url(r'^info/$', LibraryInfoView.as_view()),
        url(r'^run_st_sim/$', csrf_exempt(RunModelView.as_view())),
        url(r'^outputs/(?P<scenario_id>\d+)/(?P<data_type>[a-z]+)/(?P<iteration>\d+)/(?P<timestep>\d+)/$',
            RastersView.as_view()),
        url(r'^select/' + bounds_regex + '/', include([
            url(r'^$', RasterSelectionView.as_view()),
            url(r'^(?P<type>[a-z]+)/$', RasterTextureView.as_view()),
            url(r'^(?P<type>[a-z]+)/stats/$', RasterTextureStats.as_view())
        ]))
    ])),
]
