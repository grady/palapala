var shapes = [];
var pointerMap = {};

globals.shapes = shapes;

$("#colorPicker").spectrum({
    preferredFormat: "hex",
    showPalette: true,
    showPaletteOnly: true,
    togglePaletteOnly: true,
    togglePaletteMoreText: ">",
    togglePaletteLessText: "<",
    palette: [["black", "red"],
    ["mediumseagreen", "mediumblue"],
    ["mediumorchid", "darkorange"]],
    replacerClassName: "sp-replacer btn btn-secondary bg-secondary"
});

function getWidth(event) {
    var size = $("#sizeSlider").val()
    return size * (event.pressure * 3 || 1);
}

function onMouseDown(event) {
    if ($("input[name='tool']:checked").val() === "pen") {
        pointerMap[event.pointerId] = new Path({
            strokeColor: $("#colorPicker").spectrum("get").toRgbString(),
            strokeWidth: getWidth(event),
            strokeCap: "round",

        });
    }
    if ($("input[name='tool']:checked").val() === "eraser") {
        pointerMap[event.pointerId] = new Path({
            strokeColor: 'white',
            strokeWidth: getWidth(event),
            strokeCap: "round",
        });
    }    
}

function onMouseDrag(event) {
    var path = pointerMap[event.pointerId];
    if (path) path.add(event.point);
}

function onMouseUp(event) {
    var path = pointerMap[event.pointerId];
    path.simplify();
    if (path.segments == 0) {
        path = new Path.Circle({
            center: event.point,
            radius: path.strokeWidth / 2,
            fillColor: path.strokeColor
        });
    }
    if(path.strokeColor === 'white'){
        for(var i=0; i<shapes.length;i++){shapes[i].subtract(path);}
    }
    shapes.push(path);
    delete pointerMap[event.pointerId];
}