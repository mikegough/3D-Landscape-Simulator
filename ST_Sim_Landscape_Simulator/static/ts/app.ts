// app.ts

import {createTerrain, createDataTerrain, createTerrainTile, TileData} from './terrain'
import {createSpatialVegetation, VegetationGroups} from './veg'
import {detectWebGL, detectWebWorkers} from './utils'
import {Loader, Assets, AssetList, AssetDescription, AssetRepo} from './assetloader'
import * as STSIM from './stsim'


const compute_heights = [
	"var onmessage = function(e) {",
		"postMessage(computeHeights(e.data.w, e.data.h, e.data.data))",
	"};",
	"function computeHeights(w,h,data) {",
	"	var idx;",
	"	var heights = new Float32Array(w * h);",
	"	for (var y = 0; y < h; ++y) {",
	"		for (var x = 0; x < w; ++x) {",
	"			idx = (x + y * w) * 4;",
	"			heights[x + y * w] = (data[idx] | (data[idx+1] << 8) | (data[idx+2] << 16)) + data[idx+3] - 255;",
	"		}",
	"	}",
	"	return heights",
	"}"
].join('\n')


export default function run(container_id: string, showloadingScreen: Function, hideLoadingScreen: Function) {

	if (!detectWebGL()) {
		alert("Your browser does not support WebGL. Please use a different browser (I.e. Chrome, Firefox).")
		return null
	}

	const useWebWorker = detectWebWorkers()

	const disp = 2.0 / 60.0

	let initialized = false
	let masterAssets = {} as AssetRepo

	// setup the THREE scene
	const container = document.getElementById(container_id)
	const scene = new THREE.Scene()
	const renderer = new THREE.WebGLRenderer({antialias: false})
	container.appendChild(renderer.domElement)

	// camera creation
	const camera = new THREE.PerspectiveCamera(60, container.offsetWidth / container.offsetHeight, 2.0, 1500.0)
	camera.position.y = 350
	camera.position.z = 600
	const camera_start = new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z)

	function resetCamera() {
		controls.target = new THREE.Vector3(0,0,0)
		camera.position.set(camera_start.x,camera_start.y,camera_start.z)
		controls.update()
		render()
	}

	// Custom event handlers since we only want to render when something happens.
	renderer.domElement.addEventListener('mousedown', animate, false)
	renderer.domElement.addEventListener('mouseup', stopAnimate, false)
	renderer.domElement.addEventListener('mousewheel', render, false)
	renderer.domElement.addEventListener( 'MozMousePixelScroll', render, false ); // firefox


	// Camera controls
	const controls = new THREE.OrbitControls(camera, renderer.domElement)
	controls.enableKeys = false
	controls.zoomSpeed = 0.1
	controls.maxPolarAngle = Math.PI / 2.4
	controls.minDistance = 150
	controls.maxDistance = 900

	/*
	var gui = new dat.GUI({autoPlace: false});
    var terrainControls = gui.addFolder('Terrain Controls', "a");
    terrainControls.add(verticalScale, 'verticalScale',0.0, 10.0).onChange( function(){
        material.uniforms.verticalScale.value = verticalScale.verticalScale;
    });
    terrainControls.add(verticalScale, 'flipLegend', 1.0).onChange( function() {
        if (material.uniforms.legendOrientation.value == 1) {
            material.uniforms.legendOrientation.value = 0;
        } else {
            material.uniforms.legendOrientation.value = 1;
        }
        RedrawLegend(currentVariableName);
    });
    terrainControls.open();
    gui.domElement.style.position='absolute';
    gui.domElement.style.bottom = '20px';
    gui.domElement.style.right = '0%';
    gui.domElement.style.textAlign = 'center';
    container.appendChild(gui.domElement);
    */


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
					/* tile shaders */
					{name: 'tile_vert', url: 'static/shader/terrain_tile.vert.glsl'},
					{name: 'tile_frag', url: 'static/shader/terrain_tile.frag.glsl'},
					/* realism shaders */
					{name: 'terrain_vert', url: 'static/shader/terrain.vert.glsl'},
					{name: 'terrain_frag', url: 'static/shader/terrain.frag.glsl'},
					/* data shaders */
					{name: 'data_terrain_vert', url: 'static/shader/data_terrain.vert.glsl'},
					{name: 'data_terrain_frag', url: 'static/shader/data_terrain.frag.glsl'},
				],
				textures: [
					// terrain materials
					{name: 'terrain_dirt', url: 'static/img/terrain/dirt-512.jpg'},
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
			camera.position.set(camera_start.x, camera_start.y, camera_start.z)

			// remove current terrain and vegetation cover
			if (scene.getObjectByName('terrain') != undefined) {
				scene.remove(scene.getObjectByName('terrain'))
				scene.remove(scene.getObjectByName('data'))
				scene.remove(scene.getObjectByName('realism'))
				scene.remove(scene.getObjectByName('vegetation'))
				render()
			}

			const baseSourceURL = [currentLibraryName, 'select', currentUUID].join('/')
			const studyAreaLoader = Loader()
			let studyAreaAssets = {} as AssetList

			// Construct urls for vegetation geometry, textures based on asset names
			const assetNamesList = currentDefinitions.veg_model_config.visualization_asset_names
			let textures = [] as AssetDescription[]
			let geometries = [] as AssetDescription[]
			let assetName : string
			let assetPath : string
			textures.push({name: 'elevation', url: baseSourceURL + '/elev/'})
			textures.push({name: 'veg_tex', url: baseSourceURL + '/veg/'})
			textures.push({name: 'sc_tex', url: baseSourceURL + '/sc/'})

			for (var idx in assetNamesList) {
				assetName = assetNamesList[idx].asset_name
				assetPath = [currentLibraryName, assetName].join('/')
				geometries.push({
					name: assetName,
					url: 'static/json/geometry/' + assetPath + '.json'					
				})
				textures.push({
					name: assetName,
					url: 'static/img/' + assetPath + '.png'
				})
			}

			studyAreaAssets.textures = textures
			studyAreaAssets.geometries = geometries
			studyAreaLoader.load(studyAreaAssets, createScene, reportProgress, reportError)
		}
	}

	let current_unit_id : string
	function setStudyAreaTiles(reporting_unit_name: string, unit_id : string, initialConditions: STSIM.LibraryInitConditions) {
		if (unit_id != current_unit_id) {

			if (scene.getObjectByName('terrain') != undefined) {
				scene.remove(scene.getObjectByName('terrain'))
				scene.remove(scene.getObjectByName('data'))
				scene.remove(scene.getObjectByName('realism'))
				scene.remove(scene.getObjectByName('vegetation'))
				render()
			}

			currentConditions = initialConditions
			current_unit_id = unit_id

			// collect assets for the tiles
			const baseTilePath = currentLibraryName + '/select/' + reporting_unit_name + '/' + unit_id
			const studyAreaLoader = Loader()
			let studyAreaTileAssets = {} as AssetList
			let textures = [] as AssetDescription[]
			let i :number, j : number
			for (i = 0; i < currentConditions.elev.x_tiles; i++) {
				for (j = 0; j < currentConditions.elev.y_tiles; j++) {
					textures.push({
						name: [i,j,'veg'].join('_'),
						url: baseTilePath + '/veg/' + String(i) + '/' + String(j) + '/'
					})
					textures.push({
						name: [i,j,'sc'].join('_'),
						url: baseTilePath + '/sc/' + String(i) + '/' + String(j) + '/'
					})
					textures.push({
						name: [i,j,'elev'].join('_'),
						url: baseTilePath + '/elev/' + String(i) + '/' + String(j) + '/'
					})

				}
			}

			studyAreaTileAssets.textures = textures
			studyAreaLoader.load(studyAreaTileAssets, createTiles, reportProgress, reportError)
		}
	}

	function createTiles(loadedAssets: Assets) {

		camera.position.set(camera_start.x, camera_start.y, camera_start.z)

		const tile_size = currentConditions.elev.tile_size
		const x_tiles = currentConditions.elev.x_tiles
		const y_tiles = currentConditions.elev.y_tiles
		const world_width = currentConditions.elev.dem_width
		const world_height = currentConditions.elev.dem_height
		const world_x_offset = -1 * world_width / 2 + tile_size / 2
		const world_y_offset = world_height - tile_size / 2
		const tile_group = new THREE.Group()
		tile_group.name = 'terrain'
		scene.add(tile_group)

		function createOneTile(x: number, y: number, x_offset: number, y_offset: number) {

			const heightmap = loadedAssets.textures[[x,y,'elev'].join('_')]

			const image = heightmap.image
			let w = image.naturalWidth
			let h = image.naturalHeight
			let canvas = document.createElement('canvas')
			canvas.width = w
			canvas.height = h
			let ctx = canvas.getContext('2d')
			ctx.drawImage(image, 0, 0, w, h)
			let data = ctx.getImageData(0, 0, w, h).data
			

			const init_tex_name = [x,y,'sc'].join('_')
			const initial_texture = loadedAssets.textures[init_tex_name]
			const object_width = initial_texture.image.width
			const object_height = initial_texture.image.height
			const x_object_offset = object_width / 2 - tile_size / 2
			const y_object_offset = object_height / 2 - tile_size / 2
			const translate_x = world_x_offset + x_offset + x_object_offset
			const translate_y = world_y_offset + y_offset - y_object_offset

			if (useWebWorker) {
				var compute_heights_worker = new Worker(URL.createObjectURL(new Blob([compute_heights], {type: 'text/javascript'})))
				compute_heights_worker.onmessage = function(e) {
			
					const heights = e.data
					tile_group.add(createTerrainTile({
						x: x,
						y: y,
						width: object_width,
						height: object_height,
						translate_x: translate_x,
						translate_y: translate_y,
						translate_z: -currentConditions.elev.dem_min,
						init_tex: initial_texture,
						heights: heights,
						disp: disp,
						vertexShader: masterAssets['terrain'].text['tile_vert'],
						fragmentShader: masterAssets['terrain'].text['tile_frag']
					}))
	
					compute_heights_worker.terminate()
					compute_heights_worker = undefined
					render()
				}

				// Send the data
				compute_heights_worker.postMessage({data:data, w: w, h:h})
			}
			else {
				console.log('No web workers, computing on main thread...')
				const heights = computeHeightsCPU(loadedAssets.textures[[x,y,'elev'].join('_')])
				tile_group.add(createTerrainTile({
					x: x,
					y: y,
					width: object_width,
					height: object_height,
					translate_x: translate_x,
					translate_y: translate_y,
					translate_z: -currentConditions.elev.dem_min,
					init_tex: initial_texture,
					heights: heights,
					disp: disp,
					vertexShader: masterAssets['terrain'].text['tile_vert'],
					fragmentShader: masterAssets['terrain'].text['tile_frag']
				}))
			}
		} 

		let local_x_offset = 0
		let local_y_offset = 0

		let x: number, y: number
		for (x = 0; x < x_tiles; x++) {
			local_y_offset = 0
			for (y = 0; y < y_tiles; y++) {
				createOneTile(x, y, local_x_offset, local_y_offset)
                local_y_offset -= tile_size;
			}
			local_x_offset += tile_size;
		}

		tile_group.rotateX(-Math.PI / 2)

		// show the animation controls for the outputs
		/*
    	$('#animation_container').show();
	
		// activate the checkbox
		$('#viz_type').on('change', function() {
			let i : number
			let child : THREE.Mesh
			for (i = 0; i < tile_group.children.length; i++) {
				child = tile_group.children[i] as THREE.Mesh
				let child_data = child.userData as TileData
				let child_mat = child.material as THREE.ShaderMaterial
				if (child_data['active_texture_type'] == 'veg') {
					child_mat.uniforms.active_texture.value = loadedAssets.textures[[child_data.x, child_data.y, 'sc'].join('_')]		
					child_data['active_texture_type'] = 'sc'
				} else {
					child_mat.uniforms.active_texture.value = loadedAssets.textures[[child_data.x, child_data.y, 'veg'].join('_')]
					child_data['active_texture_type'] = 'veg'
				}
				child_mat.uniforms.active_texture.needsUpdate = true
			}
			render()
			// redraw legend
			if (child.userData.active_texture_type == 'veg') {


				let veg_color_map = {}
				for (var code in currentConditions.veg_sc_pct) {
					for (var name in currentDefinitions.veg_type_color_map) {
						if (Number(name) == Number(code)) {
							if (currentDefinitions.has_lookup) {
								veg_color_map[String(currentConditions.veg_names[name]).substr(0, 30) + '...'] = currentDefinitions.veg_type_color_map[name]
							} else {
								veg_color_map[name] = currentDefinitions.veg_type_color_map[name]								
							}
							break
						}
					}
				}

				drawLegendCallback(veg_color_map)
			} else {
				drawLegendCallback(currentDefinitions.state_class_color_map)				
			}

		})
		*/



		// always finish with a render
		resetCamera()
		//controls.update()
		//render()
		hideLoadingScreen()
	}

	function createScene(loadedAssets: Assets) {
		masterAssets[currentLibraryName] = loadedAssets


		const heightmapTexture = loadedAssets.textures['elevation']
		const terrainAssets = masterAssets['terrain']
		const vegetationAssets = masterAssets['vegetation']
		
		function createObjects(heights: Float32Array) {
			// define the realism group
			let realismGroup = new THREE.Group()
			realismGroup.name = 'realism'
			const realismTerrain = createTerrain({
				dirt: terrainAssets.textures['terrain_dirt'],
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
		
			// define the data group
			let dataGroup = new THREE.Group()
			dataGroup.name = 'data'
			dataGroup.visible = false	// initially set to false
			const dataTerrain = createDataTerrain({
				heightmap: heightmapTexture,
				heights: heights,
				stateclassTexture: loadedAssets.textures['sc_tex'],
				data: currentConditions.elev,
				vertShader: terrainAssets.text['data_terrain_vert'],
				fragShader: terrainAssets.text['data_terrain_frag'],
				disp: disp
			})
			dataGroup.add(dataTerrain)
		
			let vegAssetGroups = {} as STSIM.VizMapping
			let assetGroup : STSIM.VizAsset
			let i : number, j : number, breakout : boolean, name : string
			for (name in currentConditions.veg_sc_pct) {
				for (i = 0; i < currentDefinitions.veg_model_config.visualization_asset_names.length; i++) {
					assetGroup = currentDefinitions.veg_model_config.visualization_asset_names[i]
					breakout = false
					for (j = 0; j < assetGroup.valid_names.length; j++) {
						// is there a lookup in our definitions
						if (currentDefinitions.veg_model_config.lookup_field) {
							const lookupNames = currentDefinitions.veg_model_config.asset_map
							if (lookupNames[name] == assetGroup.valid_names[j]) {
								vegAssetGroups[name] = assetGroup
								breakout = true
								break;
							}
						// use the library names as is
						} else {
							if (name == assetGroup.valid_names[j]) {
								vegAssetGroups[name] = assetGroup
								breakout = true
								break;
							}	
						}
					}
					if (breakout) break;
				}
			}

			// create the vegetation
			const vegGroups = createSpatialVegetation({
				libraryName: currentLibraryName,
				zonalVegtypes: currentConditions.veg_sc_pct,
				veg_names: currentConditions.veg_names,
				vegAssetGroups : vegAssetGroups,
				vegtypes: currentDefinitions.vegtype_definitions,
				config: currentDefinitions.veg_model_config,
				strataTexture: loadedAssets.textures['veg_tex'],
				stateclassTexture: loadedAssets.textures['sc_tex'],
				heightmap: heightmapTexture,
				geometries: loadedAssets.geometries,
				textures: loadedAssets.textures,
				realismVertexShader: vegetationAssets.text['real_veg_vert'],
				realismFragmentShader: vegetationAssets.text['real_veg_frag'],
				dataVertexShader: vegetationAssets.text['data_veg_vert'],
				dataFragmentShader: vegetationAssets.text['data_veg_frag'],
				heightStats: currentConditions.elev,
				disp: disp
			}) as VegetationGroups
			//realismGroup.add(vegGroups.data)		
			//dataGroup.add(vegGroups.data)
			scene.add(vegGroups.data)
			scene.add(realismGroup)
			scene.add(dataGroup)
	
	
			// show the animation controls for the outputs
    		$('#animation_container').show();
	
			// activate the checkbox
			$('#viz_type').on('change', function() {
			if (dataGroup.visible) {
					dataGroup.visible = false
					realismGroup.visible = true
				} else {
					dataGroup.visible = true
					realismGroup.visible = false
				}
				render()
			})
				
			// render the scene once everything is finished being processed
			console.log('Vegetation Rendered!')
			//render()
			resetCamera()
			hideLoadingScreen()
		}

		if (useWebWorker) {
			const image = heightmapTexture.image
			let w = image.naturalWidth
			let h = image.naturalHeight
			let canvas = document.createElement('canvas')
			canvas.width = w
			canvas.height = h
			let ctx = canvas.getContext('2d')
			ctx.drawImage(image, 0, 0, w, h)
			let data = ctx.getImageData(0, 0, w, h).data
			var compute_heights_worker = new Worker(URL.createObjectURL(new Blob([compute_heights], {type: 'text/javascript'})))
			compute_heights_worker.onmessage = function(e) {
				createObjects(e.data)
				compute_heights_worker.terminate()
				compute_heights_worker = undefined
				render()
			}
			// Send the data
			compute_heights_worker.postMessage({data:data, w: w, h:h})
		} else {
			const heights = computeHeightsCPU(heightmapTexture)
			createObjects(heights)
		}
	}

	function collectSpatialOutputs(runControl: STSIM.RunControl) {

		if (!runControl.spatial) return
		console.log('Updating vegetation covers')
		
		const sid = runControl.result_scenario_id
		const srcSpatialTexturePath = runControl.library + '/outputs/' + sid

		let model_outputs : AssetDescription[] = new Array()
		for (var step = runControl.min_step; step <= runControl.max_step; step += runControl.step_size) {
			for (var it = 1; it <= runControl.iterations; it += 1) {
				
				model_outputs.push({name: String(it) + '_' + String(step), url: srcSpatialTexturePath + '/sc/' + it + '/' + step + '/'})
				if (step == runControl.min_step) break;	// Only need to get the initial timestep 1 time for all iterations			
			}
		}
		const outputsLoader = Loader()
		outputsLoader.load({
				textures: model_outputs,
			},
			function(loadedAssets: Assets) {
				console.log('Animation assets loaded!')
				
				masterAssets[String(sid)] = loadedAssets

				const dataGroup = scene.getObjectByName('data') as THREE.Group
				const realismGroup = scene.getObjectByName('realism') as THREE.Group
				dataGroup.visible = true
				realismGroup.visible = false
				render()

				// create an animation slider and update the stateclass texture to the last one in the timeseries, poc
				$('#viz_type').prop('checked', true)
				const animationSlider = $('#animation_slider')
				const currentIteration = 1								// TODO - show other iterations
				animationSlider.attr('max', runControl.max_step)
				animationSlider.attr('step', runControl.step_size)
				animationSlider.on('input', function() {
					const timestep = animationSlider.val()
					let timeTexture: THREE.Texture
					if (timestep == 0 || timestep == '0') {
						timeTexture = masterAssets[String(sid)].textures['1_0']
					}
					else {
						timeTexture = masterAssets[String(sid)].textures[String(currentIteration) + '_' + String(timestep)]
					}

					let vegetation = scene.getObjectByName('vegetation')
					let childMaterial: THREE.RawShaderMaterial
					for (var i = 0; i < vegetation.children.length; i++) {
						const child = vegetation.children[i] as THREE.Mesh
						childMaterial = child.material as THREE.RawShaderMaterial
						childMaterial.uniforms.sc_tex.value = timeTexture
						childMaterial.needsUpdate = true
					}

					render()
				})
			},reportProgress,reportError)
	}


	function computeHeightsCPU(hmTexture: THREE.Texture ) { //, stats: STSIM.ElevationStatistics) {

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
				idx = (x + y * w) * 4
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
		const newContainer = document.getElementById(container_id)
		renderer.setSize(newContainer.offsetWidth, newContainer.offsetHeight)
		camera.aspect = newContainer.offsetWidth / newContainer.offsetHeight
		camera.updateProjectionMatrix()
		render()
	}

	function isInitialized() {
		return initialized
	}

	let drawLegendCallback : Function
	function registerLegendCallback(callback: Function) {
		drawLegendCallback = callback;
	}

	return {
		isInitialized: isInitialized,
		resize: resize,
		scene: scene,
		camera: camera,
		controls: controls,
		reset: resetCamera,
		setLibraryDefinitions: setLibraryDefinitions,
		setStudyArea: setStudyArea,
		setStudyAreaTiles: setStudyAreaTiles,
		libraryDefinitions: masterAssets[currentLibraryName],
		collectSpatialOutputs: collectSpatialOutputs,
		showLoadingScreen: showloadingScreen,
		registerLegendCallback: registerLegendCallback
	}
}

function reportProgress(progress: number) {
	console.log("Loading assets... " + progress * 100 + "%")
}

function reportError(error: string) {
	console.log(error)
	return
}
