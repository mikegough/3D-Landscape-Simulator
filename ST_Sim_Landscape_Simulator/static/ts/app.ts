// app.ts

import * as globals from './globals'
import {createTerrain, createDataTerrain} from './terrain'
import {createSpatialVegetation/*, createDataVegetation*/} from './veg'
import {detectWebGL} from './utils'
import {Loader, Assets, AssetList, AssetDescription, AssetRepo} from './assetloader'
import * as STSIM from './stsim'


export default function run(container_id: string) {

	if (!detectWebGL) {
		alert("Your browser does not support WebGL. Please use a different browser (I.e. Chrome, Firefox).")
		return null
	}

	let initialized = false
	let masterAssets = {} as AssetRepo

	// setup the THREE scene
	const container = document.getElementById(container_id)
	const scene = new THREE.Scene()
	const renderer = new THREE.WebGLRenderer()
	container.appendChild(renderer.domElement)
	const camera = new THREE.PerspectiveCamera(75, container.offsetWidth / container.offsetHeight, .1, 100000.0)
	
	// Camera controls
	const controls = new THREE.OrbitControls(camera, renderer.domElement)
	controls.enableKeys = false
	camera.position.y = 350
	camera.position.z = 600
	controls.maxPolarAngle = Math.PI / 2

	// Custom event handlers since we only want to render when something happens.
	//renderer.domElement.addEventListener('mousedown', animate, false)
	//renderer.domElement.addEventListener('mouseup', stopAnimate, false)
	//renderer.domElement.addEventListener('mousewheel', render, false)
	//renderer.domElement.addEventListener( 'MozMousePixelScroll', render, false ); // firefox

	initialize()

	// Load initial assets
	function initialize() {

		let terrainInitialized = false
		let vegetationInitialized = false
		function tryDone() {
			return terrainInitialized && vegetationInitialized
		}

		const terrainLoader = Loader()
		terrainLoader.load({
				text: [
					/* realism shaders */
					{name: 'terrain_vert', url: 'static/shader/terrain.vert.glsl'},
					{name: 'terrain_frag', url: 'static/shader/terrain.frag.glsl'},
					/* data shaders */
					{name: 'data_terrain_vert', url: 'static/shader/data_terrain.vert.glsl'},
					{name: 'data_terrain_frag', url: 'static/shader/data_terrain.frag.glsl'},
				],
				textures: [
					// terrain materials
					{name: 'terrain_rock', url: 'static/img/terrain/rock-512.jpg'},
					{name: 'terrain_grass', url: 'static/img/terrain/grass-512.jpg'},
					{name: 'terrain_snow', url: 'static/img/terrain/snow-512.jpg'},
					{name: 'terrain_sand', url: 'static/img/terrain/sand-512.jpg'},
					{name: 'terrain_water', url: 'static/img/terrain/water-512.jpg'},
		
				],
			},
			function(loadedAssets: Assets) {
				console.log('Terrain loaded')
				masterAssets['terrain'] = loadedAssets
				terrainInitialized = true
				initialized = tryDone()
			},
			reportProgress, reportError)

		const vegetationLoader = Loader()
		vegetationLoader.load(
			{
				text: [
					{name: 'real_veg_vert', url: 'static/shader/real_veg.vert.glsl'},
					{name: 'real_veg_frag', url: 'static/shader/real_veg.frag.glsl'},
					{name: 'data_veg_vert', url: 'static/shader/data_veg.vert.glsl'},
					{name: 'data_veg_frag', url: 'static/shader/data_veg.frag.glsl'},
				]
			},
			function(loadedAssets: Assets) {
				console.log('Vegetation shaders loaded')
				masterAssets['vegetation'] = loadedAssets
				vegetationInitialized = true
				initialized = tryDone()
			},
			reportProgress, reportError)
	}

	let currentDefinitions : STSIM.LibraryDefinitions
	let currentLibraryName = ""
	function setLibraryDefinitions(name:string, definitions: STSIM.LibraryDefinitions) {
		if (name != currentLibraryName) {
			currentLibraryName = name
			currentDefinitions = definitions
		}
	}

	let currentUUID : string
	let currentConditions : STSIM.LibraryInitConditions
	function setStudyArea(uuid : string, initialConditions: STSIM.LibraryInitConditions) {
		if (uuid != currentUUID) {
			currentUUID = uuid
			currentConditions = initialConditions

			// remove current terrain and vegetation cover
			if (scene.getObjectByName('terrain') != undefined) {
				scene.remove(scene.getObjectByName('data'))
				scene.remove(scene.getObjectByName('realism'))
				render()
			}

			const baseSourceURL = [currentLibraryName, 'select', currentUUID].join('/')
			const studyAreaLoader = Loader()
			let studyAreaAssets = {} as AssetList

			// Construct urls for vegetation geometry, textures based on asset names
			const assetNamesList = currentDefinitions.veg_model_config.visualization_asset_names
			let textures = [] as AssetDescription[]
			let geometries = [] as AssetDescription[]
			let assetName : any

			textures.push({name: 'elevation', url: baseSourceURL + '/elev/'})
			textures.push({name: 'veg_tex', url: baseSourceURL + '/veg/'})
			textures.push({name: 'sc_tex', url: baseSourceURL + '/sc/'})

			for (var idx in assetNamesList) {
				assetName = assetNamesList[idx].asset_name
				geometries.push({
					name: assetName + '_geometry',
					url: 'static/json/geometry/' + assetName + '.json'					
				})
				textures.push({
					name: assetName + '_material',
					url: 'static/img/' + assetName + '.png'
				})
			}

			// TODO - use these instead of a stock geometry/material
			studyAreaAssets.textures = textures
			studyAreaAssets.geometries = geometries

			// TODO - use the above and remove the below
			
			studyAreaAssets.textures = [
				{name: 'elevation', url: baseSourceURL + '/elev/'},
				{name: 'veg_tex', url: baseSourceURL + '/veg/'},
				{name: 'sc_tex', url: baseSourceURL + '/sc/'},
				{name: 'material', url: 'static/img/sagebrush/sagebrush_alt.png'}
			]
			studyAreaAssets.geometries = [
					{name: 'geometry', url: 'static/json/geometry/sagebrush_simple4.json'}
			]
			
			studyAreaLoader.load(studyAreaAssets, createScene, reportProgress, reportError)
		}
	}

	function createScene(loadedAssets: Assets) {
		masterAssets[currentLibraryName] = loadedAssets

		const heightmapTexture = loadedAssets.textures['elevation']
		const heights = computeHeights(heightmapTexture)
		const disp = 3.0 / 30.0

		// define the realism group
		let realismGroup = new THREE.Group()
		realismGroup.name = 'realism'
		const terrainAssets = masterAssets['terrain']
		const vegetationAssets = masterAssets['vegetation']
		// create normal terrain
		const realismTerrain = createTerrain({
			rock: terrainAssets.textures['terrain_rock'],
			snow: terrainAssets.textures['terrain_snow'],
			grass: terrainAssets.textures['terrain_grass'],
			sand: terrainAssets.textures['terrain_sand'],
			water: terrainAssets.textures['terrain_water'],
			vertShader: terrainAssets.text['terrain_vert'],
			fragShader: terrainAssets.text['terrain_frag'],
			data: currentConditions.elev,
			heightmap: heightmapTexture,
			heights: heights,
			disp: disp
		})
		realismGroup.add(realismTerrain)
		const realismVegetation = createSpatialVegetation({
			zonalVegtypes: currentConditions.veg_sc_pct,
			vegtypes: currentDefinitions.vegtype_definitions,
			config: currentDefinitions.veg_model_config,
			strataTexture: loadedAssets.textures['veg_tex'],
			stateclassTexture: loadedAssets.textures['sc_tex'],
			heightmap: heightmapTexture,
			geometries: loadedAssets.geometries,
			textures: loadedAssets.textures,
			vertexShader: vegetationAssets.text['real_veg_vert'],
			fragmentShader: vegetationAssets.text['real_veg_frag'],
			heightStats: currentConditions.elev,
			disp: disp
		})
		realismGroup.add(realismVegetation)		
		scene.add(realismGroup)

				/*
				// define the data group
				let dataGroup = new THREE.Group()
				dataGroup.name = 'data'
				dataGroup.visible = false	// initially set to false
				const dataTerrain = createDataTerrain({
					heightmap: heightmapTexture,
					heights: heights,
					stateclassTexture: loadedAssets.textures['init_sc'],
					data: heightmapStats,
					vertShader: terrainAssets.text['data_terrain_vert'],
					fragShader: terrainAssets.text['data_terrain_frag'],
					disp: 2.0/ 30.0
				})
				dataGroup.add(dataTerrain)
				*/
				/*
				const dataVegetation = createDataVegetation({
					strataTexture: spatialAssets.textures['init_veg'],
					stateclassTexture: spatialAssets.textures['init_sc'],
					heightmap: heightmapTexture,
					vegGeometries: masterAssets.geometries,
					vegTextures: masterAssets.textures,
					vertShader: masterAssets.text['data_veg_vert'],
					fragShader: masterAssets.text['data_veg_frag'],
					data: vegetationStats,
					heightData: heightmapStats,
					disp: 2.0 / 30.0
				})
				dataGroup.add(dataVegetation)
				scene.add(dataGroup)
				*/


		// render the scene once everything is finished being processed
		console.log('Vegetation Rendered!')
		render()	
	}



	function updateSpatialVegetation(runControl: STSIM.RunControl) {
		console.log('Updating vegetation covers')
		/*
		// updating the vegetation means getting the new stateclass textures to animate over
		const sid = runControl.result_scenario_id
		//const srcSpatialTexturePath = srcSpatialTextureBase + _project_id + '/' + sid 
		const srcSpatialTexturePath = srcSpatialTextureBase + 'Castle Creek'

		let model_outputs : AssetDescription[] = new Array()
		for (var step = runControl.min_step; step <= runControl.max_step; step += runControl.step_size) {
			model_outputs.push({name: String(step), url: srcSpatialTexturePath + '/stateclass/' + step + '/'})
		}
		const tempLoader = Loader()
		tempLoader.load({
				textures: model_outputs,
			},
			function(loadedAssets: Assets) {
				console.log('Animation assets loaded!')
				console.log(loadedAssets.textures)
				animationAssets = loadedAssets

				// show the animation controls for the outputs
    			$('#animation_container').show();

				// activate the checkbox
				$('#viz_type').on('change', function() {
					const dataGroup = scene.getObjectByName('data')
					const realismGroup = scene.getObjectByName('realism')
					if (dataGroup.visible) {
						dataGroup.visible = false
						realismGroup.visible = true
					} else {
						dataGroup.visible = true
						realismGroup.visible = false
					}
					render()
				})

				const dataGroup = scene.getObjectByName('data') as THREE.Group
				const realismGroup = scene.getObjectByName('realism') as THREE.Group
				dataGroup.visible = true
				realismGroup.visible = false
				render()

				// create an animation slider and update the stateclass texture to the last one in the timeseries, poc
				const animationSlider = $('#animation_slider')
				animationSlider.attr('max', runControl.max_step)
				animationSlider.attr('step', runControl.step_size)
				animationSlider.on('input', function() {
					const value = animationSlider.val()
					let timeTexture: THREE.Texture

					if (value == 0 || value == '0') {
						timeTexture = spatialAssets.textures['init_sc']
					}
					else {
						timeTexture = animationAssets.textures[String(value)]
					}

					// update the dataGroup terrain and vegtypes
					let child: THREE.Object3D
					const dataGroup = scene.getObjectByName('data') as THREE.Group
					for (var i = 0; i < dataGroup.children.length; i++) {
						child = dataGroup.children[i]
						if (child.name == 'terrain') {
							child.material.uniforms.tex.value = timeTexture
							child.material.needsUpdate = true
						}
						else {
							// iterate through the child group
							for (var j = 0; j < child.children.length; j++) {
								child.children[j].material.uniforms.sc_tex.value = timeTexture
								child.children[j].material.needsUpdate = true
							}
						}
	
					}

					render()
				})

			},
			function(progress: number) {
				console.log("Loading model assets... " + progress * 100 + "%")
			},
			function(error: string) {
				console.log(error)
				return
			}
		)
		*/
	}

	function computeHeights(hmTexture: THREE.Texture ) { //, stats: STSIM.ElevationStatistics) {
		const image = hmTexture.image
		let w = image.naturalWidth
		let h = image.naturalHeight
		let canvas = document.createElement('canvas')
		canvas.width = w
		canvas.height = h
		let ctx = canvas.getContext('2d')
		ctx.drawImage(image, 0, 0, w, h)
		let data = ctx.getImageData(0, 0, w, h).data
		const heights = new Float32Array(w * h)
		let idx: number
		for (let y = 0; y < h; ++y) {
			for (let x = 0; x < w; ++x) {
				// idx pixel we want to get. Image has rgba, but we only need the r channel
				idx = (x + y * w) * 4

				// scale & store this altitude
				heights[x + y * w] = (data[idx] | (data[idx+1] << 8) | (data[idx+2] << 16)) + data[idx+3] - 255  
			}
		}
		// Free the resources and return
		data = ctx = canvas = null
		return heights
	}

	function render() {
		renderer.render(scene, camera)
		controls.update()
	}

	let renderID: any

	function animate() {
		render()
		renderID = requestAnimationFrame(animate)
	}

	function stopAnimate() {
		cancelAnimationFrame(renderID)
	}

	function resize() {
		renderer.setSize(container.offsetWidth, container.offsetHeight)
		camera.aspect = container.offsetWidth / container.offsetHeight
		camera.updateProjectionMatrix()
		render()
	}

	function isInitialized() {
		return initialized
	}

	animate()
	return {
		isInitialized: isInitialized,
		resize: resize,
		// debug 
		scene: scene,
		camera: camera,
		setLibraryDefinitions: setLibraryDefinitions,
		setStudyArea: setStudyArea,
		libraryDefinitions: masterAssets[currentLibraryName],
		//collectSpatialOutput: updateSpatialVegetation

		// TODO - remove in production
		currentLibrary: getCurrentDefinitions
	}


	// debug functions
	function getCurrentDefinitions() {
		return currentDefinitions
	}

}

function reportProgress(progress: number) {
	console.log("Loading assets... " + progress * 100 + "%")
}

function reportError(error: string) {
	console.log(error)
	return
}

