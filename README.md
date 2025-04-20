# Zuugle Widget

**Zuugle Widget** is a drop-in JavaScript component that provides a full-featured activity planning interface — complete with origin input, custom date selection, and visualized connection data.

## 🚀 Features

- ✨ Modal interface with responsive layout
- 📍 Origin address autocomplete
- 📅 Custom calendar picker
- 🔁 Dynamic connection fetch and rendering
- 📦 Easy integration into any HTML page

## 🔧 Installation

1. Include the widget script on your page:

```html
<script src="dianaWidget.js"></script>
```

2. Add a container in your HTML:

```html
<div id="modalContainer"></div>
```

3. Define your config before loading the widget:

```html
<script>
  window.journeyConfig = {
    activity_name: "My Activity",
    activityStartLocation: "Start Station",
    activityStartLocationType: "station",
    activityEndLocation: "End Station",
    activityEndLocationType: "station",
    activityEarliestStartTime: "09:00:00",
    activityLatestEndTime: "18:00:00",
    activityDurationMinutes: "180"
  };
</script>
```

4. The widget initializes automatically on page load.
