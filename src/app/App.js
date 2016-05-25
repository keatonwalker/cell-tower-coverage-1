define([
    'agrc/widgets/map/BaseMap',
    'agrc/widgets/layer/OpacitySlider',

    'app/config',
    'app/CoordinateSectorCreator',

    'dijit/registry',
    'dijit/_TemplatedMixin',
    'dijit/_WidgetBase',
    'dijit/_WidgetsInTemplateMixin',

    'dojo/dom',
    'dojo/dom-style',
    'dojo/on',
    'dojo/text!app/templates/App.html',
    'dojo/_base/array',
    'dojo/_base/declare',
    'dojo/_base/lang',

    'esri/dijit/Print',
    'esri/geometry/Extent',
    'esri/layers/ArcGISDynamicMapServiceLayer',

    'ijit/widgets/layout/SideBarToggler',

    'layer-selector'
], function (
    BaseMap,
    OpacitySlider,

    config,
    CoordinateSectorCreator,

    registry,
    _TemplatedMixin,
    _WidgetBase,
    _WidgetsInTemplateMixin,

    dom,
    domStyle,
    on,
    template,
    array,
    declare,
    lang,

    Print,
    Extent,
    ArcGISDynamicMapServiceLayer,

    SideBarToggler,

    BaseMapSelector
) {
    return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
        // summary:
        //      The main widget for the app

        widgetsInTemplate: true,
        templateString: template,
        baseClass: 'app',

        // childWidgets: Object[]
        //      container for holding custom child widgets
        childWidgets: null,

        //psapId
        //    layer ID for psap boundaries
        psapId: 'PsapBoundaries',
        // map: agrc.widgets.map.Basemap
        map: null,

        constructor: function () {
            // summary:
            //      first function to fire after page loads
            console.info('app.App::constructor', arguments);

            config.app = this;
            this.childWidgets = [];

            this.inherited(arguments);
        },
        postCreate: function () {
            // summary:
            //      Fires when
            console.log('app.App::postCreate', arguments);
            // set version number
            this.version.innerHTML = config.version;

            this.initMap();

            this.childWidgets.push(
                new SideBarToggler({
                    sidebar: this.sideBar,
                    map: this.map,
                    centerContainer: this.centerContainer
                }, this.sidebarToggle),
                new CoordinateSectorCreator({
                    map: this.map
                }, this.coordinateNode),
                new OpacitySlider({
                    mapServiceLayer: this.map.getLayer(this.psapId),
                    displayLegend: false
                }, this.sliderNode)
            );

            this.inherited(arguments);

            this.setupConnections();
        },
        setupConnections: function () {
            // summary:
            //      Fires when
            console.log('app.App::setupConnections', arguments);
        },
        startup: function () {
            // summary:
            //      Fires after postCreate when all of the child widgets are finished laying out.
            console.log('app.App::startup', arguments);

            var that = this;
            array.forEach(this.childWidgets, function (widget) {
                console.log(widget.declaredClass);
                that.own(widget);
                widget.startup();
            });

            this.inherited(arguments);
        },
        initMap: function () {
            // summary:
            //      Sets up the map
            console.info('app.App::initMap', arguments);

            this.map = new BaseMap(this.mapDiv, {
                useDefaultBaseMap: false,
                showAttribution: false,
                extent: new Extent({
                    xmax: -12010849.397533866,
                    xmin: -12898741.918094235,
                    ymax: 5224652.298632992,
                    ymin: 4422369.249751998,
                    spatialReference: {
                        wkid: 3857
                    }
                })
            });

            this.childWidgets.push(
                new BaseMapSelector({
                    map: this.map,
                    quadWord: config.quadWord,
                    baseLayers: ['Hybrid', 'Lite', 'Terrain', 'Topo', 'Color IR']
                })
            );
            var urlPsap = config.urls.psap;
            var psapBoundaries = new ArcGISDynamicMapServiceLayer(urlPsap, {
                id: this.psapId,
                opacity: 0.75
            });

            this.map.addLayer(psapBoundaries);

        }
    });
});
