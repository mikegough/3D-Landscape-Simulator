// globals.ts
define("globals", ["require", "exports"], function (require, exports) {
    "use strict";
    // debugging constants
    exports.USE_RANDOM = true;
    //export const USE_RANDOM = false
    // global constants configuration
    exports.MAX_INSTANCES = 5000; // max number of vertex instances we allow per vegtype
    exports.MAX_CLUSTERS_PER_VEG = 20; // maximum number of clusters to generate for each vegtype
    exports.RESOLUTION = 800.0; // resolution of terrain (in meters)
    exports.TERRAIN_DISP = 5.0 / exports.RESOLUTION; // the amount of displacement we impose to actually 'see' the terrain
    exports.MAX_CLUSTER_RADIUS = 30.0; // max radius to grow around a cluster
    // global colors
    exports.WHITE = 'rgb(255,255,255)';
    function getVegetationAssetsName(vegname) {
        if (vegname.includes("Sagebrush")) {
            return 'sagebrush';
        }
        else if (vegname.includes("Juniper")) {
            return 'juniper';
        }
        else if (vegname.includes("Mahogany")) {
            return 'tree';
        }
        return 'grass';
    }
    exports.getVegetationAssetsName = getVegetationAssetsName;
    function useSymmetry(vegname) {
        return !(vegname.includes('Sagebrush')
            || vegname.includes('Mahogany')
            || vegname.includes('Juniper'));
    }
    exports.useSymmetry = useSymmetry;
    // TODO - make this part of the configuration
    function getVegetationScale(vegname) {
        if (vegname.includes("Sagebrush")) {
            return 10.0;
        }
        else if (vegname.includes("Juniper")) {
            return 1.;
        }
        else if (vegname.includes("Mahogany")) {
            return 15.0;
        }
        return 1.0;
    }
    exports.getVegetationScale = getVegetationScale;
    // TODO - same as above
    function getRenderOrder(vegname) {
        // sagebrush should always be rendered first
        if (!vegname.includes('Sagebrush')) {
            return 1;
        }
        return 0;
    }
    exports.getRenderOrder = getRenderOrder;
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
    function createTerrain(params) {
        // data for landscape width/height
        const maxHeight = params.data.dem_max;
        const width = params.data.dem_width;
        const height = params.data.dem_height;
        // make sure the textures repeat wrap
        params.heightmap.wrapS = params.heightmap.wrapT = THREE.RepeatWrapping;
        params.rock.wrapS = params.rock.wrapT = THREE.RepeatWrapping;
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
                rock: { type: "t", value: params.rock },
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
        // make sure the textures repeat wrap
        params.heightmap.wrapS = params.heightmap.wrapT = THREE.RepeatWrapping;
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
                tex: { type: "t", value: params.stateclassTexture }
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
        let vegGroup = new THREE.Group();
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
        const veg_geo = params.geometries['geometry']; // REMOVE, only for testing
        veg_geo.scale(10, 10, 10);
        const veg_tex = params.textures['material'];
        const strata_positions = computeStrataPositions(params.vegtypes, strata_data, w, h);
        if (params.config.lookup_field) {
            console.log('Has lookup', params.config.lookup_field);
        }
        for (var name in params.zonalVegtypes) {
            // TODO - replace with the actual asset name
            //const assetName = globals.getVegetationAssetsName(name)
            //const veg_geo = params.geometries[assetName]
            //const veg_tex = params.textures[assetName + '_material']
            const vegtypePositions = computeVegtypePositions(params.vegtypes[name], strata_positions, strata_data, w, h);
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
            }));
        }
        strata_data = ctx = canvas = null;
        console.log('Vegetation generated!');
        return vegGroup;
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
    function createVegtype(params) {
        const halfPatch = new THREE.Geometry();
        halfPatch.merge(params.geo);
        if (globals.useSymmetry(name)) {
            params.geo.rotateY(Math.PI);
            halfPatch.merge(params.geo);
        }
        const inst_geo = new THREE.InstancedBufferGeometry();
        inst_geo.fromGeometry(halfPatch);
        halfPatch.dispose();
        const s = globals.getVegetationScale(name);
        inst_geo.scale(s, s, s);
        // always remove the color buffer since we are using textures
        if (inst_geo.attributes['color']) {
            inst_geo.removeAttribute('color');
        }
        inst_geo.maxInstancedCount = params.numValid;
        const offsets = new THREE.InstancedBufferAttribute(new Float32Array(params.numValid * 2), 2);
        const hCoords = new THREE.InstancedBufferAttribute(new Float32Array(params.numValid * 2), 2);
        const rotations = new THREE.InstancedBufferAttribute(new Float32Array(params.numValid), 1);
        inst_geo.addAttribute('offset', offsets);
        inst_geo.addAttribute('hCoord', hCoords);
        inst_geo.addAttribute('rotation', rotations);
        // generate offsets
        let i = 0;
        let x, y, idx, posx, posy, tx, ty;
        for (y = 0; y < params.height; y += 5) {
            for (x = 0; x < params.width; x += 5) {
                idx = (x + y * params.width);
                if (params.map[idx]) {
                    posx = (x - params.width / 2);
                    posy = (y - params.height / 2);
                    tx = x / params.width;
                    ty = y / params.height;
                    offsets.setXY(i, posx, posy);
                    hCoords.setXY(i, tx, 1 - ty);
                    rotations.setX(i, Math.random() * 2.0);
                    i++;
                }
            }
        }
        //const maxHeight = params.heightStats.dem_max
        const lightPosition = globals.getVegetationLightPosition(name);
        const diffuseScale = getDiffuseScale(name);
        const mat = new THREE.RawShaderMaterial({
            uniforms: {
                // heights
                heightmap: { type: "t", value: params.heightmap },
                disp: { type: "f", value: params.disp },
                // coloring texture
                tex: { type: "t", value: params.tex },
                //vegColor: {type: "3f", value: vegColor},	// implicit vec3 in shaders
                // lighting
                lightPosition: { type: "3f", value: lightPosition },
                ambientProduct: { type: "c", value: getAmbientProduct(name) },
                diffuseProduct: { type: "c", value: DIFFUSE },
                diffuseScale: { type: "f", value: diffuseScale },
                specularProduct: { type: "c", value: SPEC },
                shininess: { type: "f", value: SHINY }
            },
            vertexShader: params.vertexShader,
            fragmentShader: params.fragmentShader,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(inst_geo, mat);
        mesh.name = name;
        mesh.renderOrder = globals.getRenderOrder(name);
        mesh.frustumCulled = false;
        return mesh;
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
    function getDiffuseScale(vegname) {
        if (vegname.includes("Sagebrush")) {
            return 0.7;
        }
        return 0.0;
    }
    function getAmbientProduct(vegname) {
        if (vegname.includes("Sagebrush")) {
            return AMBIENT.multiplyScalar(0.2);
        }
        return AMBIENT;
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
});
// app.ts
define("app", ["require", "exports", "terrain", "veg", "utils", "assetloader"], function (require, exports, terrain_1, veg_1, utils_1, assetloader_1) {
    "use strict";
    function run(container_id) {
        if (!utils_1.detectWebGL) {
            alert("Your browser does not support WebGL. Please use a different browser (I.e. Chrome, Firefox).");
            return null;
        }
        let initialized = false;
        let masterAssets = {};
        // setup the THREE scene
        const container = document.getElementById(container_id);
        const scene = new THREE.Scene();
        const renderer = new THREE.WebGLRenderer();
        container.appendChild(renderer.domElement);
        const camera = new THREE.PerspectiveCamera(75, container.offsetWidth / container.offsetHeight, .1, 100000.0);
        // Camera controls
        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableKeys = false;
        camera.position.y = 350;
        camera.position.z = 600;
        //const camera_start_position = camera.position.copy(new THREE.Vector3())
        const camera_start = new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z);
        controls.maxPolarAngle = Math.PI / 2;
        // Custom event handlers since we only want to render when something happens.
        renderer.domElement.addEventListener('mousedown', animate, false);
        renderer.domElement.addEventListener('mouseup', stopAnimate, false);
        renderer.domElement.addEventListener('mousewheel', render, false);
        renderer.domElement.addEventListener('MozMousePixelScroll', render, false); // firefox
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
                    /* realism shaders */
                    { name: 'terrain_vert', url: 'static/shader/terrain.vert.glsl' },
                    { name: 'terrain_frag', url: 'static/shader/terrain.frag.glsl' },
                    /* data shaders */
                    { name: 'data_terrain_vert', url: 'static/shader/data_terrain.vert.glsl' },
                    { name: 'data_terrain_frag', url: 'static/shader/data_terrain.frag.glsl' },
                ],
                textures: [
                    // terrain materials
                    { name: 'terrain_rock', url: 'static/img/terrain/rock-512.jpg' },
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
                    scene.remove(scene.getObjectByName('data'));
                    scene.remove(scene.getObjectByName('realism'));
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
                textures.push({ name: 'elevation', url: baseSourceURL + '/elev/' });
                textures.push({ name: 'veg_tex', url: baseSourceURL + '/veg/' });
                textures.push({ name: 'sc_tex', url: baseSourceURL + '/sc/' });
                for (var idx in assetNamesList) {
                    assetName = assetNamesList[idx].asset_name;
                    geometries.push({
                        name: assetName + '_geometry',
                        url: 'static/json/geometry/' + assetName + '.json'
                    });
                    textures.push({
                        name: assetName + '_material',
                        url: 'static/img/' + assetName + '.png'
                    });
                }
                // TODO - use these instead of a stock geometry/material
                studyAreaAssets.textures = textures;
                studyAreaAssets.geometries = geometries;
                // TODO - use the above and remove the below
                studyAreaAssets.textures = [
                    { name: 'elevation', url: baseSourceURL + '/elev/' },
                    { name: 'veg_tex', url: baseSourceURL + '/veg/' },
                    { name: 'sc_tex', url: baseSourceURL + '/sc/' },
                    { name: 'material', url: 'static/img/sagebrush/sagebrush_alt.png' }
                ];
                studyAreaAssets.geometries = [
                    { name: 'geometry', url: 'static/json/geometry/sagebrush_simple4.json' }
                ];
                studyAreaLoader.load(studyAreaAssets, createScene, reportProgress, reportError);
            }
        }
        function createScene(loadedAssets) {
            masterAssets[currentLibraryName] = loadedAssets;
            const heightmapTexture = loadedAssets.textures['elevation'];
            const heights = computeHeights(heightmapTexture);
            const disp = 2.0 / 30.0;
            // define the realism group
            let realismGroup = new THREE.Group();
            realismGroup.name = 'realism';
            const terrainAssets = masterAssets['terrain'];
            const vegetationAssets = masterAssets['vegetation'];
            // create normal terrain
            const realismTerrain = terrain_1.createTerrain({
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
            });
            realismGroup.add(realismTerrain);
            const realismVegetation = veg_1.createSpatialVegetation({
                zonalVegtypes: currentConditions.veg_sc_pct,
                veg_names: currentConditions.veg_names,
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
            });
            realismGroup.add(realismVegetation);
            scene.add(realismGroup);
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
            console.log('Vegetation Rendered!');
            render();
        }
        function updateSpatialVegetation(runControl) {
            console.log('Updating vegetation covers');
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
        function computeHeights(hmTexture) {
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
                    // idx pixel we want to get. Image has rgba, but we only need the r channel
                    idx = (x + y * w) * 4;
                    // scale & store this altitude
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
            renderer.setSize(container.offsetWidth, container.offsetHeight);
            camera.aspect = container.offsetWidth / container.offsetHeight;
            camera.updateProjectionMatrix();
            render();
        }
        function isInitialized() {
            return initialized;
        }
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
        };
        // debug functions
        function getCurrentDefinitions() {
            return currentDefinitions;
        }
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