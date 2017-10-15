mapboxgl.accessToken = 'pk.eyJ1IjoiY2hlbnlpIiwiYSI6ImNpam4yeTBlNTAwY2d0b201ZGhnNWRzZXEifQ.3ddWSoN5UBBiG3Bug0TzoQ';

// Standard set up
var filterGroup = document.getElementById('filter-group');
var map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/chenyi/cilwf6sdq002j9mm38001yzm0',
  center: [-73.987910,40.722223],
  zoom: 10.76
});
// Add direction functionality
map.addControl(new mapboxgl.Directions());


// layers for choropleth
var layers = [
  ['#bcbddc', 333370],
  ['#9e9ac8', 538985],
  ['#807dba', 790939],
  ['#6a51a3', 1306994],
  ['#4a1486', 419540466]
];


var facilityOn = true

map.on('load', function(){

  //***********************************************************
  // Choropleth Map
  //***********************************************************

  // build legend layers
  var legend = document.getElementById('legend'); //get the legend from the HTML document
  map.addSource('NYCpop_density', {
    'type': 'vector',
    'url': 'mapbox://chenyi.05uz1m5u'
  });
  layers.forEach(function(layer, i){
    console.log(layer);
    map.addLayer({
      "id": "layer-" + i,
      "type": "fill",
      "source": "NYCpop_density",
      "paint": {
        "fill-color": layer[0],
        "fill-opacity": 0.2
      },
      "source-layer": "pop_density",

    });

    // Build out legends on map
    var item = document.createElement('div');//each layer gets a 'row' - this isn't in the legend yet, we do this later
    var key = document.createElement('span');//add a 'key' to the row. A key will be the color circle

    key.className = 'legend-key'; //the key will take on the shape and style properties defined here, in the HTML
    key.style.backgroundColor = layer[0]; // the background color is retreived from teh layers array

    var value = document.createElement('span');//add a value variable to the 'row' in the legend
    value.id = 'legend-value-' + i; //give the value variable an id that we can access and change

    item.appendChild(key); //add the key (color cirlce) to the legend row
    item.appendChild(value);//add the value to the legend row
    legend.appendChild(item); // Add row to the legend
  });

  layers.forEach(function(layer, i) {
    var filters = ['all',['<=', 'Pop_Den', layer[1]]];
    if (i !== 0) filters.push(['>', 'Pop_Den', layers[i - 1][1]]);
    map.setFilter('layer-' + i, filters);
    // Set the legend value for each layer
    document.getElementById('legend-value-' + i).textContent = layer[1].toLocaleString() ; //as we iterate through the layers
    //get the correct row, and add the appropriate text
  });


  //*********************************************************
  // Generate point layers and filtering methods
  //********************************************************

  // LOAD HEALTH FACILITIES SOURCE

  map.addSource('HealthFacilitiesSource',{
    "type": "geojson",
    "data": hlth
  });

  map.addLayer({
    "id": "facilityLayer",
    "type": "circle",
    "source": "HealthFacilitiesSource",
    "interactive": true,
    "layout": {},
    "paint":{
      'circle-color': "black",
      'circle-radius': 5,
      'circle-opacity': 0
    },
  });
  var facility_colors = ['red','green','blue','pink'];
  //SIZE ARRAY HERE
  var facility_size = [1,2,3,4,5]
  var coloridx = null;
  // LOAD LAYERS AND FILTERS
  hlth.features.forEach(function(feature) {
    var type = feature.properties['Facility_Type'];
    var layerID = 'poi-' + type;
    if (type === "Diagnostic & Treatment Center"){
      typeidx = 0;
      z-Index = 5;
    }
    else if (type === "Acute Care Hospital"){
      typeidx = 1;
      z-Index = 4;
    }
    else if (type === "Nursing Home"){
      typeidx = 2;
      z-Index = 3;
    }
    else if (type === "Child Health Center"){
      typeidx = 3;
      z-Index = 2;
    }
    if (!map.getLayer(layerID)) {
      map.addLayer({
        "id": layerID,
        "type": "circle",
        "source": "HealthFacilitiesSource",
        "layout": {},
        "paint":{
          'circle-color': facility_colors[typeidx],
          'circle-radius': facility_size[typeidx],
          'circle-opacity': 1
        },
        "filter": ["==", "Facility_Type", type]
      });

      // Add checkbox and label elements for the layer.
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.id = layerID;
      input.checked = true;
      filterGroup.appendChild(input);

      var label = document.createElement('label');
      label.setAttribute('for', layerID);
      label.textContent = type;
      filterGroup.appendChild(label);

      // When the checkbox changes, update the visibility of the layer.
      input.addEventListener('change', function(e) {
        map.setLayoutProperty(layerID, 'visibility',
        e.target.checked ? 'visible' : 'none');
      });
    };
  });
});


//*********************************************************
// Create hover popups for points
//*********************************************************

// Create popup box
var popup_facility = new mapboxgl.Popup({
  closeButton: true,
  closeOnClick: true
});

map.on("mousemove", function(e) {
  map.featuresAt(e.point, {
    radius: 6,
    includeGeometry: true,
    layer: ["facilityLayer"]
  }, function (err, features) {
    if (!err && features.length) { // if no error & features exist
      map.getCanvas().style.cursor = (!err && (features[0].properties.Facility_Name != "")) ? 'pointer' : '';
      popup_facility.setLngLat(features[0].geometry.coordinates)
      .setHTML("<b>" + features[0].properties.Facility_Name + "</b><br>" + features[0].properties.Location + "<br>Call them at <i>" + features[0].properties.Phone + "</i>.")
      .addTo(map);
    }

    else {
      map.getCanvas().style.cursor = '';
      popup_facility.remove();
      return;
    }
  });
});

//*********************************************************
//Generate buffer, find points within buffer,
//highlight points, and create pop up with info about points
//*********************************************************

//set up variables before real work starts
var tempClickBuffer = null;
var tempHealth = null;
var tempNearest = null;
var popup_origin = new mapboxgl.Popup({
  closeButton: true,
  closeOnClick: false
});

// when you click the map, do the following.
// recall 'e' is an event data object: https://www.mapbox.com/mapbox-gl-js/api/#EventData
map.on("click", function(e) {
  // clean up variables if we've already clicked somewhere else.
  // check by seeing if there's geojson text in the tempClickBuffer variable
  if (tempClickBuffer != null){
    tempClickBuffer = null;
    tempHealth = null;
    tempNearest = null;
    tempPt = null;
    map.removeLayer('tempClickBufferLayer'); //get rid of the old buffer
    map.removeSource('tempClickBufferSource'); //get rid of the old selected supermarkets
    map.removeLayer('selectedHealth'); //reset source
    map.removeSource('tempHealth'); //reset source
    map.removeLayer('selectedNearest'); //reset source
    map.removeSource('tempNearest'); //reset source
  }

  // create a point geojson object from the event data - this creates a point where you clicked
  tempLngLat = [e.lngLat.lng,e.lngLat.lat]; //create an array that looks like: [lng,lat]
  // make an object that is a 'geojson' object from the point data
  var tempPt = {
    "type": "Feature",
    "properties": {},
    "geometry": {
      "type": "Point",
      "coordinates": tempLngLat
    }
  };

  // create a buffer using the point geojson you just created, 1 km circular buffer
  tempClickBuffer = turf.buffer(tempPt, 1.5, 'kilometers');
  // see what facilities (from the hlth geojson variable) are within the 'tempClickBuffer' geojson object you just created.
  // this function generates a new featureCollection called 'tempHealth', which we will display later
  tempHealth = turf.within(hlth,tempClickBuffer);

  // creates a temporary nearest point
  tempNearest = turf.nearest(tempPt, tempHealth)

  // if the array is not null, add a pop up centered on your click location
  // that states the number of supermarkets within the clickBuffer
  /*
  if (tempHealth.features.length != null){
  popup_origin.remove()
  .setLngLat(e.lngLat)
  .setHTML('The nearest facility is <b>' + tempNearest.properties.Facility_Name + '</b>.')
  .addTo(map)
  console.log(tempNearest.properties.Facility_Name)
};
*/

// center the  map on the point you clicked and zoom in, using 'easeTo' so it is animated
map.easeTo({
  center: e.lngLat, //center on the point you clicked
  zoom: 13, //zoom to zoom level 12
  duration: 1000 //take 1000 milliseconds to get there
})

// add the source and layer information of the buffer geojson (tempClickBuffer) and
// subset of supermarkets geojson objects created
map.addSource('tempHealth',{
  "type": "geojson",
  "data": tempHealth
});
map.addLayer({
  'id': 'selectedHealth',
  'type': 'circle',
  'source': 'tempHealth',
  'interactive': true,
  'layout': {},
  'paint': {
    'circle-color': '#82daf0',
    'circle-radius': 5,
    'circle-opacity': 1
  }
});
map.addSource('tempNearest',{
  "type": "geojson",
  "data": tempNearest
});
map.addLayer({
  'id': 'selectedNearest',
  'type': 'circle',
  'source': 'tempNearest',
  'interactive': true,
  'layout': {},
  'paint': {
    'circle-color': '#7878c5',
    'circle-radius': 5,
    'circle-opacity': 1
  }
});
map.addSource('tempClickBufferSource',{
  "type": "geojson",
  "data": tempClickBuffer
});
map.addLayer({
  'id': 'tempClickBufferLayer',
  'type': 'fill',
  'source': 'tempClickBufferSource',
  'interactive': true,
  'layout': {},
  'paint': {
    'fill-color': 'white',
    'fill-opacity': 0.35,
    'fill-outline-color': '#1f91ae'
  }
}, 'selectedHealth'); // insert the buffer behind the selectedNearest layer


//*********************************************************
// Specify points for directions
//*********************************************************
// Add direction functionality

var directions = new mapboxgl.Directions({
  unit: 'metric', // Use the metric system to display distances.
  profile: 'walking', // Set the initial profile to walking.
  container: 'directions', // Specify an element thats not the map container.
});

directions.setOrigin(tempPt.geometry.coordinates); // On load, set the origin to our temporary coordinates on the mouse.
directions.setDestination(tempNearest.geometry.coordinates); // On load, set the destination to the nearest point's coordinates.

directions.on('route', function(e){
    console.log(e.route);
});

});
map.addControl(new mapboxgl.Directions());
