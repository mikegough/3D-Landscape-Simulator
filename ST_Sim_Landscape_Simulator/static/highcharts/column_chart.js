function create_column_chart(veg_type, chart_div_id, x_axis_categories) {
    $(function () {
    $('#'+chart_div_id).highcharts({
        chart: {
            type: 'column',
            width:308,
            height:250,
            marginBottom: 100,
            marginLeft:58,
            marginRight:10,
            marginTop:5,
        },
        title: {
            text: ''
        },
        subtitle: {
            text: ''
        },
        credits: {
            enabled:false
        },
        legend: {
        },
        xAxis: {
            categories:x_axis_categories,
            crosshair: true
        },
        yAxis: {
            min: 0,
            title: {
                text: 'Percent of Landscape'
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
            column: {
                pointPadding:0,
                borderWidth: 1
            },
            series: {
                groupPadding: 0.05
            }
        },
    });
});
}

function create_column_charts(results_data_json, run) {

        //Restructure Dictionary
        number_of_iterations=settings["iterations"]
        last_timestep=20
        column_chart_dict = {}
        //Creates a dictionary of all the final timestep values by veg_type/state class.
        $.each(new Array(parseInt(settings["iterations"])),
            function(n) {
                var iteration = n + 1
                // Each iteration
                $.each(results_data_json[iteration][last_timestep], function (veg_type, state_class_dict) {
                    if (typeof column_chart_dict[veg_type] == "undefined") {
                        column_chart_dict[veg_type] = {}
                    }
                    $.each(state_class_dict, function(state_class,value) {
                        if (typeof column_chart_dict[veg_type][state_class]=="undefined"){
                            column_chart_dict[veg_type][state_class]=[]
                        }
                        column_chart_dict[veg_type][state_class].push(parseFloat(value) * 100)
                    })
                })
            }
        );

        //Get the min/median/max from the dictionary above. Store in a new dictionary.
        column_chart_dict_final={}
        $.each(column_chart_dict, function(veg_type, state_class_list){
            column_chart_dict_final[veg_type]={}
            $.each(state_class_list, function(state_class,array_of_values){
                console.log(array_of_values)
                min_val=Math.min.apply(Math,array_of_values)
                max_val=Math.max.apply(Math,array_of_values)
                var sorted_array=array_of_values.sort()
                length_of_array=sorted_array.length
                low_middle_index = Math.floor((sorted_array.length - 1) / 2);
                high_middle_index = Math.ceil((sorted_array.length - 1) / 2);
                median_val=(sorted_array[low_middle_index] + sorted_array[high_middle_index]) / 2;
                column_chart_dict_final[veg_type][state_class]=[]
                column_chart_dict_final[veg_type][state_class].push(min_val)
                column_chart_dict_final[veg_type][state_class].push(median_val)
                column_chart_dict_final[veg_type][state_class].push(max_val)
            })
        });

        //$("#area_charts").empty()

        // Go through each veg type in the min/median/max dictionary and make a chart out of the state class values
        chart_count=1
        $.each(column_chart_dict_final, function(veg_type,state_classes) {

            chart_div_id="chart_" + run + "_"  + chart_count
            median_vals=[]
            min_max_vals=[]
            state_class_names=[]

            $.each(state_classes, function(state_class_name,value){
                state_class_names.push([state_class_name])
                median_vals.push({y:value[1], color:state_class_color_map[state_class_name]})
                min_max_vals.push([value[0],value[2]])
            });

            // Create the chart
            create_column_chart(veg_type,chart_div_id,state_class_names)

            cc = $('#'+chart_div_id).highcharts()

            // Add a series for each of the median values
                cc.addSeries({
                    name:'',
                    //color: state_class_color_map[state_class_name],
                    data: median_vals,
                    stacking: 'normal',
                    showInLegend: false,
                    point: {
                        events: {
                            mouseOver: function () {
                            },
                        }
                    }
                })
                cc.addSeries({
                    name:'Range',
                    type: 'errorbar',
                    data: min_max_vals,
                })
                chart_count++;

        });
}
/*
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
*/
