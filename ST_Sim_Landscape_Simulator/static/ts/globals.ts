// globals.ts


// global colors
export const WHITE = 'rgb(255,255,255)'

export function getVegetationLightPosition(vegname: string) : number[] {
	if (vegname.includes("Sagebrush")) {
		return [0.0, -5.0, 5.0]
	}
	return [0.0, 5.0, 0.0]
}
