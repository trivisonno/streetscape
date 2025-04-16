# Streetscape

Streetscape is an interactive web-based tool designed for urban planners, engineers, and designers to visualize and edit street layouts. It provides a user-friendly interface for creating, modifying, and analyzing various street elements such as lane design, traffic control devices, traffic calming, and more.

## Live Demo

Try the tool here: [Streetscape Tool](https://trivisonno.github.io/streetscape/)

## Features

### 1. **Interactive Map**
- Built using [Leaflet.js](https://leafletjs.com/) for seamless map interactions.
- Supports multiple base layers, including:
  - Cuyahoga County GIS Aerial Imagery
  - OpenStreetMap
  - Google Satellite and Hybrid views.

### 2. **Lane Markings**
- Draw and edit lane lines with customizable properties:
  - **Color**: White, Yellow, Red.
  - **Width**: Multiple options (e.g., 6", 2').
  - **Style**: Solid, Long Dashed, Short Dashed.
- Generate offset lines with configurable distance and repetition.
- Calculate the radius of curved lane lines.

### 3. **Pavement Polygons**
- Draw and edit pavement areas with customizable properties:
  - **Stroke Color**: Define the border color.
  - **Fill Color**: Choose from a palette or custom colors.
  - **Opacity**: Adjust transparency for better visualization.
- Automatically calculate and display the area in square feet and square yards.

### 4. **Traffic Control Markers**
- Add markers for traffic control elements such as:
  - Bike lanes, sharrows, parking, and speed tables.
  - MUTCD-compliant signs (e.g., stop signs, no turn on red).
- Rotate markers using an intuitive angle selector.

### 5. **Text Labels**
- Add draggable text labels to annotate the map.
- Customize label text, color, and font size.
- Automatically resize labels based on zoom level.

### 6. **Callout Lines**
- Draw callout lines with arrowheads for annotations.
- Edit and adjust callout lines interactively.

### 7. **GeoJSON Support**
- Save the current design as a `.geojson` file for sharing or further analysis.
- Load existing `.geojson` files to restore or modify designs.

### 8. **Project Settings**
- Set and save the default map view (center and zoom level).
- Manage base layers and overlay layers.
- Clear all map elements with a single click.

### 9. **Keyboard Shortcuts**
- `L`: Start drawing a new lane line.
- `O`: Open the offset line popup for the selected line.
- `R`: Remove the selected marker or line.
- `F`: Flip the rotation of a selected marker by 180°.
- `T`: Add a new text label.
- `C`: Add a new callout line.
- `Escape`: Deselect all features.

## Usage

1. Open the application in your browser.
2. Use the tabs to switch between different tools:
   - **Pavements**: Create and customize pavement polygons.
   - **Line Markings**: Draw and edit lane lines.
   - **Traffic Control**: Add and manage markers.
   - **Project Settings**: Configure map settings and manage layers.
3. Save your design as a `.geojson` file or load an existing design.

## Contributing

Contributions are welcome! Feel free to submit issues or pull requests to improve the tool.
