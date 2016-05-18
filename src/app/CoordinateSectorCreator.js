define([
    'dijit/_TemplatedMixin',
    'dijit/_WidgetBase',

    'dojo/_base/declare',
    'dojo/_base/lang',
    'dojo/_base/array',
    'dojo/_base/event',

    'dojo/query',
    'dojo/number',
    'dojo/on',
    'dojo/aspect',
    'dojo/dom-attr',
    'dojo/dom-class',
    'dojo/text!app/templates/CoordinateSectorCreator.html',

    'esri/geometry/Point',
    'esri/SpatialReference',
    'esri/geometry/webMercatorUtils',
    'esri/geometry/Polygon',
    'esri/geometry/Circle',
    'esri/symbols/SimpleFillSymbol',
    'esri/symbols/SimpleLineSymbol',
    'esri/Color',
    'esri/graphic',
    'esri/layers/GraphicsLayer'
], function (
    _TemplatedMixin,
    _WidgetBase,

    declare,
    lang,
    array,
    events,

    query,
    number,
    on,
    aspect,
    domAttr,
    domClass,
    template,

    Point,
    SpatialReference,
    webMercatorUtils,
    Polygon,
    Circle,
    SimpleFillSymbol,
    SimpleLineSymbol,
    Color,
    Graphic,
    GraphicsLayer
) {
    return declare([_WidgetBase, _TemplatedMixin], {
        // description:
        //      Creates circle sectors from coordinates.
        templateString: template,
        baseClass: 'coordinate-sector-creator',
        // _panelController: {key: DomNode}
        // summary:
        //      an object has of domnodes that contain the
        //      coorindate form elements
        _panelController: null,
        // zoomLevel: Number
        // summary:
        //      the cache level to zoom the map to
        zoomLevel: 13,
        // symbol: esri/symbols/SimpleFillSymbol
        // summary:
        //      symbol used to display coverage graphicsLayer
        symbol: null,
        // graphicsLayer: esri/layers/GraphicsLayer
        // summary:
        //      GraphicsLayer used to display coverage areas
        graphicsLayer: null,
        // Properties to be sent into constructor
        // map: esri/map
        // summary:
        //      the map to zoom
        map: null,

        postCreate: function () {
            // summary:
            //      Overrides method of same name in dijit._Widget.
            console.log('app.CoordinateSectorCreator::postCreate', arguments);
            if (!this.map) {
                throw 'This widget requires an esri/map to be useful.';
            }
            this.symbol = new SimpleFillSymbol(SimpleFillSymbol.STYLE_NULL,
              new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
              new Color([255,255,0]), 4),new Color([255,255,0,0.25])
            );
            this.graphicsLayer = new GraphicsLayer({ id: 'sectors' });
            this.map.addLayer(this.graphicsLayer);

            this._panelController = {
                panels: {
                    dd: this.ddNode
                },
                hideAllBut: function (showMe) {
                    for (var prop in this.panels) {
                        if (this.panels.hasOwnProperty(prop)) {
                            if (showMe && prop === showMe) {
                                domClass.replace(this.panels[prop], 'show', 'hide');
                                this.visible = this.panels[prop];
                                continue;
                            }

                            domClass.replace(this.panels[prop], 'hide', 'show');
                        }
                    }
                },
                visible: this.ddNode
            };

            this.set('valid', false);

            this.setupConnections();

            this.inherited(arguments);
        },
        clear: function () {
            // summary:
            //      clears all coverage area graphics from the map
            this.graphicsLayer.clear();

            return;
        },
        createSector: function () {
            // summary:
            //      creates a cirlce sector and zooms center point created by _getCoverageParams
            console.log('app.CoordinateSectorCreator::createSector', arguments);

            if (!this.map) {
                throw 'This widget requires an esri/map to be useful.';
            }

            // disable create button
            domClass.add(this.createNode, 'disabled');
            domAttr.set(this.createNode, 'disabled', true);

            //Get user supplied coverage parameters
            var coverageParams = this._getCoverageParams();
            var point = coverageParams.center;

            //Create coverage area polygon and add it to the graphics layer
            var polygonJson = {
                'rings': [this._createCircleSector(
                    point.x,
                    point.y,
                    coverageParams.beamWidth,
                    coverageParams.azimuth,
                    coverageParams.range
                )],
                'spatialReference': { 'wkid': 4326 }
            };
            var sectorPolygon = webMercatorUtils.geographicToWebMercator(new Polygon(polygonJson));
            sectorPolygon.setSpatialReference(new SpatialReference({wkid: 3857}));//set spatialReference to web map Web mercator wkid
            var graphic = new Graphic(sectorPolygon, this.symbol);
            this.graphicsLayer.add(graphic);

            //Zoom to sector center point
            //Maybe change this to zoom to sector polygon extent
            var p = webMercatorUtils.geographicToWebMercator(point);
            p.setSpatialReference(new SpatialReference({wkid: 3857}));
            this.map.centerAndZoom(p, this.zoomLevel);
            this.emit('create', {
                bubbles: true,
                cancelable: true,
                point: point
            });

            // enable create button
            domClass.remove(this.createNode, 'disabled');
            domAttr.remove(this.createNode, 'disabled');

            return;
        },
        setupConnections: function () {
            // summary:
            //      wire events, and such
            console.log('app.CoordinateSectorCreator::setupConnections', arguments);
            this.own(
                on(this.domNode, 'input:change', lang.hitch(this, '_validate')),
                on(this.domNode, 'input:input', lang.hitch(this, '_validate')),
                on(this.formNode, 'submit', function (evt) {
                    events.stop(evt);
                })
            );

            this.watch('valid', lang.hitch(this, '_enableCreateSector'));
            aspect.after(this, '_updateView', lang.hitch(this, '_validate'));
        },
        _updateView: function (evt) {
            // summary:
            //      handles the click event of the coordinate system buttons
            // evt
            console.log('app.CoordinateSectorCreator::_updateView::_updateView', arguments);

            this._panelController.hideAllBut(evt.target.value);
        },
        _enableCreateSector: function (prop, old, value) {
            // summary:
            //      if validate returns true, enable the create button
            console.log('app.CoordinateSectorCreator::_enableCreate', arguments);

            if (!value) {
                domClass.add(this.createNode, 'disabled');
                domAttr.set(this.createNode, 'disabled', true);

                return;
            }

            domClass.remove(this.createNode, 'disabled');
            domAttr.remove(this.createNode, 'disabled');
        },
        _getCoverageParams: function () {
          // summary:
          //      Get center point, range and angle inputs to create coverage area
            var getValue = function (input, match) {
                var value = array.filter(input, function (node) {
                    return node.name === match;
                })[0].value;

                return number.parse(value);
            };

            var inputs = query('[data-required="true"]', this._panelController.visible);
            var sr = new SpatialReference({
                wkid: 4326
            });
            var point = null;
            var x = null;
            var y = null;
            var beamWidth = null;
            var azimuth = null;
            var range = null;

            switch (this._panelController.visible) {//switch allows for other coordinate nodes in the future
                case this.ddNode:
                    x = getValue(inputs, 'x');
                    y = getValue(inputs, 'y');
                    beamWidth = getValue(inputs, 'beamWidth');
                    azimuth = getValue(inputs, 'azimuth');
                    range = getValue(inputs, 'range');

                    point = new Point(-x, y, sr);

                    break;
            }

            var coverageParams = {
                'center': point,
                'beamWidth': beamWidth,
                'azimuth': azimuth,
                'range': range
            };

            return coverageParams;
        },
        _validate: function () {
            // summary:
            //      validates the inputs from the node
            console.log('app.CoordinateSectorCreator::_validate', arguments);

            var valid = false;
            var inputs = query('[data-required="true"]', this._panelController.visible);

            //reset validation
            inputs.forEach(function (node) {
                domClass.remove(node.parentElement, 'has-error');
                domClass.remove(node.parentElement, 'has-success');
            });

            //filter inputs to get bad ones
            var problems = array.filter(inputs, function (node) {
                if (!node.value ||
                    lang.trim(node.value) === '' || !number.parse(node.value)) {
                    domClass.add(node.parentElement, 'has-error');
                    return true;
                } else {
                    domClass.add(node.parentElement, 'has-success');
                    return false;
                }
            });

            valid = problems.length === 0;

            this.set('valid', valid);

            return valid;
        },
        _createCircleSector: function (long, lat, beamWidth, azimuth, range) {

            var startAngle = (azimuth + (360 - (beamWidth / 2.0))) % 360;
            var radiusPoints = [];
            if (beamWidth < 360) {//only use center point if sector is not a full circle
                radiusPoints.push([long, lat]);
            }
            //Create a point every 1 degree around the arc
            for (var i = 0; i <= beamWidth; i++) {
                var angle = (startAngle + i) % 360
                var radPoint = this.destVincenty(lat, long, angle, range)
                radiusPoints.push(radPoint)
            };
            if (beamWidth < 360) {
                radiusPoints.push([long, lat])
            }
            return radiusPoints;
        },
        toRad: function (n) {
            return n * Math.PI / 180;
        },
        toDeg: function (n) {
            return n * 180 / Math.PI;
        },
        destVincenty: function (lat1, lon1, brng, dist) {
            //https://gist.github.com/mathiasbynens/354587
            var a = 6378137;
            var b = 6356752.3142;
            var f = 1 / 298.257223563; // WGS-84 ellipsiod
            var s = dist;
            var alpha1 = this.toRad(brng);
            var sinAlpha1 = Math.sin(alpha1);
            var cosAlpha1 = Math.cos(alpha1);
            var tanU1 = (1 - f) * Math.tan(this.toRad(lat1));
            var cosU1 = 1 / Math.sqrt((1 + tanU1 * tanU1));
            var sinU1 = tanU1 * cosU1;
            var sigma1 = Math.atan2(tanU1, cosAlpha1);
            var sinAlpha = cosU1 * sinAlpha1;
            var cosSqAlpha = 1 - sinAlpha * sinAlpha;
            var uSq = cosSqAlpha * (a * a - b * b) / (b * b);
            var A = 1 + uSq / 16384 * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
            var B = uSq / 1024 * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
            var sigma = s / (b * A);
            var sigmaP = 2 * Math.PI;
            while (Math.abs(sigma - sigmaP) > 1e-12) {
                var cos2SigmaM = Math.cos(2 * sigma1 + sigma);
                var sinSigma = Math.sin(sigma);
                var cosSigma = Math.cos(sigma);
                var deltaSigma = B * sinSigma * (cos2SigmaM + B / 4 * (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) - B / 6 * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM)));
                sigmaP = sigma;
                sigma = s / (b * A) + deltaSigma;
            };
            var tmp = sinU1 * sinSigma - cosU1 * cosSigma * cosAlpha1;
            var lat2 = Math.atan2(sinU1 * cosSigma + cosU1 * sinSigma * cosAlpha1, (1 - f) * Math.sqrt(sinAlpha * sinAlpha + tmp * tmp));
            var lambda = Math.atan2(sinSigma * sinAlpha1, cosU1 * cosSigma - sinU1 * sinSigma * cosAlpha1);
            var C = f / 16 * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
            var L = lambda - (1 - C) * f * sinAlpha * (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));
                // revAz = Math.atan2(sinAlpha, -tmp); // final bearing
            return [lon1 + this.toDeg(L), this.toDeg(lat2)];
        }
    });
});
