"use strict";

//import simplify from "../lib/simplify-js-1.2.4/simplify";

$(document).ready(init);


let canvas;
let ctx;
const pointerMap = {};
let lines = [];

function init() {
    canvas = document.getElementById("canvas");
    ctx = canvas.getContext("2d", { desynchronized: false });

    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerleave", pointerDelete);
    canvas.addEventListener("pointerup", pointerDelete);

    lines = JSON.parse(window.localStorage.getItem("lines")) || [];
    $(window).resize(setSize);
    setSize();

    $("#clearButton").click(clearCanvas);
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
    
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    lines = [];
    window.localStorage.removeItem("lines");

}

function setSize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (let i = 0; i < lines.length; i++) {
        drawLine(lines[i]);
    }
}

function draw(event, pointer) {
    pointer.setPos(event);
    let newWidth = $("#sizeSlider").val() * (event.pressure * 3 || 1);
    ctx.lineWidth *= (newWidth + 20)/(ctx.lineWidth+20);
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
        if(line[i].width !== line[i - 1].width){
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
    let pointer = new Pointer(event);
    let scale = $("#sizeSlider").val();
    if(pointer.mode === "pen"){
    ctx.strokeStyle = $("#colorPicker").spectrum("get").toRgbString();
    lines.push([{
        x: event.clientX, y: event.clientY, strokeStyle: ctx.strokeStyle,
        width: scale * (event.pressure * 3 || 1)
    }]);
    draw(event, pointer);
    }  else {
        clearCircle({x: event.clientX, y: event.clientY}, $("#sizeSlider").val()*5);
    }
}

function pointerMove(event) {
    let pointer = pointerMap[event.pointerId];
    let scale = $("#sizeSlider").val();
    if (pointer) {
        if (pointer.mode === "pen"){
            lines[lines.length - 1].push({
                x: event.clientX, y: event.clientY,
                width: scale * (event.pressure * 3 || 1)
            });
            draw(event, pointer);
        } else{
            clearCircle({x: event.clientX, y: event.clientY}, $("#sizeSlider").val()*5);
        }
    }
}

function pointerDelete(event) {
    if (pointerMap[event.pointerId]){
        if(pointerMap[event.pointerId].mode === "pen"){
            //console.log(pointerMap[event.pointerId]);
            lines.push(simplify(lines.pop(), 0.5));
            window.localStorage.setItem("lines", JSON.stringify(lines));
        }
    }
    Pointer.delete(event.pointerId);
}

class Pointer {
    constructor(event) {
        this.id = event.pointerId;
        this.mode = $("input[name='tool']:checked").val();
        this.scale = $("#sizeSlider").val();
        this.pos0 = { x: event.clientX, y: event.clientY, pressure: event.pressure || 1};
        this.pos1 = { x: this.pos0.x, y: this.pos0.y , pressure: this.pos0.pressure};
        pointerMap[this.id] = this;
    }
    setPos(event) {
        this.pos1.x = event.clientX;
        this.pos1.y = event.clientY;
        this.pos1.pressure = event.pressure || 1;
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
};