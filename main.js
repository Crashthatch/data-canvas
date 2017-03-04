define([
  'base/js/namespace',
  'nbextensions/jupyter-canvas/node_modules/d3/build/d3',
], function(
  Jupyter,
  d3
) {

  let cellGraph = {}

  function load_ipython_extension() {
    console.log(
      'This is the current notebook application instance:',
      Jupyter.notebook
    );
    console.log( Jupyter.actions._actions );
    console.log( d3.selectAll('#notebook') );

    //Inject our CSS:
    var $link = $('<link rel="stylesheet" type="text/css" href="/nbextensions/jupyter-canvas/style.css">');
    $('head').append($link);


    //Allow zooming & panning of the canvas.
    var zoomed = function(){
      var transform = d3.event.transform;
      d3.select('#notebook')
        .style("transform", "translate(" + transform.x + "px," + transform.y + "px) scale(" + transform.k + ")");
    }
    var zoom = d3.selectAll('#notebook_panel').call(d3.zoom().on("zoom", zoomed));

    function getTransform(elt){
      let transform = d3.select(elt).style('transform');
      if( transform != "none" ){
        transform = transform.replace(/[^0-9\-.,]/g, '').split(',');
        return {x:parseFloat(transform[4]), y: parseFloat(transform[5]), k: parseFloat(transform[0])};
      }
      else{
        return {x: 0, y: 0, k: 1};
      }
    }

    //Allow cells to be dragged to move them around.
    let cellStartPosition, mouseStartPosition = {};
    function startDrag(d){
      cellStartPosition = getTransform(this);

      mouseStartPosition.x = d3.event.x;
      mouseStartPosition.y = d3.event.y;
    }

    function dragged(d) {
      //Figure out how much the mouse has moved during this drag.
      let mouseMoved = {};
      mouseMoved.x = d3.event.x - mouseStartPosition.x;
      mouseMoved.y = d3.event.y - mouseStartPosition.y;

      //If we are zoomed in, 10 px of the mouse might only correspond to less actual movement, & vice versa.
      var currentZoom = getTransform('#notebook').k;
      mouseMoved.x /= currentZoom;
      mouseMoved.y /= currentZoom;


      //New position of cell should be its starting location + whatever the mouse has moved by.
      d3.select(this).style("transform", "translate(" + (cellStartPosition.x + mouseMoved.x) + "px," + (cellStartPosition.y + mouseMoved.y) + "px)");
    }

    var drag = d3.selectAll(".cell").call(d3.drag().on('start', startDrag).on("drag", dragged));

  }

  return {
    load_ipython_extension: load_ipython_extension
  };
});

