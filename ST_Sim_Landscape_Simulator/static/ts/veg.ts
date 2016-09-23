// veg.ts
import * as globals from './globals'
import * as STSIM from './stsim'
import {GeometryAssets, TextureAssets} from './assetloader'

const RESOLUTION = 30	// 30 meter resolution

const AMBIENT = new THREE.Color(globals.WHITE)
const DIFFUSE = new THREE.Color(globals.WHITE)
const SPEC = new THREE.Color(globals.WHITE)
const INTENSITY = 1.0
const KA = 0.63
//const KA = 0.2
const KD = 1.0
const KS = 0.2
const SHINY = 20.0
AMBIENT.multiplyScalar(KA * INTENSITY)
DIFFUSE.multiplyScalar(KD * INTENSITY)
SPEC.multiplyScalar(KS * INTENSITY)

/*
	We should create two types of vegetation
	1) uses the standard 'realism' shaders that the non-spatial version uses, and
	2) one that uses the data-based shaders, to highlight the state class textures that are
	actually being shown, which dictate the change over time.
*/


interface SpatialVegetationParams {
	zonalVegtypes: {[vegtype: string] : {[stateclass: string] : number}}
	vegtypes: STSIM.DefinitionMapping
	config: STSIM.VisualizationConfig
	strataTexture: THREE.Texture
	stateclassTexture: THREE.Texture
	heightmap: THREE.Texture
	geometries: GeometryAssets
	textures: TextureAssets
	vertexShader: string
	fragmentShader: string
	heightStats: STSIM.ElevationStatistics
	disp: number,	// possibly unnecessary?
}

interface Vegtype3D {
	name: string
	heightmap: THREE.Texture
	sc_tex?: THREE.Texture
	map: boolean[]
	numValid: number
	heightStats: STSIM.ElevationStatistics
	geo: THREE.Geometry
	tex: THREE.Texture
	width: number
	height: number
	vertexShader: string
	fragmentShader: string
	disp: number
}


function decodeStrataImage(raw_data :Uint8ClampedArray) : Uint32Array {

	let decoded_data = new Uint32Array(raw_data.length / 4)

	let idx: number
	for (var i = 0; i < decoded_data.length; i++) {
		idx = i * 4
		decoded_data[i] = raw_data[idx] | (raw_data[idx+1] << 8) | (raw_data[idx+2] << 16) 
	}

	return decoded_data
}

// returns a THREE.Group of vegetation
export function createSpatialVegetation(params: SpatialVegetationParams) {
	console.log('Generating realistic vegetation...')

	let vegGroup = new THREE.Group()

	const strata_map = params.strataTexture
	//const vegtypes = params.data
	const image = strata_map.image
	let w = image.naturalWidth
	let h = image.naturalHeight
	let canvas = document.createElement('canvas')
	canvas.width = w
	canvas.height = h
	let ctx = canvas.getContext('2d')
	ctx.drawImage(image, 0, 0, w, h)
	
	// get the image data and convert to IDs
	let raw_image_data = ctx.getImageData(0,0,w,h).data
	let strata_data = decodeStrataImage(raw_image_data)

	raw_image_data = null

	
	const veg_geo = params.geometries['geometry']	// REMOVE, only for testing
	veg_geo.scale(10,10,10)
	const veg_tex = params.textures['material']


	const strata_positions = computeStrataPositions(params.vegtypes, strata_data, w, h)
	//for (var name in params.vegtypes) {
	for (var name in params.zonalVegtypes) {	
		// TODO - replace with the actual asset name
		//const assetName = globals.getVegetationAssetsName(name)
		//const veg_geo = params.geometries[assetName]
		//const veg_tex = params.textures[assetName + '_material']

		const vegtypePositions = computeVegtypePositions(params.vegtypes[name], strata_positions, strata_data, w, h)
		vegGroup.add(createVegtype({
			name: name,
			heightmap: params.heightmap,
			//sc_tex: params.stateclassTexture, 
			map: vegtypePositions.map, 
			numValid: vegtypePositions.numValid,
			heightStats: params.heightStats,
			geo: veg_geo,
			tex: veg_tex,
			width: w,
			height: h,
			vertexShader: params.vertexShader,
			fragmentShader: params.fragmentShader,
			disp: params.disp
		}))
	}
	
	strata_data = ctx = canvas = null

	console.log('Vegetation generated!')
	return vegGroup
}


function computeStrataPositions(vegtypes: any, data: Uint32Array, w: number, h: number) {
	let strata_map: boolean[] = new Array()		// declare boolean array
	let strata_data = data.slice()

	// calculate max from strata indices
	let max = 0
	for (var key in vegtypes) {
		max = vegtypes[key] > max ? vegtypes[key] : max
	}

	// compute the dither
	// Adapted from http://blog.ivank.net/floyd-steinberg-dithering-in-javascript.html
	
	// set upper threshold and middle threshold
	let mid : number, shift: number
	if (max < 256) {
		mid = 128
		shift = 4
	} else if (max < 65536) {
		mid = 32768
		shift = 8
	} else {
		mid = 8388608
		shift = 12
	}
	const upper = mid * 2 - 1
	
	let idx: number, cc: number, rc: number, err: number
	for (let y = 0; y < h; ++y) {
		for (let x = 0; x < w; ++x) {
			idx = (x + y * w)
			cc = strata_data[idx]
			rc = (cc<mid?0:upper)
			err = cc-rc
			strata_data[idx] = rc
			if (x+1<w) {
				strata_data[idx+1] += (err*7)>>shift 		// right neighbor
			}
			if (y+1==h) {	
				continue	// last line, go back to top
			}
			if (x > 0) {
				strata_data[idx + w - 1] += (err*3)>>shift;	// bottom left neighbor
			}
			strata_data[idx + w] += (err*5)>>shift			// bottom neighbor
			if (x + 1 < w) {
				strata_data[idx + w + 1] += (err*1)>>shift	// bottom right neighbor
			}
		}
	}
	

	// convert to boolean and return the map
	for (var i = 0; i < strata_data.length; i++) {
		strata_map.push(strata_data[i] == 0 || i % 3 == 0? true: false)
		//strata_map.push(strata_data[i] == 0 || i % 3 == 0 ? false: true)
	}
	return strata_map
}



function computeVegtypePositions(id: number, position_map: boolean[], type_data: Uint32Array, w:number, h:number) {
	let vegtype_map: boolean[] = new Array()		// declare boolean array
	let idx : number
	let valid: boolean
	let numValid = 0
	for (let y = 0; y < h; ++y) {
		for (let x = 0; x < w; x++) {

			// idx in the image
			idx = (x + y * w)
			
			// update vegtype map
			valid = type_data[idx] == id && position_map[idx]

			// how many are valid? This informs the number of instances to do
			if (valid) numValid++

			vegtype_map.push(valid)
		}
	}

	console.log(numValid);
	return {map: vegtype_map, numValid: numValid}
}


function createVegtype(params: Vegtype3D) {

	const halfPatch = new THREE.Geometry()
	halfPatch.merge(params.geo)
	
	if (globals.useSymmetry(name)) {
		params.geo.rotateY(Math.PI)
		halfPatch.merge(params.geo)
	}

	const inst_geo = new THREE.InstancedBufferGeometry()
	inst_geo.fromGeometry(halfPatch)
	halfPatch.dispose()
	const s = globals.getVegetationScale(name)
	inst_geo.scale(s,s,s)

	// always remove the color buffer since we are using textures
	if ( inst_geo.attributes['color'] ) {
		inst_geo.removeAttribute('color')
	}		

	inst_geo.maxInstancedCount = params.numValid

	const offsets = new THREE.InstancedBufferAttribute(new Float32Array(params.numValid * 2), 2)
	const hCoords = new THREE.InstancedBufferAttribute(new Float32Array(params.numValid * 2), 2)
	const rotations = new THREE.InstancedBufferAttribute(new Float32Array(params.numValid), 1)

	inst_geo.addAttribute('offset', offsets)
	inst_geo.addAttribute('hCoord', hCoords)
	inst_geo.addAttribute('rotation', rotations)

	// generate offsets
	let i = 0
	let x: number, y:number, idx:number, posx: number, posy: number, tx:number, ty: number
	for (y = 0; y < params.height; y += 5) {
		for (x = 0; x < params.width; x += 5) {

			idx = (x + y * params.width)

			if (params.map[idx]) {
				posx = (x - params.width/2)
				posy = (y - params.height/2)
				
				tx = x / params.width
				ty = y / params.height

				offsets.setXY(i, posx, posy)
				hCoords.setXY(i, tx, 1 - ty)
				rotations.setX(i, Math.random() * 2.0)
				i++;
			}
		}
	}
	//const maxHeight = params.heightStats.dem_max
	const lightPosition = globals.getVegetationLightPosition(name)
	const diffuseScale = getDiffuseScale(name)

	const mat = new THREE.RawShaderMaterial({
		uniforms: {
			// heights
			heightmap: {type: "t", value: params.heightmap},
			disp: {type: "f", value: params.disp},
			// coloring texture
			tex: {type: "t", value: params.tex},
			//vegColor: {type: "3f", value: vegColor},	// implicit vec3 in shaders
			// lighting
			lightPosition: {type: "3f", value: lightPosition},
			ambientProduct: {type: "c", value: getAmbientProduct(name)},
			diffuseProduct: {type: "c", value: DIFFUSE},
			diffuseScale: {type: "f", value: diffuseScale},
			specularProduct: {type: "c", value: SPEC},
			shininess: {type: "f", value: SHINY}
		},
		vertexShader: params.vertexShader,
		fragmentShader: params.fragmentShader,
		side: THREE.DoubleSide
	})

	const mesh = new THREE.Mesh(inst_geo, mat)
	mesh.name = name
	mesh.renderOrder = globals.getRenderOrder(name)
	mesh.frustumCulled = false

	return mesh

}


/*
interface DataVegtypeCommonParams {
	geo: THREE.Geometry,
	tex: THREE.Texture,
	width: number,
	height: number,
	vertShader: string,
	fragShader: string,
}

export function createDataVegetation(params: SpatialVegetationParams) {
	console.log('Generating data-driven vegetation...')

	let vegGroup = new THREE.Group()

	const strata_map = params.strataTexture
	const vegtypes = params.data
	const image = strata_map.image
	let w = image.naturalWidth
	let h = image.naturalHeight
	let canvas = document.createElement('canvas')
	canvas.width = w
	canvas.height = h
	let ctx = canvas.getContext('2d')
	ctx.drawImage(image, 0, 0, w, h)
	let strata_data = ctx.getImageData(0, 0, w, h).data
	const strata_positions = computeStrataPositions(vegtypes, strata_data, w, h)

	for (var name in vegtypes) {
		const assetName = globals.getVegetationAssetsName(name)
		const veg_geo = params.vegGeometries[assetName]
		const veg_tex = params.vegTextures[assetName + '_material']

		const vegtypePositions = computeVegtypePositions(vegtypes[name], strata_positions, strata_data, w, h)
		vegGroup.add(createDataVegtype(name, params.heightmap, params.stateclassTexture, 
			vegtypePositions.map,  vegtypePositions.numValid, params.heightData, {
				geo: veg_geo,
				tex: veg_tex,
				width: w,
				height: h,
				vertShader: params.vertShader,
				fragShader: params.fragShader,
			})
		)
	}
	
	strata_data = ctx = canvas = null

	console.log('Vegetation generated!')
	return vegGroup
}
*/



/*
function createDataVegtype(name: string, heightmap: THREE.Texture, init_tex: THREE.Texture, map: boolean[],
	numValid: number, heightData: any, params: DataVegtypeCommonParams) {

	const halfPatch = new THREE.Geometry()
	halfPatch.merge(params.geo)
	
	if (globals.useSymmetry(name)) {
		params.geo.rotateY(Math.PI)
		halfPatch.merge(params.geo)
	}

	const inst_geo = new THREE.InstancedBufferGeometry()
	inst_geo.fromGeometry(halfPatch)
	halfPatch.dispose()
	const s = globals.getVegetationScale(name)
	inst_geo.scale(s,s,s)

	// always remove the color buffer since we are using textures
	if ( inst_geo.attributes['color'] ) {
		inst_geo.removeAttribute('color')
	}		

	inst_geo.maxInstancedCount = numValid

	const offsets = new THREE.InstancedBufferAttribute(new Float32Array(numValid * 2), 2)
	const hCoords = new THREE.InstancedBufferAttribute(new Float32Array(numValid * 2), 2)
	const rotations = new THREE.InstancedBufferAttribute(new Float32Array(numValid), 1)

	inst_geo.addAttribute('offset', offsets)
	inst_geo.addAttribute('hCoord', hCoords)
	inst_geo.addAttribute('rotation', rotations)

	// generate offsets
	let i = 0
	let x: number, y:number, idx:number, posx: number, posy: number, tx:number, ty: number
	for (y = 0; y < params.height; y++) {
		for (x = 0; x < params.width; x++) {

			idx = (x + y * params.width)

			if (map[idx]) {
				posx = (x - params.width/2)
				posy = (y - params.height/2)
				
				tx = x / params.width
				ty = y / params.height

				offsets.setXY(i, posx, posy)
				hCoords.setXY(i, tx, 1 - ty)
				rotations.setX(i, Math.random() * 2.0)
				i++;
			}
		}
	}
	const maxHeight = heightData.dem_max

	const mat = new THREE.RawShaderMaterial({
		uniforms: {
			heightmap: {type: "t", value: heightmap},
			maxHeight: {type: "f", value: maxHeight},
			disp: {type: "f", value: 2.0 / 30.0},
			tex: {type:"t", value: params.tex},
			sc_tex: {type:"t", value:init_tex},
		},
		vertexShader: params.vertShader,
		fragmentShader: params.fragShader,
		side: THREE.DoubleSide
	})

	const mesh = new THREE.Mesh(inst_geo, mat)
	mesh.name = name
	mesh.renderOrder = globals.getRenderOrder(name)
	mesh.frustumCulled = false

	return mesh

}
*/

function getDiffuseScale(vegname: string) : number {
	if (vegname.includes("Sagebrush")) {
		return 0.7
	}

	return 0.0
}

function getAmbientProduct(vegname: string) : THREE.Color {
	if (vegname.includes("Sagebrush")) {
		return AMBIENT.multiplyScalar(0.2)
	}

	return AMBIENT

}