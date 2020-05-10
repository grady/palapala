let mementos = [];
let conn;
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
            project.clear();
            (new Layer()).activate();
            new Path();
            doc.create({ layers: project.exportJSON({ asString: false }), desmos: null });
        } else {
            project.importJSON(doc.data.layers);
            if (doc.data.desmos) {
                desmosTool.desmos.css(doc.data.desmos.css);
                if (!desmosTool.calc)
                    initDesmos();
                if (doc.data.desmos.state){
                    desmosTool.setState = true;
                    desmosTool.calc.setState(doc.data.desmos.state);
                }
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
                    console.log('setState', doc.data.desmos.state);
                    desmosTool.setState = true;
                    desmosTool.calc.setState(doc.data.desmos.state);
                }
            });
        }
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

function newLayer(blendMode) {
    let newLayer = blendMode ? new Layer({ blendMode: blendMode }) : new Layer();
    newLayer.activate();
    new Path();
    doc.submitOp([{ p: ["layers", newLayer.index], li: newLayer.exportJSON({ asString: false }) }]);
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
    onMouseDown: function (event) {
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
    onMouseDown: function (event) {
        brushTool.path = new Path({ closed: true, fillColor: project.currentStyle.strokeColor, strokeWidth: 1, segments: [event.point] })
        brushTool.leftPath = new Path({ fillColor: project.currentStyle.strokeColor.clone(), strokeWidth: 0, segments: [event.point], insert: false })
        brushTool.rightPath = new Path({ insert: false })
    },
    onMouseDrag: function (event) {
        let diff = event.delta;
        let force = event.event.type === "touchmove" ? event.event.changedTouches[0].force ** 2 : 1;
        diff.angle += 90;
        diff.length = Math.max(1, force * project.currentStyle.strokeWidth);
        let lp = event.point - diff, rp = event.point + diff;
        brushTool.path.insertSegments(event.count, [lp, rp]);
        brushTool.leftPath.add(lp);
        brushTool.rightPath.add(rp);
    },
    onMouseUp: function (event) {
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
    onMouseDown: function (event) {
        eraseTool.path = new Path({
            strokeWidth: project.currentStyle.strokeWidth * (event.modifiers.shift ? 20 : 5),
            blendMode: "destination-out"
        });
    },
    onMouseDrag: function (event) {
        eraseTool.path.add(event.point);
    },
    onMouseUp: function (event) {
        eraseTool.path.simplify();
        submitPath(eraseTool.path);
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
    },
    onMouseUp: function (event) {
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
    onMouseDrag: function (event) {
        lineTool.path.lastSegment.point.set(event.point);
        if (event.modifiers.shift) lineTool.path.firstSegment.point.set(lineMirror(event));
        lineTool.path.firstSegment.point.set(event.modifiers.shift ? lineMirror(event) : event.downPoint);
    },
    onMouseUp: function (event) {
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
        submitPath(rectTool.path);
        rectTool.path = null
    }
});

const highlightTool = new Tool({
    name: "highlight",
    path: null,
    onMouseDown: function (event) {
        highlightTool.path = new Path({ strokeWidth: project.currentStyle.strokeWidth * 5 });
        highlightTool.path.strokeColor.alpha = 0.4;
    },
    onMouseDrag: event => highlightTool.path.add(event.point),
    onMouseUp: function (event) {
        submitPath(highlightTool.path);
        highlightTool.path = null
    }
});

const axesTool = new Tool({
    name: "axes",
    path: null,
    onMouseDown: function (event) {
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
        xaxis.firstSegment.point.setX(event.point.x);
        xaxis.lastSegment.point.setX(event.modifiers.shift ? mirror.x : event.downPoint.x);
        yaxis.firstSegment.point.setY(event.point.y);
        yaxis.lastSegment.point.setY(event.modifiers.shift ? mirror.y : event.downPoint.y);
    },
    onMouseUp: function (event) {
        submitPath(axesTool.path);
        axesTool.path = null
    }
});

const desmosTool = new Tool({
    name: "desmos",
    desmos: $("#desmos"),
    calc: null,
    path: null,
    setState: false,
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
        let css = {
            display: "inherit",
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
        }
        desmosTool.desmos.css(css);

        if (!desmosTool.calc) {
            initDesmos();
        }
        doc.submitOp([{ p: ["desmos"], oi: { css: css, state: desmosTool.calc.getState() } }]);
    }
});

function initDesmos() {
    if (!desmosTool.calc) {
        desmosTool.calc = Desmos.GraphingCalculator(desmosTool.desmos[0], { expressionsCollapsed: true });
        if (doc.data.desmos && doc.data.desmos.state){
            desmosTool.setState = true;
            desmosTool.calc.setState(doc.data.desmos.state);
        }
        desmosTool.calc.observeEvent('change', function () {
            // was this triggered by setState?
            if (desmosTool.setState){
                desmosTool.setState = false;
                return;
            }
            if (!globals.isequal(doc.data.desmos.state, desmosTool.calc.getState())) {
                console.log("submitOp", desmosTool.calc.getState());
                doc.submitOp([{ p: ["desmos", "state"], oi: desmosTool.calc.getState() }]);
            }
        });
    }
}

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

function replaceData(op) {
    if (op.p.length == 1 && op.od) {
        project.clear();
        project.importJSON(op.oi);
        return;
    }
    let path = op.p.filter((item, index) => (index - 2) % 3);
    let testObj, oldObj = project;
    for (let ii = 0; ii < path.length; ii += 2) {
        testObj = oldObj[path[ii]][path[ii + 1]];
        if (testObj) oldObj = testObj;
    }
    oldObj.importJSON(op.li);
}