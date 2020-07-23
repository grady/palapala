import $ from 'jquery';
import paper from 'paper';

import 'bootstrap';
//import 'bootstrap/dist/css/bootstrap.min.css'

import 'spectrum-colorpicker';
//import 'spectrum-colorpicker/spectrum.css';

import * as tools from './tools';


$(() => {
  globals.paper = paper;
  paper.setup("canvas");
  $("#colorPicker").spectrum({
    preferredFormat: "hex",
    showPalette: true,
    showPaletteOnly: true,
    togglePaletteOnly: true,
    togglePaletteMoreText: ">",
    togglePaletteLessText: "<",
    hideAfterPaletteSelect: true,
    palette: [
      ["black", "red", "whitesmoke"],
      ["mediumseagreen", "mediumblue", "gold"],
      ["mediumorchid", "darkorange", "turquoise"]
    ],
    showAlpha: true,
    replacerClassName: "bg-primary",
    change: color => paper.project.currentStyle.strokeColor.set(color.toRgbString())
  });

  $("#sizeSlider").change(event => paper.project.currentStyle.strokeWidth = event.target.value);
  $(".sp-container").addClass("bg-secondary");
  $(".sp-dd").remove();

  $("input[name=tool]").click(event => {
    let tool = paper.tools.find(tool => tool.name === event.target.value);
    tool.activate();
    if(tool.desmos) 
      tool.desmos.css({ zIndex: 1, opacity: 0.95});
    else 
      $("#desmos").css({zIndex: "initial", opacity: 1});
  });

  $("#penButton input").trigger("click");

  $("#lockButton").click(tools.setLock);

  $("#clearButton").click(tools.clearProject);

  paper.project.currentStyle = {
    strokeColor: new paper.Color($("#colorPicker").spectrum("get").toRgbString()),
    strokeWidth: $("#sizeSlider").val(),
    strokeCap: "round",
    strokeJoin: "round",
  }
  tools.connect();
});

$(window).on("load", () => {
  $("#desmosButton").removeClass("disabled")
});