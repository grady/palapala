"use strict";

$("#colorPicker").spectrum({
    change: function(color){ctx.strokeStyle = color.toRgbString();},
    color: "black",
    preferredFormat: "hex",
    showPalette: true,

    palette: [["black"], ["darkred"],["seagreen"],["navy"],["indigo"], ["chocolate"]]
});

let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d", {desynchronized: true});
let pointerMap = {};
let lines = [];

window.addEventListener('load', init);
window.addEventListener('resize', init);

canvas.addEventListener('pointerdown', pointerDown);
canvas.addEventListener('pointermove', pointerMove);
canvas.addEventListener('pointerleave', pointerDelete);
canvas.addEventListener('pointerup', pointerDelete);



function init(){
    canvas.height = document.body.clientHeight;
    canvas.width = document.body.clientWidth;
    ctx.imageSmoothingEnabled = true;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

}

function draw(event, pointer){
    pointer.setPos(event);
    ctx.lineWidth = event.pressure ? event.pressure * 8 : 4;
    ctx.beginPath();
    ctx.moveTo(pointer.pos0.x, pointer.pos0.y);
    ctx.lineTo(pointer.pos1.x, pointer.pos1.y);
    ctx.stroke();
    pointer.pos0.x = pointer.pos1.x;
    pointer.pos0.y = pointer.pos1.y;
}

function pointerDown(event){
    let pointer = new Pointer(event.pointerId, event.clientX, event.clientY);
    draw(event, pointer);
}

function pointerMove(event){
    let pointer = pointerMap[event.pointerId];
    if(pointer){        
        draw(event, pointer);
    }
}

function pointerDelete(event){
    Pointer.delete(event.pointerId);
}

class Pointer {
    constructor(id, x=-1, y=-1){
        this.id = id;
        this.pos0 = {x: x, y: y};
        this.pos1 = {x: x, y: y};
        pointerMap[id] = this;
    }
    setPos(event){
        this.pos1.x = event.clientX;
        this.pos1.y = event.clientY;
    }
    static delete(id){
        delete pointerMap[id];  
    }
}