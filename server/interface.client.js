var expr = /[-a-zA-Z0-9.]+(:(6553[0-5]|655[0-2]\d|65[0-4]\d{2}|6[0-4]\d{3}|[1-5]\d{4}|[1-9]\d{0,3}))/,
    socketIPAndPort = expr.exec( window.location.toString() )[0].split(":"), 
    socketString = 'ws://' + socketIPAndPort[0] + ':' + ( parseInt( __socketPort ) );

Interface.Socket = new WebSocket( socketString );

// console.log( 'Opening socket ' + socketString )

Interface.Socket.onmessage = function (event) {
  var data = JSON.parse( event.data )
  if( data.type === 'osc' ) {
    Interface.OSC._receive( event.data );
  }else {
    if( Interface.Socket.receive ) {
      Interface.Socket.receive( data  )
    }
  }
};

Interface.OSC = {
  socket : Interface.Socket,
  send : function(_address, _typetags, _parameters) {
    if(typeof _address === 'string' && typeof _typetags === 'string') {
      var obj = {
        type : "osc",
        address: _address,
        typetags: _typetags,
        parameters: Array.isArray(_parameters) ? _parameters : [ _parameters ],
      }
      this.socket.send( JSON.stringify(obj) );
    }else{
      console.log("INVALID OSC MESSAGE FORMATION", arguments);
    }
  },
  _receive : function( data ) {
    var msg = JSON.parse( data );

    if( msg.address in this.callbacks ) {
      this.callbacks[ msg.address ]( msg.parameters );
    }else{
      for(var i = 0; i < Interface.panels.length; i++) {
        for( var j = 0; j < Interface.panels[i].children.length; j++) {
          var child = Interface.panels[i].children[j];
          
          if( child.key === msg.address ) {
            child.setValue( msg.parameters[ 0 ] );
            return;
          }
        }
      }
      this.receive( msg.address, msg.typetags, msg.parameters );
    }
  },
  receive : function(address, typetags, parameters) { },
  
  callbacks : { // "panel" is the Interface.Panel object created in the livecode.html interface
    "/interface/runScript": function(args) {
      eval(args[0]);
    },
    "/interface/addWidget": function(args) {
      // console.log( args )
      var w = {};

      var json2 = args[0].replace(/\'/gi, "\""); // replace any single quotes in json string
      
      try {
        eval("w = " + json2);
        // TODO: use JSON.parse? It's really annoying to format strings for JSON in Max/MSP...
        //w  = JSON.parse( json2 ); // since this might be an 'important' string, don't fail on json parsing error
      }catch (e) {
        console.log("ERROR PARSING JSON");
        return;
      }
            
      var isImportant = false;
    	var hasBounds = (typeof w.bounds !== "undefined") || (typeof w.x !== "undefined");
            
      var _w = new Interface[w.type](w);
      
      panel.add( _w );
                    
      if(!hasBounds) {
        // TODO: IMPLEMENT
        //if(!Interface.isWidgetSensor(w) ) {
        Interface.autogui.placeWidget(_w, isImportant);
        //}
      }
        
      // var widgetPage = (typeof w.page !== "undefined") ? w.page : Interface.currentPage;
      // Interface.addingPage = widgetPage;
      // Interface.addWidget(window[w.name], Interface.addingPage);
    },
    "/interface/addWidgetKV" : function(args) {
      var w = {};
      for (var i = 2; i < args.length; i+=2) {
        w[args[i]]=args[i+1];
      }
                                        
      var isImportant = false;
            
      if(typeof w.page === "undefined") {
        w.page = Interface.currentPage;
      }
            
      var _w = Interface.makeWidget(w);
      _w.page = w.page;
            
      if(typeof _w.bounds == "undefined") {
        if(!Interface.isWidgetSensor(w) ) {
          Interface.autogui.placeWidget(_w, isImportant);
        }
      }
            
      var widgetPage = (typeof w.page !== "undefined") ? w.page : Interface.currentPage;
      Interface.addWidget(window[w.name], widgetPage);
    },
    "/interface/autogui/redoLayout" : function(args) {
      Interface.autogui.redoLayout();
    },
    "/interface/removeWidget": function(args) {
      var w = panel.getWidgetWithName( args[0] );
      if(typeof Interface.autogui !== "undefined") {
        Interface.autogui.removeWidget( w );
      }
      panel.remove( w );
    },
    "/interface/setBounds": function(args) {
      var w = panel.getWidgetWithName( args[0] );
      w.bounds = [ args[1], args[2], args[3], args[4] ];
    },
    "/interface/setColors": function(args) {
      var w = panel.getWidgetWithName( args[0] );
      w.background = args[1];
      w.fill = args[2];
      w.stroke = args[3];
      w.refresh();
    },
    "/interface/setRange": function(args) {
      var w = panel.getWidgetWithName( args[0] );
      w.min = args[1];
      w.max = args[2];
    },
    "/interface/setAddress": function(args) {
      var w = panel.getWidgetWithName(args[0]);
      w.key = args[1];
    },
    "/interface/clear" : function(args) {
      Interface.autogui.reset();
      panel.clear();
    },
  },
};

Interface.Livecode = {
  _receive : function( msg ) {
    if( msg.address in this ) {
      this[ msg.address ]( msg.parameters );
    }else{
      for(var i = 0; i < Interface.panels.length; i++) {
        for( var j = 0; j < Interface.panels[i].children.length; j++) {
          var child = Interface.panels[i].children[j];
          
          if( child.key === msg.address ) {
            child.setValue( msg.parameters[ 0 ] );
            return;
          }
        }
      }
      if( this.receive ) { // end-user callback
        this.receive( msg.address, msg.typetags, msg.parameters );
      }
    }
  },
  "/interface/runScript": function(args) {
    eval(args[0]);
  },
  "/interface/addWidget": function(args) {
    var w = typeof args[0] === 'string' ? JSON.parse( args[0] ) : args[0],
        isImportant = false,
  	    hasBounds = (typeof w.bounds !== "undefined") || (typeof w.x !== "undefined"),
        _w = new Interface[w.type](w);
    
    // console.log( _w )    
    panel.add( _w );
                  
    if(!hasBounds) {
      // TODO: IMPLEMENT
      //if(!Interface.isWidgetSensor(w) ) {
      Interface.autogui.placeWidget(_w, isImportant);
      //}
    }
      
    // var widgetPage = (typeof w.page !== "undefined") ? w.page : Interface.currentPage;
    // Interface.addingPage = widgetPage;
    // Interface.addWidget(window[w.name], Interface.addingPage);
  },
  "/interface/clear" : function(args) {
    panel.clear();
    Interface.autogui.reset();
  },
  "/interface/setLabel": function(args) {
    var w = panel.getWidgetWithName(args[0]);
    w.label = args[1];
    w.draw();
  },
  "/interface/removeWidget": function(args) {
    var w = panel.getWidgetWithName( args[0] );
    panel.remove( w );
    if(typeof Interface.autogui !== "undefined") {
      Interface.autogui.removeWidget( w );
    }
  },
  "/interface/setBounds": function(args) {
    var w = panel.getWidgetWithName( args[0] );
    w.bounds = [ args[1], args[2], args[3], args[4] ];
  },
  "/interface/setColors": function(args) {
    var w = panel.getWidgetWithName( args[0] );
    w.background = args[1];
    w.fill = args[2];
    w.stroke = args[3];
    w.refresh();
  },
  "/interface/setRange": function(args) {
    var w = panel.getWidgetWithName( args[0] );
    w.min = args[1];
    w.max = args[2];
  },
  "/interface/setAddress": function(args) {
    var w = panel.getWidgetWithName(args[0]);
    w.key = args[1];
  },
}

Interface.MIDI = {
  socket: Interface.Socket,
  send : function(messageType, channel, number, value) {
    var obj = null;
    if(Array.isArray( arguments[0] )) {
      // TODO: fill in to allow stuff like [145,1,127]
    }else{
      obj = {
        type    : 'midi',
        midiType  : messageType,
        channel   : channel,
        number    : number,
      }
      if(typeof value !== 'undefined') {
        obj.value = value;
      }
      this.socket.send( JSON.stringify( obj ) );
    }
  }
};

Interface.autogui = {
  hasPageButtons: false,
  children: [
    [{
      "bounds": [0, 0, 1, 1],
      "widget": null,
      "sacrosanct": false,
      "parent": null,
      "id": 0,
      "children": [], 
    },]
  ],

  getBestChildForNewWidget: function(page) {
    var _maxSize = 0;
    page = 0;
    if (typeof this.children[page] === "undefined") {
      this.children[page] = [{
        "bounds": [0, 0, 1, 1],
        "widget": null,
        "sacrosanct": false,
        "parent": null,
        "id": 0,
        "children": [],
      }, ];
    }
    var bestChild = this.children[page][0];

    // TODO include sacrosanct check

    function check(child) {
      if (child.children.length === 0) {
        if (child.widget === null) {
          if (child.bounds[2] + child.bounds[3] > _maxSize) {
            bestChild = child;
            _maxSize = child.bounds[2] + child.bounds[3];
          }
        } else {
          if ((child.bounds[2] + child.bounds[3]) / 2 > _maxSize) {
            bestChild = child;
            _maxSize = (child.bounds[2] + child.bounds[3]) / 2;
          }
        }
      } else {;
        for (var i = 0; i < child.children.length; i++) {
          var _child = child.children[i];
          check(_child, _maxSize);
        }
      }
    }

    check(bestChild);

    return bestChild;
  },

  placeWidget: function(_widget, sacrosanct) {
    if (_widget === null) console.log("ALERT ALERT ALERT ALERT ALERT ALERT ALERT ALERT ALERT ALERT ALERT ALERT");

    var maxSize = 0;
    var bestDiv = -1;
    var bestChild = null;

    bestChild = this.getBestChildForNewWidget(0);

    if (bestChild.widget === null) {
      bestChild.widget = _widget;
      _widget.bounds = bestChild.bounds;
      _widget.div = bestChild;
    } else {
      var w = bestChild.widget;

      var splitDir = (bestChild.bounds[2] > bestChild.bounds[3]) ? 0 : 1; // will the cell be split horizontally or vertically?

      var widgetWidth, widgetHeight;
      widgetWidth = (splitDir == 0) ? bestChild.bounds[2] / 2 : bestChild.bounds[2];
      widgetHeight = (splitDir == 1) ? bestChild.bounds[3] / 2 : bestChild.bounds[3];

      var div1 = {
        "bounds": [bestChild.bounds[0], bestChild.bounds[1], widgetWidth, widgetHeight],
        "widget": w,
        "sacrosanct": false,
        "parent": bestChild,
        "children": [],
      }

      var newDivX = (splitDir == 0) ? bestChild.bounds[0] + widgetWidth : bestChild.bounds[0];
      var newDivY = (splitDir == 1) ? bestChild.bounds[1] + widgetHeight : bestChild.bounds[1];

      var div2 = {
        "bounds": [newDivX, newDivY, widgetWidth, widgetHeight],
        "widget": _widget,
        "sacrosanct": sacrosanct,
        "parent": bestChild,
        "children": [],
      }

      div1.widget.div = div1;
      div1.widget.bounds = div1.bounds;

      div2.widget.bounds = div2.bounds;
      div2.widget.div = div2;

      bestChild.children.push(div1);
      bestChild.children.push(div2);
    }
  },

  removeWidget: function(_widget) {
    _widget.div.widget = null;
    var parent = _widget.div.parent;
    if (parent != null) {
      var childNumber = jQuery.inArray(_widget.div, parent.children);
      // determine if sibling is already empty, if so, remove sibling and self from parent array
      var siblingNumber = (childNumber === 1) ? 0 : 1;
      if (parent.children[siblingNumber].widget == null) {
        parent.children = [];
        parent.widget = null;
      }
    } else {
      _widget.div.children = [];
    }
  },

  reset: function() {
    this.children = [
      [{
        "bounds": [0, 0, 1, 1],
        "widget": null,
        "sacrosanct": false,
        "parent": null,
        "id": 0,
        "children": [],
      },]
    ];
  },

  redoLayout: function() {
    this.children = [
      [{
        "bounds": [0, 0, 1, 1],
        "widget": null,
        "sacrosanct": false,
        "parent": null,
        "id": 0,
        "children": [],
      },]
    ];

    for (var i = 0; i < panel.children.length; i++) {
      var w = panel.children[i];
      this.placeWidget(w);
    }
  },
};
