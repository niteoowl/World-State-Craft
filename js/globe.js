// World State Craft - 3D Globe Module
// Using Three.js for performance-optimized 3D globe rendering

import * as THREE from 'https://esm.sh/three@0.160.0';
import { OrbitControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js';

class Globe {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.globe = null;
        this.countries = new Map();
        this.markers = [];
        this.selectedTerritory = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.init();
    }

    init() {
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0e17);

        // Camera
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        this.camera.position.set(0, 0, 3);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.renderer.domElement);

        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 1.5;
        this.controls.maxDistance = 5;
        this.controls.enablePan = false;
        this.controls.rotateSpeed = 0.5;

        // Lighting
        this.setupLighting();

        // Create globe
        this.createGlobe();

        // Create atmosphere
        this.createAtmosphere();

        // Stars background
        this.createStars();

        // Event listeners
        this.setupEventListeners();

        // Start animation loop
        this.animate();
    }

    setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);

        // Directional light (sun)
        const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
        sunLight.position.set(5, 3, 5);
        this.scene.add(sunLight);

        // Hemisphere light for natural look
        const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x3d5c5c, 0.3);
        this.scene.add(hemiLight);
    }

    createGlobe() {
        // Earth texture - using satellite imagery
        const textureLoader = new THREE.TextureLoader();

        // Load textures
        const earthTexture = textureLoader.load(
            'https://unpkg.com/three-globe@2.31.0/example/img/earth-blue-marble.jpg'
        );
        const bumpTexture = textureLoader.load(
            'https://unpkg.com/three-globe@2.31.0/example/img/earth-topology.png'
        );
        const specTexture = textureLoader.load(
            'https://unpkg.com/three-globe@2.31.0/example/img/earth-water.png'
        );

        // Globe geometry
        const geometry = new THREE.SphereGeometry(1, 64, 64);

        // Globe material with realistic shading
        const material = new THREE.MeshPhongMaterial({
            map: earthTexture,
            bumpMap: bumpTexture,
            bumpScale: 0.02,
            specularMap: specTexture,
            specular: new THREE.Color(0x333333),
            shininess: 5
        });

        this.globe = new THREE.Mesh(geometry, material);
        this.scene.add(this.globe);

        // Add country borders overlay
        this.loadCountryBorders();
    }

    createAtmosphere() {
        // Atmospheric glow
        const atmosphereGeometry = new THREE.SphereGeometry(1.02, 64, 64);
        const atmosphereMaterial = new THREE.ShaderMaterial({
            vertexShader: `
                varying vec3 vNormal;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                varying vec3 vNormal;
                void main() {
                    float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
                    gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity;
                }
            `,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            transparent: true
        });

        const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
        this.scene.add(atmosphere);
    }

    createStars() {
        const starsGeometry = new THREE.BufferGeometry();
        const starsMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.005,
            transparent: true,
            opacity: 0.8
        });

        const starsVertices = [];
        for (let i = 0; i < 5000; i++) {
            const x = (Math.random() - 0.5) * 100;
            const y = (Math.random() - 0.5) * 100;
            const z = (Math.random() - 0.5) * 100;
            starsVertices.push(x, y, z);
        }

        starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
        const stars = new THREE.Points(starsGeometry, starsMaterial);
        this.scene.add(stars);
    }

    async loadCountryBorders() {
        try {
            // Load GeoJSON for country borders
            const response = await fetch('https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json');
            const geojson = await response.json();

            // Create country meshes
            this.createCountryMeshes(geojson);
        } catch (error) {
            console.error('Failed to load country borders:', error);
        }
    }

    createCountryMeshes(geojson) {
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0xc9a227,
            opacity: 0.3,
            transparent: true
        });

        geojson.features.forEach(feature => {
            const countryName = feature.properties.name;
            const coordinates = feature.geometry.coordinates;
            const type = feature.geometry.type;

            const lines = [];

            const processCoordinates = (coords) => {
                const points = coords.map(coord => {
                    return this.latLonToVector3(coord[1], coord[0], 1.001);
                });

                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const line = new THREE.Line(geometry, lineMaterial);
                lines.push(line);
                this.scene.add(line);
            };

            if (type === 'Polygon') {
                coordinates.forEach(ring => processCoordinates(ring));
            } else if (type === 'MultiPolygon') {
                coordinates.forEach(polygon => {
                    polygon.forEach(ring => processCoordinates(ring));
                });
            }

            this.countries.set(countryName, {
                feature,
                lines,
                bbox: this.computeBBox(feature),
                owned: false,
                owner: null
            });
        });
    }

    latLonToVector3(lat, lon, radius = 1) {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lon + 180) * (Math.PI / 180);

        const x = -radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.cos(phi);
        const z = radius * Math.sin(phi) * Math.sin(theta);

        return new THREE.Vector3(x, y, z);
    }

    addNationMarker(lat, lon, flagUrl, nationName, nationId) {
        const position = this.latLonToVector3(lat, lon, 1.02);

        // Create marker sprite
        const textureLoader = new THREE.TextureLoader();
        const flagTexture = textureLoader.load(flagUrl);

        const spriteMaterial = new THREE.SpriteMaterial({
            map: flagTexture,
            transparent: true
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.copy(position);
        sprite.scale.set(0.1, 0.06, 1);
        sprite.userData = { nationId, nationName };

        this.markers.push(sprite);
        this.scene.add(sprite);

        return sprite;
    }

    highlightCountry(countryName, color = 0xc9a227) {
        const country = this.countries.get(countryName);
        if (country) {
            country.lines.forEach(line => {
                line.material.color.setHex(color);
                line.material.opacity = 1;
            });
        }
    }

    setCountryOwner(countryName, ownerId, color) {
        const country = this.countries.get(countryName);
        if (country) {
            country.owned = true;
            country.owner = ownerId;
            country.lines.forEach(line => {
                line.material.color.setHex(color);
                line.material.opacity = 0.8;
            });
        }
    }

    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', () => this.onWindowResize());

        // Mouse click for selection
        this.renderer.domElement.addEventListener('click', (e) => this.onMouseClick(e));

        // Mouse move for hover
        this.renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
    }

    onWindowResize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    onMouseClick(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.globe);

        if (intersects.length > 0) {
            let lat, lon;

            // Use UV coordinates for pixel-perfect precision if available
            if (intersects[0].uv) {
                const uv = intersects[0].uv;
                lat = (uv.y - 0.5) * 180;
                lon = (uv.x - 0.5) * 360;
            } else {
                // Fallback to vector math
                const point = intersects[0].point;
                const coords = this.vector3ToLatLon(point);
                lat = coords.lat;
                lon = coords.lon;
            }

            // Find which country was clicked
            const clickedCountry = this.findCountryAtPoint(lat, lon);

            console.log(`Clicked at ${lat.toFixed(2)}, ${lon.toFixed(2)} -> ${clickedCountry}`);

            if (clickedCountry) {
                window.dispatchEvent(new CustomEvent('globe:countryClick', {
                    detail: {
                        country: clickedCountry,
                        lat: lat,
                        lon: lon
                    }
                }));
            }
        }

        // Check marker clicks
        const markerIntersects = this.raycaster.intersectObjects(this.markers);
        if (markerIntersects.length > 0) {
            const marker = markerIntersects[0].object;
            window.dispatchEvent(new CustomEvent('globe:nationClick', {
                detail: marker.userData
            }));
        }
    }

    onMouseMove(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.globe);

        if (intersects.length > 0) {
            let lat, lon;

            if (intersects[0].uv) {
                const uv = intersects[0].uv;
                lat = (uv.y - 0.5) * 180;
                lon = (uv.x - 0.5) * 360;
            } else {
                const point = intersects[0].point;
                const coords = this.vector3ToLatLon(point);
                lat = coords.lat;
                lon = coords.lon;
            }

            window.dispatchEvent(new CustomEvent('globe:hover', {
                detail: {
                    lat: lat,
                    lon: lon,
                    screenX: event.clientX,
                    screenY: event.clientY
                }
            }));
        }
    }

    vector3ToLatLon(vector) {
        const norm = vector.clone().normalize();

        // Standard spherical conversion matching Three.js
        const phi = Math.asin(norm.y);
        const lat = phi * (180 / Math.PI);

        // Atan2(z, x) corresponds to longitude
        // Adjust for rotation offset if necessary. 
        // Based on typical Three.js spheres:
        const theta = Math.atan2(-norm.z, norm.x);
        const lon = (theta * (180 / Math.PI)) + 90;

        // Normalize lon to -180...180 would be handled by % usually, 
        // but UV method is preferred.

        return { lat, lon };
    }

    findCountryAtPoint(lat, lon) {
        // 1. Exact point-in-polygon check
        for (const [name, country] of this.countries) {
            if (this.isPointInCountry(lat, lon, country.feature)) {
                return name;
            }
        }

        // 2. Proximity check (fallback for small countries/borders)
        // Search within ~3 degrees radius
        let closestName = null;
        let closestDist = 3.0;

        for (const [name, country] of this.countries) {
            // Check bounding box first for performance
            if (!this.isInBoundingBox(lat, lon, country.bbox, 3.0)) continue;

            // Calculate approximate center from bbox
            const centerLat = (country.bbox.minLat + country.bbox.maxLat) / 2;
            const centerLon = (country.bbox.minLon + country.bbox.maxLon) / 2;

            // Simple Euclidean distance (approximation good enough for local picking)
            const dLat = lat - centerLat;
            const dLon = lon - centerLon;
            const dist = Math.sqrt(dLat * dLat + dLon * dLon);

            if (dist < closestDist) {
                closestDist = dist;
                closestName = name;
            }
        }

        return closestName;
    }

    // Optimization: Compute Bbox on load
    computeBBox(feature) {
        let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
        const coordinates = feature.geometry.coordinates;
        const type = feature.geometry.type;

        const processRing = (ring) => {
            ring.forEach(coord => {
                const lon = coord[0];
                const lat = coord[1];
                minLon = Math.min(minLon, lon);
                maxLon = Math.max(maxLon, lon);
                minLat = Math.min(minLat, lat);
                maxLat = Math.max(maxLat, lat);
            });
        };

        if (type === 'Polygon') {
            coordinates.forEach(processRing);
        } else if (type === 'MultiPolygon') {
            coordinates.forEach(poly => poly.forEach(processRing));
        }
        return { minLat, maxLat, minLon, maxLon };
    }

    isInBoundingBox(lat, lon, bbox, margin = 0) {
        if (!bbox) return true;
        return lat >= bbox.minLat - margin &&
            lat <= bbox.maxLat + margin &&
            lon >= bbox.minLon - margin &&
            lon <= bbox.maxLon + margin;
    }

    isPointInCountry(lat, lon, feature) {
        const coordinates = feature.geometry.coordinates;
        const type = feature.geometry.type;

        const isInPolygon = (point, polygon) => {
            let inside = false;
            for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
                const xi = polygon[i][0], yi = polygon[i][1];
                const xj = polygon[j][0], yj = polygon[j][1];

                if (((yi > point[1]) !== (yj > point[1])) &&
                    (point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi)) {
                    inside = !inside;
                }
            }
            return inside;
        };

        const point = [lon, lat];

        if (type === 'Polygon') {
            return isInPolygon(point, coordinates[0]);
        } else if (type === 'MultiPolygon') {
            return coordinates.some(polygon => isInPolygon(point, polygon[0]));
        }

        return false;
    }

    rotateTo(lat, lon, duration = 1000) {
        // Animate camera to look at specific coordinates
        const targetPosition = this.latLonToVector3(lat, lon, 3);
        // Simple lerp animation could be added here
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // Slow rotation when not interacting
        if (!this.controls.enabled) {
            this.globe.rotation.y += 0.001;
        }

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    destroy() {
        this.renderer.dispose();
        this.container.removeChild(this.renderer.domElement);
    }
}

export default Globe;
