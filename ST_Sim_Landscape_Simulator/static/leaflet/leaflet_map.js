var map = L.map('map', {
        zoomControl: false
    }
).setView([39,-113], 5);

// BEGIN MAP CONTROLS
var feature_id;

// Info control in upper right
var info = L.control();

info.onAdd = function (map) {
    this._div = L.DomUtil.create('div', 'info');
    this.update();
    return this._div;
};

info.update = function (props) {
    this._div.innerHTML = '<h4>Reporting Unit Name</h4>' +  (props ?
        '<b>' + props.NAME
            : 'Hover over a reporting unit');
};

info.addTo(map);

// Basemaps
topographic=L.esri.basemapLayer("Topographic").addTo(map);
imagery=L.esri.basemapLayer("Imagery")
usa_topo=L.esri.basemapLayer("USATopo")
national_geographic=L.esri.basemapLayer("NationalGeographic")


var groupedOverlays = {
    "Base Maps": {
        'Topographic': topographic,
        'USA Topo': usa_topo,
        'National Geographic': national_geographic,
        'Imagery': imagery,
    },
    "Reference Layers": {
    }
};

var options = { exclusiveGroups: ["Reporting Units","Base Maps"]};
L.control.groupedLayers("", groupedOverlays, options).addTo(map);

// Zoom control
L.control.zoom({
    position:'topright'
}).addTo(map);

// END MAP CONTROLS

// BEGIN LAYERS AND LAYER FUNCTIONS

var default_style = {
    "color": "#3D8DFF",
    "weight": 2,
    "opacity": 0.65,
    "fillOpacity":.15
};

var watersheds = L.geoJson(sagebrush_watersheds, {
    clickable:true,
    style:default_style,
    onEachFeature: onEachFeature
}).addTo(map);

var counties = L.geoJson(sagebrush_counties, {
    clickable:true,
    style:default_style,
    onEachFeature: onEachFeature
});

var reporting_units = {
    "Watersheds": watersheds,
    "Counties": counties,
};

var active_reporting_units = watersheds;

map.on('baselayerchange', function (event) {
    active_reporting_units = event.layer;
});

layer_control = L.control.layers(reporting_units, "", {collapsed:false, position:'topleft', width:'300px'} ).addTo(map)

var selected_feature_style = {
        weight: 5,
        dashArray: '',
        fillColor:'#5BDAFF',
        fillOpacity: 0.8
    };

function onEachFeature(feature, layer) {
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: selectFeature
    });
}

function highlightFeature(e) {
    var layer = e.target;

    layer.setStyle(selected_feature_style);

    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
        layer.bringToFront();
    }

    info.update(layer.feature.properties);
}

function resetHighlight(e) {
    active_reporting_units.resetStyle(e.target);

    if (typeof selected_feature != "undefined") {
        selected_feature.setStyle(selected_feature_style);
        info.update(selected_feature.feature.properties);
    } else {
        info.update();
    }
}
var libraries = [];
function selectFeature(e) {


    if (typeof drawn_layer != "undefined" && map.hasLayer(drawn_layer)){
        map.removeLayer(drawn_layer)
    }

    // Reset styling on the entire layer in order to "de-select" the previous selected feature
    active_reporting_units.eachLayer(function(l){active_reporting_units.resetStyle(l);});

    selected_feature=e.target;
    selected_feature.setStyle(selected_feature_style);

    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
        selected_feature.bringToFront();
    }

    feature_id = selected_feature.feature.properties.NAME;
    libraries = selected_feature.feature.properties.LIBRARIES;

    var unit_id = selected_feature.feature.properties.ID;

    if (libraries.indexOf(current_library) == -1) {
        library_initialized = false;
    }

    // setup the library dropdown
    $('#ss1').empty();
    $('#ss1').append('<select id="settings_library"></select>');
    for (var i = 0; i < libraries.length; i++) {
        var lib = libraries[i];
        var selected = "";
        if (lib == 'Landfire') selected = " selected";  // Our default library.
        $('#settings_library').append("<option value='" + lib + "'" + selected +">" + lib +"</option>");
    }
    $("#settings_library").selectBoxIt();
    selection_state = 'tiles';
    setupReportingUnit(unit_id);

}

// END LAYERS AND LAYER FUNCTIONS
// ******************************** //
//BEGIN USER DEFINED AREA FUNCTIONS
drawnItems = L.featureGroup().addTo(map);

var drawButtons = new L.Control.Draw({
    /*edit: { featureGroup: drawnItems },*/
    draw: {
        polyline: false,
        circle: false,
        marker: false,
        polygon: false,
        /*
         polygon: {
         shapeOptions: {
         color:"#00FFFF",
         opacity:.6
         },
         },
         */
        rectangle: {
            shapeOptions: {
                color:"#00FFFF",
                opacity:.6
            }
        },
        showArea:true,
    },
});

map.addControl(drawButtons);

map.on('draw:created', function (e) {

    // Reset styling on the entire layer in order to "de-select" the previous selected feature
    active_reporting_units.eachLayer(function(l){active_reporting_units.resetStyle(l);});

    // Prevents mouseover function from keeping the selected feature highlighted
    delete selected_feature;

    if (typeof drawn_layer != "undefined" && map.hasLayer(drawn_layer)){
        map.removeLayer(drawn_layer)
    }

    drawn_layer = e.layer;

    var type = e.layerType;
    drawnItems.addLayer(e.layer);

    var bottom = e.layer._bounds._southWest.lat;
    var top = e.layer._bounds._northEast.lat;
    var left = e.layer._bounds._southWest.lng;
    var right = e.layer._bounds._northEast.lng;
    var extent = [left, bottom, right, top];
    feature_id="User Defined Area";

    selection_state = 'user_defined';
    setupUserDefinedArea(extent);
});

//END USER DEFINED AREA FUNCTIONS
