# Example: Detailed street-level accessibility analysis

In this example we use Project Sidewalk dataset for Chicago, which includes geo-located data on sidewalk accessibility issues such as severity regarding crosswalks, curb ramps, missing curb ramps, no sidewalk, obstacles, and surface problems. Here we map the distribution and severity of various sidewalk accessibility issues across Chicago’s street segments. In the previous example, we demonstrated how StreetWeave can identify problematic street segments across Chicago by visualizing sidewalk accessibility data directly over the streets. However, marking an entire street segment as problematic may not offer the granularity needed for targeted urban improvements. To precisely determine which parts of a single street segment exhibit accessibility issues, a more detailed, fine-grained analysis is essential.

Follow the steps below, and after each modification to the specification, click `Apply` to see the updated visualization.

## Step 1: Adding a map

At first we need to specify the unit level. The concept of a unit defines the spatial granularity at which data can be aggregated, analyzed, and visualized, providing users with flexible options for spatial analysis.

`gMap(unit="segment/25")`

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

StreetWeave’s grammar allows to specify how data is visually encoded onto the physical network using customizable visual properties.

`.ft(method = "rect", color = "NoSidewalk", opacity = 1 , width = "NoCurbRamp").orientation("parallel").alignment("left")`


You should see the following:

![StreetWeave example](step4.png?raw=true)

## Step 5: Changing attribute

StreetWeave’s grammar offers the flexibility to transform one visualization into another simply by tweaking a single attribute, here changing the `orientation` from `parallel` to `perpendicular` a new visualization can be created.

`.ft(method = "rect", color = "NoSidewalk", opacity = 1 , width = "NoCurbRamp").orientation("perpendicular").alignment("left")`

You should see the following:

![StreetWeave example](step5.png?raw=true)


## Step 6: Creating multilayer visualizations

StreetWeave also supports adding multiple layers of visualization, enabling the integration of different data aspects in a single view.

```
Layer1 = gMap(unit=segment/25)
.data(physicalLayer = "SmallChicago_filtered_data.json", thematicLayer = "SideWalk_data.json")
.relation( spatialRelation = "contains", operation = "aggregation", type = "mean")
.ft(method = "rect", color = "NoSidewalk", height = "SurfaceProblem", opacity = 1 , width = "NoCurbRamp")
.orientation("perpendicular")
.alignment("right")

```


```
Layer2 = gMap(unit=segment/25)
.data(physicalLayer = "SmallChicago_filtered_data.json", thematicLayer = "SideWalk_data.json")
.relation( spatialRelation = "contains", operation = "aggregation", type = "mean")
.ft(method = "rect", color = "Crosswalk", height = "CurbRamp", opacity = 1 , width = "Obstacle")
.orientation("perpendicular")
.alignment("left")

```


You should see the following:

![StreetWeave example](step6.png?raw=true)

## Final Specification
<details>
<summary>StreetWeave specification (click to expand)</summary>

```diff
Layer1 = gMap(unit=segment/25)
.data(physicalLayer = "SmallChicago_filtered_data.json", thematicLayer = "SideWalk_data.json")
.relation( spatialRelation = "contains", operation = "aggregation", type = "mean")
.ft(method = "rect", color = "NoSidewalk", height = "SurfaceProblem", opacity = 1 , width = "NoCurbRamp")
.orientation("perpendicular")
.alignment("right")

Layer2 = gMap(unit=segment/25)
.data(physicalLayer = "SmallChicago_filtered_data.json", thematicLayer = "SideWalk_data.json")
.relation( spatialRelation = "contains", operation = "aggregation", type = "mean")
.ft(method = "rect", color = "Crosswalk", height = "CurbRamp", opacity = 1 , width = "Obstacle")
.orientation("perpendicular")
.alignment("left")


```
</details>
