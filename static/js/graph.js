// data sources
// const countiesDataUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRgkvhtziA93AnQaiE6eMmf_iujke82_gBtv6_Ixs5XIzZ-dc4rgXug2Ll8P3N56PqyHz5ECvfxBDW_/pub?gid=786105712&single=true&output=csv"
// const casesDeathsDataUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRgkvhtziA93AnQaiE6eMmf_iujke82_gBtv6_Ixs5XIzZ-dc4rgXug2Ll8P3N56PqyHz5ECvfxBDW_/pub?gid=247770862&single=true&output=csv"
// const casesStatisticsDataUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRgkvhtziA93AnQaiE6eMmf_iujke82_gBtv6_Ixs5XIzZ-dc4rgXug2Ll8P3N56PqyHz5ECvfxBDW_/pub?gid=2036441059&single=true&output=csv"
const countiesDataUrl = "data/test/COVID19 - County.csv"
const casesDeathsDataUrl = "data/test/COVID19 - CasesAndDeaths.csv"
const casesStatisticsDataUrl = "data/test/COVID19 - Statistics.csv"
const countiesGeoDataUrl = "data/counties-min.geojson"
let allValues;
// formatting
const dayFormat = d3.timeFormat("%A");
const dateFormat = d3.timeParse("%Y/%m/%d");
const formatTime = d3.timeFormat("%a %d %b");
const unixTime = d3.timeFormat("%Q");
const colorRange = ['#fee8c8', '#fdd49e', '#fdbb84', '#fc8d59', '#ef6548', '#d7301f', '#b30000', '#7f0000'];
const dFormat = d3.format(",");
// == Create Chart Objectives
// covid in numbers
const number_Cases = dc.numberDisplay('#total-cases');
const number_Deaths = dc.numberDisplay('#total-deaths');
const number_Hospital = dc.numberDisplay('#hospitalised-cases');
const number_Recovered = dc.numberDisplay('#total-recovered');
const number_ICU = dc.numberDisplay('#icu-cases');
const number_HealthWorker = dc.numberDisplay('#health-worker-cases');
const stackBar_ageGroupCases = dc.barChart("#stackedBarAge");
const bar_genders = dc.barChart('#barCasesGender');
// counties
const rowChart_counties = dc.rowChart('#chart01');
const leaflet_counties = dc_leaflet.choroplethChart("#map");
const bar_provinces = dc.barChart('#chart02');
const compositeLine_counties = new dc.CompositeChart("#cases-per-day");
// cases and deaths
const compositeLine_cases = new dc.CompositeChart("#casesAndDeaths01");
const compositeLine_deaths = new dc.CompositeChart("#casesAndDeaths02");

dc.config.defaultColors(d3.schemeDark2);

let countiesData = fetch(countiesDataUrl, { mode: 'cors' })
  .then(function (response) {
    return response.ok ? response.text() : Promise.reject(response.status);
  })
  .then(function (text) { return d3.csvParse(text); })
  .then(function (data) {
    data.forEach(d => cleanCountiesData(d));
    return data
  })
  .catch(function (error) { console.log('Request failed', error) });


let casesDeathsData = fetch(casesDeathsDataUrl, { mode: 'cors' })
  .then(function (response) {
    return response.ok ? response.text() : Promise.reject(response.status);
  })
  .then(function (text) { return d3.csvParse(text); })
  .then(function (data) {
    data.forEach(d => cleanCasesDeathsData(d));
    return data
  })
  .catch(function (error) { console.log('Request failed', error) });


let casesStatisticsData = fetch(casesStatisticsDataUrl, { mode: 'cors' })
  .then(function (response) {
    return response.ok ? response.text() : Promise.reject(response.status);
  })
  .then(function (text) { return d3.csvParse(text); })
  .then(function (data) {
    data.forEach(d => cleanStatsData(d));
    return data
  })
  .catch(function (error) { console.log('Request failed', error) });

let geoData = d3.json(countiesGeoDataUrl)

Promise.all([countiesData, casesDeathsData, geoData, casesStatisticsData])
  .then(function ([countiesData, casesDeathsData, geoData, casesStatisticsData]) {
    createCountyCharts(countiesData, geoData);
    createDeathCharts(casesDeathsData);
    createStatsCharts(casesStatisticsData);
    removingLoading()
    dc.renderAll()
    setDateOnPhaseChart();
  });

function createCountyCharts(countiesData, geoData) {
  let mondays = getDaysFromUnixTime(countiesData, "Monday")
  // ==  create the crossfilter object
  let ndx = crossfilter(countiesData);
  // ==  create dimensions
  let dim_county     = ndx.dimension(d => d.County);
  let dim_county4Map = ndx.dimension(d => d.County);
  let dim_province   = ndx.dimension(d => d.Province);
  let dim_date       = ndx.dimension(d => d.unixTime);
  // == create groups
  const grp_countySumCases = dim_county4Map.group().reduceSum(d => d['NewCases']);
  const grp_provincesSumCases = dim_province.group().reduceSum(d => d['NewCases']);
  const grp_dateSumCases = dim_date.group().reduceSum(d => d['NewCases']);
  const grp_dateSumCases3Day = dim_date.group().reduceSum(d => d['3DayAvg']);
  const grp_dateSumCases7Day = dim_date.group().reduceSum(d => d['7DayAvg']);

  let averageSalaryByGender = dim_county.group().reduce(
    function (p, v) {
      p.count++;
      p.total += v["NewCases"];
      p.threeDay += v["3DayAvg"];
      p.sevenDay += v["7DayAvg"];
      return p;
    },
    function (p, v) {
      p.count--;
      if (p.count == 0) {
        p.total = 0;
        p.threeDay = 0;
        p.sevenDay = 0;
      } else {
        p.total -= v["NewCases"];
        p.threeDay -= v["3DayAvg"];
        p.sevenDay -= v["7DayAvg"];
      }
      return p;
    },
    function () {
      return { count: 0, total: 0, threeDay: 0, sevenDay: 0 };
    }
  );

  leaflet_counties
    .dimension(dim_county4Map)
    .group(grp_countySumCases)
    .width($(leaflet_counties.anchor()).parent().width())
    .height(320)
    .center([53.42, -7])
    .zoom(6)
    .geojson(geoData)
    .colors(colorRange)
    .colorDomain([0, d3.extent(grp_countySumCases.all(), d => d.value)[1] / 8])
    .colorAccessor(d => d.value)
    .featureKeyAccessor(feature => feature.properties.COUNTY)
    .legend(dc_leaflet.legend().position('bottomright'))
    ;

  ordinalBarChart(bar_provinces, dim_province, grp_provincesSumCases);
  createCompositeChart(compositeLine_counties, dim_date, [grp_dateSumCases, grp_dateSumCases3Day, grp_dateSumCases7Day]);
  createRowChart(rowChart_counties, dim_county, averageSalaryByGender)

  compositeLine_counties.margins().left = 50;

  timeXAxis(compositeLine_counties, mondays)

};

function createDeathCharts(casesDeathsData) {
  let mondays = getDaysFromUnixTime(casesDeathsData, "Monday")

  let ndx = crossfilter(casesDeathsData);
  //dimensions
  let dim_date1 = ndx.dimension(d => d.unixTime);
  let dim_date2 = ndx.dimension(d => d.unixTime);
  // groups
  const grp_cases1Day = dim_date1.group().reduceSum(d => d.ConfirmedCovidCases);
  const grp_cases3Day = dim_date1.group().reduceSum(d => d.Cases3DayAvg);
  const grp_cases7Day = dim_date1.group().reduceSum(d => d.Cases7DayAvg);
  const grp_deaths1Day   = dim_date2.group().reduceSum(d => d.ConfirmedCovidDeaths);
  const grp_deaths3Day   = dim_date2.group().reduceSum(d => d.Deaths3Day);
  const grp_deaths7Day   = dim_date2.group().reduceSum(d => d.Deaths7Day);

  // charts
  createCompositeChart(compositeLine_cases,  dim_date1, [grp_cases1Day, grp_cases3Day, grp_cases7Day])
  createCompositeChart(compositeLine_deaths, dim_date2, [grp_deaths1Day, grp_deaths3Day, grp_deaths7Day])
  show_number_filtered(ndx)

  timeXAxis(compositeLine_cases, mondays)
  timeXAxis(compositeLine_deaths, mondays)
}

function createStatsCharts(statsData) {
  let ndx = crossfilter(statsData);

  let dim_male    = ndx.dimension(d => d.Male );
  let dim_female  = ndx.dimension(d => d.Female );
  let dim_unknown = ndx.dimension(d => d.Unknown );

  let grp_maleSum    = dim_male.groupAll().reduceSum(d => d.Male);
  let grp_femaleSum  = dim_female.groupAll().reduceSum(d => d.Female);
  let grp_unknownSum = dim_unknown.groupAll().reduceSum(d => d.Unknown);

  allValues = ndx.groupAll().reduce(
    function (p, v) {
      p.count++;
      p.CovidCases += v.CovidCases;
      p.CovidDeaths += v.CovidDeaths;
      p.CovidRecovered += v.CovidRecovered;
      p.ConfirmedCases += v.ConfirmedCases;
      p.HospitalisedCases += v.HospitalisedCases;
      p.RequiringICUCases += v.RequiringICUCases;
      p.HealthcareWorkersCases += v.HealthcareWorkersCases;
      p.HospitalisedAged5 += v.HospitalisedAged5;
      p.HospitalisedAged5to14 += v.HospitalisedAged5to14;
      p.HospitalisedAged15to24 += v.HospitalisedAged15to24;
      p.HospitalisedAged25to34 += v.HospitalisedAged25to34;
      p.HospitalisedAged35to44 += v.HospitalisedAged35to44;
      p.HospitalisedAged45to54 += v.HospitalisedAged45to54;
      p.HospitalisedAged55to64 += v.HospitalisedAged55to64;
      p.HospitalisedAged65up += v.HospitalisedAged65up;
      p.Aged5 += v.Aged5;
      p.Aged5to14 += v.Aged5to14;
      p.Aged15to24 += v.Aged15to24;
      p.Aged25to34 += v.Aged25to34;
      p.Aged35to44 += v.Aged35to44;
      p.Aged45to54 += v.Aged45to54;
      p.Aged55to64 += v.Aged55to64;
      p.Aged65up += v.Aged65up;
      p.Male += v.Male;
      p.Female += v.Female;
      p.Unknown += v.Unknown;
      return p;
    },
    function (p, v) {
      p.count--;
      if (p.count == 0) {
        p.CovidCases = 0;
        p.CovidDeaths = 0;
        p.CovidRecovered = 0;
        p.ConfirmedCases = 0;
        p.HospitalisedCases = 0;
        p.RequiringICUCases = 0;
        p.HealthcareWorkersCases = 0;
        p.HospitalisedAged5 = 0;
        p.HospitalisedAged5to14 = 0;
        p.HospitalisedAged15to24 = 0;
        p.HospitalisedAged25to34 = 0;
        p.HospitalisedAged35to44 = 0;
        p.HospitalisedAged45to54 = 0;
        p.HospitalisedAged55to64 = 0;
        p.HospitalisedAged65up = 0;
        p.Aged5 = 0;
        p.Aged5to14 = 0;
        p.Aged15to24 = 0;
        p.Aged25to34 = 0;
        p.Aged35to44 = 0;
        p.Aged45to54 = 0;
        p.Aged55to64 = 0;
        p.Aged65up = 0;
        p.Male = 0;
        p.Female = 0;
        p.Unknown = 0;
      } else {
        p.CovidCases -= v.CovidCases;
        p.CovidDeaths -= v.CovidDeaths;
        p.CovidRecovered -= v.CovidRecovered;
        p.ConfirmedCases -= v.ConfirmedCases;
        p.HospitalisedCases -= v.HospitalisedCases;
        p.RequiringICUCases -= v.RequiringICUCases;
        p.HealthcareWorkersCases -= v.HealthcareWorkersCases;
        p.HospitalisedAged5 -= v.HospitalisedAged5;
        p.HospitalisedAged5to14 -= v.HospitalisedAged5to14;
        p.HospitalisedAged15to24 -= v.HospitalisedAged15to24;
        p.HospitalisedAged25to34 -= v.HospitalisedAged25to34;
        p.HospitalisedAged35to44 -= v.HospitalisedAged35to44;
        p.HospitalisedAged45to54 -= v.HospitalisedAged45to54;
        p.HospitalisedAged55to64 -= v.HospitalisedAged55to64;
        p.HospitalisedAged65up -= v.HospitalisedAged65up;
        p.Aged5 -= v.Aged5;
        p.Aged5to14 -= v.Aged5to14;
        p.Aged15to24 -= v.Aged15to24;
        p.Aged25to34 -= v.Aged25to34;
        p.Aged35to44 -= v.Aged35to44;
        p.Aged45to54 -= v.Aged45to54;
        p.Aged55to64 -= v.Aged55to64;
        p.Aged65up -= v.Aged65up;
        p.Male -= v.Male;
        p.Female -= v.Female;
        p.Unknown -= v.Unknown;
      }
      return p;
    },
    function () {
      return {
        count: 0,
        CovidCases: 0,
        CovidDeaths: 0,
        CovidRecovered: 0,
        ConfirmedCases: 0,
        HospitalisedCases: 0,
        RequiringICUCases: 0,
        HealthcareWorkersCases: 0,
        HospitalisedAged5: 0,
        HospitalisedAged5to14: 0,
        HospitalisedAged15to24: 0,
        HospitalisedAged25to34: 0,
        HospitalisedAged35to44: 0,
        HospitalisedAged45to54: 0,
        HospitalisedAged55to64: 0,
        HospitalisedAged65up: 0,
        Aged5: 0,
        Aged5to14: 0,
        Aged15to24: 0,
        Aged25to34: 0,
        Aged35to44: 0,
        Aged45to54: 0,
        Aged55to64: 0,
        Aged65up: 0,
        Male: 0,
        Female: 0,
        Unknown: 0
      };
    }
  );

  let bogus_dimension = {};
  let fake_group = {
    all: function () {
      return [
        { key: 'Male', value: grp_maleSum.value() },
        { key: 'Female', value: grp_femaleSum.value() },
        { key: 'Unknown', value: grp_unknownSum.value() }
      ];
    }
  }

  let grp_ageCases = {
    all: function () {
      return [
        { key: "0-5",   value: allValues.value().Aged5 },
        { key: "5-14",  value: allValues.value().Aged5to14 },
        { key: "15-24", value: allValues.value().Aged15to24 },
        { key: "25-34", value: allValues.value().Aged25to34 },
        { key: "35-44", value: allValues.value().Aged35to44 },
        { key: "45-54", value: allValues.value().Aged45to54 },
        { key: "55-64", value: allValues.value().Aged55to64 },
        { key: "65+",   value: allValues.value().Aged65up }
      ];
    }
  }

  let grp_ageHospitalised = {
    all: function () {
      return [
        { key: "0-5",   value: allValues.value().HospitalisedAged5 },
        { key: "5-14",  value: allValues.value().HospitalisedAged5to14 },
        { key: "15-24", value: allValues.value().HospitalisedAged15to24 },
        { key: "25-34", value: allValues.value().HospitalisedAged25to34 },
        { key: "35-44", value: allValues.value().HospitalisedAged35to44 },
        { key: "45-54", value: allValues.value().HospitalisedAged45to54 },
        { key: "55-64", value: allValues.value().HospitalisedAged55to64 },
        { key: "65+",   value: allValues.value().HospitalisedAged65up }
      ];
    }
  }
  let ageArray = [
    allValues.value().Aged5 + allValues.value().HospitalisedAged5,
    allValues.value().Aged5to14 + allValues.value().HospitalisedAged5to14,
    allValues.value().Aged15to24 + allValues.value().HospitalisedAged15to24,
    allValues.value().Aged25to34 + allValues.value().HospitalisedAged25to34,
    allValues.value().Aged35to44 + allValues.value().HospitalisedAged35to44,
    allValues.value().Aged45to54 + allValues.value().HospitalisedAged45to54,
    allValues.value().Aged55to64 + allValues.value().HospitalisedAged55to64,
    allValues.value().Aged65up + allValues.value().HospitalisedAged65up
  ]
  
  stackBar_ageGroupCases
    .dimension(bogus_dimension)
    .group(grp_ageCases, "Non Hospitalised Cases")
    .stack(grp_ageHospitalised, "Hospitalised Cases")
    .width($(stackBar_ageGroupCases.anchor()).parent().width())
    .height(330)
    .renderLabel(true)
    .label(d => d.y1 + "("+d3.format(".0%")(d.y/d.y1) +")")
    .x(d3.scaleBand())
    .xUnits(dc.units.ordinal)
    .y(d3.scaleLinear().domain([0, d3.max(ageArray) * 1.1]))
    .legend(dc.legend().x(60).y(30).itemHeight(15).gap(5))
    .barPadding(0.2)
    .hidableStacks(true)
    .ordinalColors(['#4292c6','#07306b'])
    .xAxisLabel("Cases and Hospitalisations by Age Group");

    
    createnumber_(number_Cases, "CovidCases", ndx, dFormat)
    createnumber_(number_Deaths, "CovidDeaths", ndx, dFormat)
    createnumber_(number_Recovered, "CovidRecovered", ndx, dFormat)
    createnumber_(number_Hospital, "HospitalisedCases", ndx, dFormat)
    createnumber_(number_ICU, "RequiringICUCases", ndx, dFormat)
    createnumber_(number_HealthWorker, "HealthcareWorkersCases", ndx, dFormat)
    ordinalBarChart(bar_genders, bogus_dimension, fake_group)
    
    stackBar_ageGroupCases.margins().bottom = 65;
    bar_genders.margins().bottom = 50;
    bar_genders.filter = function () { };
    bar_genders.xAxisLabel("Cases by Gender");
    bar_genders.barPadding(0.2);

}

function cleanCountiesData(d) {
  d['NewCases'] = +d["NewCases"];
  d['3DayAvg'] = +d["3DayAvg"];
  d['7DayAvg'] = +d["7DayAvg"];
  d.County = d.County.toUpperCase();
  d.dd = dateFormat(d.Date.split(" ")[0]);
  d.unixTime = +unixTime(d.dd);
  d.formattedDate = formatTime(d.dd);
  return d;
}

function cleanCasesDeathsData(d) {
  d.ConfirmedCovidCases = +d.ConfirmedCovidCases;
  d.Cases3DayAvg = +d.Cases3DayAvg;
  d.Cases7DayAvg = +d.Cases7DayAvg;
  d.ConfirmedCovidDeaths = +d.ConfirmedCovidDeaths;
  d.Deaths3Day = +d.Deaths3Day;
  d.Deaths7Day = +d.Deaths7Day;
  d.ConfirmedCovidRecovered = +d.ConfirmedCovidRecovered;
  d.dd = dateFormat(d.Date.split(" ")[0]);
  d.unixTime = +unixTime(d.dd);
  d.formattedDate = formatTime(d.dd);
}

function cleanStatsData(d) {
  d.dd = dateFormat(d.Date.split(" ")[0]);
  d.unixTime = +unixTime(d.dd);
  d.formattedDate = formatTime(d.dd);
  d.Aged5 = +d.Aged5;
  d.Aged5to14 = +d.Aged5to14;
  d.Aged15to24 = +d.Aged15to24;
  d.Aged25to34 = +d.Aged25to34;
  d.Aged35to44 = +d.Aged35to44;
  d.Aged45to54 = +d.Aged45to54;
  d.Aged55to64 = +d.Aged55to64;
  d.Aged65up = +d.Aged65up;
  d.CloseContact = +d.CloseContact;
  d.CommunityTransmission = +d.CommunityTransmission;
  d.ConfirmedCases = +d.ConfirmedCases;
  d.Female = +d.Female;
  d.HealthcareWorkersCases = +d.HealthcareWorkersCases;
  d.HospitalisedAged5 = +d.HospitalisedAged5;
  d.HospitalisedAged5to14 = +d.HospitalisedAged5to14;
  d.HospitalisedAged15to24 = +d.HospitalisedAged15to24;
  d.HospitalisedAged25to34 = +d.HospitalisedAged25to34;
  d.HospitalisedAged35to44 = +d.HospitalisedAged35to44;
  d.HospitalisedAged45to54 = +d.HospitalisedAged45to54;
  d.HospitalisedAged55to64 = +d.HospitalisedAged55to64;
  d.HospitalisedAged65up = +d.HospitalisedAged65up;
  d.HospitalisedCases = +d.HospitalisedCases;
  d.Male = +d.Male;
  d.RequiringICUCases = +d.RequiringICUCases;
  d.TravelAbroad = +d.TravelAbroad;
  d.UnderInvestigation = +d.UnderInvestigation;
  d.Unknown = +d.Unknown;
  d.CovidCases = +d.CovidCases;
  d.CovidDeaths = +d.CovidDeaths;
  d.CovidRecovered = +d.CovidRecovered;
  return d;
}

// ===== chart functions
function ordinalBarChart(chart, dimension, group) {
  chart
    .dimension(dimension)
    .group(group)
    .width($(chart.anchor()).parent().width())
    .height(330)
    .x(d3.scaleBand())
    .xUnits(dc.units.ordinal)
    .gap(10)
    //TO-DO modify 17000, max by 1.1
    .y(d3.scaleLinear().domain([0, d3.max(group.all(), d => d.value) * 1.1]))
    .label(function (d) {
      return d.data.value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
    );
}

function createRowChart(chart, dimension, group) {
  chart
    .dimension(dimension)
    .group(group)
    .width($(chart.anchor()).parent().width() * 1.1)
    .height(340)
    .cap(12)
    .ordering(d => -d.value.total)
    .colors(colorRange)
    .colorDomain([0, d3.extent(group.all(), d => d.value.total)[1] / 8])
    .colorAccessor(function (d, i) { return d.value.total })
    .valueAccessor(function (d) {
      if (d.value.count == 0) {
        return 0;
      } else {
        return d.value.total;
      }
    })
    .title(function (d) {
      if (d.value.total > 0) return d.value.total.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    })
    .renderTitleLabel(true)
    .elasticX(true);
}

function createCompositeChart(chart, dimension, groups) {
  chart
    .width($(chart.anchor()).parent().width())
    .height(300)
    .legend(dc.legend().x(80).y(20).itemHeight(13).gap(5))
    .renderHorizontalGridLines(false)
    .x(d3.scaleLinear().domain(d3.extent(groups[0].all(), d => d.key)))
    .elasticY(true).brushOn(true)
    .compose([
      new dc.LineChart(chart)
        .dimension(dimension)
        .colors('black')
        .group(groups[0], "Cases per Day")
        .dashStyle([2, 2])
        .xyTipsOn(true),
      new dc.LineChart(chart)
        .dimension(dimension)
        .colors('blue')
        .group(groups[1], "3 Day Avg.")
        .dashStyle([4, 4]),
      new dc.LineChart(chart)
        .dimension(dimension)
        .colors('green')
        .group(groups[2], "7 Day Avg.")
        .dashStyle([6, 6])
    ]).on('postRender', function (thisChart) {
      addDatesToChart(thisChart)
    });
}

function show_number_filtered(ndx) {
  let group = ndx.groupAll();

  dc.dataCount('#cases-count')
    .crossfilter(ndx)
    .groupAll(group)
    .transitionDuration(500);
}

function createnumber_(chart, column, ndx, dFormat) {
  chart
    .formatNumber(dFormat)
    .group(ndx.groupAll().reduceSum(d => d[column]))
    .valueAccessor(d => d)
}


// ===== chart subfunctions
function addDatesToChart(chart) {
  let chartBody = chart.select('g').select('g');
  let offset = 0;
  if (chart == "BarChart") offset = 10;

  let covidDates = [
    //{date:1583971200000, label:"Delay Phase"},          // 12th March
    { date: 1585267200000, label: "Stay Home Phase" },    // 27th March
    { date: 1588291200000, label: "Ease Restrictions" },  // 01st May
    { date: 1589760000000, label: "Phase 01" }            // 18th May
  ]

  for (const covDate in covidDates) {

    let covidDate = covidDates[covDate].date;
    let covidLabel = covidDates[covDate].label;

    // add vertical line on chart
    chartBody.append('path')
      .attr('d', d3.line()([[chart.x()(covidDate), offset], [chart.x()(covidDate), chart.effectiveHeight() + offset]]))
      .attr('stroke', 'red')
      .attr("stroke-width", 1)
      .style("stroke-dasharray", ("10,3"))

    // add text to line
    chartBody.append('text')
      .attr('x', offset)
      .attr('y', -chart.x()(covidDate) - 5)
      .attr('transform', 'rotate(90)')
      .attr('class', 'small')
      .attr('stroke', 'none')
      .attr('fill', 'black')
      .text(covidLabel);
  }
}

function timeXAxis(chart) {
  chart.xAxis().tickValues([1584921600000, 1585267200000, 1585526400000, 1586131200000, 1586736000000, 1587340800000, 1587945600000]);
  chart.xAxis().tickFormat(function (v) {
    let date = new Date(v);
    return date.toDateString().split(" 2020").join(" ").trim();
  })
}

function timeXAxis(chart, times) {
  chart.xAxis().tickValues(times);
  chart.xAxis().tickFormat(function (v) {
    let date = new Date(v);
    return date.toDateString().split(" 2020").join(" ").trim();
  })
}

// ====== general functions
let roundDown = function (num, precision) {
  num = parseFloat(num);
  if (!precision) return num.toLocaleString();
  return (Math.floor(num / precision) * precision).toLocaleString();
};

function getDaysFromUnixTime(data, day) {
  let mondays = [];
  for (let i in data) {
    if (dayFormat(data[i].dd) == day) {
      mondays.push(data[i].unixTime)
    }
  }
  return [...new Set(mondays)];;
}

function toggleSeriesLine(chartId, lineId) {
  document.querySelectorAll("#" + chartId + " .sub .stack path").forEach(d => d.classList.add("fadeout"))
  document.querySelector("#" + chartId + " .sub._" + lineId + " .stack path").classList.remove("fadeout")
}

function setDateOnPhaseChart(){
  let svgWidth = document.getElementById("phase-chart").getBoundingClientRect().width;
  let now = new Date();

  // commented out to change to date to be fixed to 25/7/20
  // let today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let today = new Date(2020,06,25);
  let start = new Date(2020,01,27);

  let days = Math.floor((today - start)/24/60/60/1000);
  let translation = (days/186)*svgWidth;
  document.getElementById("phase-location").style.transitionDuration = "3s";;
  document.getElementById("phase-location").setAttribute("transform", "translate("+translation+", 120)");
}

function removingLoading(){
  document.querySelector(".loading-cover").remove();
  document.querySelector(".loading").classList.remove("loading");
}


function oldcharts() {
  let barChart03 = dc.barChart('#chart03');
  let barChart04 = dc.barChart('#chart04');
  let barChart05 = dc.barChart('#chart05');

  barChart03
    .dimension(dataDimension)
    .group(dateNewCasesGroup)
    .width($(barChart03.anchor()).parent().width())
    .height(300)
    .x(d3.scaleBand())
    .xUnits(dc.units.ordinal)
    .brushOn(true)
    .elasticY(true)
    .on('postRender', function (chart) {
      addDatesToChart(chart)
    });
  barChart03.xAxis().tickValues([1584921600000, 1585526400000, 1586131200000, 1586736000000, 1587340800000, 1587945600000]);
  barChart03.xAxis().tickFormat(function (v) {
    let date = new Date(v);
    return date.toDateString().split(" 2020").join(" ").trim();
  })


  barChart04
    .dimension(dataDimension1)
    .group(date3DayCasesGroup)
    .width($(barChart04.anchor()).parent().width())
    .height(300)
    .x(d3.scaleBand())
    .xUnits(dc.units.ordinal)
    .brushOn(true)
    .elasticY(true)
    .on('postRender', function (chart) {
      addDatesToChart(chart)
    });

  barChart05
    .dimension(dataDimension2)
    .group(date7DayCasesGroup)
    .width($(barChart05.anchor()).parent().width())
    .height(300)
    .x(d3.scaleBand())
    .xUnits(dc.units.ordinal)
    .brushOn(true)
    .elasticY(true)
    .on('postRender', function (chart) {
      addDatesToChart(chart)
    });

  barChart03.margins().left = 50;
  barChart04.margins().left = 50;
  barChart05.margins().left = 50;
  timeXAxis(barChart03)
  timeXAxis(barChart04)
  timeXAxis(barChart05)
}
