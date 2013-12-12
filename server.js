if(typeof require !== 'undefined') {
  var fs                = require('fs'),
      ws                = require('ws'),
      url               = require('url'),
      net               = require('net'),
      connect           = require('connect'),
      omgosc            = require('omgosc'),
      gui               = require('nw.gui'),
      //midi              = require('midi'),
      fetchingInterface = null;
}


if(typeof global.interface === 'undefined') { // only run if not reloading...  
  var OSC_ADMIN_PORT = 10000, WEBSOCKET_ADMIN_PORT = 10001, ids = [];
  
  global.interface = {
    count: 0,
    servers: [],
    portsInUse: [],
    livecodeServer : null,
    highlightedServerRow : null,
    oscAdminIn : new omgosc.UdpReceiver( OSC_ADMIN_PORT ),
    websocketAdminIn : new ws.Server({ port:WEBSOCKET_ADMIN_PORT }),
    
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
    
    serverRow : function( server ) {
      var infoTable = $( '<table>' )
        .css({ border:'none' })
        .addClass('infoTable')
        .append( $("<tr>").append( $("<td>").text('Name'), $("<td>").text( server.name ) ) ) 
        .append( $("<tr>").append( $("<td>").text('Directory'), $("<td>").text( server.directory ) ) ) 
        .append( $("<tr>").append( $("<td>").text('Web Server Port'), $("<td>").text( server.webServerPort ) ) )
        .append( $("<tr>").append( $("<td>").text('Web Socket Port'), $("<td>").text( server.webSocketPort ) ) ) 
        .append( $("<tr>").append( $("<td>").text('Output Message Format'), $("<td>").text( server.outputType ) ) ); 

      var srv;
      console.log( server.outputType )
      if( server.outputType === 'OSC' ) {
        _srv = global.interface.makeServer( server );  
        
        infoTable.append( $("<tr>").append( $("<td>").text('OSC Input Port'), $("<td>").text( server.oscInputPort ) ) );
        infoTable.append( $("<tr>").append( $("<td>").text('OSC Output Port'), $("<td>").text( server.oscOutputPort ) ) );
        infoTable.append( $("<tr>").append( $("<td>").text('OSC Output IP Address'), $("<td>").text( server.oscOutputIP ) ) );                    
      }else if( server.outputType === 'WebSocket' ) {
        //server.webSocketMasterPort = 8003
        //server.webSocketPort = 8001
        //_srv = global.interface.makeServer( server );  
        infoTable.append( $("<tr>").append( $("<td>").text('WebSocket Output Port'), $("<td>").text( server.webSocketMasterPort ) ) );
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
        
      //row.server = _srv;
      
      $("#serverTableBody").append(row);
    },
    appendLivecodeRow : function() {
      var row = $('<tr>')
        .append( $('<td colspan=3>').html( '<b>livecode server is now running.</b>' ).css('font-size', '1em') ) 
      
      $('#serverTableBody').append( row )            
    }, 
    openFile : function() { 
      $("#fileButton").trigger('click');
      
      $("#fileButton").change(function() {
        var json = fs.readFileSync( $( this ).val(), [ 'utf-8' ] ), 
            servers = JSON.parse( json );

        for(var i = 0; i < servers.length; i++) {
          global.interface.serverRow( servers[i] );
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
    
    init : function() {
      var serverCount = 1,
          _srv = null,
          servers = {};
          win = require('nw.gui').Window.get();
          win.show();
  
      $( '#deleteButton' )
        .button({ icons:{ primary:'ui-icon-close'} })
        .click(function() {
          if( global.interface.highlightServerRow !== null ) {
            global.interface.removeServer( global.interface.highlightServerRow.server );
            $( global.interface.highlightServerRow ).remove();
            global.interface.highlightServerRow = null;
          }
        });
  
      $( "#clearMonitorButton" )
        .button({icons:{ primary:'ui-icon-close' } })
        .click( function() { 
          $("#monitorTableBody").empty();
          rowCount = 0;
        });   
  
      (function($){
          $.fn.extend({
              center: function () {
                  return this.each(function() {
                      var top = ($(window).height() - $(this).outerHeight()) / 2;
                      var left = ($(window).width() - $(this).outerWidth()) / 2;
                      $(this).css({position:'absolute', margin:0, top: '100px', left: (left > 0 ? left : 0)+'px'});
                  });
              }
          }); 
      })(jQuery);
  
      $("#newButton").button({icons:{ primary:'ui-icon-document' } })
        .click(function() {
          var t = $("<table id='newServerTable'>").css({ border:'1px solid #ccc'}),
              nameRow = $("<tr>"),
              name = $('<input type="text" value="Server' + serverCount++ + '" />'),
              nameLabel = $("<td width=150>Server Name</td>").css({ textAlign:'right', paddingRight:'15px' }),
              directoryRow = $("<tr>"),
              directory = $('<input type="file" nwdirectory />').css({ textAlign:'left' }),
              directoryLabel = $("<td>Server Directory</td>").css({ textAlign:'right', paddingRight:'15px' }),
              webServerRow = $("<tr>"),
              webServerPort = $('<input type="text" value="8080" />'),
              webServerLabel = $("<td>Web Server Port</td>").css({ textAlign:'right', paddingRight:'15px' }),
              webSocketRow = $("<tr>"),
              webSocketPort = $('<input type="text" value="8081" />'),
              webSocketMasterPort = $('<input type="text" value="8081" />')
              webSocketLabel = $("<td>Web Socket Port</td>").css({ textAlign:'right', paddingRight:'15px' }),
              outputTypeRow = $("<tr>"),
              outputType = $('<select><option>Select an option</option><option>OSC</option><option>WebSocket</option><option>MIDI</option></select>'),
              outputTypeLabel = $("<td>Output Message Format</td>").css({ textAlign:'right', paddingRight:'15px' });
      
          directory.change( function() {
            if( outputType.val() != 'Select an option') {
              $( "#submitButton" ).attr( 'disabled', false );
            }
          })
      
          outputType.change( function() {
            if($(this).val() === 'OSC') {
              oscOutputPortRow = $("<tr>"),
              oscOutputPort =  $('<input type="text" value="8082" />'),
              oscOutputPortLabel = $("<td>OSC Output Port</td>").css({ textAlign:'right', paddingRight:'15px' });
              oscOutputPortRow.append( oscOutputPortLabel, $("<td>").append( oscOutputPort ).css({ textAlign:'left' }) );
          
              t.append( oscOutputPortRow );
          
              oscOutputIPRow = $("<tr>"),
              oscOutputIP =  $('<input type="text" value="127.0.0.1" />'),
              oscOutputIPLabel = $("<td>OSC Output IP Address</td>").css({ textAlign:'right', paddingRight:'15px' });
              oscOutputIPRow.append( oscOutputIPLabel, $("<td>").append( oscOutputIP ).css({ textAlign:'left' }) );
          
              t.append( oscOutputIPRow );
          
              oscInputPortRow = $("<tr>"),
              oscInputPort =  $('<input type="text" value="8083" />'),
              oscInputPortLabel = $("<td>OSC Input Port</td>").css({ textAlign:'right', paddingRight:'15px' });
              oscInputPortRow.append( oscInputPortLabel, $("<td>").append( oscInputPort ).css({ textAlign:'left' }) );
          
              t.append( oscInputPortRow );
            }else if( $(this).val() === 'WebSocket' ) {
              webSocketMasterPortRow = $("<tr>"),
              webSocketMasterPort =  $('<input type="text" value="8082" />'),
              webSocketMasterPortLabel = $("<td>WebSocket Output Port</td>").css({ textAlign:'right', paddingRight:'15px' });
              webSocketMasterPortRow.append( webSocketMasterPortLabel, $("<td>").append( webSocketMasterPort ).css({ textAlign:'left' }) );
        
              t.append( webSocketMasterPortRow );      
            }

            if(directory.val() != '')
              $( "#submitButton" ).attr( 'disabled', false );
          });
      
          nameRow.append(nameLabel, $("<td>").append( name ).css({ textAlign:'left' }) );
          directoryRow.append(directoryLabel, $("<td>").append( directory ).css({ textAlign:'left' }) );
          webServerRow.append( webServerLabel, $("<td>").append( webServerPort ).css({ textAlign:'left' }) );
          webSocketRow.append( webSocketLabel, $("<td>").append( webSocketPort ).css({ textAlign:'left' }) );
          outputTypeRow.append( outputTypeLabel, $("<td>").append( outputType ).css({ textAlign:'left' }) );
      
          t.append(nameRow, directoryRow, webServerRow, webSocketRow, outputTypeRow);
          t.css({ textAlign:'right' })
      
          var bigdiv = $("<div>").css({
            backgroundColor:'rgba(255,255,255,.8)',
            width:'100%',
            height:'100%',
            position:'absolute',
            top:0,
            left:0,
            display:'block'
          })
      
          var d = $("<div>");
      
          d.css({
            backgroundColor:'#efefef',
            border:'1px solid #ccc',
            'box-shadow': '5px 5px 5px #888888',
            display:'block',
            width:'450px',
            padding:'1em',
          })
      
          d.append( $("<h2>Create a Server</h2>").css({ marginTop: 0 }) )
          d.append( $("<p>You must select an output message format and a server directory to create a server.</p>").css({ fontSize: '.9em' }) )
          d.append( t )
      
          d.append( $("<button id='submitButton'>Submit</button>").css({ float:'right' }).attr('disabled', true) );
      
          d.append( $("<button>Cancel</button>").css({ float:'right' }).click( function() { bigdiv.remove(); } ) );
      
          bigdiv.append( d );
          $(d).center();
      
          $("body").append( bigdiv );
      
          $("#submitButton").click( function() {
            console.log("click!")
            var infoTable = $( '<table>' )
              .css({ border:'none' })
              .addClass('infoTable')
              .append( $("<tr>").append( $("<td>").text('Name'), $("<td>").text(name.val() ) ) ) 
              .append( $("<tr>").append( $("<td>").text('Directory'), $("<td>").text( directory.val() ) ) ) 
              .append( $("<tr>").append( $("<td>").text('Web Server Port'), $("<td>").text(webServerPort.val()) ) )
              .append( $("<tr>").append( $("<td>").text('Web Socket Port'), $("<td>").text( webSocketPort.val()) ) ) 
              .append( $("<tr>").append( $("<td>").text('Output Message Format'), $("<td>").text( outputType.val()) ) ); 


            if( outputType.val() === 'OSC' ) {
              _srv = global.interface.makeServer({
                'name' : name.val(),
                'directory' : directory.val(),
                'webServerPort' : webServerPort.val(),
                'webSocketPort' : webSocketPort.val(),
                'outputType' : outputType.val(),
                'oscInputPort' : oscInputPort.val(),
                'oscOutputPort' : oscOutputPort.val(),
                'oscOutputIP' : oscOutputIP.val(),
              });
          
              infoTable.append( $("<tr>").append( $("<td>").text('OSC Input Port'), $("<td>").text( oscInputPort.val() ) ) );
              infoTable.append( $("<tr>").append( $("<td>").text('OSC Output Port'), $("<td>").text( oscOutputPort.val() ) ) );
              infoTable.append( $("<tr>").append( $("<td>").text('OSC Output IP Address'), $("<td>").text( oscOutputIP.val() ) ) );                    
            }else if( outputType.val() === 'MIDI' ) {
              _srv = global.interface.makeServer({
                name : name.val(),
                directory : directory.val(),
                webServerPort : webServerPort.val(),
                webSocketPort : webSocketPort.val(),
                outputType : outputType.val(),
              });
            }else{
              _srv = global.interface.makeServer({
                name : name.val(),
                directory : directory.val(),
                webServerPort : webServerPort.val(),
                webSocketPort : webSocketPort.val(),
                outputType : outputType.val(),
                webSocketMasterPort : webSocketMasterPort.val(),
              });
              
              infoTable.append( $("<tr>").append( $("<td>").text('WebSocket Master Port'), $("<td>").text( webSocketMasterPort.val() ) ) );
            }
            
            if(_srv !== null ) {
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
        
              bigdiv.remove();
            };
          })
        });

      var rowCount = 0;
      _monitor = {
        postMessage: function(serverName, id, address, typetags, parameters ) {
          var row = $("<tr>")
            .append( $("<td>").text( serverName ) )
            .append( $("<td>").text( id ) )
            .append( $("<td>").text( address ) )
            .append( $("<td>").text( typetags ) )
            .append( $("<td>").text( parameters ) );
        
          $("#monitorTableBody").prepend( row );
          if(rowCount++ > 20) $("#monitorTableBody tr").last().remove();        
        },
    
        addClient : function(client, id, ip, serverName, interfaceName) {
          var row = $("<tr>")
            .append( $("<td>").text( id ) )
            .append( $("<td>").text( ip ) )
            .append( $("<td>").text( serverName ) )        
            .append( $("<td>").text( interfaceName ) )
            .append( $("<td>").append( $("<input type='checkbox'>").change(
              function() {
                if( $(this).is(':checked') ) {
                  client.shouldMonitor = true;
                }else{
                  client.shouldMonitor = false;
                }
              }
            )
          ));
      
          Object.defineProperty(client, 'interfaceName', {
            get : function() { return interfaceName; },
            set : function(_v) { 
              interfaceName = _v;
              $( row ).children()[3].text( interfaceName );
            }
          })
          $("#clientsTableBody").append( row );
      
          return row;
        },
      };  
    },
    handleMsgToClients : function( server, address, parameters ) {
      var split = address.split("/"),
          sendToAll = true,
          msg
          
      if( split[1] === 'clients') {
        var clientNum = split[2],
            remote = null;
        
        address = "/" + split.slice(3).join('/')
            
        msg = { type:'webSocket', address:address, body:parameters }
        if( typeof msg.body !== 'undefined' ) {  msg.parameters = msg.body;  }   
      
        if(clientNum !== '*') {
          clientNum = parseInt(clientNum)
          remote = global.interface.getClientById( server, clientNum )
  
          if(remote !== null && remote.readyState === 1 ) {
            remote.send( JSON.stringify( msg ) );
          }
          sendToAll = false
        }
      }
       
      if( sendToAll ) {
        msg = { type:'webSocket', address:address, body:parameters }
         
        if( typeof msg.body !== 'undefined' ) {  msg.parameters = msg.body;  }   
         
        for( var key in server.clients ) {
          var client = server.clients[ key ]
          if( client && client.readyState === 1 ) {
            client.send( JSON.stringify( msg ) );
          }
        }
      }
    },
    handleMsgFromClients : function( server, address, args, socket) {
      if(args.type === 'osc') {
        var split = args.address.split("/");
  
        if( split[1] === 'clients') { // message is addressed to another client
          global.interface.handleMsgToClients( server, address, parameters)
        }else{
          if( server.shouldAppendID ) {
            args.typetags +='i';
            args.parameters.push( socket.id );
          }
      
          if( server.shouldMonitor || socket.shouldMonitor ) {
            _monitor.postMessage(server.name, socket.id, args.address, args.typetags, args.parameters );
          }

          if(server.outputType === 'OSC') {
            server.oscOutput.send( args.address, args.typetags, args.parameters );
          }else{
            if( server.master !== null) { // must check to see if master application has connected
              server.master.send( JSON.stringify(args) );
            }else{
            }
          }
        }
      }else if( args.type === 'midi' ) {
        if(args.midiType !== 'programchange') {
          midiOutput.sendMessage([ midiNumbers[ args.midiType ] + args.channel, args.number, Math.round(args.value) ])
          if( server.shouldMonitor || socket.shouldMonitor ) {
            _monitor.postMessage(server.name, socket.id, args.midiType, args.channel, args.number + " : " + Math.round(args.value)  );
          }
        }else{
          midiOutput.sendMessage([ 0xC0 + args.channel, args.number ])
          if( server.shouldMonitor || socket.shouldMonitor ) {
            _monitor.postMessage(server.name, socket.id, args.midiType, args.channel, args.number  );
          }
        }
      }
    },
    getClientById : function( server, id ) {
      for( var key in server.clients ) {
        var client = server.clients[ key ]
        if( client.id === id ) { 
          return client
        }
      }
      console.log(" RETURNING NULL ")
      return null
    },
    assignSocketID : function( server, socket ) {
      if( typeof server.clients[ socket.ip ] !== 'undefined' ) {
        socket.id = server.clients[ socket.ip ].id
        server.clients[ socket.ip ] = socket
      }else{
        server.clients[ socket.ip ] = socket
        socket.id = server.clientCount++
      }
      // for(var i = 0; i < server.clients.length; i++) {
      //   if(typeof server.clients[i] !== 'undefined') {
      //     if(server.clients[i].ip === socket.ip) {
      //       found = true;
      //       socket.id = server.clients[i].id;
      //       break;
      //     }
      //   }
      // }
      
      // if(!found) {
      //   var id;
      //   for(var i = 0; i <= server.clients.length; i++) {
      //     if(typeof server.clients[i] === 'undefined') {
      //       id = i;
      //       break;
      //     }
      //   }
      //   socket.id = id;
      //   server.clients.push( socket );
      // }
    },
    clientClose : function( server, socket ) {
      if(server.outputType === 'OSC')  {
        server.oscOutput.send( '/deviceDisconnected', 'i', [ socket.id ] );
      }else if( server.outputType === 'WebSocket' ) {
        if( server.master !== null) {
          var msg = JSON.stringify({ type:'osc', address:'/deviceDisconnected', typetags:'i', parameters:[ socket.id ] })
          server.master.send( msg ) 
        }
      }
      
      // for( var i = server.clients.length - 1; i >= 0; i++) {
      //   if( server.clients[ i ].id === socket.id ) {
      //     server.clients.splice( i, 1 )
      //     break;
      //   }
      // }
      // elete server.clients[ socket.id ];
      $(socket.row).remove();
    },
    sendClientConnectionNotification : function( server, id ) {
      if(server.outputType === 'OSC') {
        server.oscOutput.send( '/deviceConnected', 'i', [ id ] );
      }else if( server.outputType === 'WebSocket' ) {
        if( server.master !== null ) {
          var msg = JSON.stringify({ type:'osc', address:'/deviceConnected', typetags:'i', parameters:[ id ] })
            
          server.master.send( msg ) 
        }
      }
    },
    createWebSocketListener : function( server ) {
      server.webSocket.on( 'connection', function (socket) {
        var found = false;
    
        socket.shouldMonitor = false;
        socket.ip = socket._socket.remoteAddress;
        socket.interfaceName = fetchingInterface;
        
        global.interface.assignSocketID( server, socket );

        socket.on( 'message', function( obj ) {
          var args = JSON.parse( obj );
          global.interface.handleMsgFromClients( server, args.address, args, socket )
        })

        socket.on('close', function() { global.interface.clientClose( server, socket ); } )
        
        global.interface.sendClientConnectionNotification( server, socket.id );

        socket.row = _monitor.addClient(socket, socket.id, socket.ip, server.name, socket.interfaceName); 
      });
    },
    makeServer : function( serverProps ) {
      var clients           = {},
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
            shouldAppendID: false,
            shouldMonitor : false,
            clients       : clients,
            masterSocket  : null,
            livecode      : false,
            clientCount   : 0,
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
        server.listener = (server.webSocketMasterPort === WEBSOCKET_ADMIN_PORT) ? global.interface.websocketAdminIn : new ws.Server({ port:server.webSocketMasterPort });
        server.clients = clients
        console.log( 'LISTENING ON', server.listener.port ) 
        server.listener.on( 'connection', function (connectedSocket) {
          server.master = connectedSocket;
          console.log("MASTER IS CONNECTED") 
          server.master.ip = server.master._socket.remoteAddress;
                    
          server.master.on( 'message', function( obj ) {
            var args = JSON.parse( obj )
            global.interface.handleMsgToClients( server, args.address, args )
          });
      
        })
      }else if( server.outputType === 'OSC' ){
        server.oscOutput = new omgosc.UdpSender( server.oscOutputIP, server.oscOutputPort );
        
        if(global.interface.portsInUse.indexOf( server.oscInputPort ) === -1) {
          // don't open a new port if the admin port is the same as the desired input port
          server.oscInput = server.oscInputPort === OSC_ADMIN_PORT ?  global.interface.oscAdminIn : new omgosc.UdpReceiver( server.oscInputPort )
          global.interface.portsInUse.push( server.oscInputPort ); 
        }else{
          alert('there is already a service runnning on port ' + server.oscInputPort + '. please choose another port for osc input.');
          return;
        }        
      }else{
        if( !midiInit ) {
          midiOutput = new midi.output();
          midiOutput.openVirtualPort( "Interface.Server Output" );
          midiInit = true;
        }
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
          server.name = 'livecode';
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
          global.interface.portsInUse.splice( global.interface.portsInUse.indexOf( server.webSocketPort ), 1 );
          server.webSocket.close();
        }
        return;
      }

      global.interface.createWebSocketListener( server );
      
      if(server.outputType === 'OSC') {
        server.oscInput.on('', function(args) {
          // console.log( 'MSG RECEVIED ' + args.path + ' : CLIENTS COUNT ' + server.clients.length )
          var split = args.path.split("/");
          if(split[1] === 'clients') {
            var msg = {},
                clientNum = parseInt(split[2]),
                address = "/" + split.slice(3).join('/'),
                remote = null;
    
            msg.address = address;
            msg.typetags = args.typetag;
            msg.parameters = args.params;
            msg.type = 'osc'
            
            for(var i = 0; i < server.clients.length; i++) {
              if( server.clients[i].id === clientNum ) {
                remote = server.clients[i];
                break;
              }
            }
    
            if(remote !== null)
              remote.send( JSON.stringify( msg ) );
          }else{
            for(var key in server.clients) {
              // console.log( 'CLIENT ' + key ) 
              var client = server.clients[key];
              client.send( JSON.stringify({ type:'osc', address:args.path, typetags:args.typetag, parameters:args.params }) );
            }
          }
        });
        server.oscOutput.send( '/serverCreated', 's', [ server.name ] ); 
      }else if( server.outputType === 'WebSocket' ) {
        if( server.master !== null ) { 
          this.connectMaster( server.master ) 
        }
      }

      global.interface.servers.push( server );
      
      return server;
    },
    
    masterSocketMsg : function( args ) {
      var msg = JSON.parse( args ),
          split = msg.address ? msg.address.split("/") : null
      console.log(" MASTER SOCKET MESSAGE ")  
      msg.type = 'webSocket'
      
      if( split !== null && split[1] === 'clients') {
        var clientNum = split[2],
            address = "/" + split.slice(3).join('/'),
            remote = null;
        console.log( args ) 
        msg.address = address;
        
        if(clientNum === '*') {
          for(var i = 0; i < this.server.clients.length; i++) {
            this.server.clients[i].send( JSON.stringify(msg) );
          }
        }else{
          clientNum = parseInt(clientNum)
  
          for(var i = 0; i < this.server.clients.length; i++) {
            if( this.server.clients[i].id == clientNum ) { // deliberate ==
              // console.log( "SENDING", clientNum )
              remote = this.server.clients[i];
              break;
            }
          }
  
          if(remote !== null) {
            remote.send( JSON.stringify( msg ) );
          }
        }
      }else{
        for(var i = 0; i < this.server.clients.length; i++) {
          this.server.clients[i].send( JSON.stringify(msg) );
        }
      }
    },
    
    connectMaster : function( master ) {
      global.interface.livecodeServer.master = master
      master.on( 'message', global.interface.masterSocketMsg )
      console.log( "Master connected!!!" )
    }
  };
  
  global.interface.init();
  
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
    '/createLivecodeServer' : function( parameters, options ) {
      console.log( 'LIVECODE', parameters, options )
      // name | dir | serverPort | socketPort | oscOutputPort | oscInputPort | shouldAppend | shouldMonitor
      // global.interface.serverRow({
      //   name: parameters[0] || 'livecode',
      //   directory : parameters[1] || './interfaces',
      //   webServerPort : parameters[2] || 8080,
      //   webSocketPort : parameters[3] || 8081,
      //   oscOutputPort : parameters[4] || 8082,
      //   oscInputPort  : parameters[5] || 8083,
      //   shouldAppendID : false,
      //   shouldMonitor : false,
      //   outputType : 'WebSocket',
      // });
      
      if( global.interface.livecodeServer === null) {
        var srv
        if( options.type === 'WebSocket' ) {
          srv = global.interface.makeServer({
            webSocketPort:  8081,
            webSocketMasterPort: 10001,
            webServerPort: 8080,
            outputType: 'WebSocket',
            shouldAppendID: true,
            shouldMonitor : false,
            clients       : [],
            livecode      : true,
          })

          options.socket.server = srv
          srv.master = options.socket
        }else if( options.type === 'OSC' ) {
          srv = global.interface.makeServer({
            webSocketPort:  8081,
            oscInPort: parameters[1] || 10000,
            oscOutputPort: parameters[0] || 8082,
            webServerPort: 8080,
            outputType: 'OSC',
            shouldAppendID: true,
            shouldMonitor : false,
            clients       : [],
            livecode      : true,
          })
        }
        console.log( "SERVER IS MADE", srv.oscOutputPort )
        global.interface.livecodeServer = srv      
      }else{
        console.log( "DIDN't make server")
        return
      }
      
      global.interface.appendLivecodeRow()
    }
  }

  global.interface.oscAdminIn.on('', function(args) {
    if(args.path in __admin) {
      __admin[ args.path ]( args.params, { type:'OSC' } );
    }else{
      global.interface.handleMsgToClients( global.interface.livecodeServer, args.path, args.params )
    }
  });
  
  global.interface.websocketAdminIn.on('connection', function(socket) {
    console.log("Admin connection made.")
    socket.on('message', function(msg) {
      var args = JSON.parse( msg ),
          address = args.address,
          parameters = args.parameters,
          options = { 'socket': socket, type:'WebSocket' }

      if( address in __admin ) {
        __admin[ address ]( parameters, options )
      }else{
        global.interface.handleMsgToClients( global.interface.livecodeServer, address, parameters )
      }
    })
  });
  // console.log( global.interface.websocketAdminIn )

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
}
