var width = 700;
var height = 500;
var lowColor = '#f0f8ff';
var highColor = '#000068';
var svg = d3.select("#map");
svg.attr("viewBox", `0 0 ${width} ${height}`)
   .attr("preserveAspectRatio", "xMidYMid meet");
var projection = d3.geoAlbersUsa().translate([width / 1.99, height / 1.9])
  .scale([960]);


var path = d3.geoPath().projection(projection);
var tooltip = d3.select("#tooltip");
let currentYear;
let selectedBins = new Set();
let hoveredBin = null;
let selectedStateNames = new Set();
let legendHovered = false;
let stateColorMap = {}; // GLOBAL



window.onload = function () {
  document.getElementById("welcome-modal").style.display = "block";
};

document.getElementById("start-tour-btn").addEventListener("click", function () {
  document.getElementById("welcome-modal").style.display = "none";
  
  setTimeout(() => {
    introJs().start();
  }, 200);
});

d3.csv("climate_worried_by_state.csv", function(dataRaw) {
  var years = d3.keys(dataRaw[0]).filter(k => k !== "state");
  var dataByYear = {};
  years.forEach(year => {
    dataByYear[year] = {};
    dataRaw.forEach(row => {
      dataByYear[year][row.state] = +row[year];
    });
  });
  currentYear = years[0];
  var ramp = d3.scaleLinear().domain([35, 80]).range([lowColor, highColor]);
  d3.json("us-states.json", function(json) {
    var mapGroup = svg.append("g");


    function getFillColor(d) {
      const val = d.properties.value;
      const name = d.properties.name;
    
      const matchesSelected = selectedBins.size > 0 && Array.from(selectedBins).some(start => val >= start && val < start + 5);
      const matchesHover = hoveredBin !== null && val >= hoveredBin && val < hoveredBin + 5;
    
      if (selectedStateNames.has(name) && stateColorMap[name]) {
        return stateColorMap[name];
      }
    
      if (selectedBins.size > 0) return matchesSelected ? ramp(val) : "#ffffff";
      if (hoveredBin !== null) return matchesHover ? ramp(val) : "#ffffff";
    
      return ramp(val);
    }
    
    function refreshMapAndColors() {
      mapGroup.selectAll("path")
        .style("fill", d => getFillColor(d))
        .style("stroke", d => selectedStateNames.has(d.properties.name) ? "#FFFFC5" : "#fff")
        .style("stroke-width", d => selectedStateNames.has(d.properties.name) ? 2.5 : 1)
        .style("filter", d => selectedStateNames.has(d.properties.name) ? "url(#selected-glow)" : null)
        .each(function(d) {
          if (selectedStateNames.has(d.properties.name)) {
            d3.select(this).raise();  // <-- ensure glow renders above neighbors
          }
        });
    }
    
    function updateMap(year) {
      json.features.forEach(d => {
        d.properties.value = dataByYear[year][d.properties.name];
      });

      const states = mapGroup.selectAll("path").data(json.features);
      states.enter()
        .append("path")
        .merge(states)
        .attr("d", path)
        .style("cursor", d => {
          const val = d.properties.value;
          const inSelected = selectedBins.size > 0 && Array.from(selectedBins).some(start => val >= start && val < start + 5);
          const inHovered = hoveredBin !== null && val >= hoveredBin && val < hoveredBin + 5;
        
          // Only show pointer cursor if state is visible (i.e., clickable)
          if ((selectedBins.size > 0 && !inSelected) || (hoveredBin !== null && selectedBins.size === 0 && !inHovered)) {
            return "default";
          } else {
            return "pointer";
          }
        })
        .style("stroke", "#fff")
        .style("stroke-width", "1")
        .style("fill", d => {
          const val = d.properties.value;

          const matchesSelected = selectedBins.size > 0 && Array.from(selectedBins).some(start => val >= start && val < start + 5);
          const matchesHover = hoveredBin !== null && val >= hoveredBin && val < hoveredBin + 5;


          if (selectedStateNames.has(d.properties.name) && stateColorMap[d.properties.name]) {
            return stateColorMap[d.properties.name];
          }

          if (selectedBins.size > 0) return matchesSelected ? ramp(val) : "#ffffff";
          if (hoveredBin !== null) return matchesHover ? ramp(val) : "#ffffff";
          return ramp(val);
        })
        .on("mouseover", function(d) {
          const val = d.properties.value;
          const inSelected = selectedBins.size > 0 && Array.from(selectedBins).some(start => val >= start && val < start + 5);
          const inHovered = hoveredBin !== null && val >= hoveredBin && val < hoveredBin + 5;
        
          if (selectedBins.size > 0 && !inSelected) return;
          if (hoveredBin !== null && selectedBins.size === 0 && !inHovered) return;
        
          if (!selectedStateNames.has(d.properties.name)) {
            d3.select(this)
              .raise()
              .style("stroke", "#FFFFC5")
              .style("stroke-width", 2)
              .style("filter", "url(#hover-glow)");
          }
        
          const nationalAvg = d3.mean(Object.values(dataByYear[currentYear]));
          const diff = val - nationalAvg;
          const formattedDiff = (diff >= 0 ? "+" : "") + diff.toFixed(1);
          tooltip
            .style("visibility", "visible")
            .style("color", "black") // force black text
            .html(`${d.properties.name}: ${val.toFixed(1)}%<br>(${formattedDiff}% from National Avg)`);

        })
        
        .on("mousemove", function() {
          tooltip.style("top", (d3.event.pageY - 10) + "px").style("left", (d3.event.pageX + 10) + "px");
        })

        .on("mouseout", function(d) {
          tooltip.style("visibility", "hidden");
          
          if (selectedStateNames.has(d.properties.name)) return;
        
          d3.select(this)
            .style("stroke", "#fff")
            .style("stroke-width", 1)
            .style("filter", null);
        
          // Restore z-index of all selected states after any mouseout
          mapGroup.selectAll("path")
            .each(function(d) {
              if (selectedStateNames.has(d.properties.name)) {
                d3.select(this).raise();
              }
            });
        })
        .on("click", function(d) {
          const val = d.properties.value;
          const inSelected = selectedBins.size > 0 && Array.from(selectedBins).some(start => val >= start && val < start + 5);
          const inHovered = hoveredBin !== null && val >= hoveredBin && val < hoveredBin + 5;
        
          // Prevent clicking if state is not visible under filtering
          if ((selectedBins.size > 0 && !inSelected) || (hoveredBin !== null && selectedBins.size === 0 && !inHovered)) return;
        
          if (playing) {
            // Show warning popup
            const popup = d3.select("#popup-warning");
            popup.html("Please pause the visualization to select a state.");
            popup.style("display", "block");
            setTimeout(() => popup.style("display", "none"), 2500); // auto-hide after 2.5s
            return;
          }
        
          const clickedState = d.properties.name;
          if (selectedStateNames.has(clickedState)) {
            selectedStateNames.delete(clickedState);
          } else {
            if (selectedStateNames.size >= 5) {
              const popup = d3.select("#popup-warning");
              popup.html("You can only compare up to 5 states for clarity.");
              popup.style("display", "block");
              setTimeout(() => popup.style("display", "none"), 2500);
              return;
            }
            selectedStateNames.add(clickedState);
          }

          if (selectedStateNames.size === 0) {
            drawNationalAverage();
          } else {
            drawLineChart(Array.from(selectedStateNames));
          }
          updateMap(currentYear);
          d3.select(this)
            .style("filter", "url(#selected-glow)")
            .style("stroke", "#FFFFC5")
            .style("stroke-width", 2.5)
            .raise(); // ← THIS MUST HAPPEN RIGHT AFTER .style(
          refreshMapAndColors();
        });        
      // states.exit().remove();
    }

    updateMap(currentYear);
    drawNationalAverage();

    var slider = d3.select("#year-slider")
      .attr("min", 0)
      .attr("max", years.length - 1)
      .attr("value", 0)
      .on("input", function() {
        clearSelectedState();
        var year = years[this.value];
        currentYear = year;
        updateMap(year);
        d3.select("#year-label").text(`Year: ${year}`);
      });

    d3.select("#year-label").text(`Year: ${currentYear}`);
    var playing = false;
    var interval;
    d3.select("#play-button").on("click", function() {
      clearSelectedState();
      if (playing) {
        clearInterval(interval);
        d3.select(this).text("▶ Play");
      } else {
        let i = +slider.property("value");
        interval = setInterval(() => {
          i = (i + 1) % years.length;
          slider.property("value", i).dispatch("input");
          if (i === years.length - 1) {
            clearInterval(interval);
            d3.select("#play-button").text("▶ Play");
            playing = false;
          }
        }, 1000);
        d3.select(this).text("⏸ Pause");
      }
      playing = !playing;
    });

    // Vertical Legend scaled to match map height
    const legendBins = d3.range(35, 75, 5).reverse();
    const legendHeight = 400; // Match map height
    const binHeight = legendHeight / legendBins.length;

    const legendSvg = d3.select("#legend-svg-wrapper")
      .append("svg")
      .attr("width", 90)
      .attr("height", 390); // Adjust if needed

const legendGroup = legendSvg.append("g")
  .attr("transform", `translate(-15, 30)`);

    legendBins.forEach((start, i) => {
      const end = start + 5;
      const yPos = i * binHeight;

      legendGroup.append("rect")
        .attr("x", 20)
        .attr("y", yPos)
        .attr("width", 30)
        .attr("height", binHeight)
        .attr("fill", ramp((start + end) / 2))
        .attr("stroke", "black")
        .attr("class", "legend-bin")
        .attr("data-bin", start)
        .on("mouseover", function() {
          hoveredBin = start;
          d3.select(this).attr("stroke-width", 3);
          refreshMapAndColors();  // handles everything visually
        })
        
        .on("mouseout", function() {
          hoveredBin = null;
          d3.select(this).attr("stroke-width", selectedBins.has(+d3.select(this).attr("data-bin")) ? 3 : 1);
          refreshMapAndColors();  // again, this handles it cleanly
        })
        .on("click", function() {
          const thisBin = +d3.select(this).attr("data-bin");
        
          // Toggle bin
          if (selectedBins.has(thisBin)) {
            selectedBins.delete(thisBin);
            d3.select(this).classed("active", false);
          } else {
            selectedBins.add(thisBin);
            d3.select(this).classed("active", true);
          }
        
          // Prune selected states that don't match any selected bin
          selectedStateNames = new Set(
            Array.from(selectedStateNames).filter(state => {
              const val = dataByYear[currentYear][state];
              return Array.from(selectedBins).some(bin => val >= bin && val < bin + 5);
            })
          );
        
          if (selectedStateNames.size > 0) {
            drawLineChart(Array.from(selectedStateNames));
          } else {
            drawNationalAverage();
          }
        
          updateMap(currentYear);
          refreshMapAndColors();
          updateClearFiltersButtonState();
        });
      legendGroup.append("text")
        .attr("x", 55)
        .attr("y", yPos - 3) // shift closer to the top edge of each bin
        .text(`${end}%`)     // show only the top value
        .style("font-size", "13px")
        .style("alignment-baseline", "hanging");
    });

    // Add Clear Filters button
    d3.select("#legend-container")
      .append("button")
      .attr("id", "clear-filters-button")
      .attr("disabled", true)
      .style("cursor", "not-allowed")
      .style("padding", "5px 10px")
      .style("font-size", "12px")
      .text("Clear All Filters")
      .on("click", () => {
        selectedBins.clear();
        d3.selectAll(".legend-bin").classed("active", false);
        const sliderValue = +d3.select("#year-slider").property("value");
        currentYear = years[sliderValue];
        updateMap(currentYear);
        refreshMapAndColors();
        d3.select("#year-label").text(`Year: ${currentYear}`);
        d3.select("#clear-filters-button")
          .attr("disabled", true)
          .style("cursor", "not-allowed");
      refreshMapAndColors();

      });

      function drawLineChart(stateNames) {
        stateColorMap = {};
        const years = Object.keys(dataByYear);
        const nationalAverage = getNationalAverageData();
        const natValueByYear = {};
        nationalAverage.forEach(d => { natValueByYear[d.year] = d.value; });
      
        d3.select("#line-chart-container").html(""); // Clear
      
        const margin = { top: 60, right: 30, bottom: 68, left: 80 };
        const width = 575 - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;
      
        const svgLine = d3.select("#line-chart-container")
          .append("svg")
          .attr("width", width + margin.left + margin.right)
          .attr("height", height + margin.top + margin.bottom)
          .append("g")
          .attr("transform", `translate(${margin.left},${margin.top})`);
      
        const x = d3.scaleLinear()
          .domain(d3.extent(years, y => +y))
          .range([0, width]);
      
        const y = d3.scaleLinear().domain([0, 100]).range([height, 0]);
      
        const line = d3.line().x(d => x(d.year)).y(d => y(d.value));
        svgLine.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")))
        .selectAll("text")
        .style("font-size", "12px");

        svgLine.append("g")
      .call(d3.axisLeft(y))
      .selectAll("text")
      .style("font-size", "12px");  
            
        // National average line
        svgLine.append("path")
          .datum(nationalAverage)
          .attr("class", "nat-line")
          .attr("fill", "none")
          .attr("stroke", "#2f2585")
          .attr("stroke-width", 2)
          .attr("d", line);
      
        svgLine.selectAll(".dot-nat")
          .data(nationalAverage)
          .enter()
          .append("circle")
          .attr("class", "dot-nat")
          .attr("cx", d => x(d.year))
          .attr("cy", d => y(d.value))
          .attr("r", 4)
          .attr("fill", "#2f2585")
          .on("mouseover", function(d) {
            d3.select(this).attr("r", 7);
            tooltip
              .style("visibility", "visible")
              .style("color", "#2f2585")
              .text(`National Avg (${d.year}): ${d.value.toFixed(1)}%`);
          
            // Dim only state lines and state dots
            svgLine.selectAll(".state-line, .dot").style("opacity", 0.2);

            // KEEP ALL national dots visible
            svgLine.selectAll(".dot-nat").style("opacity", 1);

          
            svgLine.select(".nat-line")
              .style("opacity", 1)
              .attr("stroke-width", 4); // thicken the line
            d3.select(this).style("opacity", 1);
          })
          .on("mousemove", function() {
            tooltip.style("top", (d3.event.pageY - 10) + "px")
                   .style("left", (d3.event.pageX + 10) + "px");
          })
          .on("mouseout", function() {
            d3.select(this).attr("r", 4); // reset dot radius
            tooltip.style("visibility", "hidden");
          
            svgLine.selectAll(".state-line, .nat-line")
              .style("opacity", 1)
              .attr("stroke-width", 2);
          
            svgLine.selectAll(".dot, .dot-nat")
              .style("opacity", 1);
          });
          
          
        // Now handle each selected state
        stateNames.forEach((stateName, index) => {
          const customColors = ["#9e4a96", "#5ea799", "#4377a9", "#c26a78", "#94caec"];
          stateColorMap[stateName] = customColors[index % customColors.length];
          const stateValues = years.map(y => ({
            year: +y,
            value: dataByYear[y][stateName]
          }));
      
          const adjustedStateValues = stateValues.map(d => {
            const natVal = natValueByYear[d.year];
            const isOverlap = Math.abs(d.value - natVal) < 0.4;
            const pixelOffset = isOverlap ? (d.value > natVal ? -5 : 5) : 0;
            return { ...d, yOffset: pixelOffset };
          });
      
          svgLine.append("path")
            .datum(adjustedStateValues)
            .attr("class", `state-line line-${stateName.replace(/\s+/g, '-')}`)
            .attr("fill", "none")
            .attr("stroke", stateColorMap[stateName])
            .attr("stroke-width", 2)
            .attr("d", d3.line()
              .x(d => x(d.year))
              .y(d => y(d.value) + d.yOffset)
            );
      
          svgLine.selectAll(`.dot-${stateName.replace(/\s+/g, '-')}`)
            .data(adjustedStateValues)
            .enter()
            .append("circle")
            .attr("class", `dot dot-${stateName.replace(/\s+/g, '-')}`) // ADD THIS
            .attr("cx", d => x(d.year))
            .attr("cy", d => y(d.value) + d.yOffset)
            .attr("r", 4)
            .attr("fill", stateColorMap[stateName])
            .style("cursor", "pointer")
            .on("mouseover", function(d) {
              d3.select(this).attr("r", 7).attr("stroke-width", 4);
              tooltip
                .style("visibility", "visible")
                .style("color", stateColorMap[stateName])
                .text(`${stateName} (${d.year}): ${d.value.toFixed(1)}%`);
            
              // Fade out all lines/dots
              
              svgLine.selectAll(".state-line, .nat-line")
                .style("opacity", 0.2);
              svgLine.selectAll(".dot, .dot-nat")
                .style("opacity", 0.2);
            
              // Highlight this state
              svgLine.select(`.line-${stateName.replace(/\s+/g, '-')}`)
                .style("opacity", 1)
                .attr("stroke-width", 4);
              d3.selectAll(`.dot-${stateName.replace(/\s+/g, '-')}`)
                .style("opacity", 1);
            })
            .on("mousemove", function() {
              tooltip.style("top", (d3.event.pageY - 10) + "px")
                     .style("left", (d3.event.pageX + 10) + "px");
            })
            .on("mouseout", function() {
              d3.select(this).attr("r", 4);
              tooltip.style("visibility", "hidden");
              svgLine.selectAll(".state-line, .nat-line")
                .style("opacity", 1)
                .attr("stroke-width", 2);
              svgLine.selectAll(".dot, .dot-nat")
                .style("opacity", 1);
            })
            
            
        });
      
        svgLine.append("text")
          .attr("x", width / 2)
          .attr("y", -10)
          .attr("text-anchor", "middle")
          .style("font-size", "15px")
          .style("font-weight", "bold")
          .text(`% Worried: ${stateNames.join(", ")} vs National Avg`);
      
        svgLine.append("text")
          .attr("x", width / 2)
          .attr("y", height + 48)
          .attr("text-anchor", "middle")
          .style("font-size", "15px")
          .text("Year");
      
        svgLine.append("text")
          .attr("transform", "rotate(-90)")
          .attr("y", -45)
          .attr("x", -height / 2)
          .attr("text-anchor", "middle")
          .style("font-size", "15px")
          .text("% Worried");
            
      
        // Instead of appending a new button, just enable the existing one
        d3.select("#unselect-button")
        .attr("disabled", null)
        .style("cursor", "pointer")
        .on("click", () => {
          selectedStateNames.clear(); // clear all selected states
          drawNationalAverage();
          updateMap(currentYear);
          refreshMapAndColors();
          mapGroup.selectAll("path")
            .classed("selected", false)
            .style("stroke", "#fff")
            .style("stroke-width", 1)
            .style("filter", null);
        });
// Add legend for National Average
const legend = svgLine.append("g")
  .attr("class", "legend")
  .attr("transform", `translate(${width - 450}, ${margin.bottom + 300})`);

// Blue box
legend.append("rect")
  .attr("x", 0)
  .attr("y", 0)
  .attr("width", 18)
  .attr("height", 18)
  .attr("fill", "#2f2585")

// Label text
legend.append("text")
  .attr("x", 25)
  .attr("y", 14)
  .text("National Average")
  .style("font-size", "13px")
  .attr("alignment-baseline", "middle");

  updateMap(currentYear);

    }
    function getNationalAverageData() {
      const years = Object.keys(dataByYear);
      return years.map(year => {
        const values = Object.values(dataByYear[year]);
        const avg = d3.mean(values);
        return { year: +year, value: avg };
      });
    }
    
    function drawNationalAverage() {
      const values = getNationalAverageData();
    
      d3.select("#line-chart-container").html(""); 
    
      const margin = { top: 60, right: 30, bottom: 68, left: 80 };
      const width = 575 - margin.left - margin.right;
      const height = 400 - margin.top - margin.bottom;

      const svgLine = d3.select("#line-chart-container")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
      const x = d3.scaleLinear().domain(d3.extent(values, d => d.year)).range([0, width]);
      const y = d3.scaleLinear().domain([0, 100]).range([height, 0]);
    
      const line = d3.line().x(d => x(d.year)).y(d => y(d.value));
    
      svgLine.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")))
        .selectAll("text")
        .style("font-size", "12px"); 

      svgLine.append("g")
        .call(d3.axisLeft(y))
        .selectAll("text")
        .style("font-size", "12px");
    
      svgLine.append("path")
        .datum(values)
        .attr("class", "nat-line")
        .attr("fill", "none")
        .attr("stroke", "#2f2585")
        .attr("stroke-width", 2)
        .attr("d", line);
    
      svgLine.selectAll(".dot-nat")
        .data(values)
        .enter()
        .append("circle")
        .attr("class", "dot-nat")
        .attr("cx", d => x(d.year))
        .attr("cy", d => y(d.value))
        .attr("r", 4)
        .attr("fill", "#2f2585")
        .style("cursor", "pointer")
        
        .on("mouseover", function(d) {
          d3.select(this).attr("r", 7);
          tooltip
            .style("visibility", "visible")
            .style("color", "#2f2585")
            .text(`National Avg (${d.year}): ${d.value.toFixed(1)}%`);
        
          // Dim only state lines and state dots
          svgLine.selectAll(".state-line, .dot").style("opacity", 0.2);

          // KEEP ALL national dots visible
          svgLine.selectAll(".dot-nat").style("opacity", 1);
        
          // Highlight the line
          svgLine.selectAll(".nat-line")
            .style("opacity", 1)
            .attr("stroke-width", 4);
        })
        
        .on("mousemove", function() {
          tooltip.style("top", (d3.event.pageY - 10) + "px")
                 .style("left", (d3.event.pageX + 10) + "px");
        })
        .on("mouseout", function() {
          d3.select(this).attr("r", 4); // reset radius
          tooltip.style("visibility", "hidden");
          svgLine.selectAll(".state-line, .nat-line")
            .style("opacity", 1)
            .attr("stroke-width", 2);
          svgLine.selectAll(".dot, .dot-nat")
            .style("opacity", 1);
        });
        
        
    
      svgLine.append("text")
        .attr("x", width / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .style("font-size", "15px")
        .style("font-weight", "bold")
        .text("% Worried About Global Warming: National Avg");
    
      svgLine.append("text")
        .attr("x", width / 2)
        .attr("y", height + 48)
        .attr("text-anchor", "middle")
        .style("font-size", "15px")
        .text("Year");
    
      svgLine.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -45)
        .attr("x", -height / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "15px")
        .text("% Worried");
      
        d3.select("#unselect-button")
        .attr("disabled", true)
        .style("cursor", "not-allowed")
        .on("click", null); // remove handler
    }
    
    function clearSelectedState() {
      selectedStateNames.clear(); // clear all selected state names
      mapGroup.selectAll("path")
        .classed("selected", false)
        .style("stroke", "#fff")
        .style("stroke-width", 1)
        .style("filter", null);
    }

    function updateClearFiltersButtonState() {
      const button = d3.select("#clear-filters-button");
      if (selectedBins.size === 0) {
        button.attr("disabled", true).style("cursor", "not-allowed");
      } else {
        button.attr("disabled", null).style("cursor", "pointer");
      }
      refreshMapAndColors();
    }
  });
});