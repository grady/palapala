let mementos = [];
let doc;
let id;

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

    $("#sizeSlider").change(event => project.currentStyle.strokeWidth = event.target.value);
    $("#undoButton").click(undo);
    $("#redoButton").click(redo);
    project.currentStyle.strokeColor = $("#colorPicker").spectrum("get").toHexString();
    project.currentStyle.strokeWidth = $("#sizeSlider").val();
    project.currentStyle.strokeCap = "round";
    project.currentStyle.strokeJoin = "round";
    

    globals.paper = paper;

    id = window.location.pathname.split("/").filter(v => v);
    doc = globals.socket().get('palapala', id[0]);
    doc.on('load', function () {
        if (doc.type == null) {
            initProject();
            doc.create({ layers: project.exportJSON({ asString: false }), desmos: null, undo: [] });
        } else {
            project.clear();
            project.importJSON(doc.data.layers);
            if (doc.data.desmos) {
                desmosTool.initDesmos();
                desmosTool.desmos.css(doc.data.desmos.css);
            }
        }
    });
    doc.on('op', function (op, source) {
        if (!source) {
            console.log(op);
            op.filter(i => i.p[0] === "layers").forEach(item => { replaceData(item) });
            op.filter(i => i.p[0] === "desmos").forEach(item => {
                desmosTool.desmos.css(doc.data.desmos.css);
                if (!globals.isequal(doc.data.desmos.state, desmosTool.calc.getState())) {
                    desmosTool.setState(doc.data.desmos.state);
                }
            });
        }
    });
    doc.subscribe();
    
    if(id[1] !== 'view') {
        penTool.activate(); 
    } else {
        $('.main-tools').hide();
        handTool.activate();
    }
    globals.doc = doc;
}

function initProject() {
    project.clear();
    (new Layer({ name: "mainLayer" })).activate();
    new Path();
    (new Layer({ name: "toolLayer" })).activate();
    new Path();
}

function clearProject(event) {
    initProject();
    doc.submitOp([{ p: ["layers"], od: doc.data.layers, oi: project.exportJSON({ asString: false }) }]);
}

function activateTool(name) {
    if (name === "desmos") {
        desmosTool.desmos && desmosTool.desmos.css({ "z-index": 1, "opacity": 0.95 });
    } else if (paper.tool.name === "desmos") {
        desmosTool.desmos && desmosTool.desmos.css({ "z-index": -1, "opacity": 1 });
    }
    tools.find(tool => tool.name === name).activate();
}


function submitPath(path) {
    project.layers["mainLayer"].addChild(path);
    doc.submitOp([{ p: ["layers", project.layers["mainLayer"].index, 1, "children", path.index], li: path.exportJSON({ asString: false }) }]);
}

const handTool = new paper.Tool({
    name: "hand",
    minDistance: 1,
    lastPoint: null,
    onMouseDown: event => {
        lastPoint = paper.view.projectToView(event.point);
    },
    onMouseDrag: event => {
        let point = paper.view.projectToView(event.point);
        let last = paper.view.viewToProject(lastPoint);
        paper.view.scrollBy(last.subtract(event.point));

        let desmos = $("#desmos").offset();
        let delta = point.subtract(lastPoint);
        desmos.top += delta.y;
        desmos.left += delta.x;

        $("#desmos").offset(desmos);
        lastPoint = point;
    },
});

const penTool = new paper.Tool({
    name: "pen",
    minDistance: 2,
    path: null,
    onMouseDown: (event) => {
        penTool.path = new Path({ strokeColor: project.currentStyle.strokeColor.clone(), strokeWidth: project.currentStyle.strokeWidth });
    },
    onMouseDrag: (event) => {
        if (penTool.path) penTool.path.add(event.point);
    },
    onMouseUp: (event) => {
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
        submitPath(penTool.path);
        penTool.path = null;
    }
});

const brushTool = new paper.Tool({
    name: "brush",
    path: null,
    leftPath: null,
    rightPath: null,
    minDistance: 5,
    onMouseDown: (event) => {
        brushTool.path = new Path({ closed: true, fillColor: project.currentStyle.strokeColor, strokeWidth: 1, segments: [event.point] })
        brushTool.leftPath = new Path({ fillColor: project.currentStyle.strokeColor.clone(), strokeWidth: 0, segments: [event.point], insert: false })
        brushTool.rightPath = new Path({ insert: false })
    },
    onMouseDrag: (event) => {
        let diff = event.delta;
        let force = event.event.type === "touchmove" ? event.event.changedTouches[0].force ** 2 : 1;
        diff.angle += 90;
        diff.length = Math.max(1, force * project.currentStyle.strokeWidth);
        let lp = event.point - diff, rp = event.point + diff;
        brushTool.path.insertSegments(event.count, [lp, rp]);
        brushTool.leftPath.add(lp);
        brushTool.rightPath.add(rp);
    },
    onMouseUp: (event) => {
        let leftPath = brushTool.leftPath, rightPath = brushTool.rightPath, path = brushTool.path;
        setTimeout(function () {
            leftPath.add(event.point);
            leftPath.simplify(5);
            rightPath.simplify(5);
            rightPath.reverse();
            leftPath.addSegments(rightPath.segments);
            leftPath.closePath();
            path.replaceWith(leftPath);
            submitPath(leftPath);

        }, 0);
        brushTool.path = null;
        brushTool.leftPath = null;
        brushTool.rightPath = null;
    }
});

const eraseTool = new paper.Tool({
    name: "erase",
    path: null,
    onMouseDown: (event) => {
        eraseTool.path = new Path({
            strokeWidth: project.currentStyle.strokeWidth * (event.modifiers.shift ? 20 : 5),
            blendMode: "destination-out"
        });
    },
    onMouseDrag: (event) => {
        eraseTool.path.add(event.point);
    },
    onMouseUp: (event) => {
        eraseTool.path.simplify();
        submitPath(eraseTool.path);
        eraseTool.path = null;
    }
});

const circleTool = new Tool({
    name: "circle",
    path: null,
    onMouseDown: (event) => {
        circleTool.path = new Shape.Circle(event.point, 10);
    },
    onMouseDrag: (event) => {
        circleTool.path.radius = (event.point - event.downPoint).length;
    },
    onMouseUp: (event) => {
        submitPath(circleTool.path);
        circleTool.path = null;
    }
});

const lineTool = new Tool({
    name: "line",
    path: null,
    onMouseDown: event => {
        lineTool.path = new Path([event.point, event.point])
    },
    onMouseDrag: (event) => {
        lineTool.path.lastSegment.point.set(event.point);
        if (event.modifiers.shift) lineTool.path.firstSegment.point.set(lineMirror(event));
        lineTool.path.firstSegment.point.set(event.modifiers.shift ? lineMirror(event) : event.downPoint);
    },
    onMouseUp: (event) => {
        submitPath(lineTool.path);
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
        rectTool.path = new Shape.Rectangle(event.point, event.point)
    },
    onMouseDrag: (event) => {
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
    onMouseUp: (event) => {
        submitPath(rectTool.path);
        rectTool.path = null
    }
});

const highlightTool = new Tool({
    name: "highlight",
    path: null,
    onMouseDown: (event) => {
        highlightTool.path = new Path({ strokeWidth: project.currentStyle.strokeWidth * 5 });
        highlightTool.path.strokeColor.alpha = 0.4;
    },
    onMouseDrag: event => highlightTool.path.add(event.point),
    onMouseUp: (event) => {
        submitPath(highlightTool.path);
        highlightTool.path = null
    }
});

const axesTool = new Tool({
    name: "axes",
    path: null,
    onMouseDown: (event) => {
        axesTool.path = new CompoundPath({
            children: [
                new Path([event.point, event.point]),
                new Path([event.point, event.point])
            ]
        })
    },
    onMouseDrag: (event) => {
        let xaxis = axesTool.path.firstChild;
        let yaxis = axesTool.path.lastChild;
        let mirror = lineMirror(event);
        xaxis.firstSegment.point.setX(event.point.x);
        xaxis.lastSegment.point.setX(event.modifiers.shift ? mirror.x : event.downPoint.x);
        yaxis.firstSegment.point.setY(event.point.y);
        yaxis.lastSegment.point.setY(event.modifiers.shift ? mirror.y : event.downPoint.y);
    },
    onMouseUp: (event) => {
        submitPath(axesTool.path);
        axesTool.path = null
    }
});

const desmosTool = new Tool({
    name: "desmos",
    desmos: null,
    calc: null,
    path: null,
    //setState: false,
    localChange: false,
    onMouseDown: (event) => {
        if (!desmosTool.calc || event.modifiers.shift) {
            desmosTool.path = new Shape.Rectangle(event.point, event.point);
            desmosTool.path.strokeWidth = 1;
        }
    },
    onMouseDrag: (event) => {
        if (desmosTool.path) {
            desmosTool.path.size.set(event.point - event.downPoint);
            desmosTool.path.position.set((event.downPoint + event.point) / 2);
        }
    },
    onMouseUp: (event) => {
        //    debugger;
        if (desmosTool.path) {
            desmosTool.path.remove();
            desmosTool.path = null;
            let rect = new Rectangle(event.downPoint, event.point);
            let css = {
                display: "inherit",
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
            }
            desmosTool.initDesmos();
            desmosTool.desmos.css(css);
            doc.submitOp([{ p: ["desmos"], oi: { css: css, state: desmosTool.calc.getState() } }]);
        }
    },
    changeWatcher: () => {
        if (!desmosTool.localChange) {
            let state = desmosTool.calc.getState();
            if (!globals.isequal(doc.data.desmos.state, state)) {
                console.log("submitOp", state);
                doc.submitOp([{ p: ["desmos", "state"], oi: state }]);
            }
        }
        else desmosTool.localChange = false;
    },
    setState: (state) => {
        desmosTool.localChange = true;
        desmosTool.calc.setState(state);
        console.log("setState", state);
    },
    initDesmos: () => {
        desmosTool.desmos = $("#desmos");
        if (!desmosTool.calc)
            desmosTool.calc = Desmos.GraphingCalculator(desmosTool.desmos[0], { expressionsCollapsed: true });
        desmosTool.calc.observeEvent("change", desmosTool.changeWatcher);
        if (doc.data.desmos && doc.data.desmos.state)
            desmosTool.setState(doc.data.desmos.state);
    }
});

function undo(event) {
    let item = project.layers["mainLayer"].lastChild;
    if (item) {
        mementos.push(item);
        doc.submitOp([{ p: ["layers", 0, 1, "children", item.index], ld: item.exportJSON({ asString: false }) }]);
        item.remove();
        $("#redoButton").removeAttr("disabled");
    }
}

function redo(event) {
    let item = mementos.pop();
    if (mementos.length == 0) $("#redoButton").prop('disabled', true);
    if (item) {
        project.layers["mainLayer"].addChild(item);
        submitPath(item);
    }
}

function clearUndo() {
    mementos.length = 0;
    $("#redoButton").prop('disabled', true);
}

function replaceData(op) {
    if (op.p.length == 1 && op.od) {
        project.clear();
        project.importJSON(op.oi);
        return;
    }
    let path = op.p.filter((item, index) => (index - 2) % 3);
    let testObj, oldObj = project;
    for (let ii = 0; ii < path.length; ii += 2) { // ["layers", 0, /*1*/, "children", 3, /*1*/, ... ]
        testObj = oldObj[path[ii]][path[ii + 1]];
        if (testObj) oldObj = testObj;
    }
    if (op.ld) oldObj.remove();
    if (op.li) oldObj.importJSON(op.li);
}