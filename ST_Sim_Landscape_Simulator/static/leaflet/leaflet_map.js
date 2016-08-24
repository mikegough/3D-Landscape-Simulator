var map = L.map('map', {
        zoomControl: false
    }
).setView([39,-113], 5);

total_area=500000

L.control.zoom({
     position:'topright'
}).addTo(map);

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
})

map.addControl(drawButtons)

map.on('draw:created', function (e) {

    if (typeof drawn_layer != "undefined" && map.hasLayer(drawn_layer)){
        map.removeLayer(drawn_layer)
    }

    drawn_layer = e.layer;

    var type = e.layerType;
    drawnItems.addLayer(e.layer);

    //drawn_wkt=toWKT(layer);
    var bottom = e.layer._bounds._southWest.lat
    var top = e.layer._bounds._northEast.lat
    var left = e.layer._bounds._southWest.lng
    var right = e.layer._bounds._northEast.lng

    extent=[top,bottom,right,left]
    landscape_viewer.updateTerrain(extent, true)  // also updates the vegetation to the user-specified conditions

    feature_id="User Defined Area"

    show_input_options(feature_id)

})

//END USER DEFINED AREA FUNCTIONS

var OpenStreetMap=L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', { attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a>' }).addTo(map);

var counties = L.geoJson(sagebrush_counties, {
    clickable:true
}).addTo(map);

counties.on('click', function (e) {
    var bottom = e.layer._bounds._southWest.lat
    var top = e.layer._bounds._northEast.lat
    var left = e.layer._bounds._southWest.lng
    var right = e.layer._bounds._northEast.lng
    feature_id = e.layer.feature.properties.NAME
    console.log(e.layer)

    extent=[top,bottom,right,left]
    landscape_viewer.updateTerrain(extent, true)  // also updates the vegetation to the user-specified conditions

    var user_wkt = "POINT(" + e.latlng.lng + " " + e.latlng.lat + ")";

    show_input_options(feature_id)

});
