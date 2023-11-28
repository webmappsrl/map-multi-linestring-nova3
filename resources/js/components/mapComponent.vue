<template>
    <div>
        <div class="flex-container">
            <div class="flex-geometry" v-if="edit">
                <input ref="file" :id="field.name" type="file" :class="errorClasses" :placeholder="field.name"
                @change="updateLinestring($event)" accept=".geojson,.gpx,.kml" />
                <p v-if="hasError" class="my-2 text-danger">
                    {{ firstError }}
                </p>
            </div>
        </div>
        <div id="container">
            <div :id="mapRef" class="wm-map"></div>
        </div>
    </div>
</template>

<script>
import { FormField, HandlesValidationErrors } from 'laravel-nova'
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "leaflet.fullscreen/Control.FullScreen.js";
import "leaflet.fullscreen/Control.FullScreen.css";
import "leaflet-draw/dist/leaflet.draw-src.js";
import "leaflet-draw/dist/leaflet.draw-src.css";
import * as toGeoJSON from '@tmcw/togeojson';
import axios from "axios";

const DEFAULT_TILES = 'https://{s}.tile.openstreetthis.map.org/{z}/{x}/{y}.png';
const VERSION = "0.0.9"
const VERSION_IMAGE = `<img class="version-image" src="https://img.shields.io/badge/wm--map--multi--linestring-${VERSION}-blue">`;
const DEFAULT_ATTRIBUTION = '<a href="https://www.openstreetthis.map.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery (c) <a href="https://www.mapbox.com/">Mapbox</a>';
const DEFAULT_GRAPHHOPPER_PROFILE = 'foot';
const DEFAULT_CENTER = [0, 0];
const DEFAULT_MINZOOM = 7;
const DEFAULT_MAXZOOM = 17;
const DEFAULT_DEFAULTZOOM = 8;
const LINESTRING_OPTIONS = {
    fillColor: '#f03',
    fillOpacity: 0.5,
};

export default {
    name: "MapMultiLineString",
    mixins: [FormField, HandlesValidationErrors],
    props: ["field", "edit"],
    data() {
        return {
            mapRef: `mapContainer-${Math.floor(Math.random() * 10000 + 10)}`,
            deleteIcon: null,
            map: null,
            linestring: null,
            geojson: null,
            graphhoperIcon: null,
        }
    },
    methods: {
        /**
         * The code represents a function called "initMap()" which initializes a map. 
         * The function sets a timeout of 300 milliseconds before executing the code within its curly braces. 
         * Inside the function, the center, maxZoom, minZoom, defaultZoom, and attribution values are assigned from the field object or default values if they don't exist. 
         * The function then calls several other functions within itself to build the map, linestring, Leaflet edit mode, and delete geometry. 
         * The use of the setTimeout delay is likely to give time for the field object's values to be fetched or processed, to ensure consistency and accuracy in the map initialization.
         */
        initMap() {
            setTimeout(async () => {
                this.center = this.field.center ?? DEFAULT_CENTER;
                this.maxZoom = this.field.maxZoom ?? DEFAULT_MAXZOOM;
                this.minZoom = this.field.minZoom ?? DEFAULT_MINZOOM;
                this.defaultZoom = this.field.defaultZoom ?? DEFAULT_DEFAULTZOOM;
                this.attribution = this.field.attribution ?? DEFAULT_ATTRIBUTION;
                this.graphhopper_api = this.field.graphhopper_api ?? undefined;
                this.graphhopper_profile = this.field.graphhopper_profile ?? DEFAULT_GRAPHHOPPER_PROFILE;
                this.initLeafletEditMode();
                this.buildMap();
                this.buildLinestring(this.geojson);
                this.buildGraphHopperControl();
                this.buildLeafletEditMode();
                this.buildDeleteGeometry();
            }, 300);
        },
        async getRouting(points) {
            const res = await axios.post(this.graphhopper_api, { points, profile: this.graphhopper_profile, debug: false, locale: "en", points_encoded: false, instructions: false, elevation: true, optimize: "false" });
            return res.data.paths[0].points.coordinates;
        },
        /**
         * The function first assigns the global JavaScript variable L to the document.L property. 
         * This allows the L variable to be accessible throughout the document. 
         * Next, the function assigns the global L variable to the window.L property, enabling the L variable to be accessible globally across multiple windows or frames. 
         * This code assumes that the L variable is a reference to the Leaflet JavaScript library, which is typically used for creating interactive maps. 
         * The purpose of this function is to initialize editing mode for a Leaflet map, in which a user can add, modify, or delete map features.
         */
        initLeafletEditMode() {
            document.L = L;
            window.L = L;
        },
        /**
         * The function buildMap() creates and initializes a Leaflet map instance based on the data provided by the field property of the class instance. 
         * It first parses a geojson data from the field property, if available and updates its geojson data if a new one is passed to updateGeojson(). 
         * It then initializes a L.map instance using the L library from Leaflet with the mapRef, center and defaultZoom values set in the instance as parameters.
         * It adds a tile layer with the field.tiles if it is available, or adds the default tile (set as DEFAULT_TILES) to the map. 
         * It also sets the attribution value and other options for the tile layer. Finally, it adds the tile layer onto the previously created map instance. 
         * All refereces to variables used within buildMap() seem to be properties of the class instance.
         */
        buildMap() {
            var currentGeojson = this.field.geojson != null ? JSON.parse(this.field.geojson) : null;
            this.updateGeojson(currentGeojson)
            this.map = L.map(this.mapRef, {
                fullscreenControl: true,
                fullscreenControlOptions: {
                    position: "topleft"
                }
            }).setView(this.center, this.defaultZoom);
            L.tileLayer(this.field.tiles ?? DEFAULT_TILES, {
                attribution: `${this.attribution}, ${VERSION_IMAGE}`,
                maxZoom: this.maxZoom,
                minZoom: this.minZoom,
                id: "mapbox/streets-v11"
            }).addTo(this.map);
        },
        /**
         * @param {*} geojson 
         * This code defines a function called buildLinestring that takes one parameter, geojson. 
         * Upon invoking the function, if the geojson parameter is not null, the function uses the L.geoJson function to add a new layer to the map object, with the style options set to LINESTRING_OPTIONS. 
         * The new layer is assigned to the linestring property of this, and the fitBounds function is used to fit the map object to the layer's boundaries.
         * If an error occurs during the next step of the function it will be caught silently so as not to interrupt the program.
         * The next step checks whether the edit property of this is set to true. If it is, another set of checks follow: if the geojson parameter is not null, 
         * the setEditMode function will be called, otherwise the setDrawMode function will be called.
         * In conclusion, this code builds a new linestring on the map object from a given geojson parameter, and lets the user toggle between the edit and draw modes, 
         * depending on whether the geojson is null or not.
         */
        buildLinestring(geojson) {
            if (geojson != null) {
                if (this.linestring !== null) {
                    this.map.removeLayer(this.linestring);
                    this.linestring = null;
                }
                this.linestring = L.geoJson(geojson, {
                    style: LINESTRING_OPTIONS
                }).addTo(this.map);
                this.map.fitBounds(this.linestring.getBounds());
            }
            try {
                if (this.edit) {
                    if (geojson != null) {
                        this.setEditMode();
                    } else {
                        this.setDrawMode();
                    }
                }
            } catch (_) { }
        },
        /**
         * The code builds a custom leaflet control called 'deleteGeometry', which allows the user to delete a drawn polygon on a leaflet map. 
         * It first checks if the edit mode is enabled, if not, it returns. 
         * The L.Control.deleteGeometry instance is created by extending an existing L.Control object. 
         * Within its onAdd method, a div with a delete button class is created and an image is added to it. 
         * A click event listener is added to the delete icon, which removes the polygon from the map and resets the draw mode. 
         * If this.edit is true and this.geojson is not null, then the setEditMode function is called. If edit is false or geojson is null, the delete icon is not displayed and the draw mode is set. 
         * Finally, the deleteGeometry control is added to the map in the top right position (default if not specified). 
         * If there is a polygon drawn on the map and the edit mode is enabled, then the delete icon is visible.
         */
        buildDeleteGeometry() {
            if (!this.edit) {
                return;
            }
            // Extend the Leaflet Control class to create a custom deleteGeometry control
            L.Control.deleteGeometry = L.Control.extend({
                onAdd: () => {
                    this.deleteIcon = L.DomUtil.create('div')
                    L.DomUtil.addClass(this.deleteIcon, 'delete-button');
                    var img = L.DomUtil.create('img');
                    img.src = 'https://cdn-icons-png.flaticon.com/512/2891/2891491.png';
                    this.deleteIcon.appendChild(img);
                    // Add a click event listener to the delete button
                    L.DomEvent.on(this.deleteIcon, "click", (e) => {
                        L.DomEvent.stopPropagation(e);
                        this.updateLinestring(null);
                        this.setDrawMode();
                        this.deleteIcon.style.visibility = "hidden";
                        this.updateGraphHopperVisibility();
                    });
                    if (this.edit && this.geojson != null) {
                        this.setEditMode();
                    } else {
                        this.deleteIcon.style.visibility = "hidden";
                        this.setDrawMode();
                    }
                    return this.deleteIcon;
                }
            });
            L.control.deleteGeometry = function (opts) {
                return new L.Control.deleteGeometry(opts);
            }
            L.control.deleteGeometry({ position: 'topright' }).addTo(this.map);
            if (this.linestring != null && this.edit) {
                this.deleteIcon.style.visibility = "visible";
            }
        },
        /**
         * @param {*} event 
         * This function updates a linestring feature on a leaflet map. 
         * First, it checks if a linestring already exists on the map, and removes it if so. 
         * Then, if an event is passed as an argument, it creates a FileReader and extracts the file name from the event. 
         * It then sets an onload function to read the contents of the file, parse it depending on the file type (either GPX, KML or JSON), and update the geojson property of the map. 
         * If the parsing is successful, it builds a linestring from the first feature in the geojson object. 
         * If there is a parsing error, it resets the file input and hides a delete icon before displaying an alert message. 
         * Finally, if there is no event passed as argument, it resets the geojson object and the file input. 
         */
        updateLinestring(event) {
            if (this.linestring !== null) {
                this.map.removeLayer(this.linestring);
                this.linestring = null;
            }
            // If an event was provided create a new FileReader instance to read the contents of the uploaded file
            if (event) {
                const reader = new FileReader();
                let fileName = event.target.files[0].name || '';
                reader.onload = (event) => {
                    let res = event.target.result;
                    // Check the file type and convert it to GeoJSON if necessary
                    if (fileName.indexOf('gpx') > -1) {
                        // If the file is a GPX file, parse the XML and convert it to GeoJSON
                        const parser = new DOMParser().parseFromString(res, 'text/xml');
                        res = toGeoJSON.gpx(parser);
                    } else if (fileName.indexOf('kml') > -1) {
                        // If the file is a KML file, parse the XML and convert it to GeoJSON
                        const parser = new DOMParser().parseFromString(res, 'text/xml');
                        res = toGeoJSON.kml(parser);
                    } else {
                        res = JSON.parse(res);
                    }
                    this.updateGeojson(res)
                    try {
                        this.buildLinestring(this.geojson);
                    } catch (_) {
                        this.$refs.file.value = null;
                        this.deleteIcon.style.visibility = "hidden";
                        window.alert('The file is corrupted');
                    }
                };
                reader.readAsText(event.target.files[0]);
            } else {
                this.updateGeojson(null)
                this.$refs.file.value = null;
            }
        },
        /**
         * @param {*} geojson 
         * This is a method called updateGeojson that takes a geojson parameter. 
         * The purpose of this method is to update the current geojson property value of the object calling the method. 
         * First, the method assigns the new geojson value to the geojson property of the object with this.geojson = geojson. 
         * Then, it emits an event with this.$emit("geojson", geojson);. This event is emitted with the name "geojson" and passes the geojson value as a parameter. 
         * This code assumes that the object calling the method has a $emit method, which is usually the case in Vue.js components.
         */
        updateGeojson(geojson) {
            this.geojson = geojson;
            this.$emit("geojson", geojson);
        },
        /**
         * This is a method buildLeafletEditMode() that initializes Leaflet edit mode on a map. 
         * It first checks if this.edit is true, then either enters "draw mode" or "edit mode" depending on whether the linestring property exists.          
         * It listens for 'draw:created' events on the map, which are emitted when a user adds a new feature such as a point or line. 
         * It extracts the layer from the event, adds it to the linestring feature group, converts the feature group to GeoJSON, and passes the GeoJSON to updateGeojson().
         * It also listens for 'draw:edited' events on the map, which are emitted when a user modifies an existing feature. 
         * It converts the linestring to GeoJSON and passes it to updateGeojson().
         * It also listens for 'draw:deletestop' events on the map, which are emitted when a user finishes deleting a feature. It does not do anything with this event.
         * It also listens for 'draw:drawstop' events on the map, which are emitted when a user stops drawing a feature. 
         * It converts the linestring to GeoJSON, updates the GraphHopper visibility, builds the linestring, and enters edit mode.
         */
        buildLeafletEditMode() {
            if (!this.edit) {
                return;
            }
            // If the current linestring is null, set the draw mode, otherwise, set the edit mode
            if (this.linestring == null) {
                this.setDrawMode();
            } else {
                this.setEditMode();
            }
            // Add an event listener for when a new shape is created on the map
            this.map.on('draw:created', (e) => {
                const layer = e.layer;
                // If the current linestring is null, create a new feature group and set its editing options
                if (this.linestring === null) {
                    this.linestring = L.featureGroup().addTo(this.map);
                    this.drawControl.setDrawingOptions({
                        edit: {
                            featureGroup: this.linestring,
                            remove: false
                        }
                    });
                }
                this.linestring.addLayer(layer);
                const geojson = this.linestring.toGeoJSON();
                this.updateGeojson(geojson);
            });
            // Add an event listener for when a track is edited on the map
            this.map.on('draw:edited', (e) => {
                L.DomEvent.stopPropagation(e);
                var geojson = this.linestring.toGeoJSON();
                this.updateGeojson(geojson);
            });
            // Add an event listener for when the delete mode is stopped
            this.map.on('draw:deletestop', (e) => {
                L.DomEvent.stopPropagation(e);
            });
            // Add an event listener for when the draw mode is stopped
            this.map.on('draw:drawstop', (e) => {
                L.DomEvent.stopPropagation(e);
                var geojson = this.linestring.toGeoJSON();
                this.updateGraphHopperVisibility();
                this.buildLinestring(geojson)
                this.setEditMode();
            });
        },
        /**
         * The code defines a function named setEditMode(). 
         * This function removes the current drawing control from the Leaflet map object, and attempts to make a delete icon visible. 
         * After this, a new drawing control (L.Control.Draw) is created with its drawing capabilities set to false, but allowing edit functionality. 
         * The featureGroup parameter is set to a linestring object. With remove set to false, the user cannot remove any of the objects they have created. 
         * Finally, the new drawing control is added to the Leaflet map object.
         */
        setEditMode() {
            try {
                this.map.removeControl(this.drawControl);
            } catch (_) { }
            try {
                this.deleteIcon.style.visibility = "visible";
            } catch (_) { }
            this.drawControl = new L.Control.Draw({
                draw: false,
                edit: {
                    featureGroup: this.linestring,
                    remove: false
                }
            });
            this.map.addControl(this.drawControl);
        },
        /**
         * This is a method called "setDrawMode" that is likely part of a larger JavaScript class. 
         * It takes no parameters and its purpose is to set up a drawing tool on a Leaflet map. Here is what the code does, line by line:
         * Tries to remove the existing draw control from the Leaflet map object that this method is part of. 
         * If there is no existing draw control, this will not cause an error.
         * Tries to hide a delete icon element. Again, if the element doesn't exist, this will not cause an error.
         * Creates a new draw control using the Leaflet.Control.Draw constructor, passing options for what types of shapes can be drawn (in this case, only a polyline with LINESTRING_OPTIONS). 
         * Editing of shapes is disabled.
         * Adds the new draw control to the map object.
         * Finally, the method ends, having set up the map object to allow drawing of polylines.
         */
        setDrawMode() {
            try {
                this.map.removeControl(this.drawControl);
            } catch (_) { }
            try {
                this.deleteIcon.style.visibility = "hidden";
            } catch (_) { }
            this.drawControl = new L.Control.Draw({
                draw: {
                    polyline: {
                        shapeOptions: LINESTRING_OPTIONS,
                        allowIntersection: false,
                    },
                    polygon: false,
                    rectangle: false,
                    circle: false,
                    marker: false,
                    circlemarker: false
                },
                edit: false
            });
            this.map.addControl(this.drawControl);
        },
        /**
         * This code defines a function buildGraphHopperControl()that creates a custom Leaflet control for routing using GraphHopper API. 
         * It first checks if the edit option is enabled. If it's not enabled, the function returns an empty result. 
         * If the editoption is enabled, it creates a new Leaflet control called L.Control.GraphHoperusing the L.Control.extend()method. 
         * This control will have an onAdd method that creates a custom button with the class graph-hopper-button and an image of the GraphHopper logo. 
         * When the button is clicked, it asynchronously calls a getRouting() method to calculate the route using the current linestring as an input in GeoJSON format. 
         * It then builds a new linestring and updates the GeoJSON data accordingly. 
         * Finally, it checks if edit is true and geojson is not null. If it is not, the button is hidden.
         * The function then creates a new instance of the L.Control.GraphHoper and adds it to the top left position of the map.
         */
        buildGraphHopperControl() {
            if (!this.edit || this.graphhopper_api == null) {
                return;
            }
            // Extend the Leaflet control to create a custom GraphHopper control
            L.Control.GraphHoper = L.Control.extend({
                onAdd: () => {
                    this.graphhoperIcon = L.DomUtil.create('div')
                    L.DomUtil.addClass(this.graphhoperIcon, 'graph-hopper-button');
                    var img = L.DomUtil.create('img');
                    img.src = 'https://cdn-icons-png.flaticon.com/512/9265/9265993.png';
                    this.graphhoperIcon.appendChild(img);
                    // Add a click event listener to the GraphHopper button
                    L.DomEvent.on(this.graphhoperIcon, "click", async (e) => {
                        var geojson = this.linestring.toGeoJSON();
                        // Get the GraphHopper routing for the current linestring coordinates
                        geojson.features[0].geometry.coordinates = await this.getRouting(geojson.features[0].geometry.coordinates);
                        this.buildLinestring(geojson);
                        this.updateGeojson(geojson);
                    });
                    // Hide the GraphHopper button if not in edit mode or if there is no GeoJSON data
                    if (this.edit && this.geojson != null) {
                    } else {
                        this.graphhoperIcon.style.visibility = "hidden";
                    }
                    return this.graphhoperIcon;
                }
            });
            L.control.GraphHoper = function (opts) {
                return new L.Control.GraphHoper(opts);
            }
            L.control.GraphHoper({ position: 'topleft' }).addTo(this.map);
        },
        /**
         * This code defines a function called "updateGraphHopperVisibility()" which updates the visibility of a GraphHopper icon on a map. 
         * If a linestring exists (meaning there is an element on the map), the graphhopperIcon is made visible. 
         * If there is no linestring, the graphhopperIcon is set to be hidden. Any errors resulting from styling the graphhopperIcon are caught and ignored.
         */
        updateGraphHopperVisibility() {
            if (this.linestring != null) {
                try {
                    this.graphhoperIcon.style.visibility = "visible";
                } catch (_) { }
            } else {
                try {
                    this.graphhoperIcon.style.visibility = "hidden";
                } catch (_) { }
            }
        }
    },
    mounted() {
        this.initMap();
    }
};
</script>
