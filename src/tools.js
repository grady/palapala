import $ from 'jquery';
import ReconnectingWebSocket from 'reconnecting-websocket';
import ShareDb from 'sharedb/lib/client';
import paper from 'paper';
import isequal from 'lodash.isequal';

let doc;

export function clearProject() {
  resetProject();
  doc.submitOp([{ p: ["layers"], od: doc.data.layers, oi: paper.project.exportJSON({ asString: false }) }]);
}

function resetProject() {
  paper.project.clear();
  (new paper.Layer({ name: "mainLayer" })).activate();
  new paper.Path();
  (new paper.Layer({ name: "toolLayer" })).activate();
  new paper.Path();
}

export function setLock(event) {
  doc.submitOp([{ p: ["edit"], oi: event.target.checked }]);
}

function updateLock() {
  $("#lockButton").prop("checked", doc.data.edit);
  let edit = doc.data.owner || doc.data.edit;
  $("#toolbar").toggle(edit);
  if (!edit) $("#handButton input").trigger("click");
}

export function connect() {
  let url = new URL(document.location);
  let id = window.location.pathname.split("/").filter(v => v)[0];
  url.protocol = (url.protocol === "https:") ? "wss:" : "ws:";
  let socket = new ReconnectingWebSocket(url.href);
  let conn = new ShareDb.Connection(socket);
  doc = conn.get('palapala', id);
  doc.on('load', () => {
    if (doc.type == null) {
      resetProject();
      doc.create({
        layers: paper.project.exportJSON({ asString: false }),
        desmos: null,
        undo: []
      });
    } else {
      console.log(doc);
      paper.project.clear();
      paper.project.importJSON(doc.data.layers);
      if (doc.data.desmos) {
        desmosTool.initDesmos();
        desmosTool.path.importJSON(doc.data.desmos.rect);
        desmosTool.setPosition();
        desmosTool.setState(doc.data.desmos.state);
      }
      console.log(doc.data.owner, doc.data.edit);
      if (!doc.data.owner) $("#documentBar").hide();
      updateLock();
    }
  });

  doc.on('op', (op, source) => {
    if (!source) {
      console.log(op)
      op.forEach(item => {
        switch (item.p[0]) {
          case "layers":
            replaceData(item);
            break;
          case "edit":
            updateLock();
            break;
          case "desmos":
            if (doc.data.desmos) {
              desmosTool.initDesmos();
              desmosTool.path.importJSON(doc.data.desmos.rect);
              desmosTool.setPosition();
              desmosTool.setState(doc.data.desmos.state);
            } else {
              desmosTool.destroyDesmos();
            }
            break;
        }
      });
    }
  });
  doc.on('error', (err) => { console.log(err.message) });
  doc.subscribe();
}

function submitPath(path) {
  paper.project.layers["mainLayer"].addChild(path);
  doc.submitOp([{
    p: ["layers", paper.project.layers["mainLayer"].index, 1, "children", path.index],
    li: path.exportJSON({ asString: false })
  }]);
}

function replaceData(op) {
  if (op.p.length == 1 && op.od) {
    paper.project.clear();
    paper.project.importJSON(op.oi);
    return;
  }
  let path = op.p.filter((item, index) => (index - 2) % 3);
  let testObj, oldObj = paper.project;
  for (let ii = 0; ii < path.length; ii += 2) { // ["layers", 0, /*1*/, "children", 3, /*1*/, ... ]
    testObj = oldObj[path[ii]][path[ii + 1]];
    if (testObj) oldObj = testObj;
  }
  if (op.ld) oldObj.remove();
  if (op.li) oldObj.importJSON(op.li);
}

function cssPosition(rectangle) {
  if (!rectangle.intersects(paper.view.bounds)) {
    return { display: "none" }
  }
  let topLeft = paper.view.projectToView(rectangle.topLeft);
  let size = paper.view.projectToView(rectangle.bottomRight).subtract(topLeft).abs();
  return { left: topLeft.x, top: topLeft.y, width: size.x, height: size.y, display: "initial" }
}

const penTool = new paper.Tool({
  name: "pen",
  minDistance: 2,
  path: null,
  onMouseDown: (event) => {
    penTool.path = new paper.Path({
      strokeColor: paper.project.currentStyle.strokeColor.clone(),
      strokeWidth: paper.project.currentStyle.strokeWidth
    });
  },
  onMouseDrag: (event) => {
    if (penTool.path) penTool.path.add(event.point);
  },
  onMouseUp: (event) => {
    penTool.path.simplify();
    if (penTool.path.segments.length === 0) {
      penTool.path = new paper.Path.Circle({
        center: event.point,
        radius: penTool.path.strokeWidth / 2,
        strokeWidth: null,
        fillColor: penTool.path.strokeColor
      });
    }
    submitPath(penTool.path);
    penTool.path = null;
  }
});

const eraseTool = new paper.Tool({
  name: "erase",
  path: null,
  onMouseDown: (event) => {
    eraseTool.path = new paper.Path({
      strokeWidth: paper.project.currentStyle.strokeWidth * (event.modifiers.shift ? 20 : 5),
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

const handTool = new paper.Tool({
  name: "hand",
  minDistance: 1,
  lastPoint: null,
  onMouseDown: event => {
    handTool.lastPoint = paper.view.projectToView(event.point);
  },
  onMouseDrag: event => {
    let last = paper.view.viewToProject(handTool.lastPoint);
    handTool.lastPoint = paper.view.projectToView(event.point);
    paper.view.scrollBy(last.subtract(event.point));
    if (desmosTool.desmos) {
      desmosTool.desmos.css(cssPosition(desmosTool.path.bounds));
    }
  }
});


const highlightTool = new paper.Tool({
  name: "highlight",
  path: null,
  minDistance: 2,
  onMouseDown: (event) => {
    highlightTool.path = new paper.Path({ strokeWidth: paper.project.currentStyle.strokeWidth * 5 });
    highlightTool.path.strokeColor.alpha = 0.4;
  },
  onMouseDrag: event => highlightTool.path.add(event.point),
  onMouseUp: (event) => {
    submitPath(highlightTool.path);
    highlightTool.path = null
  }
});

const lineTool = new paper.Tool({
  name: "line",
  path: null,
  onMouseDown: event => {
    lineTool.path = new paper.Path([event.point, event.point])
  },
  onMouseDrag: (event) => {
    lineTool.path.lastSegment.point.set(event.point);
    lineTool.path.firstSegment.point.set(event.modifiers.shift ? lineMirror(event) : event.downPoint);
  },
  onMouseUp: (event) => {
    submitPath(lineTool.path);
    lineTool.path = null;
  },
});

function lineMirror(event) {
  return event.downPoint.subtract(event.point.subtract(event.downPoint));
}

const desmosTool = new paper.Tool({
  name: "desmos",
  desmos: null,
  calc: null,
  path: null,
  //setState: false,
  localChange: false,
  onMouseDown: (event) => {
    console.log("desmosTool");
    if (event.event.button === 2 && desmosTool.calc) {
      desmosTool.destroyDesmos();
      doc.submitOp([{ p: ["desmos"], oi: null }]);
      event.preventDefault();
    } else {
      if (!desmosTool.path) {
        desmosTool.path = new paper.Shape.Rectangle({ from: event.point, to: event.point, strokeWidth: 1 });
      } else if (event.event.button !== 2) {
        desmosTool.path.visible = true;
      }
    }
  },
  onMouseDrag: (event) => {
    if (event.downPoint.subtract(event.point).length < 20) return;
    if (desmosTool.path) {
      desmosTool.path.size.set(event.point.subtract(event.downPoint));
      desmosTool.path.position.set(event.downPoint.add(event.point).divide(2));
    }
  },
  onMouseUp: (event) => {
    //    debugger;
    if (desmosTool.path && event.event.button !== 2) {
      desmosTool.initDesmos();
      desmosTool.desmos.css({ zIndex: 1, opacity: 0.95 });
      desmosTool.setPosition();
      desmosTool.path.visible = false;
      doc.submitOp([{ p: ["desmos"], oi: { rect: desmosTool.path.exportJSON({ asString: false }), state: desmosTool.calc.getState() } }]);
    }
  },
  setPosition: () => {
    let css = cssPosition(desmosTool.path.bounds);
    if (!isequal(css, desmosTool.desmos.css(['left', 'top', 'width', 'height'])))
      desmosTool.desmos.css(css);
  },
  changeWatcher: () => {
    if (!desmosTool.localChange) {
      let state = desmosTool.calc.getState();
      if (!isequal(doc.data.desmos.state, state)) {
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
    if (!desmosTool.path) {
      desmosTool.path = new paper.Shape.Rectangle({ strokeWidth: 1, visible: false });
    }
    if (!desmosTool.desmos) {
      desmosTool.desmos = $("<div id='desmos' style='position:absolute;'></div>");
      desmosTool.desmos.insertBefore("#canvas");
    }
    if (!desmosTool.calc) {
      desmosTool.calc = Desmos.GraphingCalculator(desmosTool.desmos[0], { expressionsCollapsed: true });
      desmosTool.calc.observeEvent("change", desmosTool.changeWatcher);
    }
  },
  destroyDesmos: () => {
    if (desmosTool.desmos)
      desmosTool.desmos.remove();
    desmosTool.desmos = null;
    if (desmosTool.calc)
      desmosTool.calc.destroy();
    desmosTool.calc = null;
  }
});

