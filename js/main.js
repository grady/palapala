"use strict";

//import simplify from "../lib/simplify-js-1.2.4/simplify";

$("#colorPicker").spectrum({
    preferredFormat: "hex",
    showPalette: true,
    showPaletteOnly: true,
    togglePaletteOnly: true,
    togglePaletteMoreText: '>',
    togglePaletteLessText: '<',
    palette: [["black"], ["red"], ["mediumseagreen"], ["mediumblue"], ["rebeccapurple"], ["darkorange"]],
    replacerClassName: "sp-replacer bg-secondary",
});

let canvas;
let ctx;
let pointerMap = {};
let lines = [];

window.addEventListener('load', init);
window.addEventListener('resize', setSize);

function init() {
    canvas = document.getElementById("canvas");
    ctx = canvas.getContext("2d", { desynchronized: true });
    canvas.addEventListener('pointerdown', pointerDown);
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerleave', pointerDelete);
    canvas.addEventListener('pointerup', pointerDelete);
    ctx.lineJoin = "round";
    setSize();  
}

function setSize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    for(let i=0;i<lines.length;i++){
        drawLine(lines[i]);
    }
}

function draw(event, pointer) {
    pointer.setPos(event);
    ctx.lineWidth = event.pressure ? event.pressure * 8 : 4;
    ctx.beginPath();
    ctx.moveTo(pointer.pos0.x, pointer.pos0.y);
    ctx.lineTo(pointer.pos1.x, pointer.pos1.y);
    ctx.stroke();
    pointer.pos0.x = pointer.pos1.x;
    pointer.pos0.y = pointer.pos1.y;
}

function drawLine(line, config){
    ctx.save();
    if(config && config.color) ctx.strokeStyle = config.color;
    ctx.strokeStyle = line[0].color;
    ctx.lineWidth = line[0].width;
    ctx.beginPath();
    ctx.moveTo(line[0].x, line[0].y);
    for (let i=1; i < line.length; i++){
        ctx.lineTo(line[i].x, line[i].y);
    }
    ctx.stroke();
    ctx.restore();
}

function pointerDown(event) {
    let pointer = new Pointer(event.pointerId, event.clientX, event.clientY);
    ctx.strokeStyle = $("#colorPicker").spectrum("get").toRgbString();
    lines.push([{x: event.clientX, y: event.clientY, color: ctx.strokeStyle, width: event.pressure ? event.pressure * 8 : 4}]);
    draw(event, pointer);
}

function pointerMove(event) {
    let pointer = pointerMap[event.pointerId];
    if (pointer) {
        lines[lines.length - 1].push({x: event.clientX, y: event.clientY});
        draw(event, pointer);
    }
}

function pointerDelete(event) {
    if(pointerMap[event.pointerId]){
        let line = lines.pop();
        lines.push(simplify(line, 0.5));
    }
    Pointer.delete(event.pointerId);
}

class Brush {

    constructor() {

    }
    setMode() {

    }
}

class Pointer {
    constructor(id, x = -1, y = -1) {
        this.id = id;
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
