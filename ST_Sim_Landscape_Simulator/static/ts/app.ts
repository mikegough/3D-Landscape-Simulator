// app.ts
import {createTerrainTile, TileData} from './terrain'
import {detectWebGL, detectWebWorkers} from './utils'
import {Loader, Assets, AssetList, AssetDescription, AssetRepo} from './assetloader'
import * as STSIM from './stsim'

// Internal script for decoding the heights on the client.
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
	const renderer = new THREE.WebGLRenderer()
	container.appendChild(renderer.domElement)

	// camera creation
	const camera = new THREE.PerspectiveCamera(70, container.offsetWidth / container.offsetHeight, 2.0, 2000.0)
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
	controls.zoomSpeed = 0.5
	controls.maxPolarAngle = Math.PI / 2.3
	controls.minDistance = 75
	controls.maxDistance = 800
	
	var terrainControls = new dat.GUI({autoPlace: false})
	var guiParams = {
		'Available Layers': "State Class",
		'Vertical Scale': 1.0,
		'Light Position (x)': 1.0,
		'Light Position (y)': -1.0,
		'Light Position (z)': 1.0
	}

    var layerFolder = terrainControls.addFolder('Terrain Controls')
    layerFolder.open()

    layerFolder.add(guiParams, 'Available Layers', ['Vegetation', 'State Class', 'Elevation']).onChange( function(value: any) {
    	let active_type : string
    	switch (value) {
    		case 'State Class':
    			active_type = 'sc'
    			break
    		case 'Vegetation':
    			active_type = 'veg'
    			break
    		default:
    			active_type = 'elev'
    	}
    	let terrain = scene.getObjectByName('terrain')
		if (terrain.children.length > 0) {
			let i : number
			let child : THREE.Mesh
			for (i = 0; i < terrain.children.length; i++) {
				child = terrain.children[i] as THREE.Mesh
				let child_data = child.userData as TileData
				let child_mat = child.material as THREE.ShaderMaterial
				child_mat.uniforms.active_texture.value = masterAssets[currentLibraryName].textures[[child_data.x, child_data.y, active_type].join('_')]
				child_data['active_texture_type'] = active_type
				if (active_type == 'elev') {
					child_mat.uniforms.useElevation.value = 1
				} else {
					child_mat.uniforms.useElevation.value = 0
				}
				child_mat.uniforms.useElevation.needsUpdate = true
				child_mat.uniforms.active_texture.needsUpdate = true
			}
			buildLegend(active_type)
			render()
		}
    })

    var advControls = terrainControls.addFolder('Advanced Controls')

    advControls.add(guiParams, 'Vertical Scale',0.0, 3.0).onChange( function(value: any){
    	let terrain = scene.getObjectByName('terrain')
    	if (terrain.children.length > 0) {
    		let child : THREE.Mesh
    		for (let i = 0; i < terrain.children.length; i++) {
    			child = terrain.children[i] as THREE.Mesh
    			let child_mat = child.material as THREE.ShaderMaterial
				child_mat.uniforms.disp.value = value
				child_mat.uniforms.disp.needsUpdate = true
    		}
    		render()
    	}
    })


    let dynamicLightPosition = Array(1.0,-1.0,1.0)
    function updateLightPosition() {
    	let terrain = scene.getObjectByName('terrain')
    	if (terrain.children.length > 0) {
    		let child : THREE.Mesh
    		for (let i = 0; i < terrain.children.length; i++) {
    			child = terrain.children[i] as THREE.Mesh
    			let child_mat = child.material as THREE.ShaderMaterial
				child_mat.uniforms.lightPosition.value = dynamicLightPosition
				child_mat.uniforms.disp.needsUpdate = true
    		}
    		render()
    	}
    }

    advControls.add(guiParams, 'Light Position (x)', -1.0, 1.0).onChange(function(value: any) {
    	dynamicLightPosition[0] = value
    	updateLightPosition()
    })
    advControls.add(guiParams, 'Light Position (y)', -1.0, 1.0).onChange(function(value: any) {
    	dynamicLightPosition[1] = value
    	updateLightPosition()
    })
    advControls.add(guiParams, 'Light Position (z)', 1.0, 3.0).onChange(function(value: any) {
    	dynamicLightPosition[2] = value    	
    	updateLightPosition()
    })

    terrainControls.open();
    terrainControls.domElement.style.position='absolute';
    terrainControls.domElement.style.bottom = '20px';
    terrainControls.domElement.style.left = '0%';
    container.appendChild(terrainControls.domElement);

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
					{name: 'tile_frag', url: 'static/shader/terrain_tile.frag.glsl'}
				]
			},
			function(loadedAssets: Assets) {
				console.log('Terrain loaded')
				masterAssets['terrain'] = loadedAssets
				terrainInitialized = true
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
			let textures = [] as AssetDescription[]
			let assetName : string
			let assetPath : string
			textures.push({name: '0_0_elev', url: baseSourceURL + '/elev/'})
			textures.push({name: '0_0_veg', url: baseSourceURL + '/veg/'})
			textures.push({name: '0_0_sc', url: baseSourceURL + '/sc/'})
			studyAreaAssets.textures = textures
			studyAreaLoader.load(studyAreaAssets, createScene, reportProgress, reportError)
		}
	}

	let current_unit_id : string
	function setStudyAreaTiles(reporting_unit_name: string, unit_id : string, initialConditions: STSIM.LibraryInitConditions) {
		if (unit_id != current_unit_id) {

			if (scene.getObjectByName('terrain') != undefined) {
				scene.remove(scene.getObjectByName('terrain'))
				//scene.remove(scene.getObjectByName('data'))
				//scene.remove(scene.getObjectByName('realism'))
				//scene.remove(scene.getObjectByName('vegetation'))
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
		} else {
			hideLoadingScreen()
		}
	}

	function createTiles(loadedAssets: Assets) {
		masterAssets[currentLibraryName] = loadedAssets

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

		// always finish with a render
		resetCamera()
		buildLegend('sc')	// we know this is what is loaded
		hideLoadingScreen()
	}

	function createScene(loadedAssets: Assets) {
		masterAssets[currentLibraryName] = loadedAssets

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

			if (useWebWorker) {
				var compute_heights_worker = new Worker(URL.createObjectURL(new Blob([compute_heights], {type: 'text/javascript'})))
				compute_heights_worker.onmessage = function(e) {
			
					const heights = e.data
					tile_group.add(createTerrainTile({
						x: x,
						y: y,
						width: object_width,
						height: object_height,
						translate_x: 0,
						translate_y: 0,
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
					translate_x: 0,
					translate_y: 0,
					translate_z: -currentConditions.elev.dem_min,
					init_tex: initial_texture,
					heights: heights,
					disp: disp,
					vertexShader: masterAssets['terrain'].text['tile_vert'],
					fragmentShader: masterAssets['terrain'].text['tile_frag']
				}))
			}
		} 

		createOneTile(0, 0, 0, 0)

		tile_group.rotateX(-Math.PI / 2)

		// always finish with a render
		resetCamera()
		buildLegend('sc')	// we know this is what is loaded
		hideLoadingScreen()
	}

	function collectSpatialOutputs(runControl: STSIM.RunControl) {

		if (!runControl.spatial) return
		
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


	function computeHeightsCPU(hmTexture: THREE.Texture ) {

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

	function buildLegend(active_type: string) {
		if (active_type == 'veg') {
			let veg_color_map = {}
			for (var code in currentConditions.veg_sc_pct) {
				for (var name in currentDefinitions.veg_type_color_map) {
					if (currentDefinitions.has_lookup && Number(name) == Number(code)) {	// comparing integers yields match
						veg_color_map[currentConditions.veg_names[name]] = currentDefinitions.veg_type_color_map[name]
						break
					} else if (name == code) {	// comparing strings yields match
						veg_color_map[name] = currentDefinitions.veg_type_color_map[name]								
						break
					}
				}
			}

			drawLegendCallback(veg_color_map)
		} else {

			// Add in miscellaneous labels, colors
			let state_class_color_map = currentDefinitions.state_class_color_map
			let misc_info = currentDefinitions.misc_legend_info
			let misc : any, attr : any
			for (misc in misc_info) {
				for (attr in misc_info[misc]) {
					state_class_color_map[attr] = misc_info[misc][attr]
				}
			}

			// Determine unique colors
			let colors = new Array()
			for (attr in state_class_color_map) {
				colors.push(state_class_color_map[attr])
			}
			const unique_colors = colors.filter((v,i,a) => a.indexOf(v) === i)	// ES6, might break if not compiled correctly
			
			// temporary structure for mapping colors to labels
			let colors_to_labels = {}
			for (attr in state_class_color_map) {
				const color = state_class_color_map[attr]
				if (!colors_to_labels.hasOwnProperty(color)) {
					colors_to_labels[color] = new Array<string>()
				}
				colors_to_labels[color].push(attr)
			}

			let final_sc_color_map = {}
			let final_label : string
			for (attr in colors_to_labels) {
				// TODO - handle this more generally
				if (currentLibraryName == 'Landfire') {

					// list of similar labels
					let similar_labels = colors_to_labels[attr] as Array<string>
					if (similar_labels.length > 1) {
						let i : number
						let label : any

						// Each label looks like 'Early1:All', 'Early2:All', but they have the same color, 
						// so we simplify it by stripping the extra numeric character, which has no symbology except in ST-Sim
						for (i = 0; i < similar_labels.length; i++) {
							label = similar_labels[i]
							if (label.includes(':')) {
								label = label.split(':')
								label[0] = label[0].substr(0,label[0].length-1)
								label = label.join(':')
								similar_labels[i] = label
							}
						}

						// We now expect the final label to be the only one, so we take the first element.
						final_label = similar_labels.filter((v,i,a) => a.indexOf(v) === i).join(', ')

					} else {
						final_label = similar_labels[0]
					}
				} else {
					final_label = colors_to_labels[attr].join(', ')
				}

				final_sc_color_map[final_label] = attr
			}

			drawLegendCallback(final_sc_color_map)
		}
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
