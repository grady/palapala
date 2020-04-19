"use strict";

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
    setSize();  
}

function setSize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

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

function pointerDown(event) {
    let pointer = new Pointer(event.pointerId, event.clientX, event.clientY);
    ctx.strokeStyle = $("#colorPicker").spectrum("get").toRgbString();
    draw(event, pointer);
}

function pointerMove(event) {
    let pointer = pointerMap[event.pointerId];
    if (pointer) {
        draw(event, pointer);
    }
}

function pointerDelete(event) {
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
