// stsim.ts


export interface RunControl {
	min_step : number,
	max_step : number,
	step_size : number,
	result_scenario_id: number
}

export interface DefinitionMapping {
	[name: string]: number
}

export interface VizAsset{
	asset_name : string,
	valid_names: string[]
}

export interface VisualizationConfig {
	visualization_asset_names : VizAsset[]
	lookup_field?: string	// not all libraries require a lookup field
}

export interface LibraryDefinitions {
	vegtype_definitions : DefinitionMapping
	stateclass_definitions : DefinitionMapping
	has_lookup : boolean
	lookup_fields : string[]
	has_predefined_extent : boolean
	veg_model_config : VisualizationConfig
}

export interface ElevationStatistics {
	dem_height: number
	dem_max: number
	dem_min: number
	dem_width: number
}

export interface LibraryInitConditions {
	veg_sc_pct : {[veg_name: string] : {[stateclass_name: string] : number}}
	total_cells : number
	veg_names: {[veg_name: string] : string}
	elev: {
		dem_height: number,
		dem_max: number,
		dem_min: number,
		dem_width: number
	}
}

