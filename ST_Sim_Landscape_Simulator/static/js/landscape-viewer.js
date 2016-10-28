// globals.ts
define("globals", ["require", "exports"], function (require, exports) {
    "use strict";
    // global colors
    exports.WHITE = 'rgb(255,255,255)';
    function getVegetationLightPosition(vegname) {
        if (vegname.includes("Sagebrush")) {
            return [0.0, -5.0, 5.0];
        }
        return [0.0, 5.0, 0.0];
    }
    exports.getVegetationLightPosition = getVegetationLightPosition;
});
// terrain.ts
define("terrain", ["require", "exports", "globals"], function (require, exports, globals_1) {
    "use strict";
    /***** lighting uniforms for terrain - calculate only once for the whole app *****/
    const AMBIENT = new THREE.Color(globals_1.WHITE);
    const DIFFUSE = new THREE.Color(globals_1.WHITE);
    const SPEC = new THREE.Color(globals_1.WHITE);
    const INTENSITY = 1.0;
    const KA = 0.2;
    const KD = 1.0;
    const KS = 0.15;
    const SHINY = 20.0;
    AMBIENT.multiplyScalar(KA * INTENSITY);
    DIFFUSE.multiplyScalar(KD * INTENSITY);
    SPEC.multiplyScalar(KS * INTENSITY);
    const SUN = [1.0, 3.0, -1.0]; // light position for the terrain, i.e. the ball in the sky
    // shines from the top and slightly behind and west
    const SUN_Z = [1.0, -1.0, 3.0]; // alternative sun position
    function createTerrainTile(params) {
        var geo = new THREE.PlaneBufferGeometry(params.width, params.height, params.width - 1, params.height - 1);
        let vertices = geo.getAttribute('position');
        for (var i = 0; i < vertices.count; i++) {
            vertices.setZ(i, params.heights[i] * params.disp);
        }
        geo.computeVertexNormals();
        geo.translate(params.translate_x, params.translate_y, params.translate_z * params.disp);
        const mat = new THREE.ShaderMaterial({
            uniforms: {
                // uniform for adjusting the current texture
                active_texture: { type: 't', value: params.init_tex },
                // lighting
                lightPosition: { type: "3f", value: SUN_Z },
                ambientProduct: { type: "c", value: AMBIENT },
                diffuseProduct: { type: "c", value: DIFFUSE },
                specularProduct: { type: "c", value: SPEC },
                shininess: { type: "f", value: SHINY },
                // height exageration
                //disp: {type: "f", value: params.disp}
                disp: { type: "f", value: 1.0 } // start with 1.0, range from 0 to 3.0
            },
            vertexShader: params.vertexShader,
            fragmentShader: params.fragmentShader
        });
        const tile = new THREE.Mesh(geo, mat);
        tile.userData = { x: params.x, y: params.y, active_texture_type: 'sc' };
        geo.dispose();
        mat.dispose();
        return tile;
    }
    exports.createTerrainTile = createTerrainTile;
    function createTerrain(params) {
        // data for landscape width/height
        const maxHeight = params.data.dem_max;
        const width = params.data.dem_width;
        const height = params.data.dem_height;
        // make sure the textures repeat wrap
        params.heightmap.wrapS = params.heightmap.wrapT = THREE.RepeatWrapping;
        params.dirt.wrapS = params.dirt.wrapT = THREE.RepeatWrapping;
        params.grass.wrapS = params.grass.wrapT = THREE.RepeatWrapping;
        params.snow.wrapS = params.snow.wrapT = THREE.RepeatWrapping;
        params.sand.wrapS = params.sand.wrapT = THREE.RepeatWrapping;
        params.water.wrapS = params.water.wrapT = THREE.RepeatWrapping;
        const geo = new THREE.PlaneBufferGeometry(width, height, width - 1, height - 1);
        geo.rotateX(-Math.PI / 2);
        let vertices = geo.getAttribute('position');
        for (var i = 0; i < vertices.count; i++) {
            vertices.setY(i, params.heights[i] * params.disp);
        }
        geo.computeVertexNormals();
        const mat = new THREE.ShaderMaterial({
            uniforms: {
                // textures for color blending
                heightmap: { type: "t", value: params.heightmap },
                dirt: { type: "t", value: params.dirt },
                snow: { type: "t", value: params.snow },
                grass: { type: "t", value: params.grass },
                sand: { type: "t", value: params.sand },
                // lighting
                lightPosition: { type: "3f", value: SUN },
                ambientProduct: { type: "c", value: AMBIENT },
                diffuseProduct: { type: "c", value: DIFFUSE },
                specularProduct: { type: "c", value: SPEC },
                shininess: { type: "f", value: SHINY },
                // height exageration
                disp: { type: "f", value: params.disp }
            },
            vertexShader: params.vertShader,
            fragmentShader: params.fragShader
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = 'terrain';
        // never reuse
        geo.dispose();
        mat.dispose();
        return mesh;
    }
    exports.createTerrain = createTerrain;
    function createDataTerrain(params) {
        const width = params.data.dem_width;
        const height = params.data.dem_height;
        const geo = new THREE.PlaneBufferGeometry(width, height, width - 1, height - 1);
        geo.rotateX(-Math.PI / 2);
        let vertices = geo.getAttribute('position');
        for (var i = 0; i < vertices.count; i++) {
            vertices.setY(i, params.heights[i] * params.disp);
        }
        geo.computeVertexNormals();
        const mat = new THREE.ShaderMaterial({
            uniforms: {
                // textures for color blending
                heightmap: { type: "t", value: params.heightmap },
                //tex: {type: "t", value: params.stateclassTexture},
                lightPosition: { type: "3f", value: SUN },
                ambientProduct: { type: "c", value: AMBIENT },
                diffuseProduct: { type: "c", value: DIFFUSE },
                specularProduct: { type: "c", value: SPEC },
                shininess: { type: "f", value: SHINY },
            },
            vertexShader: params.vertShader,
            fragmentShader: params.fragShader,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = 'terrain';
        // never reuse
        geo.dispose();
        mat.dispose();
        return mesh;
    }
    exports.createDataTerrain = createDataTerrain;
});
// stsim.ts
define("stsim", ["require", "exports"], function (require, exports) {
    "use strict";
});
// Loader that provides a dictionary of named assets
// LICENSE: MIT
// Copyright (c) 2016 by Mike Linkovich;
// Adapted for use by Taylor Mutch, CBI
define("assetloader", ["require", "exports"], function (require, exports) {
    "use strict";
    /**
     * Create a Loader instance
     */
    function Loader() {
        let isLoading = false;
        let totalToLoad = 0;
        let numLoaded = 0;
        let numFailed = 0;
        let success_cb;
        let progress_cb;
        let error_cb;
        let done_cb;
        let assets = { images: {}, text: {}, textures: {}, geometries: {}, statistics: {} };
        /**
         * Start loading a list of assets
         */
        function load(assetList, success, progress, error, done) {
            success_cb = success;
            progress_cb = progress;
            error_cb = error;
            done_cb = done;
            totalToLoad = 0;
            numLoaded = 0;
            numFailed = 0;
            isLoading = true;
            if (assetList.text) {
                totalToLoad += assetList.text.length;
                for (let i = 0; i < assetList.text.length; ++i)
                    loadText(assetList.text[i]);
            }
            if (assetList.images) {
                totalToLoad += assetList.images.length;
                for (let i = 0; i < assetList.images.length; ++i)
                    loadImage(assetList.images[i]);
            }
            if (assetList.textures) {
                totalToLoad += assetList.textures.length;
                for (let i = 0; i < assetList.textures.length; ++i)
                    loadTexture(assetList.textures[i]);
            }
            if (assetList.geometries) {
                totalToLoad += assetList.geometries.length;
                for (let i = 0; i < assetList.geometries.length; ++i)
                    loadGeometry(assetList.geometries[i]);
            }
            if (assetList.statistics) {
                totalToLoad += assetList.statistics.length;
                for (let i = 0; i < assetList.statistics.length; ++i)
                    loadStatistics(assetList.statistics[i]);
            }
        }
        function loadText(ad) {
            console.log('loading ' + ad.url);
            const req = new XMLHttpRequest();
            req.overrideMimeType('*/*');
            req.onreadystatechange = function () {
                if (req.readyState === 4) {
                    if (req.status === 200) {
                        assets.text[ad.name] = req.responseText;
                        doProgress();
                    }
                    else {
                        doError("Error " + req.status + " loading " + ad.url);
                    }
                }
            };
            req.open('GET', ad.url);
            req.send();
        }
        function loadImage(ad) {
            const img = new Image();
            assets.images[ad.name] = img;
            img.onload = doProgress;
            img.onerror = doError;
            img.src = ad.url;
        }
        function loadTexture(ad) {
            let parts = ad.url.split('.');
            let ext = parts[parts.length - 1];
            if (ext === 'tga') {
                assets.textures[ad.name] = new THREE.TGALoader().load(ad.url, doProgress);
            }
            else {
                assets.textures[ad.name] = new THREE.TextureLoader().load(ad.url, doProgress);
            }
        }
        function loadGeometry(ad) {
            const jsonLoader = new THREE.JSONLoader();
            jsonLoader.load(ad.url, function (geometry, materials) {
                assets.geometries[ad.name] = geometry;
                doProgress();
            }, function (e) { }, // progress
            function (error) {
                doError("Error " + error + "loading " + ad.url);
            }); // failure
        }
        function loadStatistics(ad) {
            if ($) {
                $.getJSON(ad.url)
                    .done(function (response) {
                    assets.statistics[ad.name] = response['data'];
                    doProgress();
                })
                    .fail(function (jqhxr, textStatus, error) {
                    doError('Error ' + error + "loading " + ad.url);
                });
            }
        }
        function doProgress() {
            numLoaded += 1;
            if (progress_cb)
                progress_cb(numLoaded / totalToLoad);
            tryDone();
        }
        function doError(e) {
            if (error_cb)
                error_cb(e);
            numFailed += 1;
            tryDone();
        }
        function tryDone() {
            if (!isLoading)
                return true;
            if (numLoaded + numFailed >= totalToLoad) {
                const ok = !numFailed;
                if (ok && success_cb)
                    success_cb(assets);
                if (done_cb)
                    done_cb(ok);
                isLoading = false;
            }
            return !isLoading;
        }
        /**
         *  Public interface
         */
        return {
            load: load,
            getAssets: () => assets
        };
    }
    exports.Loader = Loader; // end Loader
});
define("veg", ["require", "exports", "globals"], function (require, exports, globals) {
    "use strict";
    const RESOLUTION = 30; // 30 meter resolution
    const AMBIENT = new THREE.Color(globals.WHITE);
    const DIFFUSE = new THREE.Color(globals.WHITE);
    const SPEC = new THREE.Color(globals.WHITE);
    const INTENSITY = 1.0;
    const KA = 0.63;
    //const KA = 0.2
    const KD = 1.0;
    const KS = 0.2;
    const SHINY = 20.0;
    AMBIENT.multiplyScalar(KA * INTENSITY);
    DIFFUSE.multiplyScalar(KD * INTENSITY);
    SPEC.multiplyScalar(KS * INTENSITY);
    function decodeStrataImage(raw_data) {
        let decoded_data = new Uint32Array(raw_data.length / 4);
        let idx;
        for (var i = 0; i < decoded_data.length; i++) {
            idx = i * 4;
            decoded_data[i] = raw_data[idx] | (raw_data[idx + 1] << 8) | (raw_data[idx + 2] << 16);
        }
        return decoded_data;
    }
    // returns a THREE.Group of vegetation
    function createSpatialVegetation(params) {
        console.log('Generating realistic vegetation...');
        let realismGroup = new THREE.Group();
        let dataGroup = new THREE.Group();
        dataGroup.name = realismGroup.name = 'vegetation';
        const strata_map = params.strataTexture;
        const image = strata_map.image;
        let w = image.naturalWidth;
        let h = image.naturalHeight;
        let canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        let ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0, w, h);
        // get the image data and convert to IDs
        let raw_image_data = ctx.getImageData(0, 0, w, h).data;
        let strata_data = decodeStrataImage(raw_image_data);
        raw_image_data = null;
        const strata_positions = computeStrataPositions(params.vegtypes, strata_data, w, h);
        for (var name in params.zonalVegtypes) {
            const assetGroup = params.vegAssetGroups[name];
            const veg_geo = params.geometries[assetGroup.asset_name];
            const veg_tex = params.textures[assetGroup.asset_name];
            const vegtypePositions = computeVegtypePositions(params.vegtypes[name], strata_positions, strata_data, w, h);
            const geometry = createVegtypeGeometry(veg_geo, vegtypePositions, w, h, assetGroup.symmetric, assetGroup.scale);
            realismGroup.add(createRealismVegtype({
                name: name,
                heightmap: params.heightmap,
                map: vegtypePositions.map,
                numValid: vegtypePositions.numValid,
                heightStats: params.heightStats,
                geo: geometry,
                tex: veg_tex,
                sc_tex: params.stateclassTexture,
                width: w,
                height: h,
                vertexShader: params.realismVertexShader,
                fragmentShader: params.realismFragmentShader,
                disp: params.disp
            }));
            dataGroup.add(createDataVegtype({
                name: name,
                heightmap: params.heightmap,
                map: vegtypePositions.map,
                numValid: vegtypePositions.numValid,
                heightStats: params.heightStats,
                geo: geometry,
                tex: veg_tex,
                sc_tex: params.stateclassTexture,
                width: w,
                height: h,
                vertexShader: params.dataVertexShader,
                fragmentShader: params.dataFragmentShader,
                disp: params.disp
            }));
        }
        strata_data = ctx = canvas = null;
        console.log('Vegetation generated!');
        return { realism: realismGroup, data: dataGroup };
    }
    exports.createSpatialVegetation = createSpatialVegetation;
    function computeStrataPositions(vegtypes, data, w, h) {
        let strata_map = new Array(); // declare boolean array
        let strata_data = data.slice();
        // convert to boolean and return the map
        for (var i = 0; i < strata_data.length; i++) {
            strata_map.push(strata_data[i] != 0 && i % Math.floor((Math.random() * 75)) == 0 ? true : false);
        }
        return strata_map;
    }
    function computeVegtypePositions(id, position_map, type_data, w, h) {
        let vegtype_map = new Array(); // declare boolean array
        let idx;
        let valid;
        let numValid = 0;
        for (let y = 0; y < h; ++y) {
            for (let x = 0; x < w; x++) {
                // idx in the image
                idx = (x + y * w);
                // update vegtype map
                valid = type_data[idx] == id && position_map[idx];
                // how many are valid? This informs the number of instances to do
                if (valid)
                    numValid++;
                vegtype_map.push(valid);
            }
        }
        return { map: vegtype_map, numValid: numValid };
    }
    function createRealismVegtype(params) {
        const lightPosition = globals.getVegetationLightPosition(name);
        const diffuseScale = DIFFUSE;
        const mat = new THREE.RawShaderMaterial({
            uniforms: {
                heightmap: { type: "t", value: params.heightmap },
                disp: { type: "f", value: params.disp },
                tex: { type: "t", value: params.tex },
                sc_tex: { type: "t", value: params.sc_tex },
                // lighting
                lightPosition: { type: "3f", value: lightPosition },
                ambientProduct: { type: "c", value: AMBIENT },
                diffuseProduct: { type: "c", value: DIFFUSE },
                diffuseScale: { type: "f", value: diffuseScale },
                specularProduct: { type: "c", value: SPEC },
                shininess: { type: "f", value: SHINY }
            },
            vertexShader: params.vertexShader,
            fragmentShader: params.fragmentShader,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(params.geo, mat);
        mesh.name = name;
        //mesh.frustumCulled = false
        return mesh;
    }
    function createVegtypeGeometry(geo, positions, width, height, symmetric, scale) {
        const baseGeo = new THREE.BoxGeometry(1, 1, 1);
        baseGeo.translate(0, 0.5, 0);
        const inst_geo = new THREE.InstancedBufferGeometry();
        inst_geo.fromGeometry(baseGeo);
        baseGeo.dispose();
        // always remove the color buffer since we are using textures
        if (inst_geo.attributes['color']) {
            inst_geo.removeAttribute('color');
        }
        inst_geo.maxInstancedCount = positions.numValid;
        const offsets = new THREE.InstancedBufferAttribute(new Float32Array(positions.numValid * 2), 2);
        const hCoords = new THREE.InstancedBufferAttribute(new Float32Array(positions.numValid * 2), 2);
        const rotations = new THREE.InstancedBufferAttribute(new Float32Array(positions.numValid), 1);
        inst_geo.addAttribute('offset', offsets);
        inst_geo.addAttribute('hCoord', hCoords);
        inst_geo.addAttribute('rotation', rotations);
        // generate offsets
        let i = 0;
        let x, y, idx, posx, posy, tx, ty;
        for (y = 0; y < height; y += 1) {
            for (x = 0; x < width; x += 1) {
                idx = (x + y * width);
                if (positions.map[idx]) {
                    posx = (x - width / 2);
                    posy = (y - height / 2);
                    tx = x / width;
                    ty = y / height;
                    offsets.setXY(i, posx, posy);
                    hCoords.setXY(i, tx, 1 - ty);
                    rotations.setX(i, Math.random() * 2.0);
                    i++;
                }
            }
        }
        return inst_geo;
    }
    function createDataVegtype(params) {
        const mat = new THREE.RawShaderMaterial({
            uniforms: {
                heightmap: { type: "t", value: params.heightmap },
                disp: { type: "f", value: params.disp },
                sc_tex: { type: "t", value: params.sc_tex },
            },
            vertexShader: params.vertexShader,
            fragmentShader: params.fragmentShader,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(params.geo, mat);
        mesh.name = name;
        mesh.frustumCulled = false;
        return mesh;
    }
});
// utils.ts
define("utils", ["require", "exports"], function (require, exports) {
    "use strict";
    function detectWebGL() {
        try {
            const canvas = document.createElement('canvas');
            return !!window['WebGLRenderingContext'] &&
                (!!canvas.getContext('webgl') || !!canvas.getContext('experimental-webgl'));
        }
        catch (e) {
            return null;
        }
    }
    exports.detectWebGL = detectWebGL;
    function detectWebWorkers() {
        return typeof (Worker) !== "undefined";
    }
    exports.detectWebWorkers = detectWebWorkers;
});
define("app", ["require", "exports", "terrain", "veg", "utils", "assetloader"], function (require, exports, terrain_1, veg_1, utils_1, assetloader_1) {
    "use strict";
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
    ].join('\n');
    function run(container_id, showloadingScreen, hideLoadingScreen) {
        if (!utils_1.detectWebGL()) {
            alert("Your browser does not support WebGL. Please use a different browser (I.e. Chrome, Firefox).");
            return null;
        }
        const useWebWorker = utils_1.detectWebWorkers();
        const disp = 2.0 / 60.0;
        let initialized = false;
        let masterAssets = {};
        // setup the THREE scene
        const container = document.getElementById(container_id);
        const scene = new THREE.Scene();
        const renderer = new THREE.WebGLRenderer({ antialias: false });
        container.appendChild(renderer.domElement);
        // camera creation
        const camera = new THREE.PerspectiveCamera(60, container.offsetWidth / container.offsetHeight, 2.0, 1500.0);
        camera.position.y = 350;
        camera.position.z = 600;
        const camera_start = new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z);
        function resetCamera() {
            controls.target = new THREE.Vector3(0, 0, 0);
            camera.position.set(camera_start.x, camera_start.y, camera_start.z);
            controls.update();
            render();
        }
        // Custom event handlers since we only want to render when something happens.
        renderer.domElement.addEventListener('mousedown', animate, false);
        renderer.domElement.addEventListener('mouseup', stopAnimate, false);
        renderer.domElement.addEventListener('mousewheel', render, false);
        renderer.domElement.addEventListener('MozMousePixelScroll', render, false); // firefox
        // Camera controls
        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableKeys = false;
        controls.zoomSpeed = 0.5;
        controls.maxPolarAngle = Math.PI / 2.4;
        controls.minDistance = 150;
        controls.maxDistance = 900;
        var terrainControls = new dat.GUI({ autoPlace: false });
        var guiParams = {
            'Available Layers': "State Class",
            'Vertical Scale': 1.0,
        };
        terrainControls.addFolder('Terrain Controls');
        //var blah = ['Vegetation', 'State Class', 'Elevation']
        terrainControls.add(guiParams, 'Available Layers', ['Vegetation', 'State Class', 'Elevation']).onChange(function (value) {
            let terrain = scene.getObjectByName('terrain');
            if (terrain.children.length > 0) {
                let i;
                let child;
                for (i = 0; i < terrain.children.length; i++) {
                    child = terrain.children[i];
                    let child_data = child.userData;
                    let child_mat = child.material;
                    if (child_data['active_texture_type'] == 'veg') {
                        child_mat.uniforms.active_texture.value = masterAssets[currentLibraryName].textures[[child_data.x, child_data.y, 'sc'].join('_')];
                        child_data['active_texture_type'] = 'sc';
                    }
                    else {
                        child_mat.uniforms.active_texture.value = masterAssets[currentLibraryName].textures[[child_data.x, child_data.y, 'veg'].join('_')];
                        child_data['active_texture_type'] = 'veg';
                    }
                    child_mat.uniforms.active_texture.needsUpdate = true;
                }
                render();
                if (child.userData.active_texture_type == 'veg') {
                    let veg_color_map = {};
                    for (var code in currentConditions.veg_sc_pct) {
                        for (var name in currentDefinitions.veg_type_color_map) {
                            if (Number(name) == Number(code)) {
                                if (currentDefinitions.has_lookup) {
                                    veg_color_map[String(currentConditions.veg_names[name]).substr(0, 30) + '...'] = currentDefinitions.veg_type_color_map[name];
                                }
                                else {
                                    veg_color_map[name] = currentDefinitions.veg_type_color_map[name];
                                }
                                break;
                            }
                        }
                    }
                    drawLegendCallback(veg_color_map);
                }
                else {
                    drawLegendCallback(currentDefinitions.state_class_color_map);
                }
            }
        });
        terrainControls.add(guiParams, 'Vertical Scale', 0.0, 3.0).onChange(function (value) {
            let terrain = scene.getObjectByName('terrain');
            // update the terrain scalar
            if (terrain.children.length > 0) {
                let child;
                for (let i = 0; i < terrain.children.length; i++) {
                    child = terrain.children[i];
                    let child_mat = child.material;
                    child_mat.uniforms.disp.value = value;
                    child_mat.uniforms.disp.needsUpdate = true;
                }
                render();
            }
        });
        terrainControls.open();
        terrainControls.domElement.style.position = 'absolute';
        terrainControls.domElement.style.bottom = '20px';
        terrainControls.domElement.style.left = '0%';
        terrainControls.domElement.style.textAlign = 'center';
        container.appendChild(terrainControls.domElement);
        initialize();
        // Load initial assets
        function initialize() {
            let terrainInitialized = false;
            let vegetationInitialized = false;
            function tryDone() {
                return terrainInitialized && vegetationInitialized;
            }
            const terrainLoader = assetloader_1.Loader();
            terrainLoader.load({
                text: [
                    /* tile shaders */
                    { name: 'tile_vert', url: 'static/shader/terrain_tile.vert.glsl' },
                    { name: 'tile_frag', url: 'static/shader/terrain_tile.frag.glsl' },
                    /* realism shaders */
                    { name: 'terrain_vert', url: 'static/shader/terrain.vert.glsl' },
                    { name: 'terrain_frag', url: 'static/shader/terrain.frag.glsl' },
                    /* data shaders */
                    { name: 'data_terrain_vert', url: 'static/shader/data_terrain.vert.glsl' },
                    { name: 'data_terrain_frag', url: 'static/shader/data_terrain.frag.glsl' },
                ],
                textures: [
                    // terrain materials
                    { name: 'terrain_dirt', url: 'static/img/terrain/dirt-512.jpg' },
                    { name: 'terrain_grass', url: 'static/img/terrain/grass-512.jpg' },
                    { name: 'terrain_snow', url: 'static/img/terrain/snow-512.jpg' },
                    { name: 'terrain_sand', url: 'static/img/terrain/sand-512.jpg' },
                    { name: 'terrain_water', url: 'static/img/terrain/water-512.jpg' },
                ],
            }, function (loadedAssets) {
                console.log('Terrain loaded');
                masterAssets['terrain'] = loadedAssets;
                terrainInitialized = true;
                initialized = tryDone();
            }, reportProgress, reportError);
            const vegetationLoader = assetloader_1.Loader();
            vegetationLoader.load({
                text: [
                    { name: 'real_veg_vert', url: 'static/shader/real_veg.vert.glsl' },
                    { name: 'real_veg_frag', url: 'static/shader/real_veg.frag.glsl' },
                    { name: 'data_veg_vert', url: 'static/shader/data_veg.vert.glsl' },
                    { name: 'data_veg_frag', url: 'static/shader/data_veg.frag.glsl' },
                ]
            }, function (loadedAssets) {
                console.log('Vegetation shaders loaded');
                masterAssets['vegetation'] = loadedAssets;
                vegetationInitialized = true;
                initialized = tryDone();
            }, reportProgress, reportError);
        }
        let currentDefinitions;
        let currentLibraryName = "";
        function setLibraryDefinitions(name, definitions) {
            if (name != currentLibraryName) {
                currentLibraryName = name;
                currentDefinitions = definitions;
            }
        }
        let currentUUID;
        let currentConditions;
        function setStudyArea(uuid, initialConditions) {
            if (uuid != currentUUID) {
                currentUUID = uuid;
                currentConditions = initialConditions;
                camera.position.set(camera_start.x, camera_start.y, camera_start.z);
                // remove current terrain and vegetation cover
                if (scene.getObjectByName('terrain') != undefined) {
                    scene.remove(scene.getObjectByName('terrain'));
                    scene.remove(scene.getObjectByName('data'));
                    scene.remove(scene.getObjectByName('realism'));
                    scene.remove(scene.getObjectByName('vegetation'));
                    render();
                }
                const baseSourceURL = [currentLibraryName, 'select', currentUUID].join('/');
                const studyAreaLoader = assetloader_1.Loader();
                let studyAreaAssets = {};
                // Construct urls for vegetation geometry, textures based on asset names
                const assetNamesList = currentDefinitions.veg_model_config.visualization_asset_names;
                let textures = [];
                let geometries = [];
                let assetName;
                let assetPath;
                textures.push({ name: 'elevation', url: baseSourceURL + '/elev/' });
                textures.push({ name: 'veg_tex', url: baseSourceURL + '/veg/' });
                textures.push({ name: 'sc_tex', url: baseSourceURL + '/sc/' });
                for (var idx in assetNamesList) {
                    assetName = assetNamesList[idx].asset_name;
                    assetPath = [currentLibraryName, assetName].join('/');
                    geometries.push({
                        name: assetName,
                        url: 'static/json/geometry/' + assetPath + '.json'
                    });
                    textures.push({
                        name: assetName,
                        url: 'static/img/' + assetPath + '.png'
                    });
                }
                studyAreaAssets.textures = textures;
                studyAreaAssets.geometries = geometries;
                studyAreaLoader.load(studyAreaAssets, createScene, reportProgress, reportError);
            }
        }
        let current_unit_id;
        function setStudyAreaTiles(reporting_unit_name, unit_id, initialConditions) {
            if (unit_id != current_unit_id) {
                if (scene.getObjectByName('terrain') != undefined) {
                    scene.remove(scene.getObjectByName('terrain'));
                    scene.remove(scene.getObjectByName('data'));
                    scene.remove(scene.getObjectByName('realism'));
                    scene.remove(scene.getObjectByName('vegetation'));
                    render();
                }
                currentConditions = initialConditions;
                current_unit_id = unit_id;
                // collect assets for the tiles
                const baseTilePath = currentLibraryName + '/select/' + reporting_unit_name + '/' + unit_id;
                const studyAreaLoader = assetloader_1.Loader();
                let studyAreaTileAssets = {};
                let textures = [];
                let i, j;
                for (i = 0; i < currentConditions.elev.x_tiles; i++) {
                    for (j = 0; j < currentConditions.elev.y_tiles; j++) {
                        textures.push({
                            name: [i, j, 'veg'].join('_'),
                            url: baseTilePath + '/veg/' + String(i) + '/' + String(j) + '/'
                        });
                        textures.push({
                            name: [i, j, 'sc'].join('_'),
                            url: baseTilePath + '/sc/' + String(i) + '/' + String(j) + '/'
                        });
                        textures.push({
                            name: [i, j, 'elev'].join('_'),
                            url: baseTilePath + '/elev/' + String(i) + '/' + String(j) + '/'
                        });
                    }
                }
                studyAreaTileAssets.textures = textures;
                studyAreaLoader.load(studyAreaTileAssets, createTiles, reportProgress, reportError);
            }
        }
        function createTiles(loadedAssets) {
            masterAssets[currentLibraryName] = loadedAssets;
            camera.position.set(camera_start.x, camera_start.y, camera_start.z);
            const tile_size = currentConditions.elev.tile_size;
            const x_tiles = currentConditions.elev.x_tiles;
            const y_tiles = currentConditions.elev.y_tiles;
            const world_width = currentConditions.elev.dem_width;
            const world_height = currentConditions.elev.dem_height;
            const world_x_offset = -1 * world_width / 2 + tile_size / 2;
            const world_y_offset = world_height - tile_size / 2;
            const tile_group = new THREE.Group();
            tile_group.name = 'terrain';
            scene.add(tile_group);
            function createOneTile(x, y, x_offset, y_offset) {
                const heightmap = loadedAssets.textures[[x, y, 'elev'].join('_')];
                const image = heightmap.image;
                let w = image.naturalWidth;
                let h = image.naturalHeight;
                let canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                let ctx = canvas.getContext('2d');
                ctx.drawImage(image, 0, 0, w, h);
                let data = ctx.getImageData(0, 0, w, h).data;
                const init_tex_name = [x, y, 'sc'].join('_');
                const initial_texture = loadedAssets.textures[init_tex_name];
                const object_width = initial_texture.image.width;
                const object_height = initial_texture.image.height;
                const x_object_offset = object_width / 2 - tile_size / 2;
                const y_object_offset = object_height / 2 - tile_size / 2;
                const translate_x = world_x_offset + x_offset + x_object_offset;
                const translate_y = world_y_offset + y_offset - y_object_offset;
                if (useWebWorker) {
                    var compute_heights_worker = new Worker(URL.createObjectURL(new Blob([compute_heights], { type: 'text/javascript' })));
                    compute_heights_worker.onmessage = function (e) {
                        const heights = e.data;
                        tile_group.add(terrain_1.createTerrainTile({
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
                        }));
                        compute_heights_worker.terminate();
                        compute_heights_worker = undefined;
                        render();
                    };
                    // Send the data
                    compute_heights_worker.postMessage({ data: data, w: w, h: h });
                }
                else {
                    console.log('No web workers, computing on main thread...');
                    const heights = computeHeightsCPU(loadedAssets.textures[[x, y, 'elev'].join('_')]);
                    tile_group.add(terrain_1.createTerrainTile({
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
                    }));
                }
            }
            let local_x_offset = 0;
            let local_y_offset = 0;
            let x, y;
            for (x = 0; x < x_tiles; x++) {
                local_y_offset = 0;
                for (y = 0; y < y_tiles; y++) {
                    createOneTile(x, y, local_x_offset, local_y_offset);
                    local_y_offset -= tile_size;
                }
                local_x_offset += tile_size;
            }
            tile_group.rotateX(-Math.PI / 2);
            // always finish with a render
            resetCamera();
            hideLoadingScreen();
        }
        function createScene(loadedAssets) {
            masterAssets[currentLibraryName] = loadedAssets;
            const heightmapTexture = loadedAssets.textures['elevation'];
            const terrainAssets = masterAssets['terrain'];
            const vegetationAssets = masterAssets['vegetation'];
            function createObjects(heights) {
                // define the realism group
                let realismGroup = new THREE.Group();
                realismGroup.name = 'realism';
                const realismTerrain = terrain_1.createTerrain({
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
                });
                realismGroup.add(realismTerrain);
                // define the data group
                let dataGroup = new THREE.Group();
                dataGroup.name = 'data';
                dataGroup.visible = false; // initially set to false
                const dataTerrain = terrain_1.createDataTerrain({
                    heightmap: heightmapTexture,
                    heights: heights,
                    stateclassTexture: loadedAssets.textures['sc_tex'],
                    data: currentConditions.elev,
                    vertShader: terrainAssets.text['data_terrain_vert'],
                    fragShader: terrainAssets.text['data_terrain_frag'],
                    disp: disp
                });
                dataGroup.add(dataTerrain);
                let vegAssetGroups = {};
                let assetGroup;
                let i, j, breakout, name;
                for (name in currentConditions.veg_sc_pct) {
                    for (i = 0; i < currentDefinitions.veg_model_config.visualization_asset_names.length; i++) {
                        assetGroup = currentDefinitions.veg_model_config.visualization_asset_names[i];
                        breakout = false;
                        for (j = 0; j < assetGroup.valid_names.length; j++) {
                            // is there a lookup in our definitions
                            if (currentDefinitions.veg_model_config.lookup_field) {
                                const lookupNames = currentDefinitions.veg_model_config.asset_map;
                                if (lookupNames[name] == assetGroup.valid_names[j]) {
                                    vegAssetGroups[name] = assetGroup;
                                    breakout = true;
                                    break;
                                }
                            }
                            else {
                                if (name == assetGroup.valid_names[j]) {
                                    vegAssetGroups[name] = assetGroup;
                                    breakout = true;
                                    break;
                                }
                            }
                        }
                        if (breakout)
                            break;
                    }
                }
                // create the vegetation
                const vegGroups = veg_1.createSpatialVegetation({
                    libraryName: currentLibraryName,
                    zonalVegtypes: currentConditions.veg_sc_pct,
                    veg_names: currentConditions.veg_names,
                    vegAssetGroups: vegAssetGroups,
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
                });
                //realismGroup.add(vegGroups.data)		
                //dataGroup.add(vegGroups.data)
                scene.add(vegGroups.data);
                scene.add(realismGroup);
                scene.add(dataGroup);
                // show the animation controls for the outputs
                $('#animation_container').show();
                // activate the checkbox
                $('#viz_type').on('change', function () {
                    if (dataGroup.visible) {
                        dataGroup.visible = false;
                        realismGroup.visible = true;
                    }
                    else {
                        dataGroup.visible = true;
                        realismGroup.visible = false;
                    }
                    render();
                });
                // render the scene once everything is finished being processed
                console.log('Vegetation Rendered!');
                //render()
                resetCamera();
                hideLoadingScreen();
            }
            if (useWebWorker) {
                const image = heightmapTexture.image;
                let w = image.naturalWidth;
                let h = image.naturalHeight;
                let canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                let ctx = canvas.getContext('2d');
                ctx.drawImage(image, 0, 0, w, h);
                let data = ctx.getImageData(0, 0, w, h).data;
                var compute_heights_worker = new Worker(URL.createObjectURL(new Blob([compute_heights], { type: 'text/javascript' })));
                compute_heights_worker.onmessage = function (e) {
                    createObjects(e.data);
                    compute_heights_worker.terminate();
                    compute_heights_worker = undefined;
                    render();
                };
                // Send the data
                compute_heights_worker.postMessage({ data: data, w: w, h: h });
            }
            else {
                const heights = computeHeightsCPU(heightmapTexture);
                createObjects(heights);
            }
        }
        function collectSpatialOutputs(runControl) {
            if (!runControl.spatial)
                return;
            console.log('Updating vegetation covers');
            const sid = runControl.result_scenario_id;
            const srcSpatialTexturePath = runControl.library + '/outputs/' + sid;
            let model_outputs = new Array();
            for (var step = runControl.min_step; step <= runControl.max_step; step += runControl.step_size) {
                for (var it = 1; it <= runControl.iterations; it += 1) {
                    model_outputs.push({ name: String(it) + '_' + String(step), url: srcSpatialTexturePath + '/sc/' + it + '/' + step + '/' });
                    if (step == runControl.min_step)
                        break; // Only need to get the initial timestep 1 time for all iterations			
                }
            }
            const outputsLoader = assetloader_1.Loader();
            outputsLoader.load({
                textures: model_outputs,
            }, function (loadedAssets) {
                console.log('Animation assets loaded!');
                masterAssets[String(sid)] = loadedAssets;
                const dataGroup = scene.getObjectByName('data');
                const realismGroup = scene.getObjectByName('realism');
                dataGroup.visible = true;
                realismGroup.visible = false;
                render();
                // create an animation slider and update the stateclass texture to the last one in the timeseries, poc
                $('#viz_type').prop('checked', true);
                const animationSlider = $('#animation_slider');
                const currentIteration = 1; // TODO - show other iterations
                animationSlider.attr('max', runControl.max_step);
                animationSlider.attr('step', runControl.step_size);
                animationSlider.on('input', function () {
                    const timestep = animationSlider.val();
                    let timeTexture;
                    if (timestep == 0 || timestep == '0') {
                        timeTexture = masterAssets[String(sid)].textures['1_0'];
                    }
                    else {
                        timeTexture = masterAssets[String(sid)].textures[String(currentIteration) + '_' + String(timestep)];
                    }
                    let vegetation = scene.getObjectByName('vegetation');
                    let childMaterial;
                    for (var i = 0; i < vegetation.children.length; i++) {
                        const child = vegetation.children[i];
                        childMaterial = child.material;
                        childMaterial.uniforms.sc_tex.value = timeTexture;
                        childMaterial.needsUpdate = true;
                    }
                    render();
                });
            }, reportProgress, reportError);
        }
        function computeHeightsCPU(hmTexture) {
            const image = hmTexture.image;
            let w = image.naturalWidth;
            let h = image.naturalHeight;
            let canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            let ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0, w, h);
            let data = ctx.getImageData(0, 0, w, h).data;
            const heights = new Float32Array(w * h);
            let idx;
            for (let y = 0; y < h; ++y) {
                for (let x = 0; x < w; ++x) {
                    idx = (x + y * w) * 4;
                    heights[x + y * w] = (data[idx] | (data[idx + 1] << 8) | (data[idx + 2] << 16)) + data[idx + 3] - 255;
                }
            }
            // Free the resources and return
            data = ctx = canvas = null;
            return heights;
        }
        function render() {
            renderer.render(scene, camera);
            controls.update();
        }
        let renderID;
        function animate() {
            render();
            renderID = requestAnimationFrame(animate);
        }
        function stopAnimate() {
            cancelAnimationFrame(renderID);
        }
        function resize() {
            const newContainer = document.getElementById(container_id);
            renderer.setSize(newContainer.offsetWidth, newContainer.offsetHeight);
            camera.aspect = newContainer.offsetWidth / newContainer.offsetHeight;
            camera.updateProjectionMatrix();
            render();
        }
        function isInitialized() {
            return initialized;
        }
        let drawLegendCallback;
        function registerLegendCallback(callback) {
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
        };
    }
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = run;
    function reportProgress(progress) {
        console.log("Loading assets... " + progress * 100 + "%");
    }
    function reportError(error) {
        console.log(error);
        return;
    }
});
//# sourceMappingURL=landscape-viewer.js.map