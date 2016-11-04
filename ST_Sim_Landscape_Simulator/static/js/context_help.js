// context_help.js


/**
    Return basic help content
    @param helpID Integer ID key pointing towards which help context was selected.
    @return string An HTML string based on which ID help icon they are hovering over
 */
function helpContentBasic(helpID) {
	switch (helpID) {
		case 1:
			return  "<table class='general_settings_table'>" +
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
			return  "<tr><td>" +
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
                    "<input type='text' id='vegNothing_label' style='width:60px!important' class='current_slider_setting' value='Pct. Cover' readonly>" +
                    "</td>" +
                    "<td>" +
                    "<div class='show_state_classes_link state_class_div'> <span class='state_class_span'>State Classes</span></div>" +
                    "<div class='sub_slider_text_inputs' style='display:none'>" +
                    "<div class='callout right '>" +
                    "<table id='nothingID' class='sub_slider_table' title='Vegtype'></table>" +
                    "</div></div>" +
                    "</td><td>" +
                    "<div class='manage_div'><span class='manage_span'>Manage</span></div>" +
                    "<div class='management_action_inputs' style='display:none'>" +
                    "<div class='manage_callout callout right'>" +
                    "<table id='nothingID' class='sub_slider_table' title='Vegtype'></table>" +
                    "</div>" +
                    "</div>" +
                    "</td></tr></table>" +
                    "</td></tr>";
		case 3:
			return  "<div class='context_basic'>" +
                    "<p style='text-align: left!important;'>Climate scenarios for normal and increased temperature and precipitation levels. " +
                    "These adjust the overall effect that temperature and precipitation will have on various vegetation.</p>" +
                    "</div>";
		case 4:
			return  "<div class='context_basic'>" +
                    "<p style='text-align: left!important;'>Annual disturbance probabilities affect the rate that vegetation will change due to a " +
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
            return '';
        case 2:
            return '';
        case 3:
            return '';
        case 4:
            return '';
        default:
            return '';
    }

}



// Tooltip popup on context help icons
var popup = $("div#pop-up");

$(document).on({
    click: function(e) {
        var helpID = Number(this.id.split('_').slice(-1)[0]);
        alertify.alert(helpContentTitle(helpID) + helpContentBasic(helpID) + helpContentInDepth(helpID));
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
