# Example: Spatial analysis and mapping

In this example we use Project Sidewalk dataset for Chicago, which includes geo-located data on sidewalk accessibility issues such as severity regarding crosswalks, curb ramps, missing curb ramps, no sidewalk, obstacles, and surface problems. Here we map the distribution and severity of various sidewalk accessibility issues across Chicago’s street segments.

Follow the steps below, and after each modification to the specification, click `Apply` to see the updated visualization.

## Step 1: Adding a map and specifying data layers

At first we need to specify the unit level. The concept of a unit defines the spatial granularity at which data can be aggregated, analyzed, and visualized, providing users with flexible options for spatial analysis. StreetWeave’s grammar allows users to load, visualize, and integrate physical layers (e.g., streets, intersections) and thematic layers (e.g., crime, pollution, pedestrian counts)

```
[
  {
    "unit": {
      "type": "segment"
    },
    "data": {
      "physical": {"path": "2.geojson"},
      "thematic": {"path": "2.csv"}
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
      "physical": {"path": "2.geojson"},
      "thematic": {"path": "2.csv"}
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
      "density":0,
      "method": "line",
      "color": "#31a354",
      "width": "CurbRamp",
      "opacity": 1,
      "alignment": "center",
      "orientation": "parallel"
    },
    "data": {
      "physical": {"path": "2.geojson"},
      "thematic": {"path": "2.csv"}
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

## Step 4: Creating multilayer visualizations

StreetWeave also supports adding multiple layers of visualization, enabling the integration of different data aspects in a single view.

```
{
    "unit": {
      "type": "segment",
      "density": 0,
      "method": "line",
      "color": "#756bb1",
      "width": "SurfaceProblem",
      "opacity": 1,
      "alignment": "left"
    },
    "data": {
      "physical": {"path": "2.geojson"},
      "thematic": {"path": "2.csv"}
    },
    "relation": {
      "spatial": "buffer",
      "value": 50,
      "type": "sum"
    }
  }
```


```
{
    "unit": {
      "type": "segment",
      "density": 0,
      "method": "line",
      "color": "#d95f0e",
      "width": "Crosswalk",
      "opacity": 1,
      "alignment": "right"
    },
    "data": {
      "physical": {"path": "2.geojson"},
      "thematic": {"path": "2.csv"}
    },
    "relation": {
      "spatial": "buffer",
      "value": 50,
      "type": "sum"
    }
  }
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
      "density":0,
      "method": "line",
      "color": "#31a354",
      "width": "CurbRamp",
      "opacity": 1,
      "alignment": "center",
      "orientation": "parallel"
    },
    "data": {
      "physical": {"path": "2.geojson"},
      "thematic": {"path": "2.csv"}
    },
    "relation": {
      "spatial": "buffer",
      "value": 50,
      "type": "sum"
    }
  },
  {
    "unit": {
      "type": "segment",
      "density": 0,
      "method": "line",
      "color": "#756bb1",
      "width": "SurfaceProblem",
      "opacity": 1,
      "alignment": "left"
    },
    "data": {
      "physical": {"path": "2.geojson"},
      "thematic": {"path": "2.csv"}
    },
    "relation": {
      "spatial": "buffer",
      "value": 50,
      "type": "sum"
    }
  },
  {
    "unit": {
      "type": "segment",
      "density": 0,
      "method": "line",
      "color": "#d95f0e",
      "width": "Crosswalk",
      "opacity": 1,
      "alignment": "right"
    },
    "data": {
      "physical": {"path": "2.geojson"},
      "thematic": {"path": "2.csv"}
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