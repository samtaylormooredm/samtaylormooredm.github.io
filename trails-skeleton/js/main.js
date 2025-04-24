
// Global objects go here (outside of any functions)
let data, scatterplot, barchart; 


d3.csv('data/vancouver_trails.csv')
   .then(_data => {
     data = _data; // for safety, so that we use a local copy of data.
     const max = d3.max(_data, d => d.difficulty);

     // ... data preprocessing etc. ... TODO: you add code here for numeric
     data.forEach(d => {
        d.time = +d.time;
        d.distance = +d.distance;
      });


     // Be sure to examine your data to fully understand the code

     // Initialize scale
     const colorScale = d3.scaleOrdinal()
      .domain(['Easy', 'Intermediate', 'Difficult'])
      .range(['#a1d99b', '#41ab5d', '#005a32']); // light to dark green


    // --- Config objects ---
    const scatterplotConfig = {
        parentElement: '#scatterplot',
        colorScale: colorScale
    };
    const barchartConfig = {
        parentElement: '#barchart',
        colorScale: colorScale
    };

    const dispatcher = d3.dispatch('filterCategories');
     
     // Initialize visualizations
     scatterplot = new Scatterplot(scatterplotConfig, data); //we will update config soon
     scatterplot.updateVis();

     barchart = new Barchart(barchartConfig, dispatcher, data);
     barchart.updateVis();

     // set up dispatcher
     dispatcher.on('filterCategories', selectedCategories => {
      if (selectedCategories.length == 0) {
        scatterplot.data = data;
      } else {
        scatterplot.data = data.filter(d => selectedCategories.includes(d.difficulty));
      }
      scatterplot.updateVis();
    });
   })
  .catch(error => console.error(error));