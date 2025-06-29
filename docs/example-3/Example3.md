# Example:  Exploring crime patterns

In this example we use Crime dataset for Chicago to visualize the crime distribution over different seasons - Summer, Winter, and Spring.

Follow the steps below, and after each modification to the specification, click `Apply` to see the updated visualization.

## Step 1: Adding a map and specifying data layers

At first we need to specify the unit level. The concept of a unit defines the spatial granularity at which data can be aggregated, analyzed, and visualized, providing users with flexible options for spatial analysis. Here we will select the unit as node (street intersection).

```
[
  {
    "unit": {
      "type": "node"
    },
    "data": {
      "physical": {"path": "LineChart.geojson"},
      "thematic": {"path": "CrimeForLine.csv"}
    }
  }
]
```

You should see the following:

![StreetWeave example](step1.png?raw=true)


## Step 2: Specifying spatial relations

 The grammar supports defining spatial relationships (buffer, contains, nearest neighbor) and applying aggregation operations (mean, sum, max, min) to summarize thematic data on physical features.

```
[
  {
    "unit": {
      "type": "node"
    },
    "data": {
      "physical": {"path": "LineChart.geojson"},
      "thematic": {"path": "CrimeForLine.csv"}
    },
    "relation": {
      "spatial": "buffer",
      "value": 50,
      "type": "sum"
    }
  }
]
```

You should see the following:

![StreetWeave example](step2.png?raw=true)

## Step 3: Visual encoding specification

StreetWeave’s grammar allows to specify how data is visually encoded onto the physical network using customizable visual properties. Here we integrate Vega-Lite visualizations directly within StreetWeave’s grammar, leveraging the extensive capabilities of existing Vega-Lite chart types.

```
[
  {
    "unit": {
      "type": "node",
      "density": 0,
      "alignment": "center",
      "chart": {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "width": 80,
        "height": 80,
        "layer": [
          {
            "mark": {
              "type": "arc",
              "innerRadius": 20,
              "stroke": "#fff"
            }
          },
          {
            "mark": {
              "type": "text",
              "radiusOffset": 10,
              "color": "black"
            },
            "encoding": {
              "text": {
                "condition": {
                  "test": "datum.value > 0",
                  "field": "category"
                },
                "value": ""
              }
            }
          }
        ],
        "encoding": {
          "theta": {
            "field": "value",
            "type": "quantitative",
            "stack": true
          },
          "radius": {
            "field": "value",
            "scale": {
              "type": "sqrt",
              "zero": true,
              "rangeMin": 20
            }
          },
          "color": {
            "field": "category",
            "type": "nominal",
            "scale": {
              "domain": [
                "Total_Crimes",
                "Summer",
                "Winter",
                "Spring"
              ],
              "range": [
                "#d53e4f",
                "#fc8d59",
                "#542788",
                "#c51b7d"
              ]
            },
            "legend": null
          }
        }
      }
    },
    "data": {
      "physical": {"path": "LineChart.geojson"},
      "thematic": {"path": "CrimeForLine.csv"}
    },
    "relation": {
      "spatial": "nn",
      "value": 10,
      "type": "mean"
    }
  }
]

```


You should see the following:

![StreetWeave example](step4.png?raw=true)

## Step 4: Creating multilayer visualizations

StreetWeave also supports adding multiple layers of visualization, enabling the integration of different data aspects in a single view.

```
[
  {
    "unit": {
      "type": "segment",
      "density": 0,
      "alignment": "center",
      "orientation": "parallel",
      "chart": {
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "data": { "name": "" },
  "width": 250,
  "height": 80,
  "transform": [
    {
      "calculate": "split(datum.category, '_')[0]",
      "as": "year"
    },
    {
      "calculate": "toNumber(split(datum.category, '_')[1])",
      "as": "month"
    },
    {
      "calculate": "['Jan','Feb','Mar','Apr','May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][datum.month - 1]",
      "as": "monthName"
    }
  ],
  "mark": {
    "type": "line",
    "point": true
  },
  "encoding": {
    "x": {
      "field": "monthName",
      "type": "ordinal",
      "sort": ["Jan","Feb","Mar","Apr","May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      "axis": { "title": null }
    },
    "y": {
      "field": "value",
      "type": "quantitative",
      "scale": { "domain": [0, 10] },
      "axis": null
    },
    "color": {
      "field": "year",
      "type": "nominal",
      "title": "Year",
      "legend": null
    }
  }
}

    },
    "data": {
      "physical": {"path": "LineChart.geojson"},
      "thematic": {"path": "LineChart.csv"}
    },
    "relation": {
      "spatial": "buffer",
      "value": 35,
      "type": "sum"
    }
  },
  {
    "unit": {
      "type": "node",
      "density": 0,
      "alignment": "center",
      "chart": {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "width": 80,
        "height": 80,
        "layer": [
          {
            "mark": {
              "type": "arc",
              "innerRadius": 20,
              "stroke": "#fff"
            }
          },
          {
            "mark": {
              "type": "text",
              "radiusOffset": 10,
              "color": "black"
            },
            "encoding": {
              "text": {
                "condition": {
                  "test": "datum.value > 0",
                  "field": "category"
                },
                "value": ""
              }
            }
          }
        ],
        "encoding": {
          "theta": {
            "field": "value",
            "type": "quantitative",
            "stack": true
          },
          "radius": {
            "field": "value",
            "scale": {
              "type": "sqrt",
              "zero": true,
              "rangeMin": 20
            }
          },
          "color": {
            "field": "category",
            "type": "nominal",
            "scale": {
              "domain": [
                "Total_Crimes",
                "Summer",
                "Winter",
                "Spring"
              ],
              "range": [
                "#d53e4f",
                "#fc8d59",
                "#542788",
                "#c51b7d"
              ]
            },
            "legend": null
          }
        }
      }
    },
    "data": {
      "physical": {"path": "LineChart.geojson"},
      "thematic": {"path": "CrimeForLine.csv"}
    },
    "relation": {
      "spatial": "nn",
      "value": 10,
      "type": "mean"
    }
  }
]

```


You should see the following:

![StreetWeave example](step5.png?raw=true)


## Final Specification
<details>
<summary>StreetWeave specification (click to expand)</summary>

```diff
[
  {
    "unit": {
      "type": "segment",
      "density": 0,
      "alignment": "center",
      "orientation": "parallel",
      "chart": {
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "data": { "name": "" },
  "width": 250,
  "height": 80,
  "transform": [
    {
      "calculate": "split(datum.category, '_')[0]",
      "as": "year"
    },
    {
      "calculate": "toNumber(split(datum.category, '_')[1])",
      "as": "month"
    },
    {
      "calculate": "['Jan','Feb','Mar','Apr','May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][datum.month - 1]",
      "as": "monthName"
    }
  ],
  "mark": {
    "type": "line",
    "point": true
  },
  "encoding": {
    "x": {
      "field": "monthName",
      "type": "ordinal",
      "sort": ["Jan","Feb","Mar","Apr","May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      "axis": { "title": null }
    },
    "y": {
      "field": "value",
      "type": "quantitative",
      "scale": { "domain": [0, 10] },
      "axis": null
    },
    "color": {
      "field": "year",
      "type": "nominal",
      "title": "Year",
      "legend": null
    }
  }
}

    },
    "data": {
      "physical": {"path": "LineChart.geojson"},
      "thematic": {"path": "LineChart.csv"}
    },
    "relation": {
      "spatial": "buffer",
      "value": 35,
      "type": "sum"
    }
  },
  {
    "unit": {
      "type": "node",
      "density": 0,
      "alignment": "center",
      "chart": {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "width": 80,
        "height": 80,
        "layer": [
          {
            "mark": {
              "type": "arc",
              "innerRadius": 20,
              "stroke": "#fff"
            }
          },
          {
            "mark": {
              "type": "text",
              "radiusOffset": 10,
              "color": "black"
            },
            "encoding": {
              "text": {
                "condition": {
                  "test": "datum.value > 0",
                  "field": "category"
                },
                "value": ""
              }
            }
          }
        ],
        "encoding": {
          "theta": {
            "field": "value",
            "type": "quantitative",
            "stack": true
          },
          "radius": {
            "field": "value",
            "scale": {
              "type": "sqrt",
              "zero": true,
              "rangeMin": 20
            }
          },
          "color": {
            "field": "category",
            "type": "nominal",
            "scale": {
              "domain": [
                "Total_Crimes",
                "Summer",
                "Winter",
                "Spring"
              ],
              "range": [
                "#d53e4f",
                "#fc8d59",
                "#542788",
                "#c51b7d"
              ]
            },
            "legend": null
          }
        }
      }
    },
    "data": {
      "physical": {"path": "LineChart.geojson"},
      "thematic": {"path": "CrimeForLine.csv"}
    },
    "relation": {
      "spatial": "nn",
      "value": 10,
      "type": "mean"
    }
  }
]

```
</details>

