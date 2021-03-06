var http = require("http");
var fs = require("fs");
var websocket = require("websocket").server;

var port = 1234;
var webrtc_clients = [];
var webrtc_discussions = {};

// 웹서버 기능
var http_server = http.createServer(function(request, response) {
  var matches = undefined;
  if (matches = request.url.match("^/images/(.*)")) {
    var path = process.cwd()+"/images/"+matches[1];
    fs.readFile(path, function(error, data) {
      if (error) {
        log_error(error);
      } else {
        response.end(data);
      }
    });
  } else {
    response.end(page);
  }
});

http_server.listen(port, function(){
  log_comment("server listening (port " + port + ")");
});

var page = undefined;
//fs.readFile("basic_video_call.html", function(error, data){
//  if(error){
//    log_error(error);
//  }else{
//    page = data;
//  }
//});

// 웹소켓 함수 구현
var websocket_server = new websocket({
  httpServer: http_server
});

websocket_server.on("request", function(request){
  log_comment("new request (" + request.origin + ")");

  var connection = request.accept(null, request.origin);
  log_comment("new connection (" + connection.remoteAddress + ")");

  webrtc_clients.push(connection);
  connection.id = webrtc_clients.length - 1;

  // 시그널링 메시지를 처리하는 함수 정의
  connection.on("message", function(message){
    if(message.type === "utf8"){
      log_comment("got message " + message.utf8Data);

      var signal = undefined;
      try{
        signal = JSON.parse(message.utf8Data);
      }catch(e){ };

      if(signal){
        if(signal.type === "join" && signal.token !== undefined){
          try{
            if(webrtc_discussions[signal.token] === undefined){
              webrtc_discussions[signal.token] = {};
            }
          }catch(e){};

          try {
            webrtc_discussions[signal.token][connection.id] = true;
          }catch(e){};
        }else if(signal.token !== undefined){
          try{
            Object.keys(webrtc_discussions[signal.token]).forEach(function(id){
              // 자기 자신이 아닌 다른 peer에게만 메시지 전송.
              if(id != connection.id){
                webrtc_clients[id].send(message.utf8Data, log_error); // TODO 여기서 상대방에게 메시지를 보낸다.
              }
            });
          }catch(e){}
        }else{
          log_comment("invalid signal: " + message.utf8Data);
        }
      }else{
        log_comment("invalid signal: " + message.utf8Data);
      }
    }
  });
});

connection.on("close", function(connection) {
  log_comment("connection closed ("+connection.remoteAddress+")");
  Object.keys(webrtc_discussions).forEach(function(token) {
    Object.keys(webrtc_discussions[token]).forEach(function(id) {
      if (id === connection.id) {
        delete webrtc_discussions[token][id];
      }
    });
  });
});

// utility functions
function log_error(error) {
  if (error !== "Connection closed" && error !== undefined) {
    log_comment("ERROR: "+error);
  }
}
function log_comment(comment) {
  console.log((new Date())+" "+comment);
}