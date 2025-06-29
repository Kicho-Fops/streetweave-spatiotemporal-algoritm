# Example: Detailed street-level accessibility analysis

In this example we use Project Sidewalk dataset for Chicago, which includes geo-located data on sidewalk accessibility issues such as severity regarding crosswalks, curb ramps, missing curb ramps, no sidewalk, obstacles, and surface problems. Here we map the distribution and severity of various sidewalk accessibility issues across Chicago’s street segments. In the previous example, we demonstrated how StreetWeave can identify problematic street segments across Chicago by visualizing sidewalk accessibility data directly over the streets. However, marking an entire street segment as problematic may not offer the granularity needed for targeted urban improvements. To precisely determine which parts of a single street segment exhibit accessibility issues, a more detailed, fine-grained analysis is essential.

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

StreetWeave’s grammar allows to specify how data is visually encoded onto the physical network using customizable visual properties. Here we are creating Bristle map using two visual components - density and color, while keeping the height constant.

```
[
  {
    "unit": {
      "type": "segment",
      "density": "SurfaceProblem",
      "method": "line",
      "color": "NoSidewalk",
      "width": 1,
      "height": 15,
      "opacity": 1,
      "alignment": "left",
      "orientation": "perpendicular"
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

Next, we fix the density and generate visualizations using two attributes: color and height.

<!-- StreetWeave’s grammar offers the flexibility to transform one visualization into another simply by tweaking a single attribute, here changing the `orientation` from `parallel` to `perpendicular` a new visualization can be created. -->

```
[
  {
    "unit": {
      "type": "segment",
      "density": 15,
      "method": "line",
      "color": "NoSidewalk",
      "width": 1,
      "height": "SurfaceProblem",
      "opacity": 1,
      "alignment": "left",
      "orientation": "perpendicular"
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


## Step 5: Creating multilayer visualizations

StreetWeave also supports adding multiple layers of visualization, enabling the integration of different data aspects in a single view.

```
[
  {
    "unit": {
      "type": "segment",
      "density": "NoSidewalk",
      "method": "line",
      "color": "SurfaceProblem",
      "width": 1,
      "height": 15,
      "opacity": 1,
      "alignment": "left",
      "orientation": "perpendicular"
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
  },
{
    "unit": {
      "type": "segment",
      "density": 15,
      "method": "rect",
      "color": "NoSidewalk",
      "height": "SurfaceProblem",
      "opacity": 1,
      "alignment": "right",
      "orientation": "perpendicular"
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

![StreetWeave example](step6.png?raw=true)

## Final Specification
<details>
<summary>StreetWeave specification (click to expand)</summary>

```diff
[
  {
    "unit": {
      "type": "segment",
      "density": "NoSidewalk",
      "method": "line",
      "color": "SurfaceProblem",
      "width": 1,
      "height": 15,
      "opacity": 1,
      "alignment": "left",
      "orientation": "perpendicular"
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
  },
{
    "unit": {
      "type": "segment",
      "density": 15,
      "method": "rect",
      "color": "NoSidewalk",
      "height": "SurfaceProblem",
      "opacity": 1,
      "alignment": "right",
      "orientation": "perpendicular"
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
