$(document).ready(function() {

    //$("select").selectBoxIt();

    // Tooltip popup on management scenarios
    $(".scenario_radio_label").hover(function(e) {
        var moveLeft = 50;
        var moveDown = -20;
        $("div#pop-up").html(this.id);
        $('div#pop-up').show();

       $('.scenario_radio_label').mousemove(function(e) {
              $("div#pop-up").css('top', e.pageY + moveDown).css('left', e.pageX + moveLeft);
            });

      // On mouse out
    },function(e){
            $('div#pop-up').hide();
            $(this).css("background-color", "white");
        }
    );

    // delegate the popup menus for any that occur on the page.
    function delegatedPopupContext(selector, element) {
        $(document).on('click', selector, function () {
            if ($(this).siblings(element).is(":visible")) {
                $(this).siblings(element).hide()
            }
            else {
                $(this).siblings(element).show()
            }
        });
    }

    delegatedPopupContext('.show_state_classes_link', '.sub_slider_text_inputs');
    delegatedPopupContext('.manage_div', '.management_action_inputs');

    // On state class value entry move slider bar
    //$(".veg_state_class_entry").keyup(function(){
    $(document).on('keyup', '.veg_state_class_entry', function() {
        veg_type_id=this.id.split("_")[1];
        veg_type=this.closest('table').title;

        //Subtract the current slider value from the total percent
        //total_input_percent=total_input_percent - veg_slider_values[veg_type]
        total_input_percent = total_input_percent - veg_slider_values[veg_type];

        veg_slider_values_state_class[veg_type]={};
        veg_state_class_value_totals=0.0;

        // On keyup, go through each state class in the given veg type and add the values in each text entry field to the veg_slider_values_state_class dictionary
        $.each(veg_type_state_classes_json[veg_type],function(index, state_class){
            var veg_state_class_id=index+1
            var veg_state_class_value=$("#veg_"+veg_type_id+"_"+veg_state_class_id).val()
            if (veg_state_class_value == ''){
                veg_state_class_value = 0;
            }
            veg_state_class_value_totals+=parseFloat(veg_state_class_value)
            veg_slider_values_state_class[veg_type][state_class]=veg_state_class_value

        })

        // To avoid initialization error
        if ($("#veg" + veg_type_id + "_slider").slider()) {
            $("#veg" + veg_type_id + "_slider").slider("value", veg_state_class_value_totals)
            var this_veg_slider_value=$("#veg" + veg_type_id  + "_slider").slider("option", "value");
            veg_slider_values[veg_type]=this_veg_slider_value
        }

        //Add the current slider value from the total percent
        //total_input_percent=total_input_percent + veg_slider_values[veg_type]
        //total_input_percent = total_input_percent + $("#veg" + veg_type_id + "_slider").slider("option", "value");

        total_input_percent = total_input_percent + veg_slider_values[veg_type];

        if (veg_state_class_value_totals > 100){

            $("#total_input_percent").html(">100%");
            total_percent_action(9999)

        }

        else {

            $("#total_input_percent").html(total_input_percent.toFixed(0) + "%");
            total_percent_action(total_input_percent.toFixed(0))

        }

    });

});


$(document).ajaxComplete(function() {
    $(".slider_bars").slider( "option", "disabled", false);
});

function show_input_options (){

    $("#selected_features").html("Location: " + feature_id);

    $("#selected_features").animate({backgroundColor: '#DBDBDB'}, 400, function() {
        $('#selected_features').animate({backgroundColor: 'white'}, 400);
    });

    $("#input_initial_veg").show();
    $("#general_settings").show();
    $("#input_probabilistic_transitions").show();
    $("#run_button").on("click", function(){
            run_st_sim(feature_id)
        }
    );

    $("#scene").show()
    $("#scene_legend").show()
    $("#map").hide()
    $("#button_list").css("visibility", "visible")
    $(".leaflet-draw-section").addClass("modified_leaflet_control_position")

    $("#step1").hide()
    $("#selected_features").show()
    $("#intro").hide()

    window.addEventListener('resize', landscape_viewer.resize, false);
    landscape_viewer.resize();

    $("#run_button").show();

    // Set the second tab (3D) to the selected tab.
    $("#map_button").removeClass("selected")
    $("#scene_button").addClass("selected")

}

run=0
iteration=1
timestep=0

// Send the scenario and initial conditions to ST-Sim.
settings=[]
settings["spatial"]=false

function run_st_sim(feature_id) {

    settings["library"]= $("#settings_library").val()
    settings["timesteps"]= $("#settings_timesteps").val()
    settings["iterations"]= $("#settings_iterations").val()
    settings["spatial"]= $("#spatial_button").hasClass('selected')

    $(document).ajaxStart(function(){
        $(".slider_bars").slider( "option", "disabled", true );
        $('input:submit').attr("disabled", true);
        $("#run_button").addClass('disabled');
        $("#run_button").val('Please Wait...');
        $("#run_button").addClass('please_wait');
        $("#running_st_sim").show()
    });
    //$("#results_table").empty()
    $("#output").show()
    $("#running_st_sim").html("Running ST-Sim...")
    $("#results_loading").html("<img src='/static/img/spinner.gif'>")


    var veg_slider_values_state_class_string = JSON.stringify(veg_slider_values_state_class)
    var probabilistic_transitions_slider_values_string = JSON.stringify(probabilistic_transitions_slider_values)

    $.ajax({
        url: settings['library'] + "/run_st_sim/" + current_uuid + '/', // the endpoint (for a specific view configured in urls.conf /view_name/)
        type: "POST", // http method
        data: {
            'veg_slider_values_state_class': veg_slider_values_state_class_string,
            'probabilistic_transitions_slider_values': probabilistic_transitions_slider_values_string,
            'timesteps': settings['timesteps'],
            'iterations': settings['iterations'],
            'spatial': settings['spatial']
        },

        // handle a successful response
        success: function (json) {
            $("#results_loading").empty()
            var response = JSON.parse(json)
            results_data_json = JSON.parse(response["results_json"])

            // Maximum of 4 model runs
            if (run == 4) {
                run = 1;
            }
            else {
                run += 1;
            }
            $("#column_charts_" + run).empty()
            $("#area_charts" + run).empty()

            $("#tab_container").css("display", "block")
            //update_results_table(timestep, run)
            update_results_table(run);
            previous_feature_id = feature_id

            create_area_charts(results_data_json, run)
            create_column_charts(results_data_json, run)

            document.getElementById("view" + run + "_link").click()

            var run_control = { // TODO - this should come from the back-end, for continuity
                'library': settings['library'],
                'min_step': 0,
                'max_step': settings['timesteps'],
                'step_size': 1,
                'iterations': settings['iterations'],
                'spatial': settings['spatial'],
                'result_scenario_id': JSON.parse(response["result_scenario_id"])
            };
            landscape_viewer.collectSpatialOutputs(run_control);
        },

        // handle a non-successful response
        error: function (xhr, errmsg, err) {
            $('#results').html("<div class='alert-box alert radius' data-alert>Oops! We have encountered an error: " + errmsg +
                " <a href='#' class='close'>&times;</a></div>");
            console.log(xhr.status + ": " + xhr.responseText);
        }
    });

    // Required here in order to disable button on page load.
    $(document).ajaxComplete(function() {
        $("#run_button").val('Run Model');
        $("#run_button").removeClass('disabled');
        $("#run_button").removeClass('please_wait');
        $('input:submit').attr("disabled", false);
        $('#button_container').attr("disabled", false);
    });


}

/****************************************  Results Table & Output Charts **********************************************/

//function update_results_table(timestep,run) { // see TODO below
function update_results_table(run) {

    // Create the Results Table
    $("#results_table_" + run).html("<tr class='location_tr'><td class='location_th' colspan='1'>Location </td><td colspan='2'>" + feature_id + "</td></tr>");

    $("#view"+run).append("<table id='selected_location_table_" + run + "' class='selected_location_table' ><tr></tr></table> <div id='area_charts_" + run +"' class='area_charts' style='display:none'></div><div id='column_charts_" + run +"' class='column_charts'> </div>")

    // Probabilistic Transitions Row
    if (typeof probabilistic_transitions_slider_values != "undefined") {
        var sum_probabilities=0

        $.each(probabilistic_transitions_slider_values, function (transition_type, probability) {
            sum_probabilities+=Math.abs(probability)
        });

        if (sum_probabilities != 0) {

            $("#results_table_" + run).append("<tr class='probabilistic_transitions_tr'><td class='probabilistic_transitions_th' id='probabalistic_transitions_th_" + run + "' colspan='2'>Disturbance Probabilities</td><td class='probabilistic_transitions_values_header'> <span class='show_disturbance_probabilities_link'> <span class='show_disturbance_probabilities_link_text'>Show</span> <img class='dropdown_arrows_disturbance' src='/static/img/down_arrow.png'></span></td></tr>");
            var sign;
            $.each(probabilistic_transitions_slider_values, function (transition_type, probability) {
                if (probability != 0) {

                    if (probability > 0) {
                        sign = "+"
                    }
                    else {
                        sign = ""
                    }
                    $("#results_table_" + run).append("<tr class='probabilistic_transitions_tr_values'><td class='probabilistic_transitions_values' id='probabilistic_transitions_values_" + run + "' colspan='3'>" + transition_type + ": " + sign + (probability * 100) + "%</td></tr>");

                }
            });
        }
        else {
            $("#results_table_" + run).append("<tr class='probabilistic_transitions_tr'><td class='probabilistic_transitions_th' id='probabalistic_transitions_th_" + run + "' colspan='2'>Disturbance Probabilities</td><td class='probabilistic_transitions_values_header'>Defaults</td></tr>");
        }
    }

    // Chart Type row
    $("#results_table_" + run).append("<tr class='chart_type_tr'>" +
        "<td class='chart_type_th' colspan='1'>Chart Type</td>" +
        "<td class='selected_td_button' id='column_chart_td_button_" + run + "'>Column</td>" +
        "<td class='unselected_td_button' id='stacked_area_chart_td_button_" + run + "'>Area</td>" +
        "</td>");


    // Chart button click functions
    $("#column_chart_td_button_" + run).click(function(){
        $(this).removeClass("unselected_td_button")
        $(this).addClass("selected_td_button")
        $("#stacked_area_chart_td_button_" + run).addClass("unselected_td_button")
        $("#stacked_area_chart_td_button_" + run).removeClass("selected_td_button")
        $(this).addClass("selected_td_button")
        $("#column_charts_" + run).show()
        $("#iteration_tr_" + run ).hide()
        $("#area_charts_" + run).hide()
        $("#veg_output_th_" + run).html("Vegetation Cover in " + settings["timesteps"] + " Years")
    });

    // Chart button click functions
    $("#stacked_area_chart_td_button_" + run).click(function(){
        $(this).removeClass("unselected_td_button")
        $(this).addClass("selected_td_button")
        $("#column_chart_td_button_" + run).addClass("unselected_td_button")
        $("#column_chart_td_button_" + run).removeClass("selected_td_button")
        $("#column_charts_" + run).hide()
        $("#iteration_tr_" + run ).show()
        $("#area_charts_" + run).show()
        $("#veg_output_th_" + run).html("Vegetation Cover across " + settings["timesteps"] + " Years")
    });


    // Iteration row
    $("#results_table_" + run).append("<tr class='iteration_tr' id='iteration_tr_" + run +"'><td class='iteration_th' colspan='2'>Iteration to Display</td><td colspan='1'><input class='iteration_to_plot' id='iteration_to_plot_" + run + "' type='text' size='3' value=1></td></tr>");

    $("#iteration_to_plot_" + run).on('keyup', function(){
        if (this.value != '') {
            $("#area_charts_" + run).empty()
            create_area_charts(results_data_json, run, this.value)
        }
    });

    // Create a list of all the veg types and create a sorted list.
    var veg_type_list = new Array()
    $.each(results_data_json[iteration][timestep], function(key,value){
        veg_type_list.push(key)
    });

    var sorted_veg_type_list = veg_type_list.sort()

    $("#running_st_sim").html("ST-Sim Model Results")

    $("#results_table_" + run).append("<tr class='veg_output_tr'><td class='veg_output_th' id='veg_output_th_" + run + "' colspan='3'>Vegetation Cover in " + settings["timesteps"] + " Years</td></tr>");
    // Go through each sorted veg_type
    $.each(sorted_veg_type_list, function (index, value) {

        var veg_type = value

        // Write veg type and % headers
        $("#results_table").html("<tr class='veg_type_percent_tr'><td class='veg_type_th' colspan='3'>" + value +
                "<span class='show_state_classes_results_link'> <img class='dropdown_arrows' src='/static/img/down_arrow.png'></span>" +
            "</td></tr>");

        // Create a list of all the state classes and create a sorted list.
        var state_list = new Array()
        $.each(results_data_json[iteration][timestep][value], function (key, value) {
            state_list.push(key)
        })

        var sorted_state_list = state_list.sort()

        // Go through each sorted state class within the veg_type in this loop and write out the values
        $.each(sorted_state_list, function (index, value) {
            $("results_table").find("tr:gt(0)").remove();
            $('#results_table').append('<tr class="state_class_tr"><td>' + value + '</td><td>' + (results_data_json[iteration][timestep][veg_type][value] * 100).toFixed(1) + '%</td></tr>');
        });

    });

    // Show/Hide state class data
    $('.show_state_classes_results_link').unbind('click');
    $('.show_state_classes_results_link').click(function () {

        if ($(this).children('img').attr('src') == '/static/img/down_arrow.png') {

            $(this).children('img').attr('src', '/static/img/up_arrow.png')
        }
        else {
            $(this).children('img').attr('src', '/static/img/down_arrow.png')
        }
        $(this).closest('tr').nextUntil('tr.veg_type_percent_tr').slideToggle(0);
    });

    // Show/Hide run specific annual disturbances probabilities
    $('.show_disturbance_probabilities_link').unbind('click');
    $('.show_disturbance_probabilities_link').click(function () {

        if ($(this).children('img').attr('src') == '/static/img/down_arrow.png') {

            $(this).children('img').attr('src', '/static/img/up_arrow.png')
            $(this).children('.show_disturbance_probabilities_link_text').html('Hide')

        }
        else {
            $(this).children('img').attr('src', '/static/img/down_arrow.png')
            $(this).children('.show_disturbance_probabilities_link_text').html('Show')
        }
        $(this).closest('tr').nextUntil('tr.chart_type_tr').slideToggle(0);
    });
}

/*************************************** Initial Vegetation Cover Inputs **********************************************/

var enable_environment_settings=false;
var veg_slider_values={}

function hideSceneLoadingDiv() {
    $('#scene_loading_div').hide();
}

function showSceneLoadingDiv() {
    $('#scene_loading_div').show();
}

var landscape_viewer = require('app').default('scene', showSceneLoadingDiv, hideSceneLoadingDiv);

var library_initialized = false;

function updateStudyArea(extent, unit_id) {

    var libraryName = $('#settings_library').val();
    if (!library_initialized) {
        // setup the sidebar for the first time
        landscape_viewer.showLoadingScreen();
        $.getJSON(libraryName + '/info/').done(function(definitions) {
            setLibrary(libraryName, definitions);

            landscape_viewer.setLibraryDefinitions(libraryName, definitions);
            // select the extent the user just selected
            if (definitions.has_tiles) {
                var reporting_units_name = "";
                for (var key in reporting_units) {
                    if (active_reporting_units == reporting_units[key]) {
                        reporting_units_name = key;
                        break;
                    }
                }
                console.log(unit_id);
                $.getJSON(libraryName + '/select/' + reporting_units_name + '/' + unit_id + '/stats/').done(function (initConditions) {
                    setInitialConditionsSidebar(initConditions);

                    landscape_viewer.setStudyAreaTiles(reporting_units_name, unit_id, initConditions);
                }).always(show_input_options);
            }
            else if (!definitions.has_predefined_extent) {
                updateExtent(libraryName, extent);
            }
        });
    } else {
        updateExtent(libraryName, extent);
    }

}

var current_uuid;
function updateExtent(libraryName, extent) {
    landscape_viewer.showLoadingScreen();
    $.getJSON(libraryName + '/select/' + extent.join('/') + '/').done(function (uuid_res) {
        var raster_uuid = uuid_res['uuid'];
        current_uuid = raster_uuid;
        $.getJSON(libraryName + '/select/' + raster_uuid + '/stats/').done(function (initConditions) {
            setInitialConditionsSidebar(initConditions);
            landscape_viewer.setStudyArea(raster_uuid, initConditions);
        }).always(show_input_options);
    })
}

var veg_type_state_classes_json, management_actions_list, probabilistic_transitions_json;
var probabilistic_transitions_slider_values = {};
var veg_has_lookup = false;
var veg_initial_conditions, state_class_color_map;

function actualVegName(vegtype) {
    if (veg_has_lookup) {
        return veg_initial_conditions.veg_names[vegtype] + ' (' + vegtype + ')';
    }
    return vegtype
}


function setLibrary(libraryName, definitions) {
    veg_type_state_classes_json = definitions['veg_type_state_classes_json'];
    management_actions_list = definitions['management_actions_list'];
    probabilistic_transitions_json = definitions['probabilistic_transitions_json'];
    state_class_color_map = definitions['state_class_color_map'];
    veg_has_lookup = definitions['has_lookup']
    landscape_viewer.setLibraryDefinitions(libraryName, definitions);
    library_initialized = true;
    if (definitions.has_predefined_extent) {
        $.getJSON(libraryName + '/select/predefined-extent/stats/').done(function (initConditions) {
            setInitialConditionsSidebar(initConditions);
            landscape_viewer.setStudyArea('predefined-extent', initConditions);
        }).always(show_input_options);
    }
}

var slider_values = {};
var veg_proportion = {};
var management_actions_dict = {};
var probability_labels = {};
    probability_labels[-1] = "0% Probability";
    probability_labels[-.75] = "Very Low (-75%)";
    probability_labels[-.50] = "Low (-50%)";
    probability_labels[-.25] = "Moderately Low (-25%)";
    probability_labels[0] = "Default Probabilities";
    probability_labels[.25] = "Moderately High (+25%)";
    probability_labels[.50] = "High (+50%)";
    probability_labels[.75] = "Very High (+75%)";
    probability_labels[1] = "100% Probability";

function setInitialConditionsSidebar(initial_conditions) {

    total_input_percent = 100;
    veg_initial_conditions = initial_conditions;
    var veg_iteration = 1;
    //console.log(initial_conditions.veg_names);
    //console.log(initial_conditions.veg_sc_pct);

    // empty the tables
    $("#vegTypeSliderTable").empty();
    $("#probabilisticTransitionSliderTable").empty();

    // Create the legend
    $("#scene_legend").empty();
    $.each(state_class_color_map, function(key,value){
        $("#scene_legend").append("<div id='scene_legend_color' style='background-color:" + value + "'> &nbsp</div>" + key + "<br>")
    });

    $.each(veg_type_state_classes_json, function (veg_type, state_class_list) {

        if (!(veg_type in veg_initial_conditions.veg_sc_pct)) {
            return true;    // skips this entry
        }

        //veg_slider_values[veg_type] = 0

        // Count the number of state classes
        var state_class_count = state_class_list.length

        //Create a skeleton to house the intital conditions slider bar and  state class input table.
        var veg_table_id = veg_type.replace(/ /g, "_").replace(/&/g, "__")
        var management_table_id = veg_table_id + "_management"
        $("#vegTypeSliderTable").append("<tr><td>" +
            "<table class='initial_veg_cover_input_table'>" +
            "<tr><td colspan='4'>" +
            "<label for='amount_veg1'><div class='imageOverlayLink'>" + actualVegName(veg_type) + " </div></label>" +
            "</td></tr>" +
            "<tr><td>" +
            "<div class='slider_bars' id='veg" + veg_iteration + "_slider'></div>" +
            "</td><td>" +
            "<input type='text' id='veg" + veg_iteration + "_label' class='current_slider_setting' readonly>" +
            "</td>" +
            "<td>" +
            "<div class='show_state_classes_link state_class_div'> <span class='state_class_span'>State Classes</span></div>" +
            "<div class='sub_slider_text_inputs' style='display:none'>" +
            "<div class='callout right '>" +
            "<table id='" + veg_table_id + "' class='sub_slider_table' title='" + veg_type + "'></table>" +
            "</div></div>" +
            "</td><td>" +
            "<div class='manage_div'><span class='manage_span'>Manage</span></div>" +
            "<div class='management_action_inputs' style='display:none'>" +
            "<div class='manage_callout callout right'>" +
            "<table id='" + management_table_id + "' class='sub_slider_table' title='" + veg_type + "'></table>" +
            "</div>" +
            "</div>" +
            "</td></tr></table>" +
            "</td></tr>"
        );

        // Set the initial slider values equal to initial conditions defined in the library (REQUIRED).
        veg_slider_values_state_class = veg_initial_conditions["veg_sc_pct"]

        // Create a slider bar
        create_slider(veg_iteration, veg_type, state_class_count)

        // Make a row for each state class.
        state_class_count = 1;
        $.each(state_class_list, function (index, state_class) {
            $("#" + veg_table_id).append("<tr><td>" + state_class + " </td><td><input class='veg_state_class_entry' id='" + "veg_" + veg_iteration + "_" + state_class_count + "' type='text' size='2' value=" + veg_initial_conditions['veg_sc_pct'][veg_type][state_class] +">%</td></tr>")
            state_class_count++
        });

        var management_action_count = 1;
        // TODO: Currently hard coded. Same for each veg type. List of management actions will eventually be specific to the veg type.
        management_actions_dict[veg_type] = management_actions_list;
        $.each(management_actions_dict[veg_type], function (index, management_action) {
            $("#" + management_table_id).append("<tr><td>" + management_action + " </td><td><input class='veg_state_class_entry' id='" + "management_" + veg_iteration + "_" + state_class_count + "_manage' type='text' size='2' value='0'> Acres</td></tr>")
            management_action_count++
        });

        $("#vegTypeSliderTable").append("</td></td>")
        veg_iteration++;

    });

    function create_slider(iterator, veg_type, state_class_count) {

        //console.log(typeof(veg_type))
        $(function () {

            var initial_slider_value = 0;

            // Loop through all the state class pct cover values and sum them up to set the initial veg slider bar value.
            $.each(veg_initial_conditions['veg_sc_pct'][veg_type], function(key,value){
                initial_slider_value+=value

            });

            veg_slider_values[veg_type]=Math.ceil(initial_slider_value)

            slider_values[iterator] = 0
            veg_proportion[iterator] = 0

            //console.log(initial_slider_value)

            $("#veg" + iterator + "_slider").slider({
                range: "min",
                value: initial_slider_value,
                min: 0,
                max: 100,
                step: 1,
                slide: function (event, ui) {
                    veg_slider_values[veg_type] = ui.value
                    $("#veg" + iterator + "_label").val(ui.value + "%");
                    $("#total_input_percent").html(total_input_percent + ui.value + "%");
                    total_percent_action(total_input_percent + ui.value)

                    // Populate state class values equally
                    veg_proportion[iterator] = (ui.value / state_class_count).toFixed(2)
                    for (i = 1; i <= state_class_count; i++) {
                        $("#veg_" + iterator + "_" + i).val(veg_proportion[iterator])
                    }

                    veg_slider_values_state_class[veg_type] = {}
                },
                start: function (event, ui) {
                    total_input_percent = total_input_percent - ui.value
                },
                stop: function (event, ui) {
                    total_input_percent = total_input_percent + ui.value

                    $.each(veg_type_state_classes_json[veg_type], function (index, state_class) {
                        veg_slider_values_state_class[veg_type][state_class] = veg_proportion[iterator]

                    })

                },
                create: function(event, ui){

                    $("#veg" + iterator + "_label").val($(this).slider('value') + "%");
                },
            });

        });
    }

    var probability_iteration = 1;

    $.each(probabilistic_transitions_json, function (transition_type, state_class_list) {

        //Create a skeleton to house the intital conditions slider bar and  state class input table.
        //probabilistic_transitions_table_id = transition_type.replace(/ /g, "_").replace(/&/g, "__")   // TODO - is this used?
        $("#probabilisticTransitionSliderTable").append("<tr><td><label for='amount_veg1'><span class='transition_type'>" + transition_type + ": </span></label>" +
            "<input type='text' id='probabilistic_transition" + probability_iteration + "_label' class='current_probability_slider_setting' readonly>" +
            "<div class='slider_bars probabilistic_transition_sliders' id='probabilistic_transition" + probability_iteration + "_slider'></div>" +
            "</td></tr>"
        );

        // Create a slider bar
        create_probability_slider(probability_iteration, transition_type, 0)

        $("#probabilisticTransitionSliderTable").append("</td></td>")

        probability_iteration++;

    });

    function create_probability_slider(iterator, transition_type) {

        $(function () {
            $("#probabilistic_transition" + iterator + "_slider").slider({
                range: "min",
                value: 0,
                min: -1,
                max: 1,
                step: .25,
                slide: function (event, ui) {
                    probabilistic_transitions_slider_values[transition_type] = ui.value
                    $("#probabilistic_transition" + iterator + "_label").val(probability_labels[ui.value]);
                },
            });

        });
    }

    //initializeStateClassColorMap();
    $(".current_probability_slider_setting").val("Default Probabilities");
}

function total_percent_action(value){
    if (value == 100 ){
        $("#total_input_percent").css('background-color', '#1EBA36')
        $("#total_input_percent").css('color', 'white')
        $("#run_button").removeClass('disabled');
        $('input:submit').attr("disabled", false);
        $("#run_button").val('Run Model');
    }
    else {
        $("#total_input_percent").css('background-color','#E47369')
        $("#total_input_percent").css('color', '#444343')
        $("#run_button").addClass('disabled');
        $('input:submit').attr("disabled", true);
        $("#run_button").val('Total Percent Cover Must Equal 100%');
    }
}

function activate_map() {
    $("#map_button").addClass("selected")
    $("#scene_button").removeClass("selected")
    $("#map").show()
    $("#scene").hide()
    $("#selected_features").hide()
    window.removeEventListener('resize', landscape_viewer.resize, false);
    $("#scene_legend").hide()
    $("#general_settings_instructions").html("Select an area of interest by clicking on a reporting unit (e.g., a watershed), or by using the rectangle tool to define your own area of interest.")
    $("div.leaflet-control-layers:nth-child(1)").css("top","55px")
}

function activate_scene(){
    $("#map_button").removeClass("selected")
    $("#scene_button").addClass("selected")
    $("#scene").show()
    $("#map").hide()
    $("#step1").hide()
    $("#selected_features").show()
    window.addEventListener('resize', landscape_viewer.resize, false);
    landscape_viewer.resize();
    $("#scene_legend").show()
    $("#general_settings_instructions").html("Now use the controls below to define the scenario you'd like to simulate. When you are ready, push the Run Model button to conduct a model run.")
}

$("#spatial_link").click(function(){
    var button = $('#spatial_button');
    if (button.hasClass('selected')) {
        button.removeClass('selected');
    } else {
        button.addClass('selected');
    }
    settings['spatial'] = button.hasClass('selected');
});

$(document).on('change', '#settings_library', function() {
    var newLibraryName = $(this).val();
    $.getJSON(newLibraryName + '/info/').done(function(definitions) {
        setLibrary(newLibraryName, definitions);
        if (definitions.has_predefined_extent) {
            feature_id = newLibraryName;
        }
    })
})


