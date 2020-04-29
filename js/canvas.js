var shapes = [];
var pointerMap = {};

globals.paper = paper;
globals.shapes = shapes;

$(document).ready(init);

function init() {
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
        replacerClassName: "sp-replacer btn btn-secondary bg-secondary",
        change: color => project.currentStyle.strokeColor = color.toHexString()
    });

    $("#clearButton").click(event => project.clear());
    $("input[name=tool]").click(event => activateTool(event.target.value));

    $("#sizeSlider").change(event => project.currentStyle.strokeWidth = event.target.value);

    project.currentStyle.strokeColor = $("#colorPicker").spectrum("get").toHexString();
    project.currentStyle.strokeWidth = $("#sizeSlider").val();
    project.currentStyle.strokeCap = "round";
}

function activateTool(name) {
    tools.forEach(function (tool) {
        if (tool.name === name) {
            console.log("Activating: " + tool.name);
            tool.activate();
        }
    });
}

const penTool = new paper.Tool();
penTool.name = "pen";
penTool.path = null;
penTool.onMouseDown = function (event) {
    penTool.path = new Path({
        //        strokeColor: $("#colorPicker").spectrum("get").toRgbString(),
        //        strokeWidth: getWidth(event),
        //strokeCap: "round"
    });
};

penTool.onMouseDrag = function (event) {
    if (penTool.path) penTool.path.add(event.point);
};

penTool.onMouseUp = function (event) {
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
};

penTool.activate();

const eraseTool = new paper.Tool();
eraseTool.name = "erase";
eraseTool.path = null;
eraseTool.onMouseDown = function (event) {
    eraseTool.path = new Path({ strokeWidth: getWidth(event) * 3, strokeCap: "round", strokeColor: "white" });
};
eraseTool.onMouseDrag = function (event) {
    if (eraseTool.path) eraseTool.path.add(event.point);
};
eraseTool.onMouseUp = function (event) {
    if (eraseTool.path) {
        //project.activeLayer.children.forEach(item => item.subtract(eraseTool.path));
        //eraseTool.path.remove();
    }
    eraseTool.path = null;
    //delete pointerMove[event.pointerId];
};

const circleTool = new Tool({
    name: "circle",
    path: null,
    onMouseDown: function(event){
        circleTool.path = new Path.Circle(event.point, 10);
    },
    onMouseDrag: function(event){
        let path = circleTool.path;
        let radius = (event.point - event.downPoint).length;
        if(radius > 1) path.scale(radius/(path.firstSegment.point - path.bounds.center).length);
    },
    onMouseUp: function(event){
        circleTool.path = null;
    }
});

function getWidth(event) {
    console.log(event);
    var size = $("#sizeSlider").val()
    return size * (event.pressure * 3 || 1);
}

// function onMouseDown(event) {
//     if ($("input[name='tool']:checked").val() === "pen") {
//         pointerMap[event.pointerId] = new Path({
//             strokeColor: $("#colorPicker").spectrum("get").toRgbString(),
//             strokeWidth: getWidth(event),
//             strokeCap: "round",

//         });
//     }
//     if ($("input[name='tool']:checked").val() === "eraser") {
//         pointerMap[event.pointerId] = new Path({
//             strokeColor: 'white',
//             strokeWidth: getWidth(event),
//             strokeCap: "round",
//         });
//     }    
// }

// function onMouseDrag(event) {
//     var path = pointerMap[event.pointerId];
//     if (path) path.add(event.point);
// }

// function onMouseUp(event) {
//     var path = pointerMap[event.pointerId];
//     path.simplify();
//     if (path.segments == 0) {
//         path = new Path.Circle({
//             center: event.point,
//             radius: path.strokeWidth / 2,
//             fillColor: path.strokeColor
//         });
//     }
//     if(path.strokeColor === 'white'){
//         for(var i=0; i<shapes.length;i++){shapes[i].subtract(path);}
//     }
//     shapes.push(path);
//     delete pointerMap[event.pointerId];
// }