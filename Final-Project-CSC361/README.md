A modular version of [this excellent choropleth](https://gist.github.com/michellechandra/0b2ce4923dc9b5809922) - will map any CSV `statesdata.csv` on a linear continuous value, using d3js v4.

Requirements for `statesdata.csv`:

- `state` column with standard full-length state names
- `value` column with any numeric values

Also, you can edit the color ramp using the `lowColor` and `highColor` variables.