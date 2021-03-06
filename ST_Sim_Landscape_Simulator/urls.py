from django.conf.urls import url, include
from ST_Sim_Landscape_Simulator.views import *
from django.views.decorators.csrf import csrf_exempt


urlpatterns = [
    # Homepage view
    url(r'^$', HomepageView.as_view(), name='home'),

    # Base library
    url(r'^(?P<library>[\w ]+)/', include([
        url(r'^info/$', LibraryInfoView.as_view()),
        url(r'^lookup/(?P<lookup_field>[\w ]+)/$', LookupView.as_view()),
        url(r'^run_st_sim/(?P<uuid>predefined-extent|[a-f0-9]{8}-?[a-f0-9]{4}-?4[a-f0-9]{3}-?[89ab][a-f0-9]{3}-?[a-f0-9]{12})/$', csrf_exempt(RunModelView.as_view())),
        url(r'^run_st_sim/(?P<uuid>predefined-extent|[a-f0-9]{8}-?[a-f0-9]{4}-?4[a-f0-9]{3}-?[89ab][a-f0-9]{3}-?[a-f0-9]{12})/done/$', RunModelStatusView.as_view()),
        url(r'^outputs/(?P<scenario_id>\d+)/(?P<type>[a-z]+)/(?P<iteration>\d+)/(?P<timestep>\d+)/$',
            RasterOutputsView.as_view()),
        url(r'^select/', include([
            url(r'^(?P<left>\-\d+\.\d+)/(?P<bottom>\d+\.\d+)/(?P<right>\-\d+\.\d+)/(?P<top>\d+\.\d+)/$',
                RasterSelectionView.as_view()),
            url(r'^(?P<uuid>predefined-extent|[a-f0-9]{8}-?[a-f0-9]{4}-?4[a-f0-9]{3}-?[89ab][a-f0-9]{3}-?[a-f0-9]{12})/',
                include([
                    url(r'^(?P<type>veg|sc|elev)/$', RasterTextureView.as_view()),
                    url(r'^stats/$', RasterTextureStats.as_view())
                ])),
            url(r'^(?P<reporting_unit>[a-zA-Z]+)/(?P<unit_id>[0-9]+)/', include([
                url(r'^(?P<type>[a-z]+)/(?P<x>[0-9]+)/(?P<y>[0-9]+)/$', RasterTileView.as_view()),
                url(r'^stats/$', RasterTileStats.as_view())
            ]))
        ]))
    ])),
]
