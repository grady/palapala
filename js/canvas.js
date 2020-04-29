var shapes = [];
var pointerMap = {};


$(document).ready(init);

function init() {
    $("#colorPicker").spectrum({
        preferredFormat: "hex",
        showPalette: true,
        showPaletteOnly: true,
        togglePaletteOnly: true,
        togglePaletteMoreText: ">",
        togglePaletteLessText: "<",
        hideAfterPaletteSelect: true,
        palette: [["black", "red"],
        ["mediumseagreen", "mediumblue"],
        ["mediumorchid", "darkorange"]],
        replacerClassName: "sp-replacer btn btn-secondary bg-secondary",
        change: color => project.currentStyle.strokeColor = color.toHexString()
    });

    $("#clearButton").click(event => project.clear());
    //$("input[name=tool]").click(event => activateTool(event.target.value));
    $("input[name=tool]").click(event => tools.find(tool => tool.name == event.target.value).activate());

    $("#sizeSlider").change(event => project.currentStyle.strokeWidth = event.target.value);

    project.currentStyle.strokeColor = $("#colorPicker").spectrum("get").toHexString();
    project.currentStyle.strokeWidth = $("#sizeSlider").val();
    project.currentStyle.strokeCap = "round";
    project.currentStyle.strokeJoin = "round";
    penTool.activate();

    globals.paper = paper;
}


// function activateTool(name) {
//     tools.forEach(function (tool) {
//         if (tool.name === name) {
//             console.log("Activating: " + tool.name);
//             tool.activate();
//         }
//     });
// }

const penTool = new paper.Tool({
    name: "pen",
    path: null,
    onMouseDown: function (event) {
        penTool.path = new Path();
    },
    onMouseDrag: function (event) {
        if (penTool.path) penTool.path.add(event.point);
    },
    onMouseUp: function (event) {
        penTool.path.simplify();
        if (penTool.path.segments.length === 0) {
            penTool.path = new Path.Circle({
                center: event.point,
                radius: penTool.path.strokeWidth / 2,
                strokeWidth: null,
                fillColor: penTool.path.strokeColor
            });
        }
        penTool.path = null;
    }
});

const eraseTool = new paper.Tool({
    name: "erase",
    path: null,
    onMouseDown: function (event) {
        eraseTool.path = new Path({ strokeWidth: project.currentStyle.strokeWidth * 3, strokeColor: "white"});
    },
    onMouseDrag: function (event) {
        if (eraseTool.path) eraseTool.path.add(event.point);
    },
    onMouseUp: function (event) {
        eraseTool.path = null;
    }
});

const circleTool = new Tool({
    name: "circle",
    path: null,
    onMouseDown: function (event) {
        circleTool.path = new Shape.Circle(event.point, 10);
    },
    onMouseDrag: function (event) {
        circleTool.path.radius = (event.point - event.downPoint).length;
        // let path = circleTool.path;
        // let radius = (event.point - event.downPoint).length;
        // if (radius > 1) path.scale(radius / (path.firstSegment.point - path.bounds.center).length);
    },
    onMouseUp: function (event) {
        circleTool.path = null;
    }
});

const lineTool = new Tool({
    name: "line",
    path: null,
    onMouseDown: event => lineTool.path = new Path([event.point, event.point]),
    onMouseDrag: function(event){
        lineTool.path.lastSegment.point.set(event.point);
        lineTool.path.firstSegment.point.set(event.modifiers.shift ? event.downPoint - (event.point - event.downPoint): event.downPoint);
    },
    onMouseUp: event => lineTool.path = null
});

const rectTool = new Tool({
    name: "rectangle",
    path: null,
    onMouseDown: event => rectTool.path = new Shape.Rectangle(event.point, event.point),
    onMouseDrag: function(event){
        rectTool.path.size.set(event.point - event.downPoint);
        if(!event.modifiers.shift) rectTool.path.position.set((event.downPoint+event.point)/2);
    },
    onMouseUp: event => {rectTool.path=null}
});
