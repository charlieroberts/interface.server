#Using the Interface.js Server

![Screenshot](https://raw.github.com/charlieroberts/interface.server/screenshots/server_screenshot.png) 

This project is designed as a server for interfaces created with [Interface.js][interfacejs]. The Interface.js Server has a number of purposes
  1) it serves interfaces to any browsers on the local area network
  2) it translates network messages from your browser into OSC or MIDI messages.
  3) it allows you to monitor connections and dataflow
  
Prebuilt binaries of the server are available for OS X and Windows [here][binaries]. If you want to build the server from source or are using Linux, you'll need to download and install [node.js][nodejs]. Node.js will provide most of the functionality we need to serve web pages, but we'll also need to add a few utility libraries to send OSC and MIDI and carry out a few other specialized tasks. We can install these utilities using the Node Package Manager, or NPM, which is installed with Node.js. After installing Node.js, open a terminal and run the following commands:

```
npm install midi
npm install omgosc
npm install connect
npm install ws
```

The last step is to download [node-webkit][node-webkit]. Node-webkit enables desktop applications to be built using web technologies. Once you have Node-webkit installed, place this directory in the same location. You can then open the server as follows:

```
./nw projectDirectoryName
```

Upon opening the server, hit the "New Server" button. Configure the server by selecting a port for it to serve web pages on, a port to communicate over web sockets, and a port to receive and send OSC on. You should also select the directory containing your Interface.js interface files. Once this is complete, check the enabled box and the server will begin to run.

Now you can open up a mobile device and type the name of the computer that the server is running on and add a .local to the url to tell the browser the destination is on the local network. Finally, add the port that you configured the server to serve web pages on (default 8080). For example, if your computer's name is foo:

http://foo.local:8080

You should then be presented with a list of interfaces to choose from. Selecting any file in your browser will run the interface and the Interface server will transmit any messages it receives into either OSC messages or MIDI messages that leave the virtual midi output named "Interface Out".

To define widgets that send OSC messages, simply set their target to be "OSC" and their key to be the OSC address you would like them to output to. For example, to send a message to /speed we could create the following slider

```javascript
a = new Interface.Slider({
  bounds:[0,0,1,1],
  target:"OSC", key:'/speed',
});
```

For MIDI, we specify a target of "MIDI" instead of Interface.OSC. For the key, we pass an array specifying the type of message we want to send, the channel it should go out on and the number of the message. It's also important to limit the range of widgets to valid MIDI values between 0 - 127. Possible message types currently include 'noteon', 'noteoff', 'cc' and 'programchange'. For example, to create a button that outputs NoteOn on channel 1, number 64 we would use:

```javascript
a = new Interface.Button({
  bounds:[0,0,1,1],
  min:0, max:127,
  target:"MIDI", key:['noteon', 0, 64],
});
```

The server directory comes with a couple of simple test files to experiment with MIDI and OSC, MIDI_test.htm and OSC_test.htm.

[nodejs]:http://nodejs.org
[npm]:http://nodejs.org/download/
[node-webkit]:https://github.com/rogerwang/node-webkit
[interfacejs]:https://github.com/charlieroberts/interface.js
[binaries]:http://www.charlie-roberts.com/interface/build
