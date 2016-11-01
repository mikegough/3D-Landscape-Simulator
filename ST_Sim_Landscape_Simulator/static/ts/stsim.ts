// stsim.ts


export interface RunControl {
	library: string
	min_step : number
	max_step : number
	step_size : number
	iterations : number
	spatial: boolean
	result_scenario_id: number
}

export interface DefinitionMapping {
	[name: string]: number
}

export interface VizAsset{
	asset_name : string
	valid_names: string[]
	scale: number
	symmetric: boolean
}

export interface VisualizationConfig {
	visualization_asset_names : VizAsset[]
	lookup_field?: string	// not all libraries require a lookup field
	asset_map?: {[veg_name: string]: string}
}

export interface VizMapping {
	[veg_name: string] : VizAsset
}

export interface LibraryDefinitions {
	vegtype_definitions : DefinitionMapping
	stateclass_definitions : DefinitionMapping
	has_lookup : boolean
	lookup_fields : string[]
	has_predefined_extent : boolean
	has_tiles : boolean
	veg_model_config : VisualizationConfig
	state_class_color_map: {[sc_name: string]: string}
	veg_type_color_map: {[veg_name: string]: string}
	misc_legend_info: [{
		ID: number
		r: number
		g: number
		b: number
		label: string
	}]
}

export interface ElevationStatistics {
	dem_height: number
	dem_max: number
	dem_min: number
	dem_width: number
	x_tiles?: number
	y_tiles?: number
	tile_size?: number
}

export interface LibraryInitConditions {
	veg_sc_pct : {[veg_name: string] : {[stateclass_name: string] : number}}
	total_cells : number
	total_active_cells: number
	veg_names: {[veg_name: string] : string}
	elev : ElevationStatistics
}

