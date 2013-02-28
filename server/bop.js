var fs                = require('fs'),
    ws                = require('ws'),
    url               = require('url'),
    connect           = require('connect'),
    omgosc            = require('omgosc'),
    midi              = require('midi'),
    webServerPort     = 8080,
    socketPort        = 8081,
    oscOutPort        = 8082,
    oscInPort         = 8083,
    osc               = new omgosc.UdpSender( '127.0.0.1', oscOutPort ),
    clients_in        = new ws.Server({ port:socketPort }),
    clients           = [],
    root              = __dirname + "/interfaces",
    interfaceJS       = null,
    server            = null,
    serveInterfaceJS  = null,
    master            = null,
    numberOfPerformers= null;

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
  
var hasPicked = [];
clients_in.on( 'connection', function (socket) {
  //socket.ip = socket._socket.remoteAddress;
  console.log("CONNECTION");
  
  socket.on( 'message', function( obj ) {
    var args = JSON.parse( obj );
    
    if(args.type === 'osc') {
      if(args.address === '/master') {
        console.log( 'MASTER RECEIVED' );
        numberOfPerformers = args.parameters[0];
        console.log(args.parameters[0]);
        master = socket;
      }else{
        console.log( 'ADVANCE !' )
        if(master !== null)
          master.send( 'advance' );
      }
		}
  });
  
  var pick = Math.ceil(Math.random() * numberOfPerformers);
  var pickCount = 0;
  while(hasPicked.indexOf(pick) > -1) {
    pick = Math.ceil(Math.random() * numberOfPerformers);
    if(pickCount++ > 50) break;
  }
  hasPicked.push(pick);
  socket.send( ''+pick );
});
