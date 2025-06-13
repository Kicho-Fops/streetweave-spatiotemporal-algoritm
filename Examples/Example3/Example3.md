# Example:  Exploring crime patterns

In this example we use Crime dataset for Chicago to visualize the crime distribution over different seasons - Summer, Winter, and Spring.

Follow the steps below, and after each modification to the specification, click `Apply` to see the updated visualization.

## Step 1: Adding a map

At first we need to specify the unit level. The concept of a unit defines the spatial granularity at which data can be aggregated, analyzed, and visualized, providing users with flexible options for spatial analysis. Here we will select the unit as node (street intersection).

`gMap(unit="node")`

You should see the following:

![StreetWeave example](step1.png?raw=true)

## Step 2: Specifying data layers
StreetWeave’s grammar allows users to load, visualize, and integrate physical layers (e.g., streets, intersections) and thematic layers (e.g., crime, pollution, pedestrian counts)

`.data(physicalLayer = "SmallChicago_filtered_data.json", thematicLayer = "SideWalk_data.json")`

You should see the following:

![StreetWeave example](step2.png?raw=true)

## Step 3: Specifying spatial relations

 The grammar supports defining spatial relationships (buffer, contains, nearest neighbor) and applying aggregation operations (mean, sum, max, min) to summarize thematic data on physical features.

`.relation(spatialRelation = "contains", operation = "aggregation", type = "mean")`

You should see the following:

![StreetWeave example](step2.png?raw=true)

## Step 4: Visual encoding specification

StreetWeave’s grammar allows to specify how data is visually encoded onto the physical network using customizable visual properties. Here we integrate Vega-Lite visualizations directly within StreetWeave’s grammar, leveraging the extensive capabilities of existing Vega-Lite chart types.

```
.chart(
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "description": "A simple radial chart with conditional text to hide zero values.",
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
          "Total Crimes",
          "Summer",
          "Winter",
          "Spring"
        ],
        "range": [
          "#1f77b4",
          "#ff7f0e",
          "#2ca02c",
          "#d62728"
        ]
      },
      "legend": null
    }
  }
}
).orientation("center").alignment("center")

```


You should see the following:

![UTK example](step4.png?raw=true)


## Final Specification
<details>
<summary>StreetWeave specification (click to expand)</summary>

```diff
gMap(unit="node")
.data(physicalLayer = "SmallChicago_filtered_data.json", thematicLayer = "SideWalk_data.json")
.relation(spatialRelation = "contains", operation = "aggregation", type = "mean")
.chart(
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "description": "A simple radial chart with conditional text to hide zero values.",
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
          "Total Crimes",
          "Summer",
          "Winter",
          "Spring"
        ],
        "range": [
          "#1f77b4",
          "#ff7f0e",
          "#2ca02c",
          "#d62728"
        ]
      },
      "legend": null
    }
  }
}
).orientation("center").alignment("center")
```
</details>

