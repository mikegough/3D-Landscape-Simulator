// Colors used in the chart.
colors=[
    "#9CC7F0",
    "#717175",
    "#ABF19D",
    "#F8B984",
    "#9FA3EE",
    "#F4849F",
    "#EADD7E",
    "#5FABAA",
    "#F68383",
    "#ACEDE8",
    "#CBC77A",
    "#9AB17A",
    "#BB845B"
];

// Makes state class colors consistent across all charts.
//i=0;
state_class_color_map={};
//$.each(veg_type_state_classes_json, function(veg_type,state_classes){
//
//    $.each(state_classes, function(index, state_class){
//        if (typeof state_class_color_map[state_class] == "undefined") {
//            state_class_color_map[state_class] = colors[i]
//        }
//        i++
//    });
//});

function create_area_chart(veg_type, chart_div_id) {

    $(function () {
       $('#' + chart_div_id).highcharts({
            chart: {
                type: 'area',
                width:308,
                height:230,
                marginBottom: 50,
                marginLeft:58,
                marginRight:10,
                marginTop:5,
            },
            title: {
                enabled:false,
                text: "", //veg_type,
                margin:5,
                x:15,
                style: {
                    fontSize: '1.1em',
                },
            },
            credits: {
                enabled:false
            },
            subtitle: {
                text: ''
            },
            legend: {
                enabled:false,
            },
            xAxis: {
                startOnTick: false,
                endOnTick: false,
                tickInterval:1,
                title: {
                    text: 'Year'
                },
                style: {
                    "textOverflow": "none"
                }
            },
            yAxis: {
                endOnTick:false,
                title: {
                    text: 'Percent of Landscape'
                },
                labels: {
                    formatter: function () {
                        return this.value;
                    }
                }
            },
            tooltip: {
                shared: true,
                hideDelay:100,
                formatter: function () {
                    var points = this.points;
                    var pointsLength = points.length;
                    var tooltipMarkup = '<div id="areaChartTooltipContainer">';
                    tooltipMarkup += pointsLength ? '<span style="font-size: 12px">Year: ' + points[0].key + '</span><br/>' : '';
                    var index;
                    var y_value;

                    for(index = 0; index < pointsLength; index += 1) {
                        y_value = (points[index].y).toFixed(2)

                        if (y_value > 0) {
                            tooltipMarkup += '<span style="color:' + points[index].series.color + '">\u25CF</span> ' + points[index].series.name + ': <b>' + y_value + '%</b><br/>';
                        }
                    }
                   tooltipMarkup += '</div>';

                   return tooltipMarkup;
                }
            },
            plotOptions: {
                area: {
                    pointStart:1,
                    stacking: 'normal',
                    lineColor: '#666666',
                    lineWidth: 1,
                    marker: {
                        radius:1,
                        enabled:false,
                        lineWidth: 1,
                        lineColor: '#666666',
                        states: {
                            hover: {
                                radius:5,
                            }
                        }

                    },

                },
            },
        });
    });

}

function create_area_charts(results_data_json, run) {

        $("#view" + run +"_tab").css("display", "inline")

        //Restructure Dictionary
        chart_dict = {}
        $.each(results_data_json[iteration], function (timestep, results_dict) {    // TODO - update the 0 to be the iteration that we are returning
            $.each(results_dict, function (veg_type, value) {
                if (typeof chart_dict[veg_type] == "undefined") {
                    chart_dict[veg_type] = {}
                }
                $.each(results_dict[veg_type], function (key, value) {
                    if (typeof chart_dict[veg_type][key] == "undefined") {
                        chart_dict[veg_type][key] = []
                    }
                    chart_dict[veg_type][key].push((parseFloat(value) * 100))
                })
            })
        });

        //$("#area_charts").empty()

        // Go through each veg type in the results and make a chart out of the state class values
        chart_count=1
        $.each(chart_dict, function(veg_type,value) {

            chart_div_id="chart_" + run + "_"  + chart_count

            $("#area_charts_" +run).append("<div class='stacked_area_chart_title' id='stacked_area_chart_title_" + chart_count +"'>" + veg_type +

            "<span class='show_stacked_area_chart_link' id='show_stacked_area_chart_link_" + chart_count + "_" + run +"'> <img class='dropdown_arrows' src='/static/img/up_arrow.png'></span></div>")

            //add a new chart div
            $("#area_charts_" + run).append("<div id='" + chart_div_id + "'></div>")

            // Create the chart
            create_area_chart(veg_type,chart_div_id)

            ac = $('#'+chart_div_id).highcharts()

            // Add a series for each state class
            $.each(chart_dict[veg_type], function (state_class_name, values_array) {
                ac.addSeries({
                    name: state_class_name,
                    color: state_class_color_map[state_class_name],
                    data: values_array,
                    lineWidth: 0,
                    stacking: 'normal',
                    point: {
                        events: {
                            mouseOver: function () {
                            },
                        }
                    }
                })
            });

            bind_click_to_collapse(chart_div_id, run)
            chart_count++;

        });
}

function bind_click_to_collapse(chart_div_id, run) {

    $("#show_stacked_area_chart_link_" + chart_count + "_" + run).click(function () {
        if ($("#" + chart_div_id).is(":visible")) {
            $(this).html(" <img class='dropdown_arrows' src='/static/img/down_arrow.png'>")
            $("#" + chart_div_id).hide()
        }
        else {
            $(this).html(" <img class='dropdown_arrows' src='/static/img/up_arrow.png'>")
            $("#" + chart_div_id).show()
        }
    });
}





