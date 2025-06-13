
# Example:  Visualizing uncertainty in COVID-19 data on street networks using pattern-based encodings

In this example we use COVID-19 dataset for Chicago to visualize the uncertainties.

Follow the steps below, and after each modification to the specification, click `Apply` to see the updated visualization.

## Step 1: Adding a map

At first we need to specify the unit level. The concept of a unit defines the spatial granularity at which data can be aggregated, analyzed, and visualized, providing users with flexible options for spatial analysis. 

`gMap(unit="segment")`

You should see the following:

![StreetWeave example](step1.png?raw=true)

## Step 2: Specifying data layers
StreetWeave’s grammar allows users to load, visualize, and integrate physical layers (e.g., streets, intersections) and thematic layers (e.g., crime, pollution, pedestrian counts)

`.data(physicalLayer = "SmallChicago_filtered_data.json", thematicLayer = "CovidData.json")`

You should see the following:

![StreetWeave example](step2.png?raw=true)

## Step 3: Specifying spatial relations

 The grammar supports defining spatial relationships (buffer, contains, nearest neighbor) and applying aggregation operations (mean, sum, max, min) to summarize thematic data on physical features.

`.relation(spatialRelation = "contains", operation = "aggregation", type = "mean")`

You should see the following:

![StreetWeave example](step2.png?raw=true)

## Step 4: Visual encoding specification

StreetWeave’s grammar allows to specify how data is visually encoded onto the physical network using customizable visual properties. 

```
.ft(method = "line", type = dashed("CCVI_Score") color = "Cumulative_Mobility_Ratio", opacity = "Comorbid_Conditions").alignment("center")

```


You should see the following:

![StreetWeave example](step4.png?raw=true)

## Step 5: Changing attribute

StreetWeave’s grammar offers the flexibility to transform one visualization into another simply by tweaking a single attribute, here changing the `line type` from `dashed` to `squiggle` a new visualization can be created.

`.ft(method = "line", type = squiggle("COVID19_Incidence_Rate"), color = "Hospital_Admission_Rate", opacity = "Crude_Mortality_Rate").alignment("center")`

You should see the following:

![StreetWeave example](step5.png?raw=true)


## Final Specification
<details>
<summary>StreetWeave specification (click to expand)</summary>

```diff
gMap(unit="segment")
.data(physicalLayer = "SmallChicago_filtered_data.json", thematicLayer = "CovidData.json")
.relation(spatialRelation = "contains", operation = "aggregation", type = "mean")
.ft(method = "line", type = squiggle("COVID19_Incidence_Rate"), color = "Hospital_Admission_Rate", opacity = "Crude_Mortality_Rate").alignment("center")
```
</details>

