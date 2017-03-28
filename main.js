define([
  'base/js/namespace',
  'nbextensions/jupyter-canvas/node_modules/d3/build/d3',
  'nbextensions/jupyter-canvas/node_modules/lodash/lodash'
], function(
  Jupyter,
  d3,
  _
) {
  const CELL_WIDTH = 800; //Must match the CSS style for .cell

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

    debouncedRefreshAllCodeMirrors();
  }
  function zoomFilter(){
    //Only respond to left-mouse-button on the notebook / notebook_panel.
    // Do not start zooming / interfere with text selection etc.
    return !event.button && (event.target.id === 'notebook' || event.target.id === 'notebook_panel' || event.type === 'wheel');
  }

  function refreshAllCodeMirrors(){
    //TODO: Refresh only those on-screen.
    $('.CodeMirror').each(function(i, el){
      el.CodeMirror.refresh();
    });
  }
  var debouncedRefreshAllCodeMirrors = _.debounce(refreshAllCodeMirrors, 400);

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

  function getCanvasTransform(){
    return getTransform('#notebook');
  }

  function getCameraCenter(){
    var screenWidth = $('#notebook_panel').width();
    var screenHeight = $('#notebook_panel').height();

    var canvasTransform = getCanvasTransform();
    return {
      x: (-canvasTransform.x + screenWidth/2) * 1/canvasTransform.k,
      y: (-canvasTransform.y + screenHeight/2) * 1/canvasTransform.k
    }
  }

  function getNewCellPosition(){
    var newPosition = getCameraCenter();
    newPosition.x -= CELL_WIDTH / 2;
    newPosition.y -= 100;

    return newPosition;
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

  function overrideInsertCellHandlers(){
    function createHandler(oldAction){
      return function(env){
        oldAction(env);
        var newCell = Jupyter.notebook.get_selected_cell();

        //Move the new cell to the centre of the current screen (rather than creating it at 0,0)
        var newLocation = getNewCellPosition();
        d3.select(newCell.element[0]).style("transform", "translate(" + newLocation.x + "px," + newLocation.y + "px)");
        newCell.metadata.x = newLocation.x;
        newCell.metadata.y = newLocation.y;

        makeDraggable(d3.select(newCell.element[0]).selectAll(".cell .input_prompt, .cell .out_prompt_overlay"));
      }
    }

    //Override the "Add cell" actions to set the x / y coords of any newly added cells:
    Jupyter.actions._actions['jupyter-notebook:insert-cell-above'].handler = createHandler(Jupyter.actions._actions['jupyter-notebook:insert-cell-above'].handler);
    Jupyter.actions._actions['jupyter-notebook:insert-cell-below'].handler = createHandler(Jupyter.actions._actions['jupyter-notebook:insert-cell-below'].handler);
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
    var placedCellLocations = [];
    var cells = _.sortBy(Jupyter.notebook.get_cells(), [cellObj => cellObj.metadata.x == undefined]); //Place those that already have set positions first.
    cells.forEach(function(cellObj){
      //Get the metadata properties of the cell.
      var cellElt = cellObj.element[0];
      var cellHeight = $(cellElt).outerHeight();

      if( cellObj.metadata.x != undefined && cellObj.metadata.y != undefined ){
        d3.select(cellElt).style("transform", "translate("+cellObj.metadata.x+"px, "+cellObj.metadata.y+"px)");
        placedCellLocations.push( {top: cellObj.metadata.y, bottom: cellObj.metadata.y + cellHeight, left: cellObj.metadata.x, right: cellObj.metadata.x + CELL_WIDTH} );
      }
      else{
        //Default to stacking up in a column (eg. for notebooks created without this plugin).

        //Check to see if there is already a cell positioned starting above this, such that this cell would be placed on top of it.
        let blockedByCell = true;
        let thisCellLocation = {top: runningTotalHeight, bottom: runningTotalHeight + cellHeight, left: 0, right: CELL_WIDTH};
        while( blockedByCell ){
          runningTotalHeight += 30; //Move down 30px and check again.
          thisCellLocation.top += 30;
          thisCellLocation.bottom += 30;
          blockedByCell = placedCellLocations.find( function(blockedLocation){
            return ((blockedLocation.right > thisCellLocation.left && blockedLocation.left < thisCellLocation.right )
                    && (blockedLocation.bottom > thisCellLocation.top && blockedLocation.top < thisCellLocation.bottom ))
          });
        }

        d3.select(cellElt).style("transform", "translate(0px, "+thisCellLocation.top+"px)");
        placedCellLocations.push( thisCellLocation );
        runningTotalHeight = thisCellLocation.bottom;
      }

      //Set codemirror not to hide lines it thinks are off-screen (because they might not really be off-screen).
      cellObj.code_mirror.options.viewportMargin = Infinity;
    });

    //Add background zoom behaviour:
    var zoomBehaviour = d3.zoom().filter(zoomFilter).on("zoom", zoomed);
    //Start camera panned left slightly so that cells appear in the middle, not left-aligned to the page.
    zoomBehaviour.translateBy(d3.select('#notebook_panel'), getCameraCenter().x - CELL_WIDTH/2, 100);
    d3.select('#notebook_panel').call(zoomBehaviour);



    //Make all initial cells draggable:
    makeDraggable( d3.selectAll(".cell .input_prompt, .cell .out_prompt_overlay") );

    overrideInsertCellHandlers();
  }

  return {
    load_ipython_extension: load_ipython_extension
  };
});

