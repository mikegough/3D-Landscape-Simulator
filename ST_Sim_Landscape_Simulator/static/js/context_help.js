// context_help.js


/**
    Return basic help content
    @param helpID Integer ID key pointing towards which help context was selected.
    @return string An HTML string based on which ID help icon they are hovering over
 */
function helpContentBasic(helpID) {
	switch (helpID) {
		case 1:
			return  "<div class='context_basic'>" +
                    "<p>Model run parameters. These determine which ST-Sim model library to use, the number of " +
                    "timesteps to run the model for, and the number of Monte-Carlo iterations to simulate.</p>" +
                    "</div>";
		case 2:
			return  "<div class='context_basic'>" +
                    "<p>List of all vegetation/strata visible in this region, separated by percent cover. " +
                    "Adjusting the value will affect the proportion of the landscape the vegetation/strata covers.</p>" +
                    "</div>";
		case 3:
			return  "<div class='context_basic'>" +
                    "<p>Climate scenarios for normal and increased temperature and precipitation levels. " +
                    "These adjust the overall affect that temperature and precipitation will have on various vegetation.</p>" +
                    "</div>";
		case 4:
			return  "<div class='context_basic'>" +
                    "<p>Annual disturbance probabilities affect the rate that vegetation will change due to a " +
                    "probabilistic (or stochastic) change or event that occurs, such as fire or insect invasion.</p>" +
                    "</div>";
		default:
			return '';
	}
}

/**
    Return titles to help content
    @param helpID Integer ID key pointing towards which help context was selected.
    @return string An HTML string based on which ID help icon they are hovering over
 */
function helpContentTitle(helpID) {
    switch (helpID) {
        case 1:
            return '<div class="steps">General Settings</div>';
        case 2:
            return '<div class="steps">Specify Initial Vegetation Cover</div>';
        case 3:
            return '<div class="steps">Climate Change Projections</div>';
        case 4:
            return '<div class="steps">Annual Disturbance Probabilities</div>';
        default:
            return '';
    }
}

/**
    Return in-depth help content
    @param helpID Integer ID key pointing towards which help context was selected.
    @return string An HTML string based on which ID help icon they are hovering over
 */
function helpContentInDepth(helpID) {

    switch (helpID) {

        case 1:
            return "<table class='general_settings_table'>" +
                    "<tr>" +
                    "<td>" +
                    "<div class='general_settings_div'>" +
                    "Library" +
                    "</div>" +
                    "</td>" +
                    "<td>The active ST-Sim library for the current area.</td>" +
                    "</tr>" +
                    "<tr>" +
                    "<td>" +
                    "<div class='general_settings_div'>" +
                    "Spatial Output" +
                    "</div>" +
                    "</td>" +
                    "<td>Toggle spatial run output (currently in development).</td>" +
                    "</tr>" +
                    "<tr>" +
                    "<td>" +
                    "<div class='general_settings_div'>" +
                    "Timesteps" +
                    "</div>" +
                    "<td>Specify the number of (annual) timesteps to project.</td>" +
                    "</tr>" +
                    "<tr>" +
                    "<td>" +
                    "<div class='general_settings_div'>" +
                    "Iterations" +
                    "</div>" +
                    "<td>Specify the number of Monte-Carlo iterations to perform.</td>" +
                    "</tr>" +
                    "</table>";
        case 2:
            return "<tr><td>" +
                    "<table class='initial_veg_cover_input_table' style='background-color: #E9E9E9;'>" +
                    "<tr><td colspan='4'>" +
                    "<label for='amount_veg1'><div class='imageOverlayLink' style='width: 328px;'>Vegetation/Strata Type </div></label>" +
                    "</td></tr>" +
                    "<tr><td>" +
                    "<div class='slider_bars_disabled ui-slider ui-slider-horizontal ui-widget ui-widget-content ui-corner-all' id='vegNothing_slider' aria-disabled='false'>" +
                    "<div class='ui-slider-range ui-widget-header ui-slider-range-min' style='width: 33%;'>" +
                    "</div><a class='ui-slider-handle ui-state-default ui-corner-all' href='#' style='left: 33%;'>" +
                    "</a></div>" +
                    "</td><td>" +
                    "<input type='text' style='width:60px!important' class='current_slider_setting' value='Pct. Cover' readonly>" +
                    "</td>" +
                    "<td>" +
                    "<div class='show_state_classes_link state_class_div'> <span class='state_class_span'>State Classes</span></div>" +
                    "<div class='sub_slider_text_inputs' style='display:none'>" +
                    "<div class='callout right '>" +
                    "<table class='sub_slider_table' title='Vegtype'></table>" +
                    "</div></div>" +
                    "</td><td>" +
                    "<div class='manage_div'><span class='manage_span'>Manage</span></div>" +
                    "<div class='management_action_inputs' style='display:none'>" +
                    "<div class='manage_callout callout right'>" +
                    "<table class='sub_slider_table' title='Vegtype'></table>" +
                    "</div>" +
                    "</div>" +
                    "</td></tr></table>" +
                    "</td></tr>";
        case 3:
            return  '<table class="sliderTable climateFutureSliderTable_disabled">' +
                    '<tbody><tr><td>' +
                    '<label for="amount_climate_temp"><span class="transition_type">Temperature: </span></label>' +
                    '<input type="text" class="current_climate_future_slider_setting" value="Warm" readonly="">' +
                    '<div class="slider_bars probabilistic_transition_sliders ui-slider ui-slider-horizontal ui-widget ui-widget-content ui-corner-all" id="climate_future_temp_slider" aria-disabled="false">' +
                    '<a class="ui-slider-handle ui-state-default ui-corner-all" href="#" style="left: 0%;"></a>' +
                    '</div></td>' +
                    '<td><label for="amount_climate_precip"><span class="transition_type">Precipitation: </span></label>' +
                    '<input type="text" class="current_climate_future_slider_setting" value="No Change" readonly="">' +
                    '<div class="slider_bars_disabled probabilistic_transition_sliders ui-slider ui-slider-horizontal ui-widget ui-widget-content ui-corner-all" id="climate_future_precip_slider" aria-disabled="false">' +
                    '<a class="ui-slider-handle ui-state-default ui-corner-all" href="#" style="left: 50%;">' +
                    '</a></div></td></tr></tbody></table>' +
                    '<p></p>';
        case 4:
            return  '<table class="sliderTable">' +
                    '<tbody><tr><td><label for="amount_veg1"><span class="transition_type">Replacement Fire: </span></label>' +
                    '<input type="text" class="current_probability_slider_setting" value="Moderately High (+25%)" readonly="">' +
                    '<div class="slider_bars_disabled probabilistic_transition_sliders ui-slider ui-slider-horizontal ui-widget ui-widget-content ui-corner-all" aria-disabled="false">' +
                    '<div class="ui-slider-range ui-widget-header ui-slider-range-min" style="width: 62.5%;"></div>' +
                    '<a class="ui-slider-handle ui-state-default ui-corner-all" href="#" style="left: 62.5%;"></a></div></td></tr>' +
                    '</tbody></table>' +
                    '<div style="text-align: left">' +
                    '<p>Disturbance probabilities relate the probability of changes from one state to another.</p>' +
                    '<p>For many STSM models, this is demonstrated by a change between state classes within a vegetation type, while others demonstrate changes by replacing complete strata types with another. ' +
                    'Adjusting these sliders will affect the probability that the vegetation type will be influenced by a probabilistic event caused by the transition type, such as fire or disease.</p>' +
                    '<p>For example, an increase in the probability of "Replacement Fire" will increase the probability that a replacement fire will occur.</p>' +
                    '</div>';
        default:
            return '';
    }

}



// Tooltip popup on context help icons
var popup = $("div#pop-up");

$(document).on({
    click: function(e) {
        var helpID = Number(this.id.split('_').slice(-1)[0]);
        alertify.alert(helpContentTitle(helpID) + helpContentInDepth(helpID));
    }
}, '.context_button');


$(document).on({
    mouseenter: function (e) {
        var moveLeft = 50;
        var moveDown = -20;

        var helpID = Number(this.id.split('_').slice(-1)[0]);

        popup.html(helpContentBasic(helpID));  // split and get last element of the id. Ids look like 'help_step_x'
        popup.show();

        $('.context_button').mousemove(function (e) {
            popup.css('top', e.pageY + moveDown).css('left', e.pageX + moveLeft);
        });
    },
    mouseleave: function(e) {
        popup.hide();
    }
}, '.context_button');
