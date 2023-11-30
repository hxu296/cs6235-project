const express = require("express");
const http = require("http");
const app = express();
const server = http.createServer(app);
const socket = require("socket.io");
const io = socket(server);

const users = {};

io.on('connection', (socket)=> {
    // try to retrieve id from query string
    let id = socket.handshake.query.id;
    if (id) {
        users[id] = id;
    } else {
        id = socket.id;
        users[id] = id;
    }
    socket.emit("yourID", id);
    io.sockets.emit("allUsers", users);
    socket.on('disconnect', () => {
        delete users[id];
    })

    socket.on("callUser", (data) => {
        io.to(data.userToCall).emit('hey', {signal: data.signalData, from: data.from});
    })

    socket.on("acceptCall", (data) => {
        io.to(data.to).emit('callAccepted', data.signal);
    })
});

server.listen(8000, () => console.log('server is running on port 8000'));


