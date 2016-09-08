// app.ts

import * as globals from './globals'
import {createTerrain, createDataTerrain} from './terrain'
import {createVegetation, VegetationOptions, Cluster} from './veg'
import {createSpatialVegetation, createDataVegetation} from './spatialveg'
import {detectWebGL} from './utils'
import {Loader, Assets, AssetDescription} from './assetloader'

interface SpatialRunControl {
	min_step : number,
	max_step : number,
	step_size : number,
	result_scenario_id: number
}

export default function run(container_id: string, params: globals.VegParams) {

	const vegParams = params
	let initialized = false
	let spatial = false

	if (!detectWebGL) {
		alert("Your browser does not support WebGL. Please use a different browser (I.e. Chrome, Firefox).")
		return null
	}

	let masterAssets: Assets
	let spatialAssets: Assets
	let animationAssets: Assets
	let terrain: THREE.Mesh

	let _project_id: number

	let srcSpatialPath = 'spatial/height/'
	let statsSpatialPath = srcSpatialPath + 'stats/'
	let srcSpatialTextureBase = 'spatial/outputs/'	// scenario/data_type/timestep



	// setup the THREE scene
	const container = document.getElementById(container_id)
	const scene = new THREE.Scene()
	const renderer = new THREE.WebGLRenderer()
	container.appendChild(renderer.domElement)
	const camera = new THREE.PerspectiveCamera(75, container.offsetWidth / container.offsetHeight, .1, 1000.0)
	
	// Camera controls
	const controls = new THREE.OrbitControls(camera, renderer.domElement)
	controls.enableKeys = false
	camera.position.z = 40
	camera.position.y = 100
	controls.maxPolarAngle = Math.PI / 2

	// Custom event handlers since we only want to render when something happens.
	renderer.domElement.addEventListener('mousedown', animate, false)
	renderer.domElement.addEventListener('mouseup', stopAnimate, false)
	renderer.domElement.addEventListener('mousewheel', render, false)
	renderer.domElement.addEventListener( 'MozMousePixelScroll', render, false ); // firefox

	// Load initial assets
	const loader = Loader()
	loader.load({
			text: [
				/* realism shaders */
				{name: 'terrain_vert', url: 'static/shader/terrain.vert.glsl'},
				{name: 'terrain_frag', url: 'static/shader/terrain.frag.glsl'},
				{name: 'veg_vert', url: 'static/shader/veg.vert.glsl'},
				{name: 'veg_frag', url: 'static/shader/veg.frag.glsl'},
				/* data shaders */
				{name: 'data_terrain_vert', url: 'static/shader/data_terrain.vert.glsl'},
				{name: 'data_terrain_frag', url: 'static/shader/data_terrain.frag.glsl'},
				{name: 'data_veg_vert', url: 'static/shader/data_veg.vert.glsl'},
				{name: 'data_veg_frag', url: 'static/shader/data_veg.frag.glsl'},
				/* spatial veg shaders - TODO: remove these and replace with a modular system */
				{name: 'spatial_veg_vert', url: 'static/shader/spatial_veg.vert.glsl'},
				{name: 'spatial_veg_frag', url: 'static/shader/spatial_veg.frag.glsl'},
			],
			
			textures: [
				// terrain materials
				{name: 'terrain_rock', url: 'static/img/terrain/rock-512.jpg'},
				{name: 'terrain_grass', url: 'static/img/terrain/grass-512.jpg'},
				{name: 'terrain_snow', url: 'static/img/terrain/snow-512.jpg'},
				{name: 'terrain_sand', url: 'static/img/terrain/sand-512.jpg'},
				{name: 'terrain_water', url: 'static/img/terrain/water-512.jpg'},

				// vegtype materials
				{name: 'grass_material', url: 'static/img/grass/grass_base.tga'},
				{name: 'tree_material', url: 'static/img/grass/grass_base.tga'},	// just a base green color
				{name: 'juniper_material', url: 'static/img/juniper/pine-leaf-diff.png'},
				// sagebrush
				{name: 'sagebrush_material', url: 'static/img/sagebrush/sagebrush_alt.png'}
			],
			
			geometries: [
				{name: 'grass', url: 'static/json/geometry/grass.json'},
				{name: 'tree', url: 'static/json/geometry/tree.json'},
				{name: 'juniper', url: 'static/json/geometry/tree_simple.json'},
				{name: 'sagebrush', url: 'static/json/geometry/sagebrush_simple4.json'}
			]/*,
			statistics: [
				{name: 'vegclass_stats', url: ""}
			]
			*/
		},
		function(loadedAssets: Assets) {
			masterAssets = loadedAssets
			initialized = true
		},
		function(progress: number) {
			console.log("Loading assets... " + progress * 100 + "%")
		},
		function(error: string) {
			console.log(error)
			return
		}
	)

	let spatialExtent = [-1, -1, -1, -1]	// dummy vars for starting out

	function updateTerrain(extent: number[], updateVeg?: boolean) {

		// confirm params are different
		if (extent.length === 4	// extent is exactly 4 long
			&& (terrain == undefined || extent[0] != spatialExtent[0] ||
			extent[1] != spatialExtent[1] ||
			extent[2] != spatialExtent[2] ||
			extent[3] != spatialExtent[3])) {
			spatialExtent = extent
			if (terrain != undefined) {
				scene.remove(terrain)
				terrain.geometry.dispose()
				for (var key in vegParams) {
					scene.remove(scene.getObjectByName(key))
				}
			}
			
			let srcPath = 'heightmap/' + extent.join('/') + '/'
			let statsPath = srcPath + 'stats/'
			const tempLoader = Loader()
			tempLoader.load({
				textures: [
					{name: 'heightmap', url: srcPath},
				],
				statistics: [
					{name: 'heightmap_stats', url: statsPath},
				]
			},
	 		function(loadedAssets: Assets) {
				// compute the heights from this heightmap
				// Only do this once per terrain. We base our clusters off of this
				const heightmapTexture = loadedAssets.textures['heightmap']
				const heightmapStats = loadedAssets.statistics['heightmap_stats']
				const heights = computeHeights(heightmapTexture, heightmapStats)

				terrain = createTerrain({
					rock: masterAssets.textures['terrain_rock'],
					snow: masterAssets.textures['terrain_snow'],
					grass: masterAssets.textures['terrain_grass'],
					sand: masterAssets.textures['terrain_sand'],
					water: masterAssets.textures['terrain_water'],
					vertShader: masterAssets.text['terrain_vert'],
					fragShader: masterAssets.text['terrain_frag'],
					data: loadedAssets.statistics['heightmap_stats'],
					heightmap: heightmapTexture,
					heights: heights,
					disp: globals.TERRAIN_DISP
				})
				scene.add(terrain)

				let baseColor = new THREE.Color(55,80,100)	// TODO - better colors
				let i = 0
				const maxColors = 7

				// Add our vegcovers
				for (var key in vegParams) {

					// calculate the veg colors we want to display
					const r = Math.floor(i/maxColors * 200)
					const g = Math.floor(i/maxColors * 130)
					const vegColor = new THREE.Color(baseColor.r + r, baseColor.g + g, baseColor.b)

					const vegAssetName = globals.getVegetationAssetsName(key)
					const vegStats = getVegetationStats(key)

					scene.add(createVegetation( 
						{
							heightmap: loadedAssets.textures['heightmap'],
							name: key,
							tex: masterAssets.textures[vegAssetName + '_material'],
							geo: masterAssets.geometries[vegAssetName],
							color: vegColor,
							vertShader: masterAssets.text['veg_vert'],
							fragShader: masterAssets.text['veg_frag'],
							disp: globals.TERRAIN_DISP,
							clusters: createClusters(heights, heightmapStats, vegStats),
							heightData: loadedAssets.statistics['heightmap_stats'],
							vegData: vegStats
						}
					))

					++i;
				}
				render()
				if (updateVeg) updateVegetation(vegParams)
			},
			function(progress: number) {
				console.log("Loading heightmap assets... " + progress*100  + "%")
			},
			function(error: string) {
				console.log(error)
				return
			})
		}	
	}

	function updateSpatialTerrain(project_id: any, updateVeg?: boolean) {
		_project_id = project_id
		spatial = true
		camera.position.y = 350
		camera.position.z = 600
		const scenario_id = 210	// TODO - replace with a way to get this from the library
		const srcSpatialTexturePath = srcSpatialTextureBase + project_id + '/' + scenario_id
		const tempLoader = Loader()
		tempLoader.load({
				textures: [
					{name: 'spatial_heightmap', url: srcSpatialPath},
					{name: 'init_sc', url: srcSpatialTexturePath + '/stateclass/0/'},
					{name: 'init_veg', url: srcSpatialTexturePath + '/veg/0/'}
				],
				statistics: [
					{name: 'spatial_stats', url: statsSpatialPath},
					{name: 'veg_class_stats', url: 'spatial/stats/' + project_id + '/' + scenario_id +'/veg/'}
				],
			},
			function(loadedAssets: Assets) {
				spatialAssets = loadedAssets
				const heightmapTexture = spatialAssets.textures['spatial_heightmap']
				const heightmapStats = spatialAssets.statistics['spatial_stats']
				const heights = computeHeights(heightmapTexture, heightmapStats)
				const vegetationStats = spatialAssets.statistics['veg_class_stats']

				// define the realism group
				let realismGroup = new THREE.Group()
				realismGroup.name = 'realism'

				// create normal terrain
				terrain = createTerrain({
					rock: masterAssets.textures['terrain_rock'],
					snow: masterAssets.textures['terrain_snow'],
					grass: masterAssets.textures['terrain_grass'],
					sand: masterAssets.textures['terrain_sand'],
					water: masterAssets.textures['terrain_water'],
					vertShader: masterAssets.text['terrain_vert'],
					fragShader: masterAssets.text['terrain_frag'],
					data: heightmapStats,
					heightmap: heightmapTexture,
					heights: heights,
					disp: 2.0 / 30.0
				})
				realismGroup.add(terrain)

				// add the vegetation
				const realismVegetation = createSpatialVegetation({
					strataTexture: spatialAssets.textures['init_veg'],
					stateclassTexture: spatialAssets.textures['init_sc'],
					heightmap: heightmapTexture,
					vegGeometries: masterAssets.geometries,
					vegTextures: masterAssets.textures,
					vertShader: masterAssets.text['spatial_veg_vert'],
					fragShader: masterAssets.text['spatial_veg_frag'],
					data: vegetationStats,
					heightData: heightmapStats,
					disp: 2.0 / 30.0
				})
				realismGroup.add(realismVegetation)
				scene.add(realismGroup)

				// render the scene since the data group won't be rendered first.
				render()

				// define the data group
				let dataGroup = new THREE.Group()
				dataGroup.name = 'data'
				dataGroup.visible = false	// initially set to false
				const dataTerrain = createDataTerrain({
					heightmap: heightmapTexture,
					heights: heights,
					stateclassTexture: spatialAssets.textures['init_sc'],
					data: heightmapStats,
					vertShader: masterAssets.text['data_terrain_vert'],
					fragShader: masterAssets.text['data_terrain_frag'],
					disp: 2.0/ 30.0
				})
				dataGroup.add(dataTerrain)
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


			},
			function(progress: number) {
				console.log("Loading spatial assets... " + progress * 100 + "%")
			},
			function(error: string) {
				console.log(error)
				return
			}
		)
	}

	function updateSpatialVegetation(runControl: SpatialRunControl) {
		console.log('Updating vegetation covers')

		// updating the vegetation means getting the new stateclass textures to animate over
		const sid = runControl.result_scenario_id
		const srcSpatialTexturePath = srcSpatialTextureBase + _project_id + '/' + sid 

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
	}

	function computeHeights(hmTexture: THREE.Texture, stats: any) {
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
				heights[x + y * w] = data[idx] / 255.0 * stats.dem_max
			}
		}
		// Free the resources and return
		data = ctx = canvas = null
		return heights
	}

	function createClusters(heights: Float32Array, hmstats: any, vegstats: any) : Cluster[] {

		const numClusters = Math.floor(Math.random() * globals.MAX_CLUSTERS_PER_VEG)

		const finalClusters = new Array()

		const w = hmstats.dem_width
		const h = hmstats.dem_height
		const maxHeight = vegstats.maxHeight
		const minHeight = vegstats.minHeight
		let ix: number, iy: number, height: number
		for (let i = 0; i < numClusters; ++i) {
			ix = Math.floor(Math.random() * w)
			iy = Math.floor(Math.random() * h)
			height = heights[ix + iy * w]
			if (height < maxHeight && height > minHeight) { 
				
				const newCluster = {
					xpos: ix - w/2,
					ypos: iy - h/2,
				} as Cluster

				finalClusters.push(newCluster)
			}
		}

		return finalClusters
	}

	function getVegetationStats(vegname: string) : any {

		if (vegname.includes("Sagebrush")) {
			return {
				minHeight: 900.0,
				maxHeight: 3100.0
			}
		}
		else if (vegname.includes("Juniper")) {
			return {
				minHeight: 0.0,
				maxHeight: 3100.0
			}
		}

		return {
			minHeight: 0.0,
			maxHeight: 5000.0
		}

	}

	function updateVegetation(newParams: globals.VegParams) {

		for (var key in newParams) {
			if (vegParams.hasOwnProperty(key)) {
				vegParams[key] = newParams[key]		// update the object to what we want it to be
				const vegCover = scene.getObjectByName(key) as THREE.Mesh
				const vegGeo = vegCover.geometry as THREE.InstancedBufferGeometry
				if (globals.USE_RANDOM) {
					vegGeo.maxInstancedCount = Math.floor(vegParams[key] / 100 * globals.MAX_INSTANCES)	// make this a static function
				}
				else {
					const vegClusters = vegCover.userData['numClusters']
					vegGeo.maxInstancedCount = Math.floor(globals.MAX_INSTANCES * (vegParams[key] / 100) * (vegClusters / globals.MAX_CLUSTERS_PER_VEG))
				}
			}
		}

		render()
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
	}

	function isInitialized() {
		return initialized
	}

	function isSpatial() {
		return spatial
	}

	return {
		updateTerrain: updateTerrain,	// non-spatial runs
		updateVegetation: updateVegetation,
		updateSpatialTerrain: updateSpatialTerrain,	// spatial runs
		updateSpatialVegetation: updateSpatialVegetation,
		isInitialized: isInitialized,
		isSpatial: isSpatial,
		resize: resize,
		// debug 
		scene: scene,
		camera: camera
	}
}

