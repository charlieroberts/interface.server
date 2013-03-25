if(typeof require !== 'undefined') {
  var fs                = require('fs'),
      ws                = require('ws'),
      url               = require('url'),
      net               = require('net'),
      connect           = require('connect'),
      omgosc            = require('omgosc'),
      gui               = require('nw.gui'),
      fetchingInterface = null;
}

if(typeof global.interface === 'undefined') { // only run if not reloading...  
  var ADMIN_PORT = 10000;
  
  global.interface = {
    count: 0,
    servers: [],
    portsInUse: [],
    highlightedServerRow : null,
    adminIn : new omgosc.UdpReceiver( ADMIN_PORT ),
    
    extend : function(destination, source) {
      for (var property in source) {
    		var keys = property.split(".");
      
    		if(source[property] instanceof Array && source[property].length < 100) { // don't copy large array buffers
    	    destination[property] = source[property].slice(0);
        } else {
          destination[property] = source[property];
        }
      }
      return destination;
    },
    
    _serverRow : function(server) {
      $("#newButton").trigger('click');
          
      var row = $( $("#serverTableBody tr").last() );

      $( $( $(row.children()[0] ).find("input") )[0] ).val( server.name );
          
      $( $( $(row.children()[1] ).find("input") )[0] ).remove();
      $(row.children()[1]).text( server.directory );

      $( $( $(row.children()[2] ).find("input") )[0] ).val( server.webServerPort);
      $( $( $(row.children()[3] ).find("input") )[0] ).val( server.webSocketPort);
      $( $( $(row.children()[4] ).find("input") )[0] ).val( server.oscOutputPort);
      $( $( $(row.children()[5] ).find("input") )[0] ).val( server.oscInputPort);
      $( $( $(row.children()[6] ).find("input") )[0] ).prop( 'checked', server.shouldAppendID );
      $( $( $(row.children()[7] ).find("input") )[0] ).prop( 'checked', server.shouldMonitor );
    },
    
    serverRow : function( server ) {
      console.log( server );
      var infoTable = $( '<table>' )
        .css({ border:'none' })
        .addClass('infoTable')
        .append( $("<tr>").append( $("<td>").text('Name'), $("<td>").text( server.name ) ) ) 
        .append( $("<tr>").append( $("<td>").text('Directory'), $("<td>").text( server.directory ) ) ) 
        .append( $("<tr>").append( $("<td>").text('Web Server Port'), $("<td>").text( server.webServerPort ) ) )
        .append( $("<tr>").append( $("<td>").text('Web Socket Port'), $("<td>").text( server.webSocketPort ) ) ) 
        .append( $("<tr>").append( $("<td>").text('Output Message Format'), $("<td>").text( server.outputType ) ) ); 

      var srv;
      
      if( server.outputType === 'OSC' ) {
        _srv = global.interface.makeServer( server );  
        
        infoTable.append( $("<tr>").append( $("<td>").text('OSC Input Port'), $("<td>").text( server.oscInputPort ) ) );
        infoTable.append( $("<tr>").append( $("<td>").text('OSC Output Port'), $("<td>").text( server.oscOutputPort ) ) );
        infoTable.append( $("<tr>").append( $("<td>").text('OSC Output IP Address'), $("<td>").text( server.oscOutputIP ) ) );                    
      }
      
      var row = $("<tr>")
        .append( $("<td>").append( infoTable ) )
        .append( $("<td>").append( $("<input type='checkbox'>").change( function() { _srv.shouldAppendID = $(this).is(':checked'); }) ) )
        .append( $("<td>").append( $("<input type='checkbox'>").change( function() { _srv.shouldMonitor  = $(this).is(':checked'); }) ) )
        .on('mousedown', function() {
          if(global.interface.highlightServerRow !== null) {
            $(global.interface.highlightServerRow).removeClass('highlightedRow');
          }
          $(this).addClass('highlightedRow');
          global.interface.highlightServerRow = row;
        });
        
      row.server = _srv;
      
      $("#serverTableBody").append(row);
    },
    
    openFile : function() { 
      $("#fileButton").trigger('click');
      
      $("#fileButton").change(function() {
        var json = fs.readFileSync( $( this ).val(), [ 'utf-8' ] ), 
            servers = JSON.parse( json );

        for(var i = 0; i < servers.length; i++) {
          //$("#newButton").trigger('click');
          
          var server = servers[i];
          global.interface.serverRow( server );

          // var row = $( $("#serverTableBody tr")[i] );
          // 
          // $( $( $(row.children()[0] ).find("input") )[0] ).val( server.name );
          // 
          // $( $( $(row.children()[1] ).find("input") )[0] ).remove();
          // $(row.children()[1]).text( server.directory );
          // 
          // $( $( $(row.children()[2] ).find("input") )[0] ).val( server.webServerPort);
          // $( $( $(row.children()[3] ).find("input") )[0] ).val( server.webSocketPort);
          // $( $( $(row.children()[4] ).find("input") )[0] ).val( server.oscOutputPort);
          // $( $( $(row.children()[5] ).find("input") )[0] ).val( server.oscInputPort);
          // $( $( $(row.children()[6] ).find("input") )[0] ).prop( 'checked', server.shouldAppendID );
          // $( $( $(row.children()[7] ).find("input") )[0] ).prop( 'checked', server.shouldMonitor );
        }
      })
    },
    
    propsToSave : ['webServerPort', 'outputType', 'webSocketPort', 
                   'oscInputPort', 'oscOutputPort', 'oscOutputIP', 
                   'shouldMonitor', 'shouldAppendID', 'directory', 'name'],
    
    saveFile : function() { 
      $("#saveFileButton").trigger('click');
      $("#saveFileButton").change(function() {
        var json = [];
        
        var serverRows = $("#serverTableBody tr");
        ////console.log(serverRows);
        for(var i = 0; i < global.interface.servers.length; i++) {
          var _server = global.interface.servers[i],
              server = {};
          
          for(var j = 0; j < global.interface.propsToSave.length; j++) {
            var prop = global.interface.propsToSave[j];
            if( prop in _server ) server[ prop ] = _server[ prop ];
          }
          json.push(server);
        }
        fs.writeFileSync($(this).val(), JSON.stringify( json ), ['utf-8']);
      })
    },
    
    removeServer : function(server) {
      if(server) {
        if(server.oscInput !== null) { server.oscInput.close(); }
        if(server.webSocket !== null) { server.webSocket.close(); }
        if(server.webServer !== null) { server.webServer.close(); } //console.log("WEB SERVER SHOULD BE CLOSED DAMN IT")); }
      
        this.portsInUse.splice( this.portsInUse.indexOf( server.webServerPort ), 1 );
        this.portsInUse.splice( this.portsInUse.indexOf( server.webSocketPort ), 1 );
        this.portsInUse.splice( this.portsInUse.indexOf( server.oscInputPort ), 1 );
      
        for(var i = 0; i < server.clients.length; i++) {
          if( server.clients[i].row ) {
            $( server.clients[i].row ).remove(); 
          }
        }
      
        this.servers.splice( this.servers.indexOf( server ), 1 );
      }
    },
    
    removeAllServers : function() {
      // on reload, kill all servers and restore port availability
      for(var i = 0; i < this.servers.length; i++) {
        var server = this.servers[i];
        this.removeServer( server );
      }
      this.servers.length = 0;
    },
  };
  
  global.interface.interfaceJS = fs.readFileSync( './zepto.js', ['utf-8'] );
  global.interface.interfaceJS += fs.readFileSync( './interface.js/interface.js', ['utf-8'] );
  global.interface.interfaceJS += fs.readFileSync( './server/interface.client.js', ['utf-8'] );
  global.interface.interfaceJS += fs.readFileSync( './server/autogui.js', ['utf-8'] );
  
  global.interface.livecodePage = fs.readFileSync( './server/interfaces/livecode.html', ['utf-8'] );
  
  var your_menu = new gui.Menu({ 
    type: 'menubar' 
  });
  var file = new gui.MenuItem({ label: 'File' });
  var submenu = new gui.Menu();
  
  submenu.append( new gui.MenuItem({ 
    label: 'Open Server Configuration ⌘O',
    click: global.interface.openFile,
  }));
  
  submenu.append( new gui.MenuItem({ 
    label: 'Save Server Configuration   ⌘S',
    click: global.interface.saveFile,
  }) );
  
  file.submenu = submenu;
  
  gui.Window.get().menu = your_menu;
  your_menu.insert( file, 1 );
  
  var __admin = {
    '/createServer' : function( parameters ) {
      // name | dir | serverPort | socketPort | oscOutputPort | oscInputPort | shouldAppend | shouldMonitor
      global.interface.serverRow({
        name: parameters[0] || 'livecode',
        directory : parameters[1] || './interfaces',
        webServerPort : parameters[2] || 8080,
        webSocketPort : parameters[3] || 8081,
        oscOutputPort : parameters[4] || 8082,
        oscInputPort  : parameters[5] || 8083,
        shouldAppendID : false,
        shouldMonitor : false
      });
      
      global.interface.makeServer(
        parameters[0] || 'livecode',
        parameters[1] || './interfaces',
        parameters[2] || 8080,
        parameters[3] || 8081,
        parameters[4] || 8083,
        parameters[5] || 8082,
        false,
        false,
        true
      );
    }
  }

  global.interface.adminIn.on('', function(args) {
    if(args.path in __admin)
      __admin[ args.path ]( args.params );
  });
  
}

global.interface.count++;

win = gui.Window.get();

Mousetrap.bind('command+o', function() {  global.interface.openFile(); });
Mousetrap.bind('command+s', function() {  global.interface.saveFile(); });
Mousetrap.bind('command+r', function() {  win.reload(); });
Mousetrap.bind('command+d', function() {  win.showDevTools(); });
Mousetrap.bind('command+escape', function() { win.isFullscreen = !win.isFullscreen });

$(window).on('load', function() {
  win.moveTo(0,0);
  win.resizeTo(1100, 500);
  win.blur();
  win.show();
});

var ids = [];

global.interface.makeServer = function( serverProps ) {
  var clients           = [],
      serverID          = global.interface.servers.length,
      root              = serverProps.directory,
      midiInit          = false,
      interfaceJS       = null,
      webserver         = null,
      serveInterfaceJS  = null,
      midiOut           = null,
      midiNumbers       = {
        "noteon"        : 0x90,
        "noteoff"       : 0x80,
        "cc"            : 0xB0,
        "programchange" : 0xC0,
      },
      server            = {
        'shouldAppendID': false,
        'shouldMonitor' : false,
        'clients'       : clients,
        'masterSocket'  : null,
        'livecode'      : false,
            
        serveInterfaceJS : function(req, res, next){
          //var ip = req.connection.remoteAddress;

        	req.uri = url.parse( req.url );
    
          var extension = req.uri.pathname.split('.').pop();
    
          if(extension == 'htm') {
            fetchingInterface = req.uri.pathname.slice(1);
          }
          
          var js = "__socketPort = " + server.webSocketPort + "; \n" + global.interface.interfaceJS;
          
        	if( req.uri.pathname === "/interface.js" ) {
        		res.writeHead( 200, {
        			'Content-Type': 'text/javascript',
        			'Content-Length': js.length
        		})
        		res.end( js );
    
        		return;
        	}
  
          next();
        },
      };
      
  global.interface.extend( server, serverProps );
  
  if(server.outputType === 'WebSocket') {
    server.master = null;
    server.masterSocket = new ws.Server({ port:outPort });
    
    server.masterSocket.on( 'connection', function (socket) {
      //console.log("A CONNECTION IS MADE");
      server.master = socket;
    
      socket.ip = socket._socket.remoteAddress;
    
      socket.on( 'message', function( obj ) {
        var args = JSON.parse( obj );
        if(args.type === 'osc') {
          var split = args.address.split("/");
      
          if( split[1] === 'clients') {
            var msg = {},
                clientNum = split[2],
                address = "/" + split.slice(3).join('/'),
                remote = null;;
        
            msg.address = address;
            msg.typetags = args.typetags;
            msg.parameters = args.parameters;
        
            if(clientNum === '*') {
              for(var i = 0; i < server.clients.length; i++) {
                server.clients[i].send( obj );
              }
            }else{
              clientNum = parseInt(clientNum)
        
              for(var i = 0; i < server.clients.length; i++) {
                if( server.clients[i].id === clientNum ) {
                  remote = server.clients[i];
                  break;
                }
              }
        
              if(remote !== null) {
                remote.send( JSON.stringify( msg ) );
              }
            }
          }else{
            if( server.shouldAppendID ) {
              args.typetags +='i';
              args.parameters.push( socket.id );
            }
          
            if( server.shouldMonitor || socket.shouldMonitor ) {
              _monitor.postMessage(server.name, socket.id, args.address, args.typetags, args.parameters );
            }
          
            //console.log(server.outputType);
          
            if(server.outputType === 'OSC') {
              server.oscOutputPort.send( args.address, args.typetags, args.parameters );
            }else{
              //console.log("SENDING TO MASTER SOCKET");
              //server.master.send( obj );
              for(var i = 0; i < server.clients.length; i++) {
                server.clients[i].send( obj );
              }
            }
          }
        }
      });
      
      //console.log("SOCKET IS MADE");
    })
  }else{
    server.oscOutput = new omgosc.UdpSender( server.oscOutputIP, server.oscOutputPort );
  }
  
  if(global.interface.portsInUse.indexOf( server.oscInputPort ) === -1) {
    server.oscInput = new omgosc.UdpReceiver( server.oscInputPort );
    global.interface.portsInUse.push( server.oscInputPort ); 
  }else{
    alert('there is already a service runnning on port ' + server.oscInputPort + '. please choose another port for osc input.');
    return;
  }
  
  if( global.interface.portsInUse.indexOf( server.webSocketPort ) === -1 ) {
    server.webSocket  = new ws.Server({ port:server.webSocketPort });
    global.interface.portsInUse.push( server.webSocketPort ); 
  }else{
    alert( 'there is already a service runnning on port ' + server.webSocketPort + '. please choose another socket port.' );
    if( server.oscInput !== null ) { 
      server.oscInput.close(); 
      global.interface.portsInUse.splice( global.interface.portsInUse.indexOf( server.oscInputPort ), 1 );
    }
    return;
  }

  if(global.interface.portsInUse.indexOf( server.webServerPort ) === -1) {
    if( server.livecode === true ) {
      server.webServer = connect()
        .use( server.serveInterfaceJS )
        .use( function(req, res) { res.end( global.interface.livecodePage ) })
       .listen( server.webServerPort );
    }else{
      server.webServer = connect()
        .use( connect.directory( server.directory, { hidden:true,icons:true } ) )
        .use( server.serveInterfaceJS )
        .use( connect.static( server.directory ) )
        .listen( server.webServerPort );
    }
        
    global.interface.portsInUse.push( server.webServerPort );
  }else{
    alert( 'there is already a service runnning on port ' + server.webServerPort + '. please choose another web server port.' );
    
    if( server.oscInput !== null ) { 
      server.oscInput.close();
      global.interface.portsInUse.splice( global.interface.portsInUse.indexOf( server.oscInputPort ), 1 );
    }
    
    if( server.webSocket !== null ) {
      server.webSocket.close();
      global.interface.portsInUse.splice( global.interface.portsInUse.indexOf( server.webSocketPort ), 1 );
    }
    return;
  }

  server.webSocket.on( 'connection', function (socket) {
    var found = false;
    
    socket.shouldMonitor = false;
    socket.ip = socket._socket.remoteAddress;
    socket.interfaceName = fetchingInterface;

    for(var i = 0; i < server.clients.length; i++) {
      if(typeof server.clients[i] !== 'undefined') {
        if(server.clients[i].ip === socket.ip) {
          found = true;
          socket.id = server.clients[i].id;
          break;
        }
      }
    }
  
    if(!found) {
      var id;
      for(var i = 0; i <= clients.length; i++) {
        if(typeof clients[i] === 'undefined') {
          id = i;
          break;
        }
      }
      socket.id = id;
      server.clients[ id ] = socket;
    }
    //console.log("setting up socket messages");
    
    socket.on( 'message', function( obj ) {
      //console.log("MESSAGE");
      var args = JSON.parse( obj );
      //console.log(args);
      if(args.type === 'osc') {
        var split = args.address.split("/");
      
        if( split[1] === 'clients') {
          var msg = {},
              clientNum = split[2],
              address = "/" + split.slice(3).join('/'),
              remote = null;;
        
          msg.address = address;
          msg.typetags = args.typetags;
          msg.parameters = args.parameters;
        
          if(clientNum === '*') {
            for(var i = 0; i < server.clients.length; i++) {
              server.clients[i].send( obj );
            }
          }else{
            clientNum = parseInt(clientNum)
        
            for(var i = 0; i < server.clients.length; i++) {
              if( server.clients[i].id === clientNum ) {
                remote = server.clients[i];
                break;
              }
            }
        
            if(remote !== null) {
              remote.send( JSON.stringify( msg ) );
            }
          }
        }else{
          if( server.shouldAppendID ) {
            args.typetags +='i';
            args.parameters.push( socket.id );
          }
          
          if( server.shouldMonitor || socket.shouldMonitor ) {
            _monitor.postMessage(server.name, socket.id, args.address, args.typetags, args.parameters );
          }
          
          //console.log(server.outputType);
          
          if(server.outputType === 'OSC') {
            server.oscOutput.send( args.address, args.typetags, args.parameters );
          }else{
            //console.log("SENDING TO MASTER SOCKET");
            server.master.send( obj );
          }
        }
      }else if( args.type === 'midi' ) {
        if( !midiInit ) {
          midiOutput = new midi.output();
          midiOutput.openVirtualPort( "Interface Output" );
          midiInit = true;
        }

        if(args.type !== 'programchange') {
          midiOutput.sendMessage([ midiNumbers[ args.midiType ] + args.channel, args.number, Math.round(args.value) ])
        }else{
          midiOutput.sendMessage([ 0xC0 + args.channel, args.number ])
        }
      }
    });
  
    socket.on('close', function() {
      if(server.outputType === 'OSC') 
        server.oscOutput.send( '/deviceDisconnected', 'i', [ socket.id ] );
      //clients.splice(socket.id, 1);
      delete clients[ socket.id ];
      $(socket.row).remove();
    });
    
    if(server.outputType === 'OSC') {
      server.oscOutput.send( '/deviceConnected', 'i', [ socket.id ] );
    }
    
    socket.row = _monitor.addClient(socket, socket.id, socket.ip, server.name, socket.interfaceName); 
  });
  
  server.oscInput.on('', function(args) {
    var split = args.path.split("/");
    if(split[1] === 'clients') {
      var msg = {},
          clientNum = parseInt(split[2]),
          address = "/" + split.slice(3).join('/'),
          remote = null;
    
      msg.address = address;
      msg.typetags = args.typetag;
      msg.parameters = args.params;

      for(var i = 0; i < clients.length; i++) {
        if( clients[i].id === clientNum ) {
          remote = clients[i];
          break;
        }
      }
    
      if(remote !== null)
        remote.send( JSON.stringify( msg ) );
    }else{
      for(var key in clients) {
        var client = clients[key];
        client.send( JSON.stringify({ address:args.path, typetags:args.typetag, parameters:args.params }) );
      }
    }
  });
  
  global.interface.servers.push( server );
  
  if(server.outputType === 'OSC') {
    server.oscOutput.send( '/serverCreated', 's', [ server.name ] );
  }
  
  return server;
}