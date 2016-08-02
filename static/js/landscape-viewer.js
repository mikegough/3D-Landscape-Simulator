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
});
// terrain.ts
define("terrain", ["require", "exports"], function (require, exports) {
    "use strict";
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
        const mat = new THREE.ShaderMaterial({
            uniforms: {
                heightmap: { type: "t", value: params.heightmap },
                maxHeight: { type: "f", value: maxHeight },
                disp: { type: "f", value: params.disp },
                rock: { type: "t", value: params.rock },
                snow: { type: "t", value: params.snow },
                grass: { type: "t", value: params.grass },
                sand: { type: "t", value: params.sand },
                water: { type: "t", value: params.water }
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
});
define("veg", ["require", "exports", "globals"], function (require, exports, globals) {
    "use strict";
    function createVegetation(params) {
        const halfPatch = new THREE.Geometry();
        halfPatch.merge(params.geo);
        if (params.symmetric) {
            params.geo.rotateY(Math.PI);
            halfPatch.merge(params.geo);
        }
        const geo = new THREE.InstancedBufferGeometry();
        geo.fromGeometry(halfPatch);
        halfPatch.dispose();
        const scale = params.scale;
        geo.scale(scale, scale, scale);
        if (geo.attributes['color']) {
            geo.removeAttribute('color');
        }
        const clusters = params.clusters;
        const heightmap = params.heightmap;
        const widthExtent = params.heightData.dem_width;
        const heightExtent = params.heightData.dem_height;
        const maxHeight = params.heightData.dem_max;
        let numVegInstances;
        if (globals.USE_RANDOM) {
            numVegInstances = globals.MAX_INSTANCES;
        }
        else {
            numVegInstances = Math.floor(globals.MAX_INSTANCES * clusters.length / globals.MAX_CLUSTERS_PER_VEG);
        }
        geo.maxInstancedCount = 0; // must initialize with 0, otherwise THREE throws an error
        const offsets = new THREE.InstancedBufferAttribute(new Float32Array(numVegInstances * 2), 2);
        const hCoords = new THREE.InstancedBufferAttribute(new Float32Array(numVegInstances * 2), 2);
        generateOffsets();
        geo.addAttribute('offset', offsets);
        geo.addAttribute('hCoord', hCoords);
        const mat = new THREE.RawShaderMaterial({
            uniforms: {
                heightmap: { type: "t", value: heightmap },
                tex: { type: "t", value: params.tex },
                maxHeight: { type: "f", value: maxHeight },
                disp: { type: "f", value: params.disp },
                vegColor: { type: "3f", value: [params.color.r / 255.0, params.color.g / 255.0, params.color.b / 255.0] },
                vegMaxHeight: { type: "f", value: params.vegData.maxHeight },
                vegMinHeight: { type: "f", value: params.vegData.minHeight }
            },
            vertexShader: params.vertShader,
            fragmentShader: params.fragShader,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.frustumCulled = false; // Prevents the veg from disappearing randomly
        mesh.name = params.name; // Make the mesh selectable directly from the scene
        mesh.userData['numClusters'] = clusters.length;
        function generateOffsets(cells) {
            let x, y, tx, ty;
            let width = widthExtent, height = heightExtent, numClusters = clusters.length;
            let cluster;
            for (let i = 0; i < offsets.count; i++) {
                // determine position in the spatial extent
                if (globals.USE_RANDOM) {
                    x = Math.random() * width - width / 2; // random placement
                    y = Math.random() * height - height / 2;
                }
                else {
                    cluster = clusters[i % clusters.length];
                    x = cluster.xpos + Math.random() * globals.MAX_CLUSTER_RADIUS;
                    y = cluster.ypos + Math.random() * globals.MAX_CLUSTER_RADIUS;
                    // adjust if outside bounds
                    if (x < -width / 2)
                        x = -width / 2;
                    if (x > width / 2)
                        x = width / 2;
                    if (y < -height / 2)
                        y = -height / 2;
                    if (y > height / 2)
                        y = height / 2;
                }
                // position in the heightmap
                tx = x / width + 0.5;
                ty = y / height + 0.5;
                // update attribute buffers
                offsets.setXY(i, x, y);
                hCoords.setXY(i, tx, 1 - ty); // 1-ty since texture is flipped on Y axis
            }
        }
        return mesh;
    }
    exports.createVegetation = createVegetation;
});
// utils.ts
define("utils", ["require", "exports"], function (require, exports) {
    "use strict";
    function $e(id) {
        return document.getElementById(id);
    }
    exports.$e = $e;
    function $i(id) {
        return document.getElementById(id);
    }
    exports.$i = $i;
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
// Loader that provides a dictionary of named assets
// LICENSE: MIT
// Copyright (c) 2016 by Mike Linkovich;
// Adapted for use by Taylor Mutch, CBI
define("asset_loader", ["require", "exports"], function (require, exports) {
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
                        console.log('loaded ' + ad.name);
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
// app.ts
define("app", ["require", "exports", "globals", "terrain", "veg", "utils", "asset_loader"], function (require, exports, globals, terrain_1, veg_1, utils_1, asset_loader_1) {
    "use strict";
    function run(container_id, params) {
        const vegParams = params;
        if (!utils_1.detectWebGL) {
            alert("Your browser does not support WebGL. Please use a different browser (I.e. Chrome, Firefox).");
            return null;
        }
        let masterAssets;
        let terrain;
        // setup the THREE scene
        const container = document.getElementById(container_id);
        const scene = new THREE.Scene();
        const renderer = new THREE.WebGLRenderer();
        container.appendChild(renderer.domElement);
        const camera = new THREE.PerspectiveCamera(75, container.offsetWidth / container.offsetHeight, .1, 1000.0);
        // Camera controls
        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableKeys = false;
        camera.position.z = 40;
        camera.position.y = 100;
        // Custom event handlers since we only want to render when something happens.
        renderer.domElement.addEventListener('mousedown', animate, false);
        renderer.domElement.addEventListener('mouseup', stopAnimate, false);
        renderer.domElement.addEventListener('mousewheel', render, false);
        renderer.domElement.addEventListener('MozMousePixelScroll', render, false); // firefox
        // Load initial assets
        const loader = asset_loader_1.Loader();
        loader.load({
            text: [
                // terrain
                { name: 'terrain_vert', url: 'static/shader/terrain.vert.glsl' },
                { name: 'terrain_frag', url: 'static/shader/terrain.frag.glsl' },
                // veg
                { name: 'veg_vert', url: 'static/shader/veg.vert.glsl' },
                { name: 'veg_frag', url: 'static/shader/veg.frag.glsl' }
            ],
            textures: [
                // terrain materials
                { name: 'terrain_rock', url: 'static/img/terrain/rock-512.jpg' },
                { name: 'terrain_grass', url: 'static/img/terrain/grass-512.jpg' },
                //{name: 'terrain_dirt', url: 'static/img/terrain/dirt-512.jpg'},
                { name: 'terrain_snow', url: 'static/img/terrain/snow-512.jpg' },
                { name: 'terrain_sand', url: 'static/img/terrain/sand-512.jpg' },
                { name: 'terrain_water', url: 'static/img/terrain/water-512.jpg' },
                // vegtype materials
                { name: 'grass_material', url: 'static/img/grass/grass_base.tga' },
                { name: 'tree_material', url: 'static/img/grass/grass_base.tga' },
                { name: 'juniper_material', url: 'static/img/juniper/pine-leaf-diff.png' },
                // sagebrush
                { name: 'sagebrush_material', url: 'static/img/sagebrush/sagebrush_1.tga' }
            ],
            geometries: [
                { name: 'grass', url: 'static/json/geometry/grass.json' },
                { name: 'tree', url: 'static/json/geometry/tree.json' },
                //{name: 'juniper', url: 'static/json/geometry/juniper2.json'},
                { name: 'juniper', url: 'static/json/geometry/tree_simple.json' },
                { name: 'sagebrush', url: 'static/json/geometry/sagebrush.json' }
            ] /*,
            statistics: [
                {name: 'vegclass_stats', url: ""}
            ]
            */
        }, function (loadedAssets) {
            masterAssets = loadedAssets;
        }, function (progress) {
            console.log("Loading assets... " + progress * 100 + "%");
        }, function (error) {
            console.log(error);
            return;
        });
        let spatialExtent = [-1, -1, -1, -1]; // dummy vars for starting out
        function updateTerrain(extent, updateVeg) {
            // confirm params are different
            if (extent.length === 4 // extent is exactly 4 long
                && (terrain == undefined || extent[0] != spatialExtent[0] ||
                    extent[1] != spatialExtent[1] ||
                    extent[2] != spatialExtent[2] ||
                    extent[3] != spatialExtent[3])) {
                spatialExtent = extent;
                if (terrain != undefined) {
                    scene.remove(terrain);
                    for (var key in vegParams) {
                        scene.remove(scene.getObjectByName(key));
                    }
                }
                let srcPath = 'heightmap/' + extent.join('/');
                let statsPath = srcPath + '/stats';
                loader.load({
                    textures: [
                        { name: 'heightmap', url: srcPath }
                    ],
                    statistics: [
                        { name: 'heightmap_stats', url: statsPath }
                    ]
                }, function (loadedAssets) {
                    terrain = terrain_1.createTerrain({
                        rock: masterAssets.textures['terrain_rock'],
                        snow: masterAssets.textures['terrain_snow'],
                        grass: masterAssets.textures['terrain_grass'],
                        sand: masterAssets.textures['terrain_sand'],
                        water: masterAssets.textures['terrain_water'],
                        vertShader: masterAssets.text['terrain_vert'],
                        fragShader: masterAssets.text['terrain_frag'],
                        data: loadedAssets.statistics['heightmap_stats'],
                        heightmap: loadedAssets.textures['heightmap'],
                        disp: globals.TERRAIN_DISP
                    });
                    scene.add(terrain);
                    // TODO - replace values with source in loadedAssets
                    const vegclass_stats = {
                        maxHeight: 3100.0,
                        minHeight: 900.0
                    };
                    // compute the heights from this heightmap
                    // Only do this once per terrain. We base our clusters off of this
                    const heightmap = loadedAssets.textures['heightmap'];
                    const heightmap_stats = loadedAssets.statistics['heightmap_stats'];
                    const heights = computeHeights(heightmap, heightmap_stats);
                    let baseColor = new THREE.Color(55, 80, 100); // TODO - better colors
                    let i = 0;
                    const maxColors = 7;
                    // Add our vegcovers
                    for (var key in vegParams) {
                        // calculate the veg colors we want to display
                        const r = Math.floor(i / maxColors * 200);
                        const g = Math.floor(i / maxColors * 130);
                        const vegColor = new THREE.Color(baseColor.r + r, baseColor.g + g, baseColor.b);
                        const vegtype = getVegetationType(key);
                        const vegscale = getVegetationScale(key);
                        scene.add(veg_1.createVegetation({
                            heightmap: loadedAssets.textures['heightmap'],
                            name: key,
                            symmetric: useSymmetry(key),
                            scale: vegscale,
                            tex: masterAssets.textures[vegtype + '_material'],
                            geo: masterAssets.geometries[vegtype],
                            color: vegColor,
                            vertShader: masterAssets.text['veg_vert'],
                            fragShader: masterAssets.text['veg_frag'],
                            disp: globals.TERRAIN_DISP,
                            clusters: createClusters(heights, heightmap_stats, vegclass_stats),
                            heightData: loadedAssets.statistics['heightmap_stats'],
                            vegData: vegclass_stats
                        }));
                        ++i;
                    }
                    render();
                    if (updateVeg)
                        updateVegetation(vegParams);
                }, function (progress) {
                    console.log("Loading heightmap assets... " + progress * 100 + "%");
                }, function (error) {
                    console.log(error);
                    return;
                });
            }
        }
        function computeHeights(hmTexture, stats) {
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
                    // flip vertical because textures are Y+
                    idx = (x + (h - y - 1) * w) * 4;
                    // scale & store this altitude
                    heights[x + y * w] = data[idx] / 255.0 * stats.dem_max;
                }
            }
            // Free the resources and return
            data = ctx = canvas = null;
            return heights;
        }
        function useSymmetry(vegname) {
            return !(vegname.includes('Sagebrush') || vegname.includes('Mahogany') || vegname.includes('Juniper'));
        }
        function getVegetationType(vegname) {
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
        function getVegetationScale(vegname) {
            if (vegname.includes("Sagebrush")) {
                return 4.0;
            }
            else if (vegname.includes("Juniper")) {
                return 1.;
            }
            else if (vegname.includes("Mahogany")) {
                return 15.0;
            }
            return 1.0;
        }
        function createClusters(heights, hmstats, vegstats) {
            const numClusters = Math.floor(Math.random() * globals.MAX_CLUSTERS_PER_VEG);
            const finalClusters = new Array();
            const w = hmstats.dem_width;
            const h = hmstats.dem_height;
            const maxHeight = vegstats.maxHeight;
            const minHeight = vegstats.minHeight;
            let ix, iy, height;
            for (let i = 0; i < numClusters; ++i) {
                ix = Math.floor(Math.random() * w);
                iy = Math.floor(Math.random() * h);
                height = heights[ix + iy * w];
                if (height < maxHeight && height > minHeight) {
                    const newCluster = {
                        xpos: ix - w / 2,
                        ypos: iy - h / 2,
                    };
                    finalClusters.push(newCluster);
                }
            }
            return finalClusters;
        }
        function updateVegetation(newParams) {
            for (var key in newParams) {
                if (vegParams.hasOwnProperty(key)) {
                    vegParams[key] = newParams[key]; // update the object to what we want it to be
                    const vegCover = scene.getObjectByName(key);
                    const vegGeo = vegCover.geometry;
                    if (globals.USE_RANDOM) {
                        vegGeo.maxInstancedCount = Math.floor(vegParams[key] / 100 * globals.MAX_INSTANCES); // make this a static function
                    }
                    else {
                        const vegClusters = vegCover.userData['numClusters'];
                        vegGeo.maxInstancedCount = Math.floor(globals.MAX_INSTANCES * (vegParams[key] / 100) * (vegClusters / globals.MAX_CLUSTERS_PER_VEG));
                    }
                }
            }
            render();
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
        }
        return {
            updateTerrain: updateTerrain,
            updateVegetation: updateVegetation,
            resize: resize,
            // debug 
            scene: scene,
            camera: camera
        };
    }
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = run;
});
//# sourceMappingURL=landscape-viewer.js.map