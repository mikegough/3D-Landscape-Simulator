$(document).ready(function() {
    $(".current_slider_setting").val(0);

    $(".scenario_radio_label").hover(function(e) {
        var moveLeft = 50;
        var moveDown = -20;
        $(this).css("background-color", "#DBDBDB");
        $("div#pop-up").css("width", "280");
        $("div#pop-up").html(this.id);
        $('div#pop-up').show();

        $('.scenario_radio_label').mousemove(function(e) {
          $("div#pop-up").css('top', e.pageY + moveDown).css('left', e.pageX + moveLeft);
        });

      //On mouse out
    },function(e){
            $('div#pop-up').hide()
            $(this).css("background-color", "white");
        }
    );
});

$('.scenario_radio_label').mousemove(function(e) {
    $("div#pop-up").css('top', e.pageY + moveDown).css('left', e.pageX + moveLeft);
});

// Get initial conditions out of CSV file
function load_initial_conditions(feature_id){
     $.ajax({
        type: "GET",
        url: "static/st_sim/initial_conditions/" + feature_id + ".csv",
        dataType: "text",
        success: function(data) {
            process_initial_conditions(data);
        }
     });

    $("#input_initial_veg").show()
    $("#input_management_scenario").show()
    $("#run_button").show()
}

// Process initial conditions data. Write to initial conditions table.
function process_initial_conditions(initial_conditions_data_json) {
    $("#selected_features").html("Currently Selected: " + feature_id)
    /*
    $("#initial_conditions").empty()
    $("#initial_conditions_table").empty()
    $("#initial_conditions_table").append("<tr><th colspan='3'>County: " + feature_id + "</th></tr>");
    $("#initial_conditions_table").append("<tr><td class='sub_th' colspan='3'>Initial Conditions</td></tr>");
    initial_conditions_data_lines = initial_conditions_data.split(/\r\n|\n/);
    var headers = initial_conditions_data_lines[0].split(',');
    var lines = [];
    initial_conditions_data_json={}
    for (var i = 1; i < initial_conditions_data_lines.length -1; i++) {
        var data = initial_conditions_data_lines[i].split(',');
        if (typeof data[0] != "undefined") {
            initial_conditions_data_json[data[0]]=parseFloat(data[2])
            $('#initial_conditions_table').append('<tr><td>' + data[0] + '</td><td>' + data[2] + '%</td></tr>');
        }
    }
    */

    createWebGL(initial_conditions_data_json, extent)
}

// Send the scenario and initial conditions to ST-Sim.
function run_st_sim(feature_id) {
    //$("#results_table").empty()
    $("#output").show()
    $("#results_loading").html("<img src='"+static_url + "img/spinner.gif'>")
    var scenario=$("input[name=scenario]:checked").val()
    veg_slider_values_string=JSON.stringify(veg_slider_values)
    $.ajax({
        url: "", // the endpoint (for a specific view configured in urls.conf /view_name/)
        type: "POST", // http method
        //data: {'scenario': scenario, 'feature_id': feature_id},
        data: {'scenario': scenario, 'veg_slider_values':veg_slider_values_string},

        // handle a successful response
        success: function (json) {
            $("#results_loading").empty()
            var response = JSON.parse(json)
            var results_data_json = JSON.parse(response["results_json"])
            var scenario_label = $("input:checked + label").text();
            if (typeof previous_feature_id == "undefined" || previous_feature_id != feature_id) {
                $("#results_table").append("<tr><th colspan='3'>County: " + feature_id + "</th></tr>");
            }
            $("#results_table").append("<tr><td class='sub_th' colspan='3'>Scenario: " + scenario_label + "</td></tr>");
            $.each(results_data_json, function(key,value) {
                //console.log(key + ": " + value);
                $("results_table").find("tr:gt(0)").remove();
                $('#results_table').append('<tr><td>' + key + '</td><td>' + value + '%</td></tr>');
            });

            $("#running_st_sim").html("ST-Sim Model Results")

            createWebGL(results_data_json)
            previous_feature_id=feature_id

        },

        // handle a non-successful response
        error : function(xhr,errmsg,err) {
            $('#results').html("<div class='alert-box alert radius' data-alert>Oops! We have encountered an error: "+errmsg+
                " <a href='#' class='close'>&times;</a></div>");
            console.log(xhr.status + ": " + xhr.responseText);
        }
    });
}

function createWebGL(json_data,extent){
    console.log(json_data,extent)
}

/*************************************************** Slider bars  ****************************************************/

//initialize default values. Change the default labels above as well.
var enable_environment_settings=false
var veg1_slider=0
var veg2_slider=0
var veg3_slider=0
var veg4_slider=0
var veg5_slider=0
var veg6_slider=0
var veg7_slider=0

var total_input_percent=0

var veg_slider_values={}

$(function() {
    $( "#veg1_slider" ).slider({
      range: "min",
      value: veg1_slider,
      min: 0,
      max: 100,
      step:1,
      slide: function( event, ui ) {
          veg_slider_values["Basin Big Sagebrush Upland"]=ui.value
          $( "#veg1_label" ).val( ui.value + "%");
          $( "#total_input_percent").html(total_input_percent + ui.value + "%");
          total_percent_action(total_input_percent + ui.value)
      },
      start:function(event, ui){
            total_input_percent=total_input_percent-ui.value
      },
      stop:function(event, ui){
            total_input_percent=total_input_percent+ui.value
      }
    });
});

$(function() {
  $( "#veg2_slider" ).slider({
      range: "min",
      value: veg2_slider,
      min: 0,
      max: 100,
      step:1,
      slide: function( event, ui ) {
          veg_slider_values["Curleaf Mountain Mahogany"]=ui.value
          $( "#veg2_label" ).val( ui.value + "%");
          $( "#total_input_percent").html(total_input_percent + ui.value + "%");
          total_percent_action(total_input_percent + ui.value)
      },
      start:function(event, ui){
          total_input_percent=total_input_percent-ui.value
      },
      stop:function(event, ui){
          total_input_percent=total_input_percent+ui.value
      }
  });
});

$(function() {
    $( "#veg3_slider" ).slider({
        range: "min",
        value: veg3_slider,
        min: 0,
        max: 100,
        step:1,
        slide: function( event, ui ) {
            veg_slider_values["Low Sagebrush"]=ui.value
            $( "#veg3_label" ).val( ui.value + "%");
            $( "#total_input_percent").html(total_input_percent + ui.value + "%");
            total_percent_action(total_input_percent + ui.value)
        },
        start:function(event, ui){
            total_input_percent=total_input_percent-ui.value
        },
        stop:function(event, ui){
            total_input_percent=total_input_percent+ui.value
        }
    });
});

$(function() {
    $( "#veg4_slider" ).slider({
        range: "min",
        value: veg4_slider,
        min: 0,
        max: 100,
        step:1,
        slide: function( event, ui ) {
            veg_slider_values["Montane Sagebrush Upland"]=ui.value
            $( "#veg4_label" ).val( ui.value + "%");
            $( "#total_input_percent").html(total_input_percent + ui.value + "%");
            total_percent_action(total_input_percent + ui.value)
        },
        start:function(event, ui){
            total_input_percent=total_input_percent-ui.value
        },
        stop:function(event, ui){
            total_input_percent=total_input_percent+ui.value
        }
    });
});

$(function() {
    $( "#veg5_slider" ).slider({
        range: "min",
        value: veg5_slider,
        min: 0,
        max: 100,
        step:1,
        slide: function( event, ui ) {
            veg_slider_values["Montane Sagebrush Upland With Trees"]=ui.value
            $( "#veg5_label" ).val( ui.value + "%");
            $( "#total_input_percent").html(total_input_percent + ui.value + "%");
            total_percent_action(total_input_percent + ui.value)
        },
        start:function(event, ui){
            total_input_percent=total_input_percent-ui.value
        },
        stop:function(event, ui){
            total_input_percent=total_input_percent+ui.value
        }
    });
});

$(function() {
    $( "#veg6_slider" ).slider({
        range: "min",
        value: veg6_slider,
        min: 0,
        max: 100,
        step:1,
        slide: function( event, ui ) {
            veg_slider_values["Western Juniper Woodland & Savannah"]=ui.value
            $( "#veg6_label" ).val( ui.value + "%");
            $( "#total_input_percent").html(total_input_percent + ui.value + "%");
            total_percent_action(total_input_percent + ui.value)
        },
    });
});

$(function() {
    $( "#veg7_slider" ).slider({
        range: "min",
        value: veg7_slider,
        min: 0,
        max: 100,
        step:1,
        slide: function( event, ui ) {
            veg_slider_values["Wyoming and Basin Big Sagebrush Upland"]=ui.value
            $( "#veg7_label" ).val( ui.value + "%");
            $( "#total_input_percent").html(total_input_percent + ui.value + "%");
            total_percent_action(total_input_percent + ui.value)
        },
    });
});

function total_percent_action(value){
    if (value > 100 ){
        $("#total_input_percent").css('background-color','#E47369')
    }
    else {
        $("#total_input_percent").css('background-color', 'white')
    }

}

