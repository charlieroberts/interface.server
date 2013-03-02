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
    
    serverRow : function(server) {
      $("#newButton").trigger('click');
          
      var row = $( $("#serverTableBody tr").last() );

      $( $( $(row.children()[0] ).find("input") )[0] ).val( server.name );
          
      $( $( $(row.children()[1] ).find("input") )[0] ).remove();
      $(row.children()[1]).text( server.directory );

      $( $( $(row.children()[2] ).find("input") )[0] ).val( server.ports.webServer);
      $( $( $(row.children()[3] ).find("input") )[0] ).val( server.ports.webSocket);
      $( $( $(row.children()[4] ).find("input") )[0] ).val( server.ports.oscOut);
      $( $( $(row.children()[5] ).find("input") )[0] ).val( server.ports.oscIn);
      $( $( $(row.children()[6] ).find("input") )[0] ).prop( 'checked', server.shouldAppendID );
      $( $( $(row.children()[7] ).find("input") )[0] ).prop( 'checked', server.shouldMonitor );
    },
    
    openFile : function() { 
      $("#fileButton").trigger('click');
      
      $("#fileButton").change(function() {
        var json = fs.readFileSync( $( this ).val(), [ 'utf-8' ] ), 
            servers = JSON.parse( json );

        for(var i = 0; i < servers.length; i++) {
          $("#newButton").trigger('click');
          
          var server = servers[i];

          var row = $( $("#serverTableBody tr")[i] );

          $( $( $(row.children()[0] ).find("input") )[0] ).val( server.name );
          
          $( $( $(row.children()[1] ).find("input") )[0] ).remove();
          $(row.children()[1]).text( server.directory );

          $( $( $(row.children()[2] ).find("input") )[0] ).val( server.ports.webServer);
          $( $( $(row.children()[3] ).find("input") )[0] ).val( server.ports.webSocket);
          $( $( $(row.children()[4] ).find("input") )[0] ).val( server.ports.oscOut);
          $( $( $(row.children()[5] ).find("input") )[0] ).val( server.ports.oscIn);
          $( $( $(row.children()[6] ).find("input") )[0] ).prop( 'checked', server.shouldAppendID );
          $( $( $(row.children()[7] ).find("input") )[0] ).prop( 'checked', server.shouldMonitor );
        }
      })
    },
    
    saveFile : function() { 
      $("#saveFileButton").trigger('click');
      $("#saveFileButton").change(function() {
        var json = [];
        
        var serverRows = $("#serverTableBody tr");
        //console.log(serverRows);
        for(var i = 0; i < serverRows.length; i++) {
          var row = $(serverRows[i]);
          // var server = global.interface.servers[i];
          var _server = {
            'name'          : $(row.children()[0].children[0]).val(),
            'directory'     : '/Users/charlie/Documents/code/interface_server/server/interfaces/', ///$(row.children()[1].children[0]).val(),
            'ports' : {
              'webServer'   : $(row.children()[2].children[0]).val(),
              'webSocket'   : $(row.children()[3].children[0]).val(),                
              'oscIn'       : $(row.children()[4].children[0]).val(),             
              'oscOut'      : $(row.children()[5].children[0]).val(),      
            },
            'shouldAppendID': $(row.children()[6].children[0]).is(':checked'), 
            'shouldMonitor' : $(row.children()[7].children[0]).is(':checked'),
          } 
          json.push(_server);
        }
        fs.writeFileSync($(this).val(), JSON.stringify( json ), ['utf-8']);
      })
    },
    
    removeServer : function(server) {
      if(server) {
        if(server.oscIn !== null) { server.oscIn.close(); }
        if(server.webSocket !== null) { server.webSocket.close(); }
        if(server.webServer !== null) { server.webServer.close(console.log("WEB SERVER SHOULD BE CLOSED DAMN IT")); }
      
        this.portsInUse.splice( this.portsInUse.indexOf( server.ports.webServer ), 1 );
        this.portsInUse.splice( this.portsInUse.indexOf( server.ports.webSocket ), 1 );
        this.portsInUse.splice( this.portsInUse.indexOf( server.ports.oscIn ), 1 );
      
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
      // name | dir | serverPort | socketPort | oscOut | oscIn | shouldAppend | shouldMonitor
      global.interface.serverRow({
        name: parameters[0] || 'livecode',
        directory : parameters[1] || './interfaces',
        ports : {
          webServer : parameters[2] || 8080,
          webSocket : parameters[3] || 8081,
          oscOut    : parameters[4] || 8082,
          oscIn     : parameters[5] || 8083,
        },
        shouldAppendID : false,
        shouldMonitor :false
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
global.interface.makeServer = function(name, directory, webServerPort, socketPort, oscInPort, oscOutPort, shouldAppendID, shouldMonitor, livecode) {
  var clients           = [],
      serverID          = global.interface.servers.length,
      root              = directory,
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
        'directory'     : directory,
        'shouldAppendID': shouldAppendID,
        'shouldMonitor' : shouldMonitor,
        'name'          : name,
        'clients'       : clients,
        'oscOut'        : null,
        'oscIn'         : null,
        'webSocket'     : null,
        'webServer'     : null,
        'livecode'      : livecode,
        ports : {
          'webServer' : webServerPort,
          'webSocket' : socketPort,
          'oscIn'     : oscInPort,
          'oscOut'    : oscOutPort,
        },
        
        serveInterfaceJS : function(req, res, next){
          //var ip = req.connection.remoteAddress;

        	req.uri = url.parse( req.url );
    
          var extension = req.uri.pathname.split('.').pop();
    
          if(extension == 'htm') {
            fetchingInterface = req.uri.pathname.slice(1);
          }
          
          var js = "__socketPort = " + server.ports.webSocket + "; \n" + global.interface.interfaceJS;
          
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
      
  server.oscOut = new omgosc.UdpSender( '127.0.0.1', oscOutPort );
  
  if(global.interface.portsInUse.indexOf( oscInPort ) === -1) {
    server.oscIn = new omgosc.UdpReceiver( oscInPort );
    global.interface.portsInUse.push( oscInPort ); 
  }else{
    alert('there is already a service runnning on port ' + oscInPort + '. please choose another port for osc input.');
    return;
  }
  
  if( global.interface.portsInUse.indexOf( socketPort ) === -1 ) {
    server.webSocket  = new ws.Server({ port:socketPort });
    global.interface.portsInUse.push( socketPort ); 
  }else{
    alert( 'there is already a service runnning on port ' + socketPort + '. please choose another socket port.' );
    if( server.oscIn !== null ) { 
      server.oscIn.close(); 
      global.interface.portsInUse.splice( global.interface.portsInUse.indexOf( oscInPort ), 1 );
    }
    return;
  }

  if(global.interface.portsInUse.indexOf( webServerPort ) === -1) {
    if( server.livecode === true ) {
      server.webServer = connect()
        .use( server.serveInterfaceJS )
        .use( function(req, res) { res.end( global.interface.livecodePage ) })
       .listen( webServerPort );
    }else{
      server.webServer = connect()
        .use( connect.directory( directory, { hidden:true,icons:true } ) )
        .use( server.serveInterfaceJS )
        .use( connect.static( directory ) )
        .listen( webServerPort );
    }
        
    global.interface.portsInUse.push( webServerPort );
  }else{
    alert( 'there is already a service runnning on port ' + webServerPort + '. please choose another web server port.' );
    
    if( server.oscIn !== null ) { 
      server.oscIn.close();
      global.interface.portsInUse.splice( global.interface.portsInUse.indexOf( oscInPort ), 1 );
    }
    
    if( server.webSocket !== null ) {
      server.webSocket.close();
      global.interface.portsInUse.splice( global.interface.portsInUse.indexOf( socketPort ), 1 );
    }
    return;
  }
   
  Object.defineProperties(server, {
    'shouldMonitor' : {
      get : function() { return shouldMonitor  },
      set : function(_v) { shouldMonitor = _v; }
    },
    'shouldAppendID' : {
      get : function() { return shouldAppendID  },
      set : function(_v) { shouldAppendID = _v; }
    },
    'name' : {
      get : function() { return name  },
      set : function(_v) { name = _v }
    },
    'oscInPort' : {
      get : function() { return oscInPort  },
      set : function(_v) { 
        oscInPort = _v; 
        oscIn.close();
        
        oscIn = new omgosc.UdpReceiver(oscInPort),
        server.oscIn = oscIn;
      }
    },
  })

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
          if( shouldAppendID ) {
            args.typetags +='i';
            args.parameters.push( socket.id );
          }
          
          if( shouldMonitor || socket.shouldMonitor ) {
            _monitor.postMessage(name, socket.id, args.address, args.typetags, args.parameters );
          }
          
          server.oscOut.send( args.address, args.typetags, args.parameters );
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
      server.oscOut.send( '/deviceDisconnected', 'i', [ socket.id ] );
      //clients.splice(socket.id, 1);
      delete clients[ socket.id ];
      $(socket.row).remove();
    });
  
    server.oscOut.send( '/deviceConnected', 'i', [ socket.id ] );
    
    socket.row = _monitor.addClient(socket, socket.id, socket.ip, server.name, socket.interfaceName); 
  });
  
  server.oscIn.on('', function(args) {
    console.log("OSC", args);
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
  
  server.oscOut.send( '/serverCreated', 's', [ server.name ] );
  
  return server;
}