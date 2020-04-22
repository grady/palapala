"use strict";

//import simplify from "../lib/simplify-js-1.2.4/simplify";

$(document).ready(init);

let canvas;
let ctx;
let pointerMap = {};
let lines = [];

//window.addEventListener('load', init);
//window.addEventListener('resize', setSize);
function init() {
  canvas = document.getElementById("canvas");
  ctx = canvas.getContext("2d", { desynchronized: true });
  lines = JSON.parse(window.localStorage.getItem("lines")) || [];  
  setSize();    
  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerleave', pointerDelete);
  canvas.addEventListener('pointerup', pointerDelete);

  $(window).resize(setSize);
  $("#clearButton").click(clearCanvas);
  $("#colorPicker").spectrum({
    preferredFormat: "hex",
    showPalette: true,
    showPaletteOnly: true,
    togglePaletteOnly: true,
    togglePaletteMoreText: '>',
    togglePaletteLessText: '<',
    palette: [["black", "red"], ["mediumseagreen", "mediumblue"], ["mediumorchid", "darkorange"]],
    replacerClassName: "sp-replacer btn btn-secondary bg-secondary",
  });
}

function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  lines = [];
  window.localStorage.removeItem("lines");
}

function setSize() {
  canvas.width = window.innerWidth - 1;
  canvas.height = window.innerHeight - 1;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (let i = 0; i < lines.length; i++) {
    drawLine(lines[i]);
  }
}

function draw(event, pointer) {
  pointer.setPos(event);
  ctx.lineWidth = $("#sizeSlider").val() * (event.pressure ? event.pressure * 2 : 1);
  ctx.beginPath();
  ctx.moveTo(pointer.pos0.x, pointer.pos0.y);
  ctx.lineTo(pointer.pos1.x, pointer.pos1.y);
  ctx.stroke();
  pointer.pos0.x = pointer.pos1.x;
  pointer.pos0.y = pointer.pos1.y;
}

function drawLine(line) {
  ctx.save();
  ctx.strokeStyle = line[0].strokeStyle;
  ctx.lineWidth = line[0].width;
  ctx.beginPath();
  ctx.moveTo(line[0].x, line[0].y);
  for (let i = 1; i < line.length; i++) {
    ctx.lineTo(line[i].x, line[i].y);
    if (line[i].width !== line[i - 1].width) {
      ctx.stroke();
      ctx.lineWidth = line[i].width;
      ctx.beginPath();
      ctx.moveTo(line[i].x, line[i].y);
    }
  }
  ctx.stroke();
  ctx.restore();
}

function pointerDown(event) {
  let pointer = new Pointer(event.pointerId, event.clientX, event.clientY, $("input[name='tool']:checked").val());
  let scale = $("#sizeSlider").val();
  if (pointer.mode === "pen") {
    ctx.strokeStyle = $("#colorPicker").spectrum("get").toRgbString();
    lines.push([{
      x: event.clientX, y: event.clientY, strokeStyle: ctx.strokeStyle,
      width: getWidth(event)
    }]);
    draw(event, pointer);
  } else {
    clearCircle({ x: event.clientX, y: event.clientY }, $("#sizeSlider").val() * 2);
  }
}

function getWidth(event) {
  return $("#sizeSlider").val() * (event.pressure ? event.pressure * 2 : 1)
}

function pointerMove(event) {
  let pointer = pointerMap[event.pointerId];
  if (pointer) {
    if (pointer.mode === "pen") {
      lines[lines.length - 1].push({
        x: event.clientX, y: event.clientY,
        width: getWidth(event)
      });
      draw(event, pointer);
    } else {
      clearCircle({ x: event.clientX, y: event.clientY }, $("#sizeSlider").val() * 2);
    }
  }
}

function pointerDelete(event) {
  let pointer = pointerMap[event.pointerID];
  if (pointer) {
    switch (pointer.mode) {
      case "erase":
        break;
      default:
        lines.push(simplify(lines.pop(), 0.5));
    }
  }
  window.localStorage.setItem("lines", JSON.stringify(lines));
  Pointer.delete(event.pointerId);
}

class Brush {

  constructor() {

  }
  setMode() {

  }
}

class Pointer {
  constructor(id, x = -1, y = -1, mode) {
    this.id = id;
    this.mode = mode;
    this.pos0 = { x: x, y: y };
    this.pos1 = { x: x, y: y };
    pointerMap[id] = this;
  }
  setPos(event) {
    this.pos1.x = event.clientX;
    this.pos1.y = event.clientY;
  }
  static delete(id) {
    delete pointerMap[id];
  }
}

function clearCircle(pos, radius) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radius, 0, 2 * Math.PI, false);
  ctx.clip();
  ctx.clearRect(pos.x - radius - 1, pos.y - radius - 1,
    radius * 2 + 2, radius * 2 + 2);
  ctx.restore();
}