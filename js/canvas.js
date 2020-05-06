let mementos = [];
let conn;
let doc;
let id;
let timer;

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
        palette: [
            ["black", "red"],
            ["mediumseagreen", "mediumblue"],
            ["mediumorchid", "darkorange"]
        ],
        replacerClassName: "sp-replacer btn btn-secondary bg-secondary",
        change: color => project.currentStyle.strokeColor.set(color.toRgbString())
    });

    $("#clearButton").click(clearProject);
    $("input[name=tool]").click(event => activateTool(event.target.value));
    //$("input[name=tool]").click(event => tools.find(tool => tool.name == event.target.value).activate());

    $("#sizeSlider").change(event => project.currentStyle.strokeWidth = event.target.value);
    $("#undoButton").click(undo);
    $("#redoButton").click(redo);
    project.currentStyle.strokeColor = $("#colorPicker").spectrum("get").toHexString();
    project.currentStyle.strokeWidth = $("#sizeSlider").val();
    project.currentStyle.strokeCap = "round";
    project.currentStyle.strokeJoin = "round";
    penTool.activate();

    globals.paper = paper;

    conn = globals.socket();
    id = window.location.pathname.split("/").filter(v => v);
    doc = conn.get('palapala', id[0]);
    doc.on('load', function () {
        if (doc.type == null) {
            doc.create({ layers: project.exportJSON({ asString: false }), desmos: null });
        } else {
            project.importJSON(doc.data.layers);
        }
    });
    doc.on('op', function (op, source) {
        if (!source) { console.log(op); op.forEach(item => { replaceData(item) }); }
    });
    doc.subscribe();
    globals.doc = doc;
}

function submitChanges() {
    let diff = globals.diff(doc.data.layers, project.exportJSON({ asString: false }));
    diff.forEach(item => item.p.unshift("layers"));
    //debugger;
    if (diff.length) { doc.submitOp(diff); }
}

function clearProject(event) {
    project.clear();
    (new Layer()).activate();
    new Path();
    doc.submitOp([{ p: ["layers"], od: doc.data.layers, oi: project.exportJSON({ asString: false }) }]);
}

function activateTool(name) {
    if (paper.tool.name === "desmos" || name === "desmos")
        desmosTool.desmos.css("z-index", name === "desmos" ? 1 : -1);
    tools.find(tool => tool.name === name).activate();

}

function submitItem(item) {
    //item.parent.index;
    submitChanges();
}

function submitPath(path) {
    doc.submitOp([{ p: ["layers", project.activeLayer.index, 1, "children", path.index], li: path.exportJSON({ asString: false }) }]);
}

const penTool = new paper.Tool({
    name: "pen",
    path: null,
    onMouseDown: function (event) {
        if (project.activeLayer.blendMode === "destination-out")
            (new Layer()).activate();
        penTool.path = new Path({ strokeColor: project.currentStyle.strokeColor.clone(), strokeWidth: project.currentStyle.strokeWidth });
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
        //debugger;
        doc.submitOp([{
            p: ["layers", project.activeLayer.index, 1, "children", penTool.path.index],
            li: penTool.path.exportJSON({ asString: false })
        }]);
        //submitItem(penTool.path);
        penTool.path = null;
    }
});

const brushTool = new paper.Tool({
    name: "brush",
    path: null,
    leftPath: null,
    rightPath: null,
    minDistance: 5,
    onMouseDown: function (event) {
        if (project.activeLayer.blendMode === "destination-out")
            (new Layer()).activate();
        brushTool.path = new Path({ closed: true, fillColor: project.currentStyle.strokeColor, strokeWidth: 1, segments: [event.point] })
        brushTool.leftPath = new Path({ fillColor: project.currentStyle.strokeColor.clone(), strokeWidth: 0, segments: [event.point], insert: false })
        brushTool.rightPath = new Path({ insert: false })
    },
    onMouseDrag: function (event) {
        let diff = event.delta;
        let force = event.event.type === "touchmove" ? event.event.changedTouches[0].force : 1;
        diff.length *= 200; // make it longer for angle calculations?
        diff.angle += 90;
        diff.length = Math.max(1, force * project.currentStyle.strokeWidth);
        let lp = event.point - diff, rp = event.point + diff;
        brushTool.path.insertSegments(event.count, [lp, rp]);
        brushTool.leftPath.add(lp);
        brushTool.rightPath.add(rp);
    },
    onMouseUp: function (event) {
        brushTool.leftPath.add(event.point);
        brushTool.leftPath.simplify(1.5);
        brushTool.rightPath.simplify(1.5);
        brushTool.rightPath.reverse();
        brushTool.leftPath.addSegments(brushTool.rightPath.segments);
        brushTool.leftPath.closePath();
        brushTool.path.replaceWith(brushTool.leftPath);
        //submitPath(brushTool.path);
        doc.submitOp([{
            p: ["layers", project.activeLayer.index, 1, "children", brushTool.leftPath.index],
            li: brushTool.leftPath.exportJSON({ asString: false })
        }]);
        brushTool.path = null;
        brushTool.leftPath = null;
        brushTool.rightPath = null;
    }
});

const eraseTool = new paper.Tool({
    name: "erase",
    path: null,
    onMouseDown: function (event) {
        if (project.activeLayer.blendMode !== "destination-out")
            (new Layer({ blendMode: "destination-out" })).activate();
        eraseTool.path = new Path({
            strokeWidth: project.currentStyle.strokeWidth * (event.modifiers.shift ? 20 : 5),
        });
    },
    onMouseDrag: function (event) {
        eraseTool.path.add(event.point);
    },
    onMouseUp: function (event) {
        eraseTool.path.simplify();
        submitChanges();
        eraseTool.path = null;
    }
});

const circleTool = new Tool({
    name: "circle",
    path: null,
    onMouseDown: function (event) {
        if (project.activeLayer.blendMode === "destination-out")
            (new Layer()).activate();
        circleTool.path = new Shape.Circle(event.point, 10);
    },
    onMouseDrag: function (event) {
        circleTool.path.radius = (event.point - event.downPoint).length;
    },
    onMouseUp: function (event) {
        submitItem(circleTool.path);
        circleTool.path = null;
    }
});

const lineTool = new Tool({
    name: "line",
    path: null,
    onMouseDown: event => {
        if (project.activeLayer.blendMode === "destination-out")
            (new Layer()).activate();
        lineTool.path = new Path([event.point, event.point])
    },
    onMouseDrag: function (event) {
        lineTool.path.lastSegment.point.set(event.point);
        if (event.modifiers.shift) lineTool.path.firstSegment.point.set(lineMirror(event));
        lineTool.path.firstSegment.point.set(event.modifiers.shift ? lineMirror(event) : event.downPoint);
    },
    onMouseUp: function (event) {
        submitItem(lineTool.path);
        lineTool.path = null;
    }
});

function lineMirror(event) {
    return event.downPoint - (event.point - event.downPoint);
}

const rectTool = new Tool({
    name: "rectangle",
    path: null,
    onMouseDown: event => {
        if (project.activeLayer.blendMode === "destination-out")
            (new Layer()).activate();
        rectTool.path = new Shape.Rectangle(event.point, event.point)
    },
    onMouseDrag: function (event) {
        let size = event.point - event.downPoint;
        if (event.modifiers.shift) {
            rectTool.path.size.set(size * 2);
            rectTool.path.position.set(event.downPoint);
        }
        else {
            rectTool.path.size.set(size);
            rectTool.path.position.set((event.downPoint + event.point) / 2);
        }
    },
    onMouseUp: function (event) {
        submitItem(rectTool.path);
        rectTool.path = null
    }
});

const highlightTool = new Tool({
    name: "highlight",
    path: null,
    onMouseDown: function (event) {
        if (project.activeLayer.blendMode === "destination-out")
            (new Layer()).activate();
        highlightTool.path = new Path({ strokeWidth: project.currentStyle.strokeWidth * 5 });
        highlightTool.path.strokeColor.alpha = 0.4;
    },
    onMouseDrag: event => highlightTool.path.add(event.point),
    onMouseUp: function (event) {
        submitItem(highlightTool.path);
        highlightTool.path = null
    }
});

const axesTool = new Tool({
    name: "axes",
    path: null,
    onMouseDown: function (event) {
        if (project.activeLayer.blendMode === "destination-out")
            (new Layer()).activate();
        axesTool.path = new CompoundPath({
            children: [
                new Path([event.point, event.point]),
                new Path([event.point, event.point])
            ]
        })
    },
    onMouseDrag: function (event) {
        let xaxis = axesTool.path.firstChild;
        let yaxis = axesTool.path.lastChild;
        let mirror = lineMirror(event);
        xaxis.firstSegment.point.x = event.point.x;
        xaxis.lastSegment.point.x = event.modifiers.shift ? mirror.x : event.downPoint.x;
        yaxis.firstSegment.point.y = event.point.y;
        yaxis.lastSegment.point.y = event.modifiers.shift ? mirror.y : event.downPoint.y;
    },
    onMouseUp: function (event) {
        submitItem(axesTool.path);
        axesTool.path = null
    }
});

const desmosTool = new Tool({
    name: "desmos",
    desmos: $("#desmos"),
    calc: null,
    path: null,
    onMouseDown: function (event) {
        desmosTool.path = new Shape.Rectangle(event.point, event.point);
        desmosTool.path.strokeWidth = 1;
    },
    onMouseDrag: function (event) {
        desmosTool.path.size.set(event.point - event.downPoint);
        desmosTool.path.position.set((event.downPoint + event.point) / 2);
    },
    onMouseUp: function (event) {
        //    debugger;
        desmosTool.path.remove();
        desmosTool.path = null;
        let rect = new Rectangle(event.downPoint, event.point);
        desmosTool.desmos.css({
            display: "inherit",
            left: rect.left + 'px',
            top: rect.top + 'px',
            width: rect.width,
            height: rect.height,
        });
        if (!desmosTool.calc) desmosTool.calc = Desmos.GraphingCalculator(desmosTool.desmos[0]);
    }
});

function undo(event) {
    let item = project.activeLayer.lastChild;
    if (item) {
        mementos.push(item);
        item.remove();
        $("#redoButton").removeAttr("disabled");
    }
}

function redo(event) {
    let item = mementos.pop();
    if (mementos.length == 0) $("#redoButton").prop('disabled', true);
    if (item) project.activeLayer.addChild(item);
}

function clearUndo() {
    mementos.length = 0;
    $("#redoButton").prop('disabled', true);
}

// find last index where fn(array[index]) is truthy
function lastIndexOf(array, fn) {
    let index = array.length - 1;
    for (; index >= 0; index--) { if (fn(array[index])) break; }
    return index;
}

// get data at path
function pathData(path) {
    let data = doc.data;
    path.forEach(item => { data = data[item] });
    return data;
}

// Find the JSON to be serialized for path
// the deepest where data is ["Class", {...}]
function getData(path) {
    let result, slice, index = path.length;

    for (; index > 0; index--) {
        slice = path.slice(0, index);
        result = pathData(slice);
        if (typeof result[0] === 'string') { break }
    }
    return { path: slice, data: result };
}

// find 
function getPaperObj(path) {
    let paperPath = path.filter((item, index) => (index - 2) % 3); // drop 2,5,8...
    let curObj = project;
    let testObj, action;
    for (let ii = 0; ii < paperPath.length; ii += 2) { // increment is 2!
        testObj = curObj[paperPath[ii]][paperPath[ii + 1]]; // each pair in path is .param[index]
        if (testObj) curObj = testObj;
        else return { o: curObj, a: "addChild" };
    }
    return { o: curObj, a: "replaceWith" };
}

function replaceData(op) {
    //debugger;
    //if(op.p.length === 1 && op.p[0] === "layers" && op.oi && !op.oi.length) // {p: ["layers"], li: []}
    //    return project.clear();
    let { path, data } = getData(op.p);
    let params = { insert: false };
    Object.assign(params, data[1]);
    let newObj = new paper[data[0]](params);
    //debugger;
    let paperObj = getPaperObj(path);
    return paperObj.o[paperObj.a](newObj);
}