/* global dc, crossfilter, d3 */
// load the data
Promise.all([d3.json("data/counties.geojson"), d3.csv("data/COVID19 - County.csv")])
  .then(function ([geoData, csvData]) {
    // draw the map
    drawCharts(csvData, geoData);
  });


// TimeStamp,Date,CountyName,Province,PopulationCensus16,ConfirmedCovidCases,NewCases,3DayAvg,7DayAvg
// 1584748800000,21/03/2020,Carlow,Leinster,56932,3,3,1,0


// "properties": { 
//     "CO_ID": "50000", 
//     "ENGLISH": "DONEGAL", 
//     "GAEILGE": "Dún na nGall", 
//     "LOGAINM_ID": "100013", 
//     "GUID": "2ae19629-1452-13a3-e055-000000000001", 
//     "CONTAE": "Dún na nGall", 
//     "COUNTY": 
//     "DONEGAL", 
//     "PROVINCE": "Ulster",
//     "CENTROID_X": 607296.31, 
//     "CENTROID_Y": 911848.45, 
//     "AREA": 4860754356.7700005, 
//     "OBJECTID": 1, 
//     "Shape__Area": 4860147602.4671297, 
//     "Shape__Length": 1673364.4617550699 }

function drawCharts(CSVdata, geojson) {

  CSVdata.forEach(function (d) {
    d['NewCases'] = +d["NewCases"]
    d['3DayAvg'] = +d["3DayAvg"]
    d['7DayAvg'] = +d["7DayAvg"]
    d.CountyName = d.CountyName.toUpperCase();
    return d;
  })

  // ===================================================================== Create dims and groups
  var ndx = crossfilter(CSVdata);
  var postcodes = ndx.dimension(function (d) { return d.CountyName; });
  var province = ndx.dimension(function (d) { return d.Province; });
  var postcodesGroup = postcodes.group().reduceSum(function (d) { return d.NewCases; });
  //var ageBracket = xf.dimension(function (d) { return d.type; });
  //var ageBracketGroup = ageBracket.group().reduceSum(function (d) { return d.value; });

  dc.pieChart('#pie01')
    .dimension(province)
    .group(province.group())
    .width(350)
    .height(300)
    .radius(75);

  dc_leaflet.choroplethChart("#mapChart")
    .dimension(postcodes)
    .group(postcodesGroup)
    .width(600)
    .height(620)
    .center([53.42, -8.1]) // 53.42, -8.10
    .zoom(7)
    .geojson(geojson)
    .colors(['#fff7ec','#fee8c8','#fdd49e','#fdbb84','#fc8d59','#ef6548','#d7301f','#b30000','#7f0000'])
    .colorDomain([0,d3.extent(postcodesGroup.all(), d => d.value)[1]/8])
    .colorAccessor(function (d, i) { return d.value; })
    .featureKeyAccessor(function (feature) {return feature.properties.COUNTY;})
    .legend(dc_leaflet.legend().position('bottomright'))
    ;

  dc.renderAll();
}













function modifyData(d) {
  d['NewCases'] = +d["NewCases"]
  d['3DayAvg'] = +d["3DayAvg"]
  d['7DayAvg'] = +d["7DayAvg"]
  d.CountyName = d.CountyName.toUpperCase();
  return d;
}

function createCountyCharts(countyData) {
  dc.config.defaultColors(d3.schemeDark2);
  let data = crossfilter(countyData);
  let numberFormat = d3.format(".2f");


  let states = data.dimension(function (d) {
    return d["CountyName"];
  });
  let stateRaisedSum = states.group().reduceSum(function (d) {
    return d["NewCases"];
  });



  d3.json("../data/counties.json").then(function (statesJson) {
    console.log(statesJson)
    let rowChart = dc.rowChart('#rowChart');
    let mapChart = new dc.GeoChoroplethChart('#mapChart');

    var projection = d3.geoAlbers().center([0, 55.4])
      .rotate([4.4, 0])
      .parallels([50, 60])
      .scale(6000)
      ;

    rowChart
      .dimension(states)
      .group(stateRaisedSum)
      .width($(rowChart.anchor()).parent().width())
      .height(300)
      .cap(12)
      .ordering(d => -d.value.total)
      .title(function (d) {
        if (d.value.total > 0) return d.value.total + " cases";
      })
      .renderTitleLabel(true)
      .elasticX(true);

    mapChart.width(990)
      .height(500)
      .dimension(states)
      .group(stateRaisedSum)
      //.colors(d3.scaleQuantize().range(["#E2F2FF", "#C4E4FF", "#9ED2FF", "#81C5FF", "#6BBAFF", "#51AEFF", "#36A2FF", "#1E96FF", "#0089FF", "#0061B5"]))
      //.colorDomain([0, 200])
      //.colorCalculator(function (d) { return d ? mapChart.colors()(d) : '#ccc'; })
      .overlayGeoJson(statesJson.features, "county", function (d) {
        return d.properties.COUNTY;
      })
      .projection(projection)
      .valueAccessor(function (kv) {
        return kv.value;
      })
      .title(function (d) {
        return "State: " + d.key + "\nTotal Amount Raised: " + numberFormat(d.value ? d.value : 0) + "M";
      });
    dc.renderAll();

  })

}