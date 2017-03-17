define([
  'base/js/namespace',
  'nbextensions/jupyter-canvas/node_modules/d3/build/d3',
], function(
  Jupyter,
  d3
) {
  //Allow zooming & panning of the canvas.
  function zoomed(){
    var transform = d3.event.transform;
    d3.select('#notebook')
      .style("transform", "translate(" + Math.round(transform.x) + "px," + Math.round(transform.y) + "px) scale(" + transform.k + ")");

    //Fix codemirror cursor. CM sets an absolute position for the cursor, based on where it really appears on the screen
    // (using getClientBoundingRect) This then gets transformed, resulting in it "overshooting".
    //
    // If the textbox element is at coords 5,5 and we are zoomed to 2x (so element is appearing on the screen at 10,10),
    // then CodeMirror sets absolute position of cursor to 10,10, which then gets tranformed and actually gets painted at 20,20.
    // "Fix" by locally reversing the scale transform.
    d3.selectAll('.CodeMirror-cursors')
      .style("transform", "scale(" + 1/transform.k + ")");

    //This div contains the "highlight" backgrounds, which are also set absolutely.
    $('.CodeMirror-lines div:nth-child(1) div:nth-child(3)')
      .css("transform", "scale(" + 1/transform.k + ")");
  }
  function zoomFilter(){
    //Only respond to left-mouse-button on the notebook / notebook_panel.
    // Do not start zooming / interfere with text selection etc.
    return !event.button && (event.target.id === 'notebook' || event.target.id === 'notebook_panel' || event.type === 'wheel');
  }

  function endZoom(){
    $('.CodeMirror').each(function(i, el){
      el.CodeMirror.refresh();
    });
  }

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
    var draggedCell = this.closest('.cell');
    cellStartPosition = getTransform(draggedCell);

    mouseStartPosition.x = d3.event.sourceEvent.pageX;
    mouseStartPosition.y = d3.event.sourceEvent.pageY;
  }

  function dragged() {
    var draggedCell = this.closest('.cell');

    //Figure out how much the mouse has moved during this drag.
    let mouseMoved = {};
    mouseMoved.x = d3.event.sourceEvent.pageX - mouseStartPosition.x;
    mouseMoved.y = d3.event.sourceEvent.pageY - mouseStartPosition.y;

    //If we are zoomed in, 10 px of the mouse might only correspond to less actual movement, & vice versa.
    var currentZoom = getTransform('#notebook').k;
    mouseMoved.x /= currentZoom;
    mouseMoved.y /= currentZoom;

    //New position of cell should be its starting location + whatever the mouse has moved by.
    d3.select(draggedCell).style("transform", "translate(" + (cellStartPosition.x + mouseMoved.x) + "px," + (cellStartPosition.y + mouseMoved.y) + "px)");
  }

  function endDrag(){
    var draggedCellObj = Jupyter.notebook.get_cells().find( (cell) => cell.element[0] == this.closest('.cell') );

    //Set x & y properties on the metadata of the cell so we store its position (these get saved and persisted across reloads).
    var transform = getTransform(this.closest('.cell'));
    draggedCellObj.metadata.x = transform.x;
    draggedCellObj.metadata.y = transform.y;
  }

  function makeDraggable(selection){
    selection.call(d3.drag().on('start', startDrag).on("drag", dragged).on("end", endDrag));
  }

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


    //This sits at the bottom of CodeMirror's textarea (to keep the height of the box, so scrolling can go there?), but is now too long.
    $('.CodeMirror-scroll > div:nth-child(2)').remove();

    $('.end_space').remove();

    var runningTotalHeight = 0;
    $('.cell').each(function(idx, cell){
      //Get the metadata properties of the cell.
      var cellObj = Jupyter.notebook.get_cells().find( (cell) => cell.element[0] == this.closest('.cell') );

      if( cellObj.metadata.x && cellObj.metadata.y ){
        d3.select(cell).style("transform", "translate("+cellObj.metadata.x+"px, "+cellObj.metadata.y+"px)");
      }
      else{
        //Default to stacking up in a column (eg. for notebooks created without this plugin).
        d3.select(cell).style("transform", "translate(0px, "+runningTotalHeight+"px)");
        runningTotalHeight += $(cell).height() + 30;
      }
    });

    //Add background zoom behaviour:
    var zoom = d3.select('#notebook_panel').call(d3.zoom().filter(zoomFilter).on("zoom", zoomed).on("end", endZoom));

    //Make all initial cells draggable:
    makeDraggable( d3.selectAll(".cell .input_prompt, .cell .out_prompt_overlay") );

  }

  return {
    load_ipython_extension: load_ipython_extension
  };
});

