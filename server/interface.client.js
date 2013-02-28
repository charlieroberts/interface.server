var expr = /[-a-zA-Z0-9.]+(:(6553[0-5]|655[0-2]\d|65[0-4]\d{2}|6[0-4]\d{3}|[1-5]\d{4}|[1-9]\d{0,3}))/,
    socketIPAndPort = expr.exec( window.location.toString() )[0].split(":"), 
    socketString = 'ws://' + socketIPAndPort[0] + ':' + ( parseInt( __socketPort ) );

Interface.Socket = new WebSocket( socketString );

Interface.Socket.onmessage = function (event) {
  Interface.OSC._receive( event.data );
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
      this.socket.send(JSON.stringify(obj));
    }else{
      console.log("INVALID OSC MESSAGE FORMATION", arguments);
    }
  },
  _receive : function( data ) {
    var msg = JSON.parse( data );
    this.receive( msg.address, msg.typetags, msg.parameters );
  },
  receive : function(address, typetags, parameters) {},
};

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