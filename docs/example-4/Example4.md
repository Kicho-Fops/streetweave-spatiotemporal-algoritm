
# Example:  Visualizing uncertainty 
<!-- in COVID-19 data on street networks using pattern-based encodings -->

In this example we use Project Sidewalk dataset for Chicago to visualize the uncertainties.

Follow the steps below, and after each modification to the specification, click `Apply` to see the updated visualization.

## Step 1: Adding a map and specifying data layers

At first we need to specify the unit level. The concept of a unit defines the spatial granularity at which data can be aggregated, analyzed, and visualized, providing users with flexible options for spatial analysis. 

```
[
  {
    "unit": {
      "type": "segment"
    },
    "data": {
      "physical": {"path": "1.geojson"},
      "thematic": {"path": "1.csv"}
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
      "type": "segment"
    },
    "data": {
      "physical": {"path": "1.geojson"},
      "thematic": {"path": "1.csv"}
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

StreetWeave’s grammar allows to specify how data is visually encoded onto the physical network using customizable visual properties. 

```
[
  {
    "unit": {
      "type": "segment",
      "density": 0,
      "method": "line",
      "dash": "NoCurbRamp",
      "color": "SurfaceProblem",
      "opacity": 1,
      "width": 2,
      "alignment": "center",
      "orientation": "parallel"
    },
    "data": {
      "physical": {"path": "1.geojson"},
      "thematic": {"path": "1.csv"}
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

![StreetWeave example](step4.png?raw=true)

## Step 4: Changing attribute

StreetWeave’s grammar offers the flexibility to transform one visualization into another simply by tweaking a single attribute, here changing the `line type` from `dashed` to `squiggle` a new visualization can be created.

```
[
  {
    "unit": {
      "type": "segment",
      "density": 0,
      "method": "line",
      "squiggle": "NoCurbRamp",
      "color": "SurfaceProblem",
      "opacity": 1,
      "width": 2,
      "alignment": "center",
      "orientation": "parallel"
    },
    "data": {
      "physical": {"path": "1.geojson"},
      "thematic": {"path": "1.csv"}
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
      "method": "line",
      "squiggle": "NoCurbRamp",
      "color": "SurfaceProblem",
      "opacity": 1,
      "width": 2,
      "alignment": "center",
      "orientation": "parallel"
    },
    "data": {
      "physical": {"path": "1.geojson"},
      "thematic": {"path": "1.csv"}
    },
    "relation": {
      "spatial": "buffer",
      "value": 50,
      "type": "sum"
    }
  }
]

```
</details>

