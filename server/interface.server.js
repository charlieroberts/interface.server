var fs                = require('fs'),
    ws                = require('ws'),
    url               = require('url'),
    connect           = require('connect'),
    omgosc            = require('omgosc'),
    midi              = require('midi'),
    webServerPort     = 8080,
    socketPort        = 8081,
    outPort           = 8082,
    oscInPort         = 8083,
    osc               = new omgosc.UdpSender( '127.0.0.1', outPort ),
    oscIn             = new omgosc.UdpReceiver(oscInPort),
    clients_in        = new ws.Server({ port:socketPort }),
    clients           = [],
    root              = __dirname + "/interfaces",
    midiInit          = false,
    interfaceJS       = null,
    server            = null,
    serveInterfaceJS  = null,
    midiOut           = null,
    midiNumbers       = {
      "noteon"        : 0x90,
      "noteoff"       : 0x80,
      "cc"            : 0xB0,
      "programchange" : 0xC0,
    };

interfaceJS =  fs.readFileSync( '../zepto.js', ['utf-8'] );
interfaceJS += fs.readFileSync( '../interface.js', ['utf-8'] );
interfaceJS += fs.readFileSync( './interface.client.js', ['utf-8'] );

serveInterfaceJS = function(req, res, next){
	req.uri = url.parse( req.url );
  
	if( req.uri.pathname == "/interface.js" ) {
		res.writeHead( 200, {
			'Content-Type': 'text/javascript',
			'Content-Length': interfaceJS.length
		})
		res.end( interfaceJS );
    
		return;
	}
  
  next();
};

server = connect()
  .use( connect.directory( root, { hidden:true,icons:true } ) )
  .use( serveInterfaceJS )
  .use( connect.static(root) )
  .listen( webServerPort );

clients_in.on( 'connection', function (socket) {
  var found = false;
      
  socket.ip = socket._socket.remoteAddress;
  console.log( "device connection received", socket.ip );
  
  for(var i = 0; i < clients.length; i++) {
    if(clients[i].ip === socket.ip) {
      found = true;
      break;
    }
  }
  
  if(!found) {
    socket.id = clients.length;
    console.log("PUSHING", socket.ip)
    clients.push( socket );
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
          for(var i = 0; i < clients.length; i++) {
            clients[i].send( obj );
          }
        }else{
          clientNum = parseInt(clientNum)
        
          for(var i = 0; i < clients.length; i++) {
            if( clients[i].id === clientNum ) {
              remote = clients[i];
              break;
            }
          }
        
          if(remote !== null) {
            remote.send( JSON.stringify( msg ) );
          }
        }
      }else{
        osc.send( args.address, args.typetags, args.parameters );
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
    osc.send( '/deviceDisconnected', 'i', [ socket.id ] );
    delete clients[ socket.id ];
  });
  
  osc.send( '/deviceConnected', 'i', [ socket.id ] ); //socket.id );
});

oscIn.on('', function(args) {
  var split = args.path.split("/");
  if(split[1] === 'clients') {
    var msg = {},
        clientNum = parseInt(split[2]),
        address = "/" + split.slice(3).join('/'),
        remote = null;;
    
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