app.directive('cartogramDirectiveAnalyst', function ($parse) { // inspired from http://prag.ma/code/d3-cartogram/#popest/2010

	return{
        restrict: 'EA',
		replace: false,
		link: function (scope, element, attrs) {
           
           var mapcont = d3.select(element[0]);
		   
		    var exp = $parse(attrs.mapData);
			var datax = exp(scope);
			
			var exp2 = $parse(attrs.inTerms);
			var inTermsOf = exp2(scope);
            
            var exp3 = $parse(attrs.flaggedTransactions);
			var flaggedTransactions = exp3(scope);
		   
		    var exp4 = $parse(attrs.transactionCountries);
			var transactionCountries = exp4(scope);
           
		   // listens for WINDOW RESIZE
			scope.$watch(function(){
			//	resize();
			})
			
			// $watchCollection executes on data change 			
			scope.$watchCollection(exp, function(newVal, oldVal){	
				datax=newVal;
                
                console.log(datax)
			});
			scope.$watchCollection(exp2, function(newVal, oldVal){	
				inTermsOf=newVal;
				console.log(inTermsOf);
			   
				// makes sure the "inTermsOf" variable gets here
		//		setTimeout(function(){update();},100);    // contiguous carto
				setTimeout(function(){updateColours();},100);    // choropleth
			});
		   
           scope.$watchCollection(exp3, function(newVal, oldVal){	
				flaggedTransactions=newVal;
                
            //    console.log(flaggedTransactions);
                //ADD ARC --- WORKS !!!!
 /*               setTimeout(function(){
                    arcs.append("path").attr("class", "arc").attr('d', linkArc("DE","RO"))
                },2000)
 */
                ////////////////////
			});
            scope.$watchCollection(exp4, function(newVal, oldVal){	
				transactionCountries=newVal;
                
                colourCountries(transactionCountries, "#F1C40F")
			});
		   
		   // get container size
			var margin = { top: -10, right: 10, bottom: -10, left: 10 }
			, width = parseInt(element[0].clientWidth) - margin.left - margin.right
			, height = parseInt(element[0].clientHeight) - margin.top - margin.bottom;

			var color = d3.scale.category10();
			
			

			// append svg to map container
			var svg = mapcont.append("svg").attr("id","map")
				.attr("width", width)
				.attr("height", height);
                
            		
			// adds zoom behaviour
			var map = d3.select("#map")
              .call(d3.behavior.zoom()
				.on("zoom", redraw))
				.append("g").attr("id","ct");
            
            setTimeout(function () {
                //addTransactionOnMap("RO");
                //arcs.append("path").attr("class", "arc").attr('d', linkArc("DE","RO"))
                
                colourCountry('RO',"#F1C40F");
            },2000)
            
            
			// redraws map on zoom and move
			function redraw() {
				map.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
			}

				
			// resizes the svg 
			function resize() {
				var margin = { top: -10, right: 10, bottom: -10, left: 10 }
				, width = parseInt(element[0].clientWidth) - margin.left - margin.right
				, height = parseInt(element[0].clientHeight) - margin.top - margin.bottom;
			
				svg.attr("width", width)
				   .attr("height", height);
			}	
				
			var countries = map.append("g")
				.attr("id", "countries")
				.selectAll("path");
                
           
			var proj = d3.geo.mercator()
				.scale(100)
				.translate([500, 300]);

			var topology,
				geometries,
				carto_features;
				
			var carto = d3.cartogram()
				.projection(proj)
	            .properties(function (d) {
					// this add the "properties" properties to the geometries
//	                console.log(d);
	                return d.properties;
	            });
            
            var transactions = map.append("g").attr("id","dots");
            var arcs = map.append("g").attr("id","arcs");
            
			 // this loads the topojson file using d3.json and creates the world map.
			d3.json("data/worldcountriestopo.json", function (data) {
				topology = data;
				geometries = topology.objects.countries.geometries;

				//these 2 below create the map and are based on the topojson implementation
				var features = carto.features(topology, geometries),
					path = d3.geo.path()
						.projection(proj);

				countries = countries.data(features)
					.enter()
						.append("path")
						.attr("class", "country")
						.style("fill", function (e) {
							return "#EAEAEA";//"#4D97B1"
						})
					.attr("d", path)
                    // no ON CLICK event for now
					.on("click", function (d,i){ 
									// recolours all countries to default
									countries.style("opacity","1"); 
									// colours the selected country
									d3.select(this).style("opacity","0.8"); 
                                    
                                    // remove previous country label
                                    d3.select("#lbl").remove();
                                    // add country name to map to signify selection
                                    var centroid = path.centroid(d),
                                        x = centroid[0],
                                        y = centroid[1];
                                    map.append("g").attr("id", "lbl").append("text")
                                        .text(function(){return d.id})
                                        .attr("x", x)
                                        .attr("y", y);
                                    
									// sends event to controller
									return scope.onCountryClick(d.id); 
								});
                               
              
				// displays country name on hover
				countries.append("title").text(function(d){return d.id;});
				
			});
            
/*            
            d3.select("#map").on("click", function (){
                // recolours all countries to default
                countries.style("opacity","1");
                
                // remove previous country label
                d3.select("#lbl").remove();
            })
*/            
            function addTransactionOnMap(country){
                
                var latLng = datax.get(country).latlng;
                
                
                var city = transactions.append("g")
     //                   .attr("class", "city")
                        .attr("transform", function() { return "translate(" + proj([latLng[1], latLng[0]]) + ")"; });

                    city.append("circle")
                        .attr("r", 2)
                        .style("fill", "lime")
                        .style("opacity", 0.75);

                    city.append("text")
                        .attr("x", 5)
                        .text(function() { return "trans" });
                
            }
            
            function lngLatToArc(countryA, countryB, bend){
                // If no bend is supplied, then do the plain square root
                bend = bend || 1;
                // `d[sourceName]` and `d[targetname]` are arrays of `[lng, lat]`
                // Note, people often put these in lat then lng, but mathematically we want x then y which is `lng,lat`
                
                var latLngA = datax.get(countryA).latlng.reverse();
                var latLngB = datax.get(countryB).latlng.reverse();        
                
                if (latLngB && latLngA) {
                    var sourceXY = proj( latLngA ),
                            targetXY = proj( latLngB );
                    // Uncomment this for testing, useful to see if you have any null lng/lat values
                    // if (!targetXY) console.log(d, targetLngLat, targetXY)
                    var sourceX = sourceXY[0],
                            sourceY = sourceXY[1];
                    var targetX = targetXY[0],
                            targetY = targetXY[1];
                    var dx = targetX - sourceX,
                            dy = targetY - sourceY,
                            dr = Math.sqrt(dx * dx + dy * dy)*bend;
                    // To avoid a whirlpool effect, make the bend direction consistent regardless of whether the source is east or west of the target
                    var west_of_source = (targetX - sourceX) < 0;
                    if (west_of_source) return "M" + targetX + "," + targetY + "A" + dr + "," + dr + " 0 0,1 " + sourceX + "," + sourceY;
                    return "M" + sourceX + "," + sourceY + "A" + dr + "," + dr + " 0 0,1 " + targetX + "," + targetY;
                    
                } else {
                    return "M0,0,l0,0z";
                }
            }
            
                    
            function linkArc(countryA, countryB) { // adapted from http://bl.ocks.org/mbostock/1153292
                var latLngA = datax.get(countryA).latlng.reverse();
                var latLngB = datax.get(countryB).latlng.reverse();   
                
                var sourceXY = proj( latLngA ),
                    targetXY = proj( latLngB );
                var sourceX = sourceXY[0],
                    sourceY = sourceXY[1];
                var targetX = targetXY[0],
                    targetY = targetXY[1];
                
                var dx = targetX - sourceX,
                    dy = targetY - sourceY,
                    dr = Math.sqrt(dx * dx + dy * dy);
                
                console.log("ran!!!")
                
                return "M" + sourceX + "," + sourceY + "A" + dr + "," + dr + " 0 0,1 " + targetX + "," + targetY;
            }
            
            function colourCountry(country, colour){
                countries.style("fill", function (d,i) {
                            if (d.id == country)
                                return colour;
                            else
							    return "#EAEAEA";//"#4D97B1"
                });
            }
            
            function colourCountries(countryArr, colour){
                
                function found (id){
                    var found = false;
                    
                    for (var i = 0; i<countryArr.length; i++)
                        if(countryArr[i] == id)
                            found = true;
                    
                    return found                   
                }
                
                countries.style("fill", function (d,i) {
                            if (found(d.id))
                                return colour;
                            else
							    return "#EAEAEA";//"#4D97B1"
                });
            }

           
			            
            function updateColours(){ // choropleth based on country financial data
              
                var maxT = [0,1];
                    maxF = [];
                    maxA = [];
                    maxV = [];
                
                function getMax (arr) {
                    var max = 0;
                    
                    for (var i = 0; i < arr.length; i++){
                        if (max < arr[i])
                            max = arr[i];
                    }
                    
                    return max;
                }
                
                function getMean (arr) {
                    var sum = 0;
                    
                    for (var i = 0; i < arr.length; i++){
                        sum += arr[i];
                    }
                    
                    return sum/arr.length;
                }
                    
 //               console.log(datax._)
                
                // computes overall maxima
                datax.forEach(function(e){
                    maxF.push(getMean(datax.get(e).financial.flagged));
                    maxA.push(getMean(datax.get(e).financial.amount));
                    maxV.push(getMean(datax.get(e).financial.volume));
                })
                                
                setTimeout(function(){
                countries.style("fill", function (d) {
                    //console.log(e.id);
                    
                    switch(inTermsOf) {
            
                        case "transactions" :   var val = getMax(maxA);
                                                var colourScale = d3.scale.linear()
                                                                    .domain([0, val])
                                                                    .range(["#B2DFEE", "#00688B"]);
                                                                    
                        
                                                var colour = datax.get(d.id)? colourScale(getMax(datax.get(d.id).financial.amount)):"#B2DFEE";
                                                
                                                // change colour attribute of the country
                                                if (datax.get(d.id))
                                                    datax.get(d.id).colour = colour;
                                                
                                                console.log(colour)
                                                
                                                // change legend info and colour
                                                d3.select("#legend").remove();
                                                //legend --- adapted from http://bl.ocks.org/KoGor/5685876
                                                var ls_w = 20, ls_h = 20;
                                                var legendLabels = [0,(val/2).toFixed(2),val.toFixed(2)];
                                                var legend = svg.append("svg").attr("id","legend").selectAll("rect").data(legendLabels)
                                                        .enter();
                                                var legendRect = legend.append("rect")
                                                    .attr("x", 20)
                                                    .attr("y", function(d, i){ return height - (i*ls_h) - 2*ls_h;})
                                                    .attr("width", ls_w)
                                                    .attr("height", ls_h)
                                                    .style("fill", function(d, i) { return colourScale(d); })
                                                    .style("opacity", 0.8);
                                                
                                                var legendText = legend.append("text")
                                                    .attr("x", 50)
                                                    .attr("y", function(d, i){ return height - (i*ls_h) - ls_h - 4;})
                                                    .text(function(d, i){ return legendLabels[i]; });
                                                ////////////////////////////////////////////////
                                                //legend.style("fill", function(d, i) { return legendColourScale(i); })
                                                
                                                
                                                /*
                                                arcs.append("path")
                                                    .attr("class", "arc")
                                                    .attr('d', function() { 
                                                        return lngLatToArc("DE", "RO", -2); // A bend of 5 looks nice and subtle, but this will depend on the length of your arcs and the visual look your visualization requires. Higher number equals less bend.
                                                    });
                                                */   
                                                    
                                                
                                                return colour;
                                                
                                                break;
                                                
                        case "flagged":			var val = getMax(maxF);
                                                var colourScale = d3.scale.linear()
                                                                    .domain([0, val])
                                                                    .range(["#FFE4E1", "#AF4035"]);//F68275//C65D57
                        
                                                var colour = datax.get(d.id)? colourScale(getMax(datax.get(d.id).financial.flagged)):"#FFE4E1";
                                                
                                                // change colour attribute of the country
                                                if (datax.get(d.id))
                                                    datax.get(d.id).colour = colour;
                                                
                                                console.log(colour)
                                                
                                                // change legend info and colour
                                                d3.select("#legend").remove();
                                                //legend --- adapted from http://bl.ocks.org/KoGor/5685876
                                                var ls_w = 20, ls_h = 20;
                                                var legendLabels = [0,(val/2).toFixed(2),val.toFixed(2)];
                                                var legend = svg.append("svg").attr("id","legend").selectAll("rect").data(legendLabels)
                                                        .enter();
                                                var legendRect = legend.append("rect")
                                                    .attr("x", 20)
                                                    .attr("y", function(d, i){ return height - (i*ls_h) - 2*ls_h;})
                                                    .attr("width", ls_w)
                                                    .attr("height", ls_h)
                                                    .style("fill", function(d, i) { return colourScale(d); })
                                                    .style("opacity", 0.8);
                                                
                                                var legendText = legend.append("text")
                                                    .attr("x", 50)
                                                    .attr("y", function(d, i){ return height - (i*ls_h) - ls_h - 4;})
                                                    .text(function(d, i){ return legendLabels[i]; });
                                                ////////////////////////////////////////////////
                                                //addTransactionOnMap("RO")
                                                return colour;
                                                
                                                break;
                                                
                        case "amount":			var val = getMax(maxA);
                                                var colourScale = d3.scale.linear()
                                                                    .domain([0, val])
                                                                    .range(["#C0D9D9", "#388E8E"]);
                        
                                                var colour = datax.get(d.id)? colourScale(getMax(datax.get(d.id).financial.amount)):"#C0D9D9";
                                                
                                                // change colour attribute of the country
                                                if (datax.get(d.id))
                                                    datax.get(d.id).colour = colour;
                                                
                                                // change legend info and colour
                                                d3.select("#legend").remove();
                                                //legend --- adapted from http://bl.ocks.org/KoGor/5685876
                                                var ls_w = 20, ls_h = 20;
                                                var legendLabels = [0,(val/2).toFixed(2),val.toFixed(2)];
                                                var legend = svg.append("svg").attr("id","legend").selectAll("rect").data(legendLabels)
                                                        .enter();
                                                var legendRect = legend.append("rect")
                                                    .attr("x", 20)
                                                    .attr("y", function(d, i){ return height - (i*ls_h) - 2*ls_h;})
                                                    .attr("width", ls_w)
                                                    .attr("height", ls_h)
                                                    .style("fill", function(d, i) { return colourScale(d); })
                                                    .style("opacity", 0.8);
                                                
                                                var legendText = legend.append("text")
                                                    .attr("x", 50)
                                                    .attr("y", function(d, i){ return height - (i*ls_h) - ls_h - 4;})
                                                    .text(function(d, i){ return legendLabels[i]; });
                                                ////////////////////////////////////////////////
                                                
                                                return colour;
                                                
                                                break;
                                                
                        case "volume":			var val = getMax(maxV);
                                                var colourScale = d3.scale.linear()
                                                                    .domain([0, val])
                                                                    .range(["#EAEAEA", "#444C57"]);
                        
                                                var colour = datax.get(d.id)? colourScale(getMax(datax.get(d.id).financial.volume)):"#EAEAEA";
                                                
                                                // change colour attribute of the country
                                                if (datax.get(d.id))    
                                                    datax.get(d.id).colour = colour;
                                                
                                                
                                                // change legend info and colour
                                                d3.select("#legend").remove();
                                                //legend --- adapted from http://bl.ocks.org/KoGor/5685876
                                                var ls_w = 20, ls_h = 20;
                                                var legendLabels = [0,(val/2).toFixed(2),val.toFixed(2)];
                                                var legend = svg.append("svg").attr("id","legend").selectAll("rect").data(legendLabels)
                                                        .enter();
                                                var legendRect = legend.append("rect")
                                                    .attr("x", 20)
                                                    .attr("y", function(d, i){ return height - (i*ls_h) - 2*ls_h;})
                                                    .attr("width", ls_w)
                                                    .attr("height", ls_h)
                                                    .style("fill", function(d, i) { return colourScale(d); })
                                                    .style("opacity", 0.8);
                                                
                                                var legendText = legend.append("text")
                                                    .attr("x", 50)
                                                    .attr("y", function(d, i){ return height - (i*ls_h) - ls_h - 4;})
                                                    .text(function(d, i){ return legendLabels[i]; });
                                                ////////////////////////////////////////////////
                                                
                                                return colour;
                                                
                                                break;
                                                
                        default:				var colour = "#EAEAEA"//"#4D97B1"//datax.get(d.id)? datax.get(d.id).area:1;
                                                
                                                // change colour attribute of the country
                                                if (datax.get(d.id))
                                                    datax.get(d.id).colour = colour;
                                                
                                                // remove legend info and colour
                                                d3.select("#legend").remove();
                                                
                                                // recolours all countries to default
                                                countries.style("opacity","1");
                                                
                                                // remove previous country label
                                                d3.select("#lbl").remove();
                                                
                                                return colour;
                                                                                                
                                                break;
                    }
                });
                },200)        
                
                
                
            }
				     
		}  
    };
});