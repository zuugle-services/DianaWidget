# Diana Widget

**Diana Widget** is a drop-in JavaScript component that provides a full-featured activity planning interface — complete with origin input, custom date selection, and visualized connection data.

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
<div id="dianaWidgetContainer"></div>
```

3. Define your config before loading the widget:

```html
<script>
  window.dianaActivityConfig = {
    activityName: "Hiking in Mountains",                            // Name of the activity
    activityType: "Hiking",                                         // Type of the activity
    activityStartLocation: "47.71557523759539, 15.8040452544133",   // Starting location in coordinates
    activityStartLocationDisplayName: "Raxseilbahn Talstation",     // Display name for the starting location
    activityStartLocationType: "coordinates",                       // Type of the starting location (can be "coordinates" or "address")
    activityEndLocation: "47.68219100889535, 15.644807818859727",   // Ending location in coordinates
    activityEndLocationDisplayName: "Altenberg/Rax Kapelle",        // Display name for the ending location
    activityEndLocationType: "coordinates",                         // Type of the ending location (can be "coordinates" or "address")
    activityEarliestStartTime: "10:00:00",                          // Earliest start time in HH:mm:ss format
    activityEarliestStartTimeFlexible: true,                        // Whether the earliest start time is flexible
    activityLatestEndTime: "17:00:00",                              // Latest end time in HH:mm:ss format
    activityLatestEndTimeFlexible: true,                            // Whether the latest end time is flexible
    activityDurationMinutes: "210",                                 // Duration of the activity in minutes
    activityStartTimeLabel: null,                                   // Can be set to "Checkin Time" for example for hotel check-in, but defaults to "Start Time"
    activityEndTimeLabel: null,                                     // Can be set to "Checkout Time" for example for hotel check-out, but defaults to "End Time"
  };
</script>
```

4. The widget initializes automatically on page load.
