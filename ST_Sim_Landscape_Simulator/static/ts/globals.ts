// globals.ts

// debugging constants

export const USE_RANDOM = true
//export const USE_RANDOM = false

// global constants configuration
export const MAX_INSTANCES = 5000		// max number of vertex instances we allow per vegtype
export const MAX_CLUSTERS_PER_VEG = 20	// maximum number of clusters to generate for each vegtype
export const RESOLUTION = 800.0			// resolution of terrain (in meters)
export const TERRAIN_DISP = 5.0 / RESOLUTION // the amount of displacement we impose to actually 'see' the terrain
export const MAX_CLUSTER_RADIUS = 30.0	// max radius to grow around a cluster

// global colors
export const WHITE = 'rgb(255,255,255)'

/*
export function getVegetationAssetsName(vegname: string) : string {

	if (vegname.includes("Sagebrush")) {
		return 'sagebrush'
	} else if (vegname.includes("Juniper")) {
		return 'juniper'
	}
	else if (vegname.includes("Mahogany")) {
		return 'tree'
	}

	return 'grass' 
}


export function useSymmetry(vegname: string) : boolean {
	return  !(vegname.includes('Sagebrush')
			  || vegname.includes('Mahogany') 
			  || vegname.includes('Juniper'))
}

// TODO - make this part of the configuration
export function getVegetationScale(vegname: string) : number {
	if (vegname.includes("Sagebrush")) {
		return 10.0
	} else if (vegname.includes("Juniper")) {
		return 1.
	} else if (vegname.includes("Mahogany")) {
		return 15.0
	}
	return 1.0 
}

// TODO - same as above
export function getRenderOrder(vegname: string) : number {
	// sagebrush should always be rendered first
	if (!vegname.includes('Sagebrush')) {
		return 1
	}
	return 0
}
*/

export function getVegetationLightPosition(vegname: string) : number[] {
	if (vegname.includes("Sagebrush")) {
		return [0.0, -5.0, 5.0]
	}
	return [0.0, 5.0, 0.0]
}